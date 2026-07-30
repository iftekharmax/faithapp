-- Admin-only RPC that asks PostgREST to reload its schema cache. Used by the
-- client-side auto-retry flow: when the students table appears to be missing
-- columns from the latest migration, the app calls this RPC and re-probes.
create or replace function public.pgrst_reload_schema()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then
    raise exception 'admin only' using errcode = '42501';
  end if;
  notify pgrst, 'reload schema';
end
$$;

revoke all on function public.pgrst_reload_schema() from public;
grant execute on function public.pgrst_reload_schema() to authenticated;

notify pgrst, 'reload schema';
