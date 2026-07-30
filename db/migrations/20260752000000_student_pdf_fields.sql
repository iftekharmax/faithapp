-- Adds structured fields matching the Faith Overseas Ltd. registration form:
--   • preferred_universities — desired country / university / course
--   • test_scores            — IELTS / UKVI / PTE / DUOLINGO / SAT / ACT (and any others)
-- academic_history keeps its existing JSONB shape; new optional keys
-- (level, board, program) are additive and safe for existing rows.

alter table public.students
  add column if not exists preferred_universities jsonb not null default '[]'::jsonb,
  add column if not exists test_scores            jsonb not null default '[]'::jsonb;

-- Both columns must be JSON arrays (never objects/scalars).
alter table public.students
  drop constraint if exists students_preferred_universities_is_array;
alter table public.students
  add  constraint students_preferred_universities_is_array
  check (jsonb_typeof(preferred_universities) = 'array') not valid;

alter table public.students
  drop constraint if exists students_test_scores_is_array;
alter table public.students
  add  constraint students_test_scores_is_array
  check (jsonb_typeof(test_scores) = 'array') not valid;
