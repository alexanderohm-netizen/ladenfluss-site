-- Disposable PostgreSQL integration fixture. NEVER run on production.
-- Mirrors relevant cloud table constraints, privileges, audit triggers and
-- authorization helper contracts. It is not the real Supabase Auth service.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE SCHEMA auth;
CREATE SCHEMA private;
GRANT USAGE ON SCHEMA auth, private, public TO authenticated;

CREATE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE private.test_verified (user_id uuid PRIMARY KEY);
CREATE TABLE private.test_members (
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL,
  active boolean NOT NULL,
  PRIMARY KEY (company_id,user_id)
);

CREATE FUNCTION private.is_verified_account() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS(SELECT 1 FROM private.test_verified WHERE user_id=auth.uid())
$$;

CREATE FUNCTION private.module_allowed(target uuid, requested text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT requested IN ('profile','vacation') AND EXISTS (
    SELECT 1 FROM private.test_members
    WHERE company_id = target AND user_id=auth.uid() AND active
      AND role IN ('owner','admin','manager')
  )
$$;

REVOKE ALL ON FUNCTION private.is_verified_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.module_allowed(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.is_verified_account() TO authenticated;
GRANT EXECUTE ON FUNCTION private.module_allowed(uuid,text) TO authenticated;


-- The production onboarding trigger is reproduced with just the fields used by the RPC.
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  retail_type text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  name text NOT NULL,
  opening_days smallint CHECK(opening_days BETWEEN 1 AND 7),
  opening_hours numeric(4,1) CHECK(opening_hours > 0 AND opening_hours <= 24)
);
CREATE FUNCTION private.new_company() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $
BEGIN
  IF auth.uid() IS NULL OR NEW.created_by <> auth.uid() THEN
    RAISE insufficient_privilege;
  END IF;
  INSERT INTO private.test_members(company_id,user_id,role,active)
  VALUES(NEW.id,NEW.created_by,'owner',true);
  INSERT INTO public.branches(company_id,name) VALUES(NEW.id,'Hauptfiliale');
  RETURN NEW;
END;
$;
CREATE TRIGGER new_company AFTER INSERT ON public.companies
FOR EACH ROW EXECUTE FUNCTION private.new_company();

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.companies,public.branches FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.companies,public.branches TO authenticated;
CREATE POLICY "read owned company" ON public.companies FOR SELECT TO authenticated
  USING(private.module_allowed(id,'profile'));
CREATE POLICY "read owned branch" ON public.branches FOR SELECT TO authenticated
  USING(private.module_allowed(company_id,'profile'));

CREATE TABLE public.cloud_documents (
  company_id uuid NOT NULL,
  module_key text NOT NULL CHECK (module_key IN ('profile','vacation','pep','zahlenfluss','warenfluss')),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload)='object' AND octet_length(payload::text) <= 1048576),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(company_id,module_key)
);
CREATE TABLE public.cloud_document_history (
  company_id uuid NOT NULL,
  module_key text NOT NULL CHECK(module_key IN ('profile','vacation','pep','zahlenfluss','warenfluss')),
  revision integer NOT NULL CHECK(revision>0),
  payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text) <= 1048576),
  saved_at timestamptz NOT NULL,
  PRIMARY KEY(company_id,module_key,revision)
);

CREATE FUNCTION private.archive_previous_cloud_document() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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

ALTER TABLE public.cloud_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cloud_document_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cloud_documents FROM PUBLIC,anon,authenticated;
REVOKE ALL ON public.cloud_document_history FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.cloud_documents TO authenticated;
GRANT SELECT ON public.cloud_document_history TO authenticated;
CREATE POLICY "authorized read"
  ON public.cloud_documents FOR SELECT TO authenticated
  USING(private.module_allowed(company_id,module_key));
CREATE POLICY "authorized history read"
  ON public.cloud_document_history FOR SELECT TO authenticated
  USING(private.module_allowed(company_id,module_key));

INSERT INTO private.test_verified(user_id) VALUES
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333'),
 ('55555555-5555-4555-8555-555555555555');
INSERT INTO private.test_members(company_id,user_id,role,active) VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','owner',true),
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','33333333-3333-4333-8333-333333333333','employee',true),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','owner',true);
INSERT INTO public.cloud_documents(company_id,module_key,payload,revision)
VALUES
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vacation','{"days":2}',1),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','vacation','{"days":9}',1);
