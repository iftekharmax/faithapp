-- PostgREST schema reload RPC
create or replace function public.reload_schema()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  notify pgrst, 'reload schema';
end;
$$;

grant execute on function public.reload_schema() to service_role;
