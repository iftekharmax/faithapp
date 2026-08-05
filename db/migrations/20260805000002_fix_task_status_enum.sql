-- Fix task_status enum to include 'completed' and 'done' if missing,
-- and ensure the application code can use them.

-- 1. Extend task_status with common completion values
-- We use 'do' block to handle errors gracefully if values already exist
do $$ begin
  alter type public.task_status add value 'completed';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.task_status add value 'done';
exception when duplicate_object then null; end $$;

-- 2. Update existing tasks that might be using an incompatible status (if any)
-- This is a safety measure.
update public.tasks set status = 'completed' where status = 'done';
