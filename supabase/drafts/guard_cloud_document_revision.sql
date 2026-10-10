-- DRAFT ONLY: do not run on production without staging integration tests.
-- Prevent unversioned payload changes and revision jumps.
-- This guard is defense in depth; clients MUST also use a conditional
-- update (WHERE revision = expected_revision) to avoid lost updates.
CREATE OR REPLACE FUNCTION private.guard_cloud_document_revision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.module_key IS DISTINCT FROM OLD.module_key THEN
    RAISE EXCEPTION 'cloud document identity is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.revision IS DISTINCT FROM OLD.revision + 1 THEN
    RAISE EXCEPTION 'cloud document revision must increment by exactly one'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.payload IS NOT DISTINCT FROM OLD.payload THEN
    RAISE EXCEPTION 'cloud document payload is unchanged'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_cloud_document_revision() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.guard_cloud_document_revision() FROM anon, authenticated;

DROP TRIGGER IF EXISTS guard_cloud_document_revision ON public.cloud_documents;
CREATE TRIGGER guard_cloud_document_revision
BEFORE UPDATE ON public.cloud_documents
FOR EACH ROW
EXECUTE FUNCTION private.guard_cloud_document_revision();

-- Existing archive_previous_cloud_document BEFORE UPDATE trigger will
-- still run when revision changes. Trigger firing order is alphabetical:
-- archive_previous_cloud_document before guard_cloud_document_revision.
-- If the guard raises an error, the entire statement rolls back, including
-- history changes made by the archive trigger.
--
-- IMPORTANT: This does NOT by itself prevent two clients from reading
-- revision N and both submitting revision N+1. A guarded write RPC or
-- conditional UPDATE with expected_revision is still mandatory.
