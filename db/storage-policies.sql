-- =============================================================================
-- Storage buckets + RLS policies for self-hosted Supabase (api.applywaybd.com)
-- Run this in Supabase Studio > SQL Editor (needs storage owner privileges).
-- =============================================================================

-- 1) Buckets (already created via API, kept here for reproducibility)
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('application-documents', 'application-documents', false, 52428800),
  ('student-documents',     'student-documents',     false, 52428800),
  ('chat-attachments',      'chat-attachments',      false, 52428800),
  ('avatars',               'avatars',               true,  10485760),
  ('university-logos',      'university-logos',      true,  10485760),
  ('country-flags',         'country-flags',         true,  10485760),
  ('student-photos',        'student-photos',        true,  10485760)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- 2) Policies on storage.objects
alter table storage.objects enable row level security;

do $$
declare
  b text;
  private_buckets text[] := array['application-documents','student-documents','chat-attachments'];
  public_buckets  text[] := array['avatars','university-logos','country-flags','student-photos'];
begin
  foreach b in array (private_buckets || public_buckets)
  loop
    execute format('drop policy if exists %I on storage.objects', b || '_auth_read');
    execute format('drop policy if exists %I on storage.objects', b || '_auth_insert');
    execute format('drop policy if exists %I on storage.objects', b || '_auth_update');
    execute format('drop policy if exists %I on storage.objects', b || '_auth_delete');
    execute format('drop policy if exists %I on storage.objects', b || '_public_read');

    execute format(
      'create policy %I on storage.objects for select to authenticated using (bucket_id = %L)',
      b || '_auth_read', b);
    execute format(
      'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L)',
      b || '_auth_insert', b);
    execute format(
      'create policy %I on storage.objects for update to authenticated using (bucket_id = %L) with check (bucket_id = %L)',
      b || '_auth_update', b, b);
    execute format(
      'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L)',
      b || '_auth_delete', b);
  end loop;

  foreach b in array public_buckets
  loop
    execute format(
      'create policy %I on storage.objects for select to anon using (bucket_id = %L)',
      b || '_public_read', b);
  end loop;
end $$;
