-- Server-only Stripe records. Browser clients cannot read, link or change billing ownership.
create table public.billing_customers (
 company_id uuid primary key references public.companies(id) on delete cascade,
 stripe_customer_id text not null unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9]+$'),
 checkout_request jsonb check (checkout_request is null or
  (jsonb_typeof(checkout_request)='object' and octet_length(checkout_request::text)<16384)),
 lease_token uuid,
 lease_until timestamptz,
 created_at timestamptz not null default now()
);
create table public.billing_subscriptions (
 subscription_id text primary key check (subscription_id ~ '^sub_[A-Za-z0-9]+$'),
 company_id uuid not null references public.billing_customers(company_id) on delete cascade,
 status text not null check(status in ('active','trialing','past_due','incomplete','incomplete_expired','canceled','unpaid','paused')),
 access_status text not null check(access_status in ('inactive','trial','active')),
 valid_until timestamptz,
 cancel_at_period_end boolean not null,
 updated_at timestamptz not null default now(),
 check ((access_status='inactive' and valid_until is null) or (access_status<>'inactive' and valid_until is not null))
);
create index billing_subscriptions_company_idx on public.billing_subscriptions(company_id);
create table public.billing_events (
 event_id text primary key check(event_id ~ '^evt_[A-Za-z0-9]+$'),
 company_id uuid not null references public.billing_customers(company_id) on delete cascade,
 processed_at timestamptz not null default now()
);
create index billing_events_company_idx on public.billing_events(company_id);
alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_events enable row level security;
revoke all on public.billing_customers,public.billing_subscriptions,public.billing_events from public,anon,authenticated;
grant select,insert,update on public.billing_customers to service_role;
grant select,insert,delete on public.billing_subscriptions to service_role;
grant select,insert on public.billing_events to service_role;
grant select,insert,update on public.module_access to service_role;

-- Serializes Checkout and reconciliation per company. A new lease fences out expired workers.
create function public.billing_acquire_lock(target uuid, lease uuid)
returns boolean language plpgsql security invoker set search_path=''
as $$ begin
 if lease is null then raise exception 'invalid_lease' using errcode='22023'; end if;
 update public.billing_customers set lease_token=lease,lease_until=clock_timestamp()+interval '120 seconds'
 where company_id=target and (lease_until is null or lease_until<clock_timestamp());
 return found;
end $$;
create function public.billing_release_lock(target uuid, lease uuid)
returns void language sql security invoker set search_path=''
as $$ update public.billing_customers set lease_token=null,lease_until=null where company_id=target and lease_token=lease $$;
create function public.billing_save_checkout(target uuid, lease uuid, request jsonb)
returns void language plpgsql security invoker set search_path=''
as $$ begin
 update public.billing_customers set checkout_request=request
 where company_id=target and lease_token=lease and lease_until>clock_timestamp();
 if not found then raise exception 'billing_lease_lost' using errcode='40001'; end if;
end $$;

-- Store event completion and derived access atomically. No client-writable metadata is consulted.
create function public.billing_finish_event(target uuid, lease uuid, event_id text, snapshot jsonb)
returns void language plpgsql security invoker set search_path=''
as $$ declare account public.billing_customers; grant_row record; begin
 select * into account from public.billing_customers where company_id=target for update;
 if account.lease_token is distinct from lease or lease is null or account.lease_until<=clock_timestamp() then
  raise exception 'billing_lease_lost' using errcode='40001';
 end if;
 if exists(select 1 from public.billing_events e where e.event_id=billing_finish_event.event_id) then return; end if;
 if snapshot is null or jsonb_typeof(snapshot)<>'array' or jsonb_array_length(snapshot)>1000 then
  raise exception 'invalid_snapshot' using errcode='22023';
 end if;
 delete from public.billing_subscriptions where company_id=target;
 insert into public.billing_subscriptions(subscription_id,company_id,status,access_status,valid_until,cancel_at_period_end)
 select s.subscription_id,target,s.status,s.access_status,s.valid_until,s.cancel_at_period_end
 from jsonb_to_recordset(snapshot) as s(subscription_id text,status text,access_status text,valid_until timestamptz,cancel_at_period_end boolean);
 select access_status,valid_until into grant_row from public.billing_subscriptions
 where company_id=target and access_status in ('trial','active') and valid_until>now()
 order by valid_until desc,access_status='active' desc limit 1;
 insert into public.module_access(company_id,module_key,status,valid_until)
 values(target,'pep',coalesce(grant_row.access_status,'inactive'),grant_row.valid_until)
 on conflict(company_id,module_key) do update set status=excluded.status,valid_until=excluded.valid_until;
 insert into public.billing_events(event_id,company_id) values(billing_finish_event.event_id,target);
end $$;
revoke all on function public.billing_acquire_lock(uuid,uuid) from public,anon,authenticated;
revoke all on function public.billing_release_lock(uuid,uuid) from public,anon,authenticated;
revoke all on function public.billing_save_checkout(uuid,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.billing_finish_event(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.billing_acquire_lock(uuid,uuid) to service_role;
grant execute on function public.billing_release_lock(uuid,uuid) to service_role;
grant execute on function public.billing_save_checkout(uuid,uuid,jsonb) to service_role;
grant execute on function public.billing_finish_event(uuid,uuid,text,jsonb) to service_role;
