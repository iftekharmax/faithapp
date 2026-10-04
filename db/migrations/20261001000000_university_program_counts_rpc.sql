-- Helper function to return program counts grouped by university without hitting PostgREST 1000-row limit
create or replace function public.get_university_program_counts()
returns table (university_id uuid, program_count bigint)
language sql stable security definer
set search_path = public
as $$
  select university_id, count(*)::bigint as program_count
  from public.university_programs
  where university_id is not null
  group by university_id;
$$;

grant execute on function public.get_university_program_counts() to authenticated, anon, service_role;
