-- Extend doc_request_status enum with 'under_review' and 'hold'.
-- New flow: counselor upload no longer auto-moves status; app team drives status.

do $$ begin
  alter type public.doc_request_status add value if not exists 'under_review';
exception when others then null; end $$;

do $$ begin
  alter type public.doc_request_status add value if not exists 'hold';
exception when others then null; end $$;
