-- Server-side validation constraints + passport uniqueness for students

-- Unique passport when set (partial unique index handles NULLs)
create unique index if not exists students_passport_no_unique
  on public.students (passport_no)
  where passport_no is not null;

-- Full name length (1..150 after trim)
alter table public.students drop constraint if exists students_full_name_length_chk;
alter table public.students add constraint students_full_name_length_chk
  check (char_length(btrim(full_name)) between 1 and 150) not valid;

-- Email format when provided
alter table public.students drop constraint if exists students_email_format_chk;
alter table public.students add constraint students_email_format_chk
  check (email is null or email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') not valid;

-- Passport expiry must be after DOB when both set
alter table public.students drop constraint if exists students_passport_expiry_chk;
alter table public.students add constraint students_passport_expiry_chk
  check (passport_expiry is null or date_of_birth is null or passport_expiry > date_of_birth) not valid;

-- Passport expiry should not be in the far past (allow historical for archived but block obvious typos)
alter table public.students drop constraint if exists students_passport_expiry_year_chk;
alter table public.students add constraint students_passport_expiry_year_chk
  check (passport_expiry is null or passport_expiry >= date '1900-01-01') not valid;
