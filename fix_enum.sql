do $$ begin
  alter type public.task_status add value 'completed';
exception when duplicate_object then null; end $$;

do $$ begin
  alter type public.task_status add value 'done';
exception when duplicate_object then null; end $$;
