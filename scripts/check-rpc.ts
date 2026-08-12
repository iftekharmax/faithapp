import { createClient } from '@supabase/supabase-js';

async function check() {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://qdveirhlzuzrxaqjevxr.supabase.co";
  const SERVICE_ROLE_KEY = process.env.SB_SERVICE_ROLE_KEY;

  if (!SERVICE_ROLE_KEY) {
    console.error("SB_SERVICE_ROLE_KEY missing");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  console.log("Checking if exec_sql exists...");
  const { error: rpcError } = await supabase.rpc('exec_sql', { sql_string: 'SELECT 1' });
  if (rpcError) {
    console.log("exec_sql check failed:", rpcError.message);
  } else {
    console.log("exec_sql EXISTS!");
  }

  console.log("Checking if pgrst_reload_schema exists...");
  const { error: reloadError } = await supabase.rpc('pgrst_reload_schema');
  if (reloadError) {
    console.log("pgrst_reload_schema check failed:", reloadError.message);
  } else {
    console.log("pgrst_reload_schema EXISTS!");
  }
}

check();
