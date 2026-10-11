-- Test fixture invariant: current hosted public.branches had no opening_days/hours.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='branches'
               AND column_name IN ('opening_days','opening_hours')) THEN
    RAISE EXCEPTION 'Staging fixture no longer mirrors pre-migration branch schema';
  END IF;
END;
$$;
