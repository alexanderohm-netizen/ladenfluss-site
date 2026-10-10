-- DRAFT ONLY. Requires staging tests and coordinated client rollout.
-- Atomic compare-and-swap for existing cloud documents.
-- Exposed as a public RPC, with authorization checked against auth.uid().
-- Current production grant audit (2026-10-10): authenticated has SELECT only;
-- direct INSERT/UPDATE/DELETE privileges are not granted. Keep it that way.
-- SECURITY DEFINER RPC can perform the write after explicit authorization.

CREATE OR REPLACE FUNCTION public.save_cloud_document_if_revision(
  p_company_id uuid,
  p_module_key text,
  p_expected_revision integer,
  p_payload jsonb
)
RETURNS TABLE(saved_revision integer, saved_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL
     OR NOT (SELECT private.is_verified_account())
     OR NOT private.module_allowed(p_company_id, p_module_key) THEN
    RAISE EXCEPTION 'not authorized to write cloud document'
      USING ERRCODE = '42501';
  END IF;

  IF p_expected_revision IS NULL OR p_expected_revision < 1 THEN
    RAISE EXCEPTION 'expected revision must be positive'
      USING ERRCODE = '22023';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR octet_length(p_payload::text) > 1048576 THEN
    RAISE EXCEPTION 'invalid cloud document payload'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.cloud_documents AS d
  SET payload = p_payload,
      revision = d.revision + 1,
      updated_at = now()
  WHERE d.company_id = p_company_id
    AND d.module_key = p_module_key
    AND d.revision = p_expected_revision
  RETURNING d.revision, d.updated_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cloud document revision conflict or missing document'
      USING ERRCODE = '40001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.save_cloud_document_if_revision(uuid,text,integer,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_cloud_document_if_revision(uuid,text,integer,jsonb) TO authenticated;

-- Keep authenticated table privileges SELECT-only. RLS UPDATE policies
-- exist but do not by themselves confer UPDATE privileges.
-- Do not grant authenticated direct INSERT/UPDATE/DELETE privileges.
-- SECURITY DEFINER privileges and RPC authorization require staging tests.
