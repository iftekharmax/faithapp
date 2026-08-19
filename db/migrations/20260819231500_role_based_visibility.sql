-- Role-based data visibility for Students and Applications

-- Update RLS for Students
drop policy if exists "students_select_staff" on public.students;
create policy "students_select_staff" on public.students for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or created_by = auth.uid()
    or assigned_counselor_id = auth.uid()
  );

drop policy if exists "students_update_staff" on public.students;
create policy "students_update_staff" on public.students for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or created_by = auth.uid()
    or assigned_counselor_id = auth.uid()
  );

drop policy if exists "students_delete_admin" on public.students;
create policy "students_delete_admin" on public.students for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Update RLS for Applications
drop policy if exists "applications_select_staff" on public.applications;
create policy "applications_select_staff" on public.applications for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or created_by = auth.uid()
    or assigned_counselor_id = auth.uid()
    or assigned_officer_id = auth.uid()
  );

drop policy if exists "applications_update_staff" on public.applications;
create policy "applications_update_staff" on public.applications for update to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or created_by = auth.uid()
    or assigned_counselor_id = auth.uid()
    or assigned_officer_id = auth.uid()
  );

drop policy if exists "applications_delete_admin" on public.applications;
create policy "applications_delete_admin" on public.applications for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Update RLS for Application Timeline
drop policy if exists "app_timeline_all_staff" on public.application_timeline;
create policy "app_timeline_all_staff" on public.application_timeline for all to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.applications a
      where a.id = application_id
      and (a.created_by = auth.uid() or a.assigned_counselor_id = auth.uid() or a.assigned_officer_id = auth.uid())
    )
  );

-- Reload schema
select pgrst_watch();
