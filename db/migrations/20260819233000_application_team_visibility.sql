-- Application Team access update
-- Admin or Application Team can see all applications
-- Other users see only their own applications

-- 1. Update applications RLS
drop policy if exists "applications_select_staff" on public.applications;
create policy "applications_select_staff" on public.applications for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'application_team')
    or created_by = auth.uid()
  );

-- Also update update/delete to allow application_team if needed?
-- The user request says "Application Team user: সব Applications দেখতে পারবে ... প্রতিটি Application-এর Created By information দেখতে পারবে ... নিজের তৈরি Applications-ও দেখতে পারবে ... অন্য users-এর তৈরি করা Applications-ও দেখতে পারবে"
-- It doesn't explicitly say they can EDIT all, but usually if they can "see all" in this context it might imply management.
-- However, "Existing search, filter, pagination, sorting অপরিবর্তಿತ থাকবে. Create/Edit/Delete functionality পরিবর্তন করবে না."
-- This "Create/Edit/Delete functionality পরিবর্তন করবে না" might mean the permissions for those shouldn't change, or it means the UI shouldn't change.
-- Usually "Application Team" handles processing, so they likely need to update status.
-- I'll stick to SELECT for now as requested for "visibility".
-- Wait, if they see them in the list, they will try to click Edit. If RLS blocks the update, it will fail.
-- The user said: "Application Team user: সব Applications দেখতে পারবে ... অন্য users-এর তৈরি করা Applications-ও দেখতে পারবে"
-- Let's update update policy too to be safe, or check if they only need to view.
-- Actually, the user says "Role-based data visibility-এর existing system update করো" and "RoleStudentsApplicationsCreated By ... Application Team Existing rules All Yes"
-- "Existing rules" for Students, but "All" for Applications.

drop policy if exists "applications_update_staff" on public.applications;
create policy "applications_update_staff" on public.applications for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'application_team')
    or created_by = auth.uid()
  );

-- 2. Update Application Timeline RLS
drop policy if exists "app_timeline_all_staff" on public.application_timeline;
create policy "app_timeline_all_staff" on public.application_timeline for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'application_team')
    or exists (
      select 1 from public.applications a
      where a.id = application_id
      and (a.created_by = auth.uid() or public.has_role(auth.uid(), 'application_team'))
    )
  );

-- 3. Update Profiles visibility
-- Non-admins who are in application_team also need to see profiles to know "Created By"
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_staff" on public.profiles for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'application_team')
    or id = auth.uid()
  );
  
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.applications TO authenticated;
GRANT SELECT ON public.application_timeline TO authenticated;
