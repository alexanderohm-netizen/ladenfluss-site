-- Run in one transaction. All fixtures are rolled back, including auth.users.
begin;
select set_config('test.owner_a',gen_random_uuid()::text,true),set_config('test.owner_b',gen_random_uuid()::text,true);
insert into auth.users(id,email,email_confirmed_at) values
 (current_setting('test.owner_a')::uuid,'cloud-test-a@example.invalid',now()),
 (current_setting('test.owner_b')::uuid,'cloud-test-b@example.invalid',now());
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.owner_a'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.companies(name,created_by) values('Test company A',auth.uid());
select set_config('test.company_a',id::text,true) from public.companies;
select public.save_cloud_document(current_setting('test.company_a')::uuid,'profile','{"currency":"EUR"}',0);
do $$ begin
 if (select count(*) from public.company_members)<>1 then raise exception 'owner membership missing'; end if;
 if (select count(*) from public.branches)<>1 then raise exception 'default branch missing'; end if;
 begin
  perform public.save_cloud_document(current_setting('test.company_a')::uuid,'profile','{}',0);
  raise exception 'stale revision accepted';
 exception when serialization_failure then null; end;
 begin
  perform public.save_cloud_document(current_setting('test.company_a')::uuid,'pep','{}',0);
  raise exception 'unpaid PEP accepted';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.module_access(company_id,module_key,status,valid_until) values(current_setting('test.company_a')::uuid,'pep','active',now()+interval '1 day');
  raise exception 'self activation accepted';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.owner_b'),'role','authenticated')::text,true);
do $$ begin
 if (select count(*) from public.companies)<>0 or (select count(*) from public.cloud_documents)<>0 then raise exception 'tenant data leaked'; end if;
 begin
  perform public.save_cloud_document(current_setting('test.company_a')::uuid,'profile','{}',0);
  raise exception 'cross tenant write accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
insert into public.module_access(company_id,module_key,status,valid_until) values(current_setting('test.company_a')::uuid,'pep','trial',now()+interval '1 day');
select set_config('request.jwt.claims',json_build_object('sub',current_setting('test.owner_a'),'role','authenticated')::text,true);
set local role authenticated;
select public.save_cloud_document(current_setting('test.company_a')::uuid,'pep','{"shifts":[]}',0);
select public.save_cloud_document(current_setting('test.company_a')::uuid,'pep','{"shifts":[]}',1);
reset role;
update public.module_access set valid_until=now()-interval '1 second';
set local role authenticated;
do $$ begin
 if exists(select 1 from public.cloud_documents where module_key='pep') then raise exception 'expired module visible'; end if;
end $$;
set local role anon;
do $$ begin
 begin
  perform * from public.companies;
  raise exception 'anonymous company access accepted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'tenant isolation, owner creation, anonymous denial, entitlement checks, revision conflicts passed' as result;
rollback;
