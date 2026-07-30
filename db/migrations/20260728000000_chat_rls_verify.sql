-- =====================================================================
-- Chat RLS verification & hardening (idempotent)
-- Confirms only conversation members can read messages/members/reactions/
-- stars, and that file metadata (jsonb attachments on messages) inherits
-- the messages SELECT policy. Storage RLS for chat-attachments was set in
-- 20260727000000_chat_hardening.sql. Typing is transport-only (Realtime
-- broadcast) and never persisted, so there is no server row to protect.
-- =====================================================================

-- 1) Ensure RLS is enabled on every chat table
alter table if exists public.conversations         enable row level security;
alter table if exists public.conversation_members  enable row level security;
alter table if exists public.messages              enable row level security;
alter table if exists public.message_reactions     enable row level security;
alter table if exists public.message_stars         enable row level security;
alter table if exists public.user_presence         enable row level security;

-- 2) message_stars: member-only reads (a star is a receipt on a message
--    row the user must already be allowed to read).
drop policy if exists "stars_select_member" on public.message_stars;
create policy "stars_select_member" on public.message_stars for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.messages m
      where m.id = message_id
        and (public.is_conversation_member(m.conversation_id, auth.uid())
             or public.has_role(auth.uid(),'admin'))
    )
  );

drop policy if exists "stars_write_self" on public.message_stars;
create policy "stars_write_self" on public.message_stars for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and public.is_conversation_member(m.conversation_id, auth.uid())
    )
  );

drop policy if exists "stars_delete_self" on public.message_stars;
create policy "stars_delete_self" on public.message_stars for delete to authenticated
  using (user_id = auth.uid());

-- 3) user_presence: any authenticated user can read presence (needed to
--    render online/last-seen indicators app-wide); users can only write
--    their OWN presence row.
drop policy if exists "presence_select_all" on public.user_presence;
create policy "presence_select_all" on public.user_presence for select to authenticated
  using (true);

drop policy if exists "presence_write_self" on public.user_presence;
create policy "presence_write_self" on public.user_presence for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "presence_update_self" on public.user_presence;
create policy "presence_update_self" on public.user_presence for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4) Ensure required grants (idempotent — Supabase does not auto-grant public
--    schema; grants here match RLS policies).
grant select, insert, update, delete on public.conversations        to authenticated;
grant select, insert, update, delete on public.conversation_members to authenticated;
grant select, insert, update, delete on public.messages             to authenticated;
grant select, insert, delete         on public.message_reactions    to authenticated;
grant select, insert, delete         on public.message_stars        to authenticated;
grant select, insert, update         on public.user_presence        to authenticated;

grant all on public.conversations, public.conversation_members, public.messages,
            public.message_reactions, public.message_stars, public.user_presence
      to service_role;

-- 5) Reconciliation helper: server-authoritative "mark read" that also
--    returns the updated cursor, so clients can reconcile after reconnect.
create or replace function public.mark_conversation_read(_cid uuid)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  _now timestamptz := now();
begin
  if not public.is_conversation_member(_cid, auth.uid()) then
    raise exception 'not a conversation member' using errcode = '42501';
  end if;
  update public.conversation_members
     set last_read_at = _now
   where conversation_id = _cid and user_id = auth.uid();
  return _now;
end $$;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
