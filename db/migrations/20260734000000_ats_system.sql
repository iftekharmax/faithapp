-- ApplyBoard-style ATS: checklists, reviews, offers, deadlines
-- Reuses existing applications + application_timeline (as activity log)
-- and university_programs (for /programs browsing).

-- Extra columns for applications (deadline, application_date; priority/status already exist)
alter table public.applications
  add column if not exists deadline date,
  add column if not exists application_date date;

-- =========================================================
-- Intakes lookup (for /programs filters)
-- =========================================================
create table if not exists public.intakes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  year int,
  sort_order int not null default 0,
  status public.uni_status not null default 'active',
  created_at timestamptz not null default now()
);
grant select on public.intakes to authenticated, anon;
grant all on public.intakes to service_role;
alter table public.intakes enable row level security;
drop policy if exists "intakes_read_all" on public.intakes;
create policy "intakes_read_all" on public.intakes for select to authenticated using (true);
drop policy if exists "intakes_write_admin" on public.intakes;
create policy "intakes_write_admin" on public.intakes for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- =========================================================
-- Application checklists
-- =========================================================
create table if not exists public.application_checklists (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  item_name text not null,
  is_required boolean not null default true,
  is_checked boolean not null default false,
  sort_order int not null default 0,
  checked_by uuid references auth.users(id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, item_name)
);
create index if not exists idx_app_checklist_app on public.application_checklists(application_id);

grant select, insert, update, delete on public.application_checklists to authenticated;
grant all on public.application_checklists to service_role;
alter table public.application_checklists enable row level security;
drop policy if exists "app_checklist_all_staff" on public.application_checklists;
create policy "app_checklist_all_staff" on public.application_checklists for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'));

drop trigger if exists trg_app_checklist_updated_at on public.application_checklists;
create trigger trg_app_checklist_updated_at before update on public.application_checklists
  for each row execute function public.set_updated_at();

-- Auto: when all required checked -> status = under_review (Ready for Review)
create or replace function public.checklist_auto_ready()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_total int;
  v_checked int;
  v_status public.application_status;
begin
  select count(*), count(*) filter (where is_checked)
    into v_total, v_checked
  from public.application_checklists
  where application_id = new.application_id and is_required;

  if v_total > 0 and v_total = v_checked then
    select status into v_status from public.applications where id = new.application_id;
    if v_status = 'draft' then
      update public.applications set status = 'under_review' where id = new.application_id;
      insert into public.application_timeline (application_id, event_type, title, description, actor_id)
      values (new.application_id, 'auto', 'Ready for review',
        'All required checklist items completed', auth.uid());
    end if;
  end if;

  insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
  values (new.application_id, 'checklist',
    case when new.is_checked then 'Checklist item completed' else 'Checklist item unchecked' end,
    new.item_name, auth.uid(),
    jsonb_build_object('item', new.item_name, 'checked', new.is_checked));

  return new;
end $$;

drop trigger if exists trg_app_checklist_ready on public.application_checklists;
create trigger trg_app_checklist_ready after update of is_checked on public.application_checklists
  for each row when (new.is_checked is distinct from old.is_checked)
  execute function public.checklist_auto_ready();

-- =========================================================
-- Internal review workflow
-- =========================================================
do $$ begin
  create type public.review_stage as enum ('processor','senior_processor','manager','submit');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.review_decision as enum ('pending','approved','rejected','changes_requested');
exception when duplicate_object then null; end $$;

create table if not exists public.application_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  stage public.review_stage not null,
  decision public.review_decision not null default 'pending',
  comments text,
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewer_email text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, stage)
);
create index if not exists idx_app_reviews_app on public.application_reviews(application_id);

grant select, insert, update, delete on public.application_reviews to authenticated;
grant all on public.application_reviews to service_role;
alter table public.application_reviews enable row level security;
drop policy if exists "app_reviews_all_staff" on public.application_reviews;
create policy "app_reviews_all_staff" on public.application_reviews for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'));

drop trigger if exists trg_app_reviews_updated_at on public.application_reviews;
create trigger trg_app_reviews_updated_at before update on public.application_reviews
  for each row execute function public.set_updated_at();

