-- Backfill existing programs with empty array if NULL
UPDATE public.university_programs 
SET others_fees = '[]'::jsonb 
WHERE others_fees IS NULL;

-- Ensure column constraint and default are perfect
ALTER TABLE public.university_programs 
  ALTER COLUMN others_fees SET DEFAULT '[]'::jsonb,
  ALTER COLUMN others_fees SET NOT NULL;

-- Trigger a schema reload
NOTIFY pgrst, 'reload schema';
