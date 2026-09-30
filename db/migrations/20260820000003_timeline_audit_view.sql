-- Create a view for timeline with actor profile info for UI convenience
CREATE OR REPLACE VIEW public.application_timeline_view AS
SELECT 
    t.*,
    p.full_name as actor_name,
    p.email as actor_email_profile
FROM public.application_timeline t
LEFT JOIN public.profiles p ON t.actor_id = p.id;

GRANT SELECT ON public.application_timeline_view TO authenticated;
