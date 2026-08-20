-- Add created_by column to application_timeline if not exists (for join performance/RLS)
-- And ensure application_timeline has appropriate RLS for creator info
ALTER TABLE public.application_timeline
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid();

-- Grant access to profiles for timeline joining
GRANT SELECT ON public.profiles TO authenticated;

-- Refresh schema
SELECT pgrst_watch();
