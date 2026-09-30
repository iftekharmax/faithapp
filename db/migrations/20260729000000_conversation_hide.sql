-- =====================================================================
-- Per-user "hide conversation" — keep history intact, reappear on new msg
-- =====================================================================

alter table if exists public.conversation_members
  add column if not exists hidden_at timestamptz;

-- Rebuild view: exclude conversations the current user hid, unless a new
-- message arrived after the hide timestamp.
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
where m.user_id = auth.uid()
  and (m.hidden_at is null or c.last_message_at > m.hidden_at);

grant select on public.my_conversations_view to authenticated;

-- Hide (soft) the current user's view of a conversation. History stays.
create or replace function public.hide_conversation(_cid uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare _now timestamptz := now();
begin
  if not public.is_conversation_member(_cid, auth.uid()) then
    raise exception 'not a conversation member' using errcode = '42501';
  end if;
  update public.conversation_members
     set hidden_at = _now
   where conversation_id = _cid and user_id = auth.uid();
  return _now;
end $$;
grant execute on function public.hide_conversation(uuid) to authenticated;

-- Unhide explicitly (e.g. reopening from People directory).
create or replace function public.unhide_conversation(_cid uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_conversation_member(_cid, auth.uid()) then
    raise exception 'not a conversation member' using errcode = '42501';
  end if;
  update public.conversation_members
     set hidden_at = null
   where conversation_id = _cid and user_id = auth.uid();
end $$;
grant execute on function public.unhide_conversation(uuid) to authenticated;
