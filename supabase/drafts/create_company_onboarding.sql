-- DRAFT ONLY: Do not execute on production before Supabase Auth/Staging E2E tests.
-- Create a company and its first branch atomically.
-- The existing private.new_company AFTER INSERT trigger creates owner membership
-- and the starter branch. This RPC updates that branch within the same transaction.
CREATE OR REPLACE FUNCTION public.create_company_onboarding(
  p_company_name text,
  p_retail_type text,
  p_branch_name text,
  p_opening_days integer,
  p_opening_hours numeric
)
RETURNS TABLE(company_id uuid, branch_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_company uuid;
  v_branch uuid;
BEGIN
  IF v_user IS NULL OR NOT (SELECT private.is_verified_account()) THEN
    RAISE EXCEPTION 'a verified account is required for onboarding'
      USING ERRCODE = '42501';
  END IF;

  IF p_company_name IS NULL OR length(btrim(p_company_name)) NOT BETWEEN 2 AND 140
     OR p_branch_name IS NULL OR length(btrim(p_branch_name)) NOT BETWEEN 2 AND 80
     OR p_retail_type IS NULL OR p_retail_type NOT IN (
       'Lebensmittel','Mode & Textil','Drogerie & Beauty',
       'Geschenke & Deko','Elektronik','Baumarkt & Heimwerken',
       'Sonstiger Einzelhandel'
     )
     OR p_opening_days IS NULL OR p_opening_days NOT BETWEEN 1 AND 7
     OR p_opening_hours IS NULL OR p_opening_hours <= 0
     OR p_opening_hours > 24 OR p_opening_hours * 2 <> trunc(p_opening_hours * 2) THEN
    RAISE EXCEPTION 'invalid onboarding input'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize multiple browser tabs onboarding for the same user.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text, 0));
  IF EXISTS (SELECT 1 FROM public.companies c WHERE c.created_by = v_user) THEN
    RAISE EXCEPTION 'account already has a company'
      USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.companies(name,retail_type,created_by)
  VALUES(btrim(p_company_name),p_retail_type,v_user)
  RETURNING id INTO v_company;

  -- private.new_company trigger must create this row automatically.
  SELECT b.id INTO v_branch
  FROM public.branches b
  WHERE b.company_id=v_company
  LIMIT 1;

  IF v_branch IS NULL THEN
    RAISE EXCEPTION 'starter branch creation failed'
      USING ERRCODE = '23514';
  END IF;

  UPDATE public.branches b
  SET name=btrim(p_branch_name),
      opening_days=p_opening_days,
      opening_hours=p_opening_hours
  WHERE b.id=v_branch;

  RETURN QUERY SELECT v_company,v_branch;
END;
$$;

REVOKE ALL ON FUNCTION public.create_company_onboarding(text,text,text,integer,numeric)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_company_onboarding(text,text,text,integer,numeric)
  TO authenticated;

-- Rollout checks:
-- 1) Confirm private.new_company trigger and private.is_verified_account are installed.
-- 2) Review function owner; keep authenticated companies/branches INSERT and UPDATE revoked.
-- 3) Verify real verified and unverified Supabase Auth sessions in staging.
-- 4) This beta permits one company per creator. Multi-company onboarding comes later.
