-- Ensure link column exists on notifications table so trigger handle_application_assignment_change
-- can insert application links without failing with column "link" does not exist.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link text;
