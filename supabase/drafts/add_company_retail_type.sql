-- DRAFT: Stage/test before applying to hosted Supabase.
-- Hosted schema (verified read-only 2026-10-11) is missing companies.retail_type.
-- The onboarding RPC cannot INSERT retail_type until this migration exists.
-- Preserve existing merchants; nullable means no guessed category is backfilled.
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS retail_type text
  CHECK (retail_type IS NULL OR char_length(retail_type) <= 80);

COMMENT ON COLUMN public.companies.retail_type IS
  'Merchant-provided retail category during verified-account onboarding; nullable for existing companies';

-- Deployment: this must be applied before create_company_onboarding.
