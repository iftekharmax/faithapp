-- Extend departments with optional logo + status
alter table public.departments add column if not exists logo_url text;
alter table public.departments add column if not exists status text not null default 'active';

do $$ begin
  alter table public.departments add constraint departments_status_chk
    check (status in ('active','inactive'));
exception when duplicate_object then null; end $$;

create index if not exists departments_status_idx on public.departments (status);
create index if not exists departments_created_at_idx on public.departments (created_at desc);
