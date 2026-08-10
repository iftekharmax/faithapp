-- Rich-text "Additional others fee" notes on programs
alter table public.university_programs
  add column if not exists additional_others_fee text;

notify pgrst, 'reload schema';
