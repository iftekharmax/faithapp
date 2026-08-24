import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = "https://api.applywaybd.com";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SB_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("SB_SERVICE_ROLE_KEY is not set.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  global: {
    fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (h.get("Authorization") === `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) h.delete("Authorization");
      h.set("apikey", SUPABASE_SERVICE_ROLE_KEY);
      return fetch(input, { ...init, headers: h });
    },
  },
});

async function run() {
  const migrationPath = path.join(process.cwd(), 'db/migrations/20260805000000_enterprise_tasks.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log("Applying migration...");
  
  // Split the SQL into individual statements to handle some potential issues with multi-statement strings in rpc/exec if we were using a different tool, 
  // but here we can try running it as one block using a custom RPC if it exists, or individual queries.
  // Since we don't have a direct 'exec' RPC in a standard Supabase setup usually, we often use a dedicated migration tool.
  // However, I can try to run it via the SQL editor equivalent API if I had it, but I don't.
  // I will use a simple approach: parse the SQL and run it. 
  // Actually, Supabase JS client doesn't have an 'exec raw SQL' method.
  
  // I'll use a trick: create a temporary function that executes the SQL and then drop it.
  // This requires the postgres role, which service_role usually has enough perms for if not restricted.
  
  const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
  
  if (error) {
    if (error.message.includes("function \"exec_sql\" does not exist")) {
      console.log("exec_sql function missing. This migration requires manual application or a pre-existing exec_sql helper.");
      console.log("SQL to apply:\n", sql);
    } else {
      console.error("Migration failed:", error);
    }
    process.exit(1);
  }

  console.log("Migration applied successfully!");
}

run();
