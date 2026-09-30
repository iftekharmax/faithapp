-- Backfill existing programs with empty array if NULL
UPDATE public.university_programs 
SET others_fees = '[]'::jsonb 
WHERE others_fees IS NULL;

-- Ensure column constraint allows empty arrays and handles defaults correctly for future rows
ALTER TABLE public.university_programs 
  ALTER COLUMN others_fees SET DEFAULT '[]'::jsonb;

-- Trigger a schema reload to be sure
NOTIFY pgrst, 'reload schema';
