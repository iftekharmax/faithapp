-- =====================================================================
-- Global Enterprise Chat System
-- =====================================================================

-- 1. Conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct','group','application')),
  title text,
  application_id uuid references public.applications(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists idx_conversations_app on public.conversations(application_id);
create index if not exists idx_conversations_last_msg on public.conversations(last_message_at desc);

grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;

-- 2. Members
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  last_read_at timestamptz,
  muted boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists idx_conv_members_user on public.conversation_members(user_id);

grant select, insert, update, delete on public.conversation_members to authenticated;
grant all on public.conversation_members to service_role;
alter table public.conversation_members enable row level security;

-- 3. Security-definer membership check (avoids RLS recursion)
create or replace function public.is_conversation_member(_cid uuid, _uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.conversation_members
                where conversation_id = _cid and user_id = _uid);
$$;
grant execute on function public.is_conversation_member(uuid, uuid) to authenticated;

-- 4. Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid references auth.users(id) on delete set null,
  body text,
  attachments jsonb not null default '[]'::jsonb,
  reply_to_id uuid references public.messages(id) on delete set null,
  edited_at timestamptz,
  deleted_at timestamptz,
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conv on public.messages(conversation_id, created_at desc);
create index if not exists idx_messages_sender on public.messages(sender_id);

grant select, insert, update, delete on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;

-- 5. Reactions
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
grant select, insert, delete on public.message_reactions to authenticated;
grant all on public.message_reactions to service_role;
alter table public.message_reactions enable row level security;

-- 6. Stars
create table if not exists public.message_stars (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
grant select, insert, delete on public.message_stars to authenticated;
grant all on public.message_stars to service_role;
alter table public.message_stars enable row level security;

-- 7. Presence
create table if not exists public.user_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'offline' check (status in ('online','away','offline')),
  last_seen_at timestamptz not null default now()
);
grant select, insert, update on public.user_presence to authenticated;
grant all on public.user_presence to service_role;
alter table public.user_presence enable row level security;

-- =====================================================================
-- RLS Policies
-- =====================================================================

-- Conversations: members can read, admins can read all
drop policy if exists "conv_select_member" on public.conversations;
create policy "conv_select_member" on public.conversations for select to authenticated
  using (public.is_conversation_member(id, auth.uid()) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "conv_insert_auth" on public.conversations;
create policy "conv_insert_auth" on public.conversations for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "conv_update_member" on public.conversations;
create policy "conv_update_member" on public.conversations for update to authenticated
  using (public.is_conversation_member(id, auth.uid()) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "conv_delete_admin" on public.conversations;
create policy "conv_delete_admin" on public.conversations for delete to authenticated
  using (public.has_role(auth.uid(), 'admin') or created_by = auth.uid());

-- Members: readable by any member of the same conversation
drop policy if exists "conv_members_select" on public.conversation_members;
create policy "conv_members_select" on public.conversation_members for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "conv_members_insert" on public.conversation_members;
create policy "conv_members_insert" on public.conversation_members for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
    or exists(select 1 from public.conversations c
              where c.id = conversation_id and c.created_by = auth.uid())
    or public.is_conversation_member(conversation_id, auth.uid())
  );

drop policy if exists "conv_members_update_self" on public.conversation_members;
create policy "conv_members_update_self" on public.conversation_members for update to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "conv_members_delete" on public.conversation_members;
create policy "conv_members_delete" on public.conversation_members for delete to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Messages
drop policy if exists "msg_select_member" on public.messages;
create policy "msg_select_member" on public.messages for select to authenticated
  using (public.is_conversation_member(conversation_id, auth.uid()) or public.has_role(auth.uid(), 'admin'));

drop policy if exists "msg_insert_member" on public.messages;
create policy "msg_insert_member" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_conversation_member(conversation_id, auth.uid()));

drop policy if exists "msg_update_own" on public.messages;
create policy "msg_update_own" on public.messages for update to authenticated
  using (sender_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

drop policy if exists "msg_delete_own" on public.messages;
create policy "msg_delete_own" on public.messages for delete to authenticated
  using (sender_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Reactions
drop policy if exists "reactions_select" on public.message_reactions;
create policy "reactions_select" on public.message_reactions for select to authenticated
  using (exists(select 1 from public.messages m
                where m.id = message_id
                  and (public.is_conversation_member(m.conversation_id, auth.uid()) or public.has_role(auth.uid(),'admin'))));

drop policy if exists "reactions_insert_self" on public.message_reactions;
create policy "reactions_insert_self" on public.message_reactions for insert to authenticated
  with check (user_id = auth.uid() and exists(
    select 1 from public.messages m where m.id = message_id
      and public.is_conversation_member(m.conversation_id, auth.uid())
  ));

drop policy if exists "reactions_delete_self" on public.message_reactions;
create policy "reactions_delete_self" on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- Stars (private per user)
drop policy if exists "stars_select_self" on public.message_stars;
create policy "stars_select_self" on public.message_stars for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "stars_insert_self" on public.message_stars;
create policy "stars_insert_self" on public.message_stars for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "stars_delete_self" on public.message_stars;
create policy "stars_delete_self" on public.message_stars for delete to authenticated
  using (user_id = auth.uid());

-- Presence: anyone signed-in can read; upsert only own row
drop policy if exists "presence_select_all" on public.user_presence;
create policy "presence_select_all" on public.user_presence for select to authenticated using (true);
drop policy if exists "presence_upsert_self" on public.user_presence;
create policy "presence_upsert_self" on public.user_presence for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "presence_update_self" on public.user_presence;
create policy "presence_update_self" on public.user_presence for update to authenticated
  using (user_id = auth.uid());

-- =====================================================================
-- Triggers: bump conversations.last_message_at on new message
-- =====================================================================
create or replace function public.bump_conversation_last_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = now() where id = new.conversation_id;
  return new;
end $$;

drop trigger if exists trg_msg_bump on public.messages;
create trigger trg_msg_bump after insert on public.messages
  for each row execute function public.bump_conversation_last_message();

-- =====================================================================
-- Helpers
-- =====================================================================

-- Find-or-create a direct conversation between two users
create or replace function public.get_or_create_direct_conversation(_other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _me uuid := auth.uid();
  _cid uuid;
begin
  if _me is null then raise exception 'unauthenticated'; end if;
  if _me = _other then raise exception 'cannot chat with self'; end if;

  select c.id into _cid
  from public.conversations c
  where c.type = 'direct'
    and exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.user_id=_me)
    and exists(select 1 from public.conversation_members m where m.conversation_id=c.id and m.user_id=_other)
    and (select count(*) from public.conversation_members m where m.conversation_id=c.id) = 2
  limit 1;

  if _cid is not null then return _cid; end if;

  insert into public.conversations (type, created_by) values ('direct', _me) returning id into _cid;
  insert into public.conversation_members (conversation_id, user_id, role) values (_cid, _me, 'owner');
  insert into public.conversation_members (conversation_id, user_id, role) values (_cid, _other, 'member');
  return _cid;
end $$;
grant execute on function public.get_or_create_direct_conversation(uuid) to authenticated;

-- Get-or-create an application conversation (staff auto-added)
create or replace function public.get_or_create_application_conversation(_app uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _me uuid := auth.uid();
  _cid uuid;
  _counselor uuid;
  _officer uuid;
  _title text;
  _admin uuid;
begin
  if _me is null then raise exception 'unauthenticated'; end if;

  select id into _cid from public.conversations where application_id = _app limit 1;
  if _cid is not null then
    -- ensure caller is a member (admins auto-add themselves)
    if not public.is_conversation_member(_cid, _me) then
      if public.has_role(_me, 'admin') then
        insert into public.conversation_members (conversation_id, user_id) values (_cid, _me)
          on conflict do nothing;
      end if;
    end if;
    return _cid;
  end if;

  select a.assigned_counselor_id, a.assigned_officer_id,
         coalesce(a.application_code || ' — ' || a.university, 'Application')
    into _counselor, _officer, _title
    from public.applications a where a.id = _app;

  if _title is null then raise exception 'application not found'; end if;

  insert into public.conversations (type, application_id, title, created_by)
  values ('application', _app, _title, _me) returning id into _cid;

  -- add creator, counselor, officer
  insert into public.conversation_members (conversation_id, user_id, role) values (_cid, _me, 'owner')
    on conflict do nothing;
  if _counselor is not null then
    insert into public.conversation_members (conversation_id, user_id) values (_cid, _counselor)
      on conflict do nothing;
  end if;
  if _officer is not null then
    insert into public.conversation_members (conversation_id, user_id) values (_cid, _officer)
      on conflict do nothing;
  end if;
  -- add all admins
  for _admin in select user_id from public.user_roles where role = 'admin' loop
    insert into public.conversation_members (conversation_id, user_id) values (_cid, _admin)
      on conflict do nothing;
  end loop;

  return _cid;
end $$;
grant execute on function public.get_or_create_application_conversation(uuid) to authenticated;

-- Unread count per conversation for the current user
create or replace view public.my_conversations_view as
select
  c.id,
  c.type,
  c.title,
  c.application_id,
  c.last_message_at,
  c.created_at,
  m.last_read_at,
  (select count(*) from public.messages msg
    where msg.conversation_id = c.id
      and msg.deleted_at is null
      and (m.last_read_at is null or msg.created_at > m.last_read_at)
      and msg.sender_id is distinct from auth.uid()
  ) as unread_count,
  (select jsonb_agg(jsonb_build_object('user_id', mm.user_id, 'role', mm.role))
     from public.conversation_members mm where mm.conversation_id = c.id) as members,
  (select jsonb_build_object('id', lm.id, 'body', lm.body, 'sender_id', lm.sender_id, 'created_at', lm.created_at, 'attachments', lm.attachments)
     from public.messages lm
     where lm.conversation_id = c.id and lm.deleted_at is null
     order by lm.created_at desc limit 1) as last_message
from public.conversations c
join public.conversation_members m on m.conversation_id = c.id
where m.user_id = auth.uid();

grant select on public.my_conversations_view to authenticated;

-- =====================================================================
-- Realtime publications
-- =====================================================================
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='message_reactions') then
    execute 'alter publication supabase_realtime add table public.message_reactions';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversation_members') then
    execute 'alter publication supabase_realtime add table public.conversation_members';
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='user_presence') then
    execute 'alter publication supabase_realtime add table public.user_presence';
  end if;
exception when others then null;
end $$;

-- =====================================================================
-- Storage bucket for attachments
-- =====================================================================
insert into storage.buckets (id, name, public) values ('chat-attachments','chat-attachments', false)
on conflict (id) do nothing;

drop policy if exists "chat_att_read" on storage.objects;
create policy "chat_att_read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments');

drop policy if exists "chat_att_write" on storage.objects;
create policy "chat_att_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-attachments' and owner = auth.uid());

drop policy if exists "chat_att_delete" on storage.objects;
create policy "chat_att_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-attachments' and (owner = auth.uid() or public.has_role(auth.uid(),'admin')));
