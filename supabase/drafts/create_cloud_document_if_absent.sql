-- DRAFT ONLY. Test in an isolated database before production.
-- First-write provisioning for a cloud module. This complements the CAS update RPC.
-- authenticated MUST keep SELECT-only table privileges; no direct INSERT grant.
CREATE OR REPLACE FUNCTION public.create_cloud_document_if_absent(
  p_company_id uuid,
  p_module_key text,
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
    RAISE EXCEPTION 'not authorized to create cloud document'
      USING ERRCODE = '42501';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR octet_length(p_payload::text) > 1048576 THEN
    RAISE EXCEPTION 'invalid cloud document payload'
      USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  INSERT INTO public.cloud_documents(company_id,module_key,payload,revision,updated_at)
  VALUES(p_company_id,p_module_key,p_payload,1,now())
  ON CONFLICT(company_id,module_key) DO NOTHING
  RETURNING revision, updated_at;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cloud document already exists'
      USING ERRCODE = '23505';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.create_cloud_document_if_absent(uuid,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_cloud_document_if_absent(uuid,text,jsonb) TO authenticated;

-- This function is for creation only. It cannot overwrite existing documents.
-- Follow-up staging checks must confirm security-definer ownership and RLS boundaries.
