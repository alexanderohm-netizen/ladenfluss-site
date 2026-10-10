begin;
select set_config('test.billing_owner',gen_random_uuid()::text,true),
 set_config('test.lease_a',gen_random_uuid()::text,true),set_config('test.lease_b',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at) values(current_setting('test.billing_owner')::uuid,'billing-test@example.invalid',now());
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.billing_owner'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.companies(name,created_by) values('Billing test',auth.uid());
select set_config('test.billing_company',id::text,true) from public.companies;
do $$ begin
 begin
  perform public.billing_acquire_lock(current_setting('test.billing_company')::uuid,gen_random_uuid());
  raise exception 'client acquired privileged billing lock';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.billing_customers(company_id,stripe_customer_id) values(current_setting('test.billing_company')::uuid,'cus_Attacker');
  raise exception 'client linked its own Stripe customer';
 exception when insufficient_privilege then null; end;
 begin
  perform * from public.billing_customers;
  raise exception 'client read internal billing records';
 exception when insufficient_privilege then null; end;
 if has_function_privilege('anon','public.billing_finish_event(uuid,uuid,text,jsonb)','execute')
 or has_function_privilege('authenticated','public.billing_finish_event(uuid,uuid,text,jsonb)','execute')
 then raise exception 'public billing webhook RPC'; end if;
end $$;
reset role;
set local role service_role;
insert into public.billing_customers(company_id,stripe_customer_id) values(current_setting('test.billing_company')::uuid,'cus_TestBilling');
do $$ begin
 if not public.billing_acquire_lock(current_setting('test.billing_company')::uuid,current_setting('test.lease_a')::uuid) then raise exception 'first billing lease failed'; end if;
 if public.billing_acquire_lock(current_setting('test.billing_company')::uuid,current_setting('test.lease_b')::uuid) then raise exception 'concurrent billing lease accepted'; end if;
end $$;
select public.billing_save_checkout(current_setting('test.billing_company')::uuid,current_setting('test.lease_a')::uuid,'{"key":"test-attempt"}');
select public.billing_finish_event(current_setting('test.billing_company')::uuid,current_setting('test.lease_a')::uuid,'evt_TestPaid',
 jsonb_build_array(jsonb_build_object('subscription_id','sub_TestBilling','status','active','access_status','active','valid_until',now()+interval '1 day','cancel_at_period_end',false)));
-- Duplicate delivery must not apply a different snapshot.
select public.billing_finish_event(current_setting('test.billing_company')::uuid,current_setting('test.lease_a')::uuid,'evt_TestPaid','[]');
do $$ begin
 if (select count(*) from public.billing_events)<>1 then raise exception 'event not deduplicated'; end if;
 if (select status from public.module_access where company_id=current_setting('test.billing_company')::uuid)<>'active' then raise exception 'duplicate changed access'; end if;
end $$;
reset role;
set local role authenticated;
select public.save_cloud_document(current_setting('test.billing_company')::uuid,'pep','{"shifts":[]}',0);
reset role;
set local role service_role;
select public.billing_finish_event(current_setting('test.billing_company')::uuid,current_setting('test.lease_a')::uuid,'evt_TestCancel','[]');
select public.billing_release_lock(current_setting('test.billing_company')::uuid,current_setting('test.lease_a')::uuid);
reset role;
set local role authenticated;
do $$ begin
 if exists(select 1 from public.cloud_documents where module_key='pep') then raise exception 'canceled customer retained access'; end if;
end $$;
reset role;
set local role service_role;
select public.billing_acquire_lock(current_setting('test.billing_company')::uuid,current_setting('test.lease_a')::uuid);
update public.billing_customers set lease_until=now()-interval '1 second' where company_id=current_setting('test.billing_company')::uuid;
select public.billing_acquire_lock(current_setting('test.billing_company')::uuid,current_setting('test.lease_b')::uuid);
do $$ begin
 begin
  perform public.billing_finish_event(current_setting('test.billing_company')::uuid,current_setting('test.lease_a')::uuid,'evt_StaleWorker','[]');
  raise exception 'expired worker changed access';
 exception when serialization_failure then null; end;
 if exists(select 1 from public.billing_events where event_id='evt_StaleWorker') then raise exception 'stale event acknowledged'; end if;
end $$;
-- An old worker's cleanup must not release the new worker's lease.
select public.billing_release_lock(current_setting('test.billing_company')::uuid,current_setting('test.lease_a')::uuid);
do $$ begin
 if (select lease_token from public.billing_customers where company_id=current_setting('test.billing_company')::uuid)<>current_setting('test.lease_b')::uuid
 then raise exception 'old worker released new lease'; end if;
end $$;
reset role;
rollback;
