-- =====================================================================
-- Student audit logs & timeline permissions
-- =====================================================================

-- Extend audit_logs with an optional entity_id so we can attribute entries
-- to a non-user entity (e.g. a student).
alter table public.audit_logs add column if not exists entity_id text;
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id, created_at desc);

-- Allow staff (admin, counselor, application_team) to view student-scoped audit entries.
drop policy if exists "audit_logs_staff_select_students" on public.audit_logs;
create policy "audit_logs_staff_select_students" on public.audit_logs for select to authenticated
  using (
    entity = 'student' and (
      public.has_role(auth.uid(), 'admin')
      or public.has_role(auth.uid(), 'counselor')
      or public.has_role(auth.uid(), 'application_team')
    )
  );

-- Tighten timeline update/delete: only the original actor or an admin may modify/delete
drop policy if exists "student_timeline_all_staff" on public.student_timeline;

drop policy if exists "student_timeline_select_staff" on public.student_timeline;
create policy "student_timeline_select_staff" on public.student_timeline for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  );

drop policy if exists "student_timeline_insert_staff" on public.student_timeline;
create policy "student_timeline_insert_staff" on public.student_timeline for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'counselor')
    or public.has_role(auth.uid(), 'application_team')
  );

drop policy if exists "student_timeline_update_own_or_admin" on public.student_timeline;
create policy "student_timeline_update_own_or_admin" on public.student_timeline for update to authenticated
  using (actor_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (actor_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "student_timeline_delete_own_or_admin" on public.student_timeline;
create policy "student_timeline_delete_own_or_admin" on public.student_timeline for delete to authenticated
  using (actor_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
