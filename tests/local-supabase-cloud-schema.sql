-- ONLY for a disposable Supabase CLI local stack.
-- Minimal parity fixture based on read-only hosted schema + policy inspection
-- (2026-10-10). This is NOT a production migration.
-- It intentionally uses real Supabase auth.uid() and auth.users rather than
-- the SQL-only fixture's simulated request.jwt.claim.sub helpers.
BEGIN;
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE public.companies(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  retail_type text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.company_members(
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('owner','admin','manager','employee')),
  status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','invited','disabled')),
  PRIMARY KEY (company_id,user_id)
);
CREATE TABLE public.branches(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Europe/Berlin'
  -- Actual hosted schema lacks opening_days/hours before the drafted ALTER.
);
CREATE TABLE public.module_access(
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  status text NOT NULL DEFAULT 'inactive' CHECK(status IN ('active','trial','inactive')),
  valid_until timestamptz,
  PRIMARY KEY (company_id,module_key)
);
CREATE TABLE public.cloud_documents(
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_key text NOT NULL CHECK(module_key IN ('profile','vacation','pep','zahlenfluss','warenfluss')),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=1048576),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id,module_key)
);
CREATE TABLE public.cloud_document_history(
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_key text NOT NULL CHECK(module_key IN ('profile','vacation','pep','zahlenfluss','warenfluss')),
  revision integer NOT NULL CHECK(revision>0),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=1048576),
  saved_at timestamptz NOT NULL,
  PRIMARY KEY(company_id,module_key,revision)
);

CREATE FUNCTION private.is_verified_account() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS(
    SELECT 1 FROM auth.users u
    WHERE u.id=(SELECT auth.uid())
      AND u.email_confirmed_at IS NOT NULL
      AND u.is_anonymous=false
  )
$$;
CREATE FUNCTION private.has_role(target uuid, roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT (SELECT private.is_verified_account()) AND EXISTS(
    SELECT 1 FROM public.company_members
    WHERE company_id=target AND user_id=(SELECT auth.uid())
      AND status='active' AND role=ANY(roles)
  )
$$;
CREATE FUNCTION private.module_allowed(target uuid, requested text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND private.has_role(target,ARRAY['owner','admin','manager'])
    AND (
      requested IN ('profile','vacation') OR EXISTS(
        SELECT 1 FROM public.module_access
        WHERE company_id=target AND module_key=requested
          AND status IN ('active','trial') AND valid_until>now()
      )
    )
$$;
CREATE FUNCTION private.new_company() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NEW.created_by<>auth.uid() THEN
    RAISE insufficient_privilege;
  END IF;
  INSERT INTO public.company_members VALUES(NEW.id,NEW.created_by,'owner','active');
  INSERT INTO public.branches(company_id,name) VALUES(NEW.id,'Hauptfiliale');
  RETURN NEW;
END;
$$;
CREATE TRIGGER new_company
AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION private.new_company();

CREATE FUNCTION private.archive_previous_cloud_document() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.cloud_document_history(company_id,module_key,revision,payload,saved_at)
  VALUES(OLD.company_id,OLD.module_key,OLD.revision,OLD.payload,OLD.updated_at);
  DELETE FROM public.cloud_document_history
  WHERE company_id=NEW.company_id AND module_key=NEW.module_key AND revision<=NEW.revision-6;
  RETURN NEW;
END;
$$;
CREATE TRIGGER archive_previous_cloud_document
BEFORE UPDATE ON public.cloud_documents
FOR EACH ROW WHEN (OLD.revision IS DISTINCT FROM NEW.revision)
EXECUTE FUNCTION private.archive_previous_cloud_document();

REVOKE ALL ON FUNCTION private.is_verified_account() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.has_role(uuid,text[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.module_allowed(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION private.new_company() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION private.archive_previous_cloud_document() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.is_verified_account() TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION private.module_allowed(uuid,text) TO authenticated;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_document_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.companies,public.company_members,public.branches,
  public.module_access,public.cloud_documents,public.cloud_document_history
  FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.companies,public.company_members,public.branches,
  public.module_access,public.cloud_documents,public.cloud_document_history
  TO authenticated;

CREATE POLICY company_create ON public.companies FOR INSERT TO authenticated
  WITH CHECK(created_by=(SELECT auth.uid()) AND (SELECT private.is_verified_account())
    AND COALESCE((SELECT auth.jwt())->>'is_anonymous','false')='false');
CREATE POLICY company_read ON public.companies FOR SELECT TO authenticated
  USING(private.has_role(id,ARRAY['owner','admin','manager','employee']));
CREATE POLICY company_edit ON public.companies FOR UPDATE TO authenticated
  USING(private.has_role(id,ARRAY['owner','admin']))
  WITH CHECK(private.has_role(id,ARRAY['owner','admin']));
CREATE POLICY member_read ON public.company_members FOR SELECT TO authenticated
  USING(user_id=(SELECT auth.uid()) AND (SELECT private.is_verified_account()));
CREATE POLICY branch_read ON public.branches FOR SELECT TO authenticated
  USING(private.has_role(company_id,ARRAY['owner','admin','manager','employee']));
CREATE POLICY branch_edit ON public.branches FOR UPDATE TO authenticated
  USING(private.has_role(company_id,ARRAY['owner','admin']))
  WITH CHECK(private.has_role(company_id,ARRAY['owner','admin']));
CREATE POLICY access_read ON public.module_access FOR SELECT TO authenticated
  USING(private.has_role(company_id,ARRAY['owner','admin','manager']));
CREATE POLICY document_read ON public.cloud_documents FOR SELECT TO authenticated
  USING(private.module_allowed(company_id,module_key));
CREATE POLICY document_create ON public.cloud_documents FOR INSERT TO authenticated
  WITH CHECK(private.module_allowed(company_id,module_key));
CREATE POLICY document_edit ON public.cloud_documents FOR UPDATE TO authenticated
  USING(private.module_allowed(company_id,module_key))
  WITH CHECK(private.module_allowed(company_id,module_key));
CREATE POLICY cloud_history_read ON public.cloud_document_history FOR SELECT TO authenticated
  USING(private.module_allowed(company_id,module_key));
COMMIT;
