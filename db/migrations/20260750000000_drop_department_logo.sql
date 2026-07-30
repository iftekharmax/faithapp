-- Remove department logo support; departments are represented by initials + gradient in the UI.
alter table if exists public.departments drop column if exists logo_url;
