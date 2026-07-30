-- Adds email_verified + email_confirmed_at to admin_users_view.
drop view if exists public.admin_users_view;
create view public.admin_users_view as
select
  p.id,
  p.email,
  p.full_name,
  p.phone,
  p.avatar_url,
  p.department,
  p.status,
  p.is_locked,
  p.last_login_at,
  p.created_at,
  (u.email_confirmed_at is not null) as email_verified,
  u.email_confirmed_at,
  coalesce(
    (select array_agg(ur.role::text order by ur.role::text)
       from public.user_roles ur where ur.user_id = p.id),
    array[]::text[]
  ) as roles
from public.profiles p
left join auth.users u on u.id = p.id;

grant select on public.admin_users_view to authenticated;
