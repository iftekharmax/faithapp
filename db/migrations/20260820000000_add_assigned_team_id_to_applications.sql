-- Add assigned_team_id to applications table
ALTER TABLE public.applications 
ADD COLUMN IF NOT EXISTS assigned_team_id uuid REFERENCES auth.users(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_applications_assigned_team_id ON public.applications(assigned_team_id);

-- Update RLS policies to allow Application Team members to be assigned
-- and to ensure only they can be assigned (though enforced at app level for now).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO authenticated;
GRANT ALL ON public.applications TO service_role;

-- We don't need a specific constraint for Application Team here because the app will filter the dropdown,
-- but a trigger could be added if strict enforcement is needed.

COMMENT ON COLUMN public.applications.assigned_team_id IS 'UUID of the Application Team member assigned to this application';
