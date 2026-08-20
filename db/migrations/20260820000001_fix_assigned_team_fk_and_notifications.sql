-- Fix relationship: assigned_team_id should reference public.profiles(id) for proper joins
-- and to ensure relationship detection works in the PostgREST cache.
ALTER TABLE public.applications 
DROP CONSTRAINT IF EXISTS applications_assigned_team_id_fkey;

ALTER TABLE public.applications
ADD CONSTRAINT applications_assigned_team_id_fkey 
FOREIGN KEY (assigned_team_id) REFERENCES public.profiles(id);

-- Create table for email notifications (if not exists)
CREATE TABLE IF NOT EXISTS public.notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    link text,
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- Trigger to notify on assignment change
CREATE OR REPLACE FUNCTION public.handle_application_assignment_change()
RETURNS TRIGGER AS $$
DECLARE
    assignee_email text;
    app_code text;
BEGIN
    -- Only act if assigned_team_id changed and is not null
    IF (TG_OP = 'INSERT' AND NEW.assigned_team_id IS NOT NULL) OR 
       (TG_OP = 'UPDATE' AND NEW.assigned_team_id IS DISTINCT FROM OLD.assigned_team_id AND NEW.assigned_team_id IS NOT NULL) THEN
        
        -- Get assignee email and app code
        SELECT email INTO assignee_email FROM public.profiles WHERE id = NEW.assigned_team_id;
        app_code := COALESCE(NEW.application_code, 'New Application');

        -- Insert notification
        INSERT INTO public.notifications (user_id, title, message, link)
        VALUES (
            NEW.assigned_team_id,
            'New Application Assignment',
            'You have been assigned to application ' || app_code,
            '/applications/' || NEW.id
        );

        -- Insert timeline event
        INSERT INTO public.application_timeline (application_id, event_type, title, description, actor_id, actor_email)
        VALUES (
            NEW.id,
            'assignment',
            'Application Assigned',
            'Application was assigned to ' || assignee_email,
            auth.uid(),
            (SELECT email FROM auth.users WHERE id = auth.uid())
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_application_assignment_change ON public.applications;
CREATE TRIGGER on_application_assignment_change
AFTER INSERT OR UPDATE ON public.applications
FOR EACH ROW EXECUTE FUNCTION public.handle_application_assignment_change();
