-- Scheduled scan for Document Requirement deadlines.
-- Runs public.check_docreq_deadlines(3) every day at 08:00 UTC via pg_cron,
-- so counselors / application team / admins get in-app + email alerts for
-- upcoming (within 3 days) and overdue requirements without anyone pressing
-- the "Check deadlines" button.
--
-- Safe to run on installs where pg_cron is not available: the DO block is a
-- no-op in that case.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;

    if exists (select 1 from cron.job where jobname = 'docreq_deadline_scan') then
      perform cron.unschedule('docreq_deadline_scan');
    end if;

    perform cron.schedule(
      'docreq_deadline_scan',
      '0 8 * * *',
      $cron$select public.check_docreq_deadlines(3);$cron$
    );
  end if;
end $$;
