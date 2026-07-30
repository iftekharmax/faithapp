-- The single-value English test columns are replaced by the multi-row
-- `test_scores` JSONB array (IELTS/UKVI/PTE/DUOLINGO/SAT/ACT).
alter table public.students
  drop column if exists english_test_type,
  drop column if exists english_test_score,
  drop column if exists english_test_date;

notify pgrst, 'reload schema';
