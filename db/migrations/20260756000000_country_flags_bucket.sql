-- Public storage bucket for uploaded country flags
insert into storage.buckets (id, name, public)
values ('country-flags','country-flags', true)
on conflict (id) do nothing;

drop policy if exists "country_flags_read" on storage.objects;
create policy "country_flags_read" on storage.objects for select to public
  using (bucket_id = 'country-flags');

drop policy if exists "country_flags_write" on storage.objects;
create policy "country_flags_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'country-flags' and public.has_role(auth.uid(),'admin'));

drop policy if exists "country_flags_update" on storage.objects;
create policy "country_flags_update" on storage.objects for update to authenticated
  using (bucket_id = 'country-flags' and public.has_role(auth.uid(),'admin'));

drop policy if exists "country_flags_delete" on storage.objects;
create policy "country_flags_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'country-flags' and public.has_role(auth.uid(),'admin'));
