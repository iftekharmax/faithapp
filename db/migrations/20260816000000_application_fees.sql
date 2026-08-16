-- Add fee breakdown columns to applications
alter table public.applications
  add column if not exists application_fee numeric(12,2),
  add column if not exists registration_fee numeric(12,2),
  add column if not exists emgs_fee numeric(12,2),
  add column if not exists others_fee numeric(12,2);

notify pgrst, 'reload schema';
