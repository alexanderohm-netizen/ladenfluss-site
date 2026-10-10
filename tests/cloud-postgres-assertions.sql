-- Execute AFTER the disposable fixture and all three draft SQL files.
-- This script fails the CI job on any unexpected result.
DO $$
BEGIN
 IF has_table_privilege('authenticated','public.cloud_documents','UPDATE') THEN
   RAISE EXCEPTION 'Authenticated has direct UPDATE privilege';
 END IF;
 IF has_table_privilege('authenticated','public.cloud_documents','INSERT') THEN
   RAISE EXCEPTION 'Authenticated has direct INSERT privilege';
 END IF;
 IF has_function_privilege('anon','public.save_cloud_document_if_revision(uuid,text,integer,jsonb)','EXECUTE') THEN
   RAISE EXCEPTION 'Anon can execute cloud save RPC';
 END IF;
 IF has_function_privilege('anon','public.create_cloud_document_if_absent(uuid,text,jsonb)','EXECUTE') THEN
   RAISE EXCEPTION 'Anon can execute cloud creation RPC';
 END IF;
 IF NOT has_function_privilege('authenticated','public.create_cloud_document_if_absent(uuid,text,jsonb)','EXECUTE') THEN
   RAISE EXCEPTION 'Authenticated cannot execute cloud creation RPC';
 END IF;
 IF NOT has_function_privilege('authenticated','public.save_cloud_document_if_revision(uuid,text,integer,jsonb)','EXECUTE') THEN
   RAISE EXCEPTION 'Authenticated cannot execute cloud save RPC';
 END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
DO $$
DECLARE
  saved integer;
  caught boolean;
BEGIN
  SELECT saved_revision INTO saved FROM public.save_cloud_document_if_revision(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vacation',1,'{"days":5}'::jsonb
  );
  IF saved <> 2 THEN RAISE EXCEPTION 'Expected revision 2, got %', saved; END IF;

  IF (SELECT payload->>'days' FROM public.cloud_documents
      WHERE company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND module_key='vacation') <> '5'
  THEN RAISE EXCEPTION 'Cloud payload was not saved'; END IF;

  IF (SELECT count(*) FROM public.cloud_document_history
      WHERE company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        AND module_key='vacation' AND revision=1 AND payload='{"days":2}'::jsonb) <> 1
  THEN RAISE EXCEPTION 'Previous version not archived'; END IF;

  caught := false;
  BEGIN
    PERFORM * FROM public.save_cloud_document_if_revision(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vacation',1,'{"days":99}'::jsonb);
  EXCEPTION WHEN SQLSTATE '40001' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Stale revision was accepted'; END IF;

  caught := false;
  BEGIN
    PERFORM * FROM public.save_cloud_document_if_revision(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vacation',2,'[1,2]'::jsonb);
  EXCEPTION WHEN SQLSTATE '22023' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Array payload was accepted'; END IF;

  caught := false;
  BEGIN
    PERFORM * FROM public.save_cloud_document_if_revision(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vacation',2,
      jsonb_build_object('huge',repeat('ä',600000)));
  EXCEPTION WHEN SQLSTATE '22023' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Oversized payload was accepted'; END IF;

  IF (SELECT count(*) FROM public.cloud_document_history
      WHERE company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 1
  THEN RAISE EXCEPTION 'Failed writes modified history'; END IF;

  SELECT saved_revision INTO saved FROM public.create_cloud_document_if_absent(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','profile','{"name":"Testshop"}'::jsonb);
  IF saved <> 1 THEN RAISE EXCEPTION 'Initial create must be revision 1'; END IF;

  caught := false;
  BEGIN
    PERFORM * FROM public.create_cloud_document_if_absent(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','profile','{"name":"Overwritten"}'::jsonb);
  EXCEPTION WHEN SQLSTATE '23505' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Existing cloud document was overwritten on create'; END IF;
  IF (SELECT payload->>'name' FROM public.cloud_documents
      WHERE company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND module_key='profile') <> 'Testshop'
  THEN RAISE EXCEPTION 'Duplicate create changed existing document'; END IF;
END $$;

-- Cross-tenant access and privilege denial.
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
DECLARE caught boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.save_cloud_document_if_revision(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vacation',2,'{"days":999}'::jsonb);
  EXCEPTION WHEN SQLSTATE '42501' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Cross-tenant write was accepted'; END IF;

  caught := false;
  BEGIN
    PERFORM * FROM public.create_cloud_document_if_absent(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','warenfluss','{"items":1}'::jsonb);
  EXCEPTION WHEN SQLSTATE '42501' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Cross-tenant document creation was accepted'; END IF;

  IF EXISTS(SELECT 1 FROM public.cloud_documents
      WHERE company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
  THEN RAISE EXCEPTION 'Cross-tenant read leaked'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
DO $$
DECLARE caught boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.save_cloud_document_if_revision(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vacation',2,'{"days":999}'::jsonb);
  EXCEPTION WHEN SQLSTATE '42501' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Employee role was allowed to write'; END IF;

  caught := false;
  BEGIN
    PERFORM * FROM public.create_cloud_document_if_absent(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','profile','{"name":"unauthorized"}'::jsonb);
  EXCEPTION WHEN SQLSTATE '42501' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Employee role was allowed to create'; END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','44444444-4444-4444-8444-444444444444',false);
DO $$
DECLARE caught boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.save_cloud_document_if_revision(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vacation',2,'{"days":999}'::jsonb);
  EXCEPTION WHEN SQLSTATE '42501' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Unverified account was allowed to write'; END IF;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);

-- Privileged-write tests prove the guard trigger itself works, independent of RPC.
DO $$
DECLARE caught boolean;
BEGIN
 caught:=false;
 BEGIN
  UPDATE public.cloud_documents SET payload='{"days":6}'::jsonb
  WHERE company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND module_key='vacation';
 EXCEPTION WHEN SQLSTATE '23514' THEN caught:=true;
 END;
 IF NOT caught THEN RAISE EXCEPTION 'Unversioned payload update accepted'; END IF;

 caught:=false;
 BEGIN
  UPDATE public.cloud_documents SET payload='{"days":6}'::jsonb, revision=4
  WHERE company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND module_key='vacation';
 EXCEPTION WHEN SQLSTATE '23514' THEN caught:=true;
 END;
 IF NOT caught THEN RAISE EXCEPTION 'Skipped revision accepted'; END IF;

 caught:=false;
 BEGIN
  UPDATE public.cloud_documents SET company_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
     payload='{"days":6}'::jsonb, revision=3
  WHERE company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND module_key='vacation';
 EXCEPTION WHEN SQLSTATE '23514' THEN caught:=true;
 END;
 IF NOT caught THEN RAISE EXCEPTION 'Identity update accepted'; END IF;

 IF (SELECT revision FROM public.cloud_documents
      WHERE company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' AND module_key='vacation') <> 2
 THEN RAISE EXCEPTION 'Invalid writes changed cloud revision'; END IF;

 IF (SELECT count(*) FROM public.cloud_document_history
      WHERE company_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') <> 1
 THEN RAISE EXCEPTION 'Rejected writes changed history'; END IF;
END $$;

SELECT 'PASS: PostgreSQL cloud RPC + trigger + tenant isolation tests' AS result;