create or replace function public.log_review_decision()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.decision <> 'pending' and (tg_op = 'INSERT' or new.decision is distinct from old.decision) then
    new.decided_at := coalesce(new.decided_at, now());
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
    values (new.application_id, 'review',
      'Review ' || new.decision::text || ' — ' || new.stage::text,
      coalesce(new.comments, ''), auth.uid(),
      jsonb_build_object('stage', new.stage, 'decision', new.decision));
  end if;
  return new;
end $$;

drop trigger if exists trg_app_reviews_log on public.application_reviews;
create trigger trg_app_reviews_log before insert or update on public.application_reviews
  for each row execute function public.log_review_decision();

-- =========================================================
-- Offer letters
-- =========================================================
do $$ begin
  create type public.offer_type as enum ('conditional','unconditional','reject');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.offer_acceptance as enum ('pending','accepted','declined','expired');
exception when duplicate_object then null; end $$;

create table if not exists public.application_offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  offer_type public.offer_type not null,
  offer_date date not null default current_date,
  expiry_date date,
  deposit_amount numeric(12,2),
  currency text default 'USD',
  acceptance public.offer_acceptance not null default 'pending',
  accepted_at timestamptz,
  offer_file_url text,
  offer_file_path text,
  acceptance_file_url text,
  acceptance_file_path text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_app_offers_app on public.application_offers(application_id);

grant select, insert, update, delete on public.application_offers to authenticated;
grant all on public.application_offers to service_role;
alter table public.application_offers enable row level security;
drop policy if exists "app_offers_all_staff" on public.application_offers;
create policy "app_offers_all_staff" on public.application_offers for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'counselor') or public.has_role(auth.uid(),'application_team'));

drop trigger if exists trg_app_offers_updated_at on public.application_offers;
create trigger trg_app_offers_updated_at before update on public.application_offers
  for each row execute function public.set_updated_at();

create or replace function public.log_offer_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
    values (new.application_id, 'offer', 'Offer received — ' || new.offer_type::text,
      coalesce(new.notes,''), auth.uid(),
      jsonb_build_object('offer_type', new.offer_type));
  elsif new.acceptance is distinct from old.acceptance then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
    values (new.application_id, 'offer',
      'Offer ' || new.acceptance::text, '', auth.uid(),
      jsonb_build_object('acceptance', new.acceptance));
  end if;
  return new;
end $$;

drop trigger if exists trg_app_offers_log on public.application_offers;
create trigger trg_app_offers_log after insert or update on public.application_offers
  for each row execute function public.log_offer_change();

-- =========================================================
-- Log document uploads/removes as timeline events
-- =========================================================
create or replace function public.log_document_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
    values (new.application_id, 'document', 'Document uploaded',
      coalesce(new.category || ' · ', '') || new.name, new.uploaded_by,
      jsonb_build_object('doc_id', new.id, 'name', new.name));
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.application_timeline (application_id, event_type, title, description, actor_id, metadata)
    values (old.application_id, 'document', 'Document removed', old.name, auth.uid(),
      jsonb_build_object('doc_id', old.id));
    return old;
  end if;
  return null;
end $$;

drop trigger if exists trg_app_docs_log on public.application_documents;
create trigger trg_app_docs_log after insert or delete on public.application_documents
  for each row execute function public.log_document_change();

-- =========================================================
-- Realtime
-- =========================================================
do $$ begin
  alter publication supabase_realtime add table public.applications;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.application_timeline;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.application_checklists;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.application_reviews;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.application_offers;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.application_documents;
exception when duplicate_object then null; end $$;

-- =========================================================
-- Seed intakes
-- =========================================================
insert into public.intakes (name, year, sort_order) values
  ('Spring 2026', 2026, 1),
  ('Summer 2026', 2026, 2),
  ('Fall 2026', 2026, 3),
  ('Winter 2026', 2026, 4),
  ('Spring 2027', 2027, 5),
  ('Fall 2027', 2027, 6)
on conflict (name) do nothing;
