-- Disposable PostgreSQL assertions for the atomic company-onboarding draft.
DO $$
BEGIN
 IF has_table_privilege('authenticated','public.companies','INSERT')
    OR has_table_privilege('authenticated','public.branches','UPDATE') THEN
   RAISE EXCEPTION 'Direct company/branch client mutation unexpectedly granted';
 END IF;
 IF has_function_privilege('anon','public.create_company_onboarding(text,text,text,integer,numeric)','EXECUTE') THEN
   RAISE EXCEPTION 'Anonymous user can invoke onboarding';
 END IF;
 IF NOT has_function_privilege('authenticated','public.create_company_onboarding(text,text,text,integer,numeric)','EXECUTE') THEN
   RAISE EXCEPTION 'Authenticated user cannot invoke onboarding';
 END IF;
END $$;

SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','55555555-5555-4555-8555-555555555555',false);

DO $$
DECLARE
  created_company uuid;
  created_branch uuid;
  caught boolean := false;
BEGIN
  SELECT company_id,branch_id INTO created_company,created_branch
  FROM public.create_company_onboarding(' Testladen  ','Lebensmittel',
                                       ' Innenstadt  ',6,9.5);

  IF created_company IS NULL OR created_branch IS NULL THEN
    RAISE EXCEPTION 'Onboarding did not create both company and branch';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.companies
    WHERE id=created_company AND name='Testladen'
      AND retail_type='Lebensmittel'
      AND created_by='55555555-5555-4555-8555-555555555555') THEN
    RAISE EXCEPTION 'Company data incorrect';
  END IF;

  IF NOT EXISTS(SELECT 1 FROM public.branches
    WHERE id=created_branch AND company_id=created_company
      AND name='Innenstadt' AND opening_days=6 AND opening_hours=9.5) THEN
    RAISE EXCEPTION 'Starter branch data incorrect';
  END IF;

  caught := false;
  BEGIN
    PERFORM * FROM public.create_company_onboarding(
      'Second Shop','Elektronik','Main',5,8);
  EXCEPTION WHEN SQLSTATE '23505' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Duplicate company onboarding accepted'; END IF;

  IF (SELECT count(*) FROM public.companies
      WHERE created_by='55555555-5555-4555-8555-555555555555') <> 1
  THEN RAISE EXCEPTION 'Duplicate onboarding inserted company'; END IF;
END $$;

-- Invalid input must not create a company for a fresh verified user.
SELECT set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
DO $$
DECLARE caught boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.create_company_onboarding(
      'Test','Elektronik','Standort',8,8.0);
  EXCEPTION WHEN SQLSTATE '22023' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Invalid workdays were accepted'; END IF;

  caught := false;
  BEGIN
    PERFORM * FROM public.create_company_onboarding(
      'Test','unknown','Standort',5,8.0);
  EXCEPTION WHEN SQLSTATE '22023' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Invalid retail type was accepted'; END IF;

  IF EXISTS(SELECT 1 FROM public.companies WHERE created_by=auth.uid()) THEN
    RAISE EXCEPTION 'Invalid onboarding created company';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub','66666666-6666-4666-8666-666666666666',false);
DO $$
DECLARE caught boolean := false;
BEGIN
  BEGIN
    PERFORM * FROM public.create_company_onboarding(
      'Unauthorized Shop','Lebensmittel','Standort',5,8.0);
  EXCEPTION WHEN SQLSTATE '42501' THEN caught := true;
  END;
  IF NOT caught THEN RAISE EXCEPTION 'Unverified user created company'; END IF;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',false);
SELECT 'PASS: atomic company/branch onboarding and authorization tests' AS result;
