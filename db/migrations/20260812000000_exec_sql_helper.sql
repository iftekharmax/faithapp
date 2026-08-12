-- Ensure the exec_sql helper exists
-- This function allows running raw SQL via the Supabase RPC API
-- It is restricted to the service_role for security

CREATE OR REPLACE FUNCTION public.exec_sql(sql_string text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql_string;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
