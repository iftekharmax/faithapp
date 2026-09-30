-- Definitive fix for applications.assigned_team_id relationship
DO $$ 
BEGIN
    -- Drop if exists to avoid conflicts
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'applications_assigned_team_id_fkey'
        AND table_name = 'applications'
    ) THEN
        ALTER TABLE public.applications DROP CONSTRAINT applications_assigned_team_id_fkey;
    END IF;

    -- Add the foreign key
    ALTER TABLE public.applications
    ADD CONSTRAINT applications_assigned_team_id_fkey
    FOREIGN KEY (assigned_team_id) REFERENCES public.profiles(id)
    ON DELETE SET NULL;
END $$;

-- Force a schema reload
NOTIFY pgrst, 'reload schema';
