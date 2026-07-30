-- Add 'required' as the default status for new document requests.
-- Counselor upload transitions status to 'pending'.

do $$ begin
  alter type public.doc_request_status add value if not exists 'required';
exception when others then null; end $$;
