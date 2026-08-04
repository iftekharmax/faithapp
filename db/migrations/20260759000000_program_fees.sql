-- Add fee breakdown columns to university_programs
alter table public.university_programs
  add column if not exists application_fee numeric(12,2),
  add column if not exists registration_fee numeric(12,2),
  add column if not exists emgs_fee numeric(12,2),
  add column if not exists others_fee numeric(12,2);

notify pgrst, 'reload schema';
