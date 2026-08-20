-- Definitive fix for application_timeline relationship
DO $$ 
BEGIN
    -- Drop if exists to avoid conflicts
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'application_timeline_actor_id_fkey'
        AND table_name = 'application_timeline'
    ) THEN
        ALTER TABLE public.application_timeline DROP CONSTRAINT application_timeline_actor_id_fkey;
    END IF;

    -- Add the foreign key
    ALTER TABLE public.application_timeline
    ADD CONSTRAINT application_timeline_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES public.profiles(id)
    ON DELETE SET NULL;
END $$;

-- Force a schema reload
NOTIFY pgrst, 'reload schema';
