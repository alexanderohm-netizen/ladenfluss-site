-- READ-ONLY Cloud Beta deployment preflight. Safe on hosted Supabase.
-- This checks SQL objects/privileges only, NOT Auth SMTP, redirects or real logins.
WITH checks AS (
  SELECT 'Branches: opening_days' AS check_name,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='branches' AND column_name='opening_days') AS passed
  UNION ALL SELECT 'Branches: opening_hours',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='branches' AND column_name='opening_hours')
  UNION ALL SELECT 'Cloud documents: RLS enabled',
    (SELECT relrowsecurity FROM pg_class WHERE oid='public.cloud_documents'::regclass)
  UNION ALL SELECT 'Cloud documents: authenticated SELECT granted',
    has_table_privilege('authenticated','public.cloud_documents','SELECT')
  UNION ALL SELECT 'Cloud documents: direct authenticated UPDATE denied',
    NOT has_table_privilege('authenticated','public.cloud_documents','UPDATE')
  UNION ALL SELECT 'Cloud documents: direct authenticated INSERT denied',
    NOT has_table_privilege('authenticated','public.cloud_documents','INSERT')
  UNION ALL SELECT 'Cloud documents: anonymous SELECT denied',
    NOT has_table_privilege('anon','public.cloud_documents','SELECT')
  UNION ALL SELECT 'Security: verification helper installed',
    to_regprocedure('private.is_verified_account()') IS NOT NULL
  UNION ALL SELECT 'Security: module entitlement helper installed',
    to_regprocedure('private.module_allowed(uuid,text)') IS NOT NULL
  UNION ALL SELECT 'Cloud: guarded revision trigger installed',
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.cloud_documents'::regclass
      AND tgname='guard_cloud_document_revision' AND NOT tgisinternal)
  UNION ALL SELECT 'Cloud: create-if-absent RPC installed',
    to_regprocedure('public.create_cloud_document_if_absent(uuid,text,jsonb)') IS NOT NULL
  UNION ALL SELECT 'Cloud: revision CAS RPC installed',
    to_regprocedure('public.save_cloud_document_if_revision(uuid,text,integer,jsonb)') IS NOT NULL
  UNION ALL SELECT 'Onboarding: company/branch RPC installed',
    to_regprocedure('public.create_company_onboarding(text,text,text,integer,numeric)') IS NOT NULL
)
SELECT check_name, CASE WHEN COALESCE(passed,false) THEN 'PASS' ELSE 'PENDING' END AS status
FROM checks ORDER BY check_name;
