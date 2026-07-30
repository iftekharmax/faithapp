-- =====================================================================
-- Chat hardening: directory for non-student users, tighter storage RLS,
-- search indexes, and RLS verification.
-- =====================================================================

-- 1) Public "people" directory for chat.
--    Non-student users only. Exposes only id/name/avatar (no PII).
--    SECURITY DEFINER so any authenticated user can browse the roster
--    without granting broad SELECT on profiles.
create or replace function public.chat_directory(_search text default null, _limit int default 50, _offset int default 0)
returns table (id uuid, full_name text, avatar_url text, email text, status text, is_online boolean, last_seen_at timestamptz)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.email,
    p.status,
    coalesce(up.status = 'online', false) as is_online,
    up.last_seen_at
  from public.profiles p
  left join public.user_presence up on up.user_id = p.id
  where p.id <> auth.uid()
    and coalesce(p.status, 'active') <> 'inactive'
    -- exclude student-only accounts
    and not exists (
      select 1 from public.user_roles ur
      where ur.user_id = p.id and ur.role = 'student'
        and not exists (
          select 1 from public.user_roles ur2
          where ur2.user_id = p.id and ur2.role <> 'student'
        )
    )
    and (
      _search is null or _search = ''
      or p.full_name ilike '%'||_search||'%'
      or p.email ilike '%'||_search||'%'
    )
  order by coalesce(up.status = 'online', false) desc, p.full_name asc nulls last
  limit greatest(_limit, 1) offset greatest(_offset, 0);
$$;
grant execute on function public.chat_directory(text, int, int) to authenticated;

-- 2) Global chat search — conversations, messages, users, applications.
--    Returns a heterogeneous set with a "kind" discriminator.
create or replace function public.chat_search(_q text, _limit int default 20, _offset int default 0)
returns table (
  kind text,               -- 'conversation' | 'message' | 'user' | 'application'
  id text,                 -- entity id as text
  conversation_id uuid,    -- non-null when this result can open a conversation
  title text,
  snippet text,
  avatar_url text,
  application_id uuid,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  with q as (select coalesce(nullif(trim(_q), ''), null) as term)
  -- conversations user is part of, matched by title
  select 'conversation'::text, c.id::text, c.id, coalesce(c.title, 'Conversation'), null::text, null::text,
         c.application_id, c.last_message_at
  from public.conversations c
  join public.conversation_members m on m.conversation_id = c.id and m.user_id = auth.uid()
  join q on true
  where q.term is not null and (c.title ilike '%'||q.term||'%')
  union all
  -- messages inside conversations user can read
  select 'message'::text, msg.id::text, msg.conversation_id, coalesce(c.title, 'Message'),
         left(msg.body, 160), null::text, c.application_id, msg.created_at
  from public.messages msg
  join public.conversations c on c.id = msg.conversation_id
  join public.conversation_members m on m.conversation_id = c.id and m.user_id = auth.uid()
  join q on true
  where q.term is not null and msg.deleted_at is null
    and msg.body ilike '%'||q.term||'%'
  union all
  -- users from the chat directory
  select 'user'::text, p.id::text, null::uuid, coalesce(p.full_name, p.email), p.email, p.avatar_url,
         null::uuid, p.created_at
  from public.profiles p
  join q on true
  where q.term is not null
    and p.id <> auth.uid()
    and (p.full_name ilike '%'||q.term||'%' or p.email ilike '%'||q.term||'%')
    and not exists (
      select 1 from public.user_roles ur
      where ur.user_id = p.id and ur.role = 'student'
        and not exists (select 1 from public.user_roles ur2 where ur2.user_id = p.id and ur2.role <> 'student')
    )
  union all
  -- linked applications
  select 'application'::text, a.id::text, c.id, coalesce(a.application_code || ' — ' || a.university, 'Application'),
         a.university, null::text, a.id, a.created_at
  from public.applications a
  left join public.conversations c on c.application_id = a.id
  left join public.conversation_members m on m.conversation_id = c.id and m.user_id = auth.uid()
  join q on true
  where q.term is not null
    and (a.application_code ilike '%'||q.term||'%' or a.university ilike '%'||q.term||'%')
    and (m.user_id is not null or public.has_role(auth.uid(),'admin'))
  order by 8 desc
  limit greatest(_limit,1) offset greatest(_offset,0);
$$;
grant execute on function public.chat_search(text, int, int) to authenticated;

-- 3) Search performance
create extension if not exists pg_trgm;
create index if not exists idx_messages_body_trgm on public.messages using gin (body gin_trgm_ops)
  where deleted_at is null;
create index if not exists idx_profiles_name_trgm on public.profiles using gin (full_name gin_trgm_ops);
create index if not exists idx_applications_code_trgm on public.applications using gin (application_code gin_trgm_ops);

-- 4) Tighten chat-attachments storage RLS: only conversation members can read.
--    Path format: "{conversation_id}/{uuid}-{name}".
drop policy if exists "chat_att_read" on storage.objects;
create policy "chat_att_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (
      public.has_role(auth.uid(), 'admin')
      or public.is_conversation_member(
        nullif(split_part(name, '/', 1), '')::uuid, auth.uid()
      )
    )
  );

drop policy if exists "chat_att_write" on storage.objects;
create policy "chat_att_write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-attachments'
    and owner = auth.uid()
    and public.is_conversation_member(
      nullif(split_part(name, '/', 1), '')::uuid, auth.uid()
    )
  );

drop policy if exists "chat_att_delete" on storage.objects;
create policy "chat_att_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-attachments'
    and (owner = auth.uid() or public.has_role(auth.uid(),'admin'))
  );
