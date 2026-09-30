-- Fix relationship between application_timeline and profiles
-- This ensures the PostgREST schema cache identifies the foreign key relationship

DO $$ 
BEGIN
    -- Check if the foreign key exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'application_timeline_actor_id_fkey'
        AND table_name = 'application_timeline'
    ) THEN
        ALTER TABLE public.application_timeline
        ADD CONSTRAINT application_timeline_actor_id_fkey
        FOREIGN KEY (actor_id) REFERENCES public.profiles(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- Refresh the view to ensure it uses the correct relationship
CREATE OR REPLACE VIEW public.application_timeline_view AS
SELECT 
    t.*,
    p.full_name as actor_name,
    p.email as actor_email_profile
FROM public.application_timeline t
LEFT JOIN public.profiles p ON t.actor_id = p.id;

GRANT SELECT ON public.application_timeline_view TO authenticated;
