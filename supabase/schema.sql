-- Ladenfluss cloud foundation. Applied to the new project only.
-- Browser access uses a publishable key + user JWT, never service_role.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.companies (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(trim(name)) between 1 and 120),
 created_by uuid not null unique references auth.users(id) on delete restrict,
 created_at timestamptz not null default now()
);
create table public.company_members (
 company_id uuid not null references public.companies(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','admin','manager','employee')),
 status text not null default 'active' check (status in ('active','disabled')),
 primary key(company_id,user_id)
);
create index company_members_user_idx on public.company_members(user_id,company_id);
create table public.branches (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 1 and 120),
 timezone text not null default 'Europe/Berlin' check (timezone='Europe/Berlin'),
 unique(company_id,id)
);
create table public.module_access (
 company_id uuid not null references public.companies(id) on delete cascade,
 module_key text not null check (module_key in ('pep','zahlenfluss','warenfluss')),
 status text not null default 'inactive' check(status in ('inactive','trial','active')),
 valid_until timestamptz,
 primary key(company_id,module_key)
);
create table public.cloud_documents (
 company_id uuid not null references public.companies(id) on delete cascade,
 module_key text not null check (module_key in ('profile','vacation','pep','zahlenfluss','warenfluss')),
 payload jsonb not null check (jsonb_typeof(payload)='object' and octet_length(payload::text)<=1048576),
 revision integer not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),
 primary key(company_id,module_key)
);

-- Internal lookup avoids recursive membership policies. No editable JWT metadata.
create function private.has_role(target uuid, roles text[])
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null and exists (
 select 1 from public.company_members where company_id=target and user_id=(select auth.uid())
 and status='active' and role=any(roles)) $$;
create function private.module_allowed(target uuid, requested text)
returns boolean language sql stable security definer set search_path=''
as $$ select auth.uid() is not null
 and private.has_role(target,array['owner','admin','manager'])
 and (requested in ('profile','vacation') or exists (
 select 1 from public.module_access where company_id=target and module_key=requested
 and status in ('active','trial') and valid_until>now())) $$;
create function private.new_company()
returns trigger language plpgsql security definer set search_path=''
as $$ begin
 if auth.uid() is null or new.created_by<>auth.uid() then raise insufficient_privilege; end if;
 insert into public.company_members values(new.id,new.created_by,'owner','active');
 insert into public.branches(company_id,name) values(new.id,'Hauptfiliale');
 return new;
end $$;
create trigger new_company after insert on public.companies for each row execute function private.new_company();
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.has_role(uuid,text[]) to authenticated;
grant execute on function private.module_allowed(uuid,text) to authenticated;

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.branches enable row level security;
alter table public.module_access enable row level security;
alter table public.cloud_documents enable row level security;
revoke all on public.companies,public.company_members,public.branches,public.module_access,public.cloud_documents from anon,authenticated;
grant select on public.companies,public.company_members,public.branches,public.module_access,public.cloud_documents to authenticated;
grant insert(name,created_by) on public.companies to authenticated;
grant update(name) on public.companies to authenticated;
grant update(name) on public.branches to authenticated;
grant insert(company_id,module_key,payload),update(payload,revision,updated_at) on public.cloud_documents to authenticated;

create policy company_read on public.companies for select to authenticated using(private.has_role(id,array['owner','admin','manager','employee']));
create policy company_create on public.companies for insert to authenticated with check(created_by=(select auth.uid()) and coalesce((select auth.jwt())->>'is_anonymous','false')='false');
create policy company_edit on public.companies for update to authenticated using(private.has_role(id,array['owner','admin'])) with check(private.has_role(id,array['owner','admin']));
create policy member_read on public.company_members for select to authenticated using(user_id=(select auth.uid()));
create policy branch_read on public.branches for select to authenticated using(private.has_role(company_id,array['owner','admin','manager','employee']));
create policy branch_edit on public.branches for update to authenticated using(private.has_role(company_id,array['owner','admin'])) with check(private.has_role(company_id,array['owner','admin']));
create policy access_read on public.module_access for select to authenticated using(private.has_role(company_id,array['owner','admin','manager']));
create policy document_read on public.cloud_documents for select to authenticated using(private.module_allowed(company_id,module_key));
create policy document_create on public.cloud_documents for insert to authenticated with check(private.module_allowed(company_id,module_key));
create policy document_edit on public.cloud_documents for update to authenticated using(private.module_allowed(company_id,module_key)) with check(private.module_allowed(company_id,module_key));

-- Atomic compare-and-swap for multiple devices; runs as caller with RLS intact.
create function public.save_cloud_document(target uuid, requested text, document jsonb, expected_revision integer)
returns public.cloud_documents language plpgsql security invoker set search_path=''
as $$ declare saved public.cloud_documents; begin
 if expected_revision is null or expected_revision<0 then raise exception 'invalid_revision' using errcode='22023'; end if;
 if expected_revision=0 then
  insert into public.cloud_documents(company_id,module_key,payload) values(target,requested,document)
  on conflict do nothing returning * into saved;
 else
  update public.cloud_documents set payload=document,revision=revision+1,updated_at=now()
  where company_id=target and module_key=requested and revision=expected_revision returning * into saved;
 end if;
 if saved.company_id is null then raise exception 'revision_conflict_or_no_access' using errcode='40001'; end if;
 return saved;
end $$;
revoke all on function public.save_cloud_document(uuid,text,jsonb,integer) from public,anon,authenticated;
grant execute on function public.save_cloud_document(uuid,text,jsonb,integer) to authenticated;
