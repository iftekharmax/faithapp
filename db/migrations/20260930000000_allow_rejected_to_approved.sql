-- Allow document requests to transition from 'rejected' to 'approved' and 'hold'.
create or replace function public.is_valid_docreq_transition(_from text, _to text)
returns boolean language sql immutable as $$
  select case
    when _from = _to then true
    when _from = 'required'     then _to in ('pending','hold','rejected')
    when _from = 'pending'      then _to in ('under_review','hold','rejected','approved','required')
    when _from = 'under_review' then _to in ('hold','rejected','approved','pending')
    when _from = 'hold'         then _to in ('pending','under_review','rejected','approved','required')
    when _from = 'rejected'     then _to in ('required','pending','under_review','hold','approved')
    when _from = 'approved'     then _to in ('pending','required')
    when _from = 'uploaded'     then _to in ('under_review','hold','rejected','approved','pending')
    else false
  end
$$;
