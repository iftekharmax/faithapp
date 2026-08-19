DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT count(*) INTO null_count FROM public.university_programs WHERE others_fees IS NULL;
  IF null_count > 0 THEN
    RAISE EXCEPTION 'Backfill failed: % programs still have NULL others_fees', null_count;
  END IF;
  RAISE NOTICE 'Verification successful: All programs have non-null others_fees';
END $$;
