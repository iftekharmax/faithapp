import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function migrate() {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://qdveirhlzuzrxaqjevxr.supabase.co";
  const SERVICE_ROLE_KEY = process.env.SB_SERVICE_ROLE_KEY;

  if (!SERVICE_ROLE_KEY) {
    console.error("❌ SB_SERVICE_ROLE_KEY is missing. Add it to Secrets.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", SERVICE_ROLE_KEY);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const migrationsDir = path.join(process.cwd(), 'db/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log("🔍 Checking migrations...");

  // Ensure tracking table exists
  await supabase.rpc('exec_sql', { sql_string: `
    CREATE TABLE IF NOT EXISTS public._migrations (
      version text PRIMARY KEY,
      name text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  ` });

  const { data: appliedData } = await supabase
    .from('_migrations')
    .select('version');
  
  const applied = new Set((appliedData || []).map((m: any) => m.version));

  for (const file of files) {
    const version = file.split('_')[0];
    if (applied.has(version)) continue;

    console.log(`🚀 Applying ${file}...`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    
    const { error } = await supabase.rpc('exec_sql', { sql_string: sql });
    
    if (error) {
      console.error(`❌ Failed to apply ${file}: `, error.message);
      process.exit(1);
    }

    await supabase.from('_migrations').insert({ version, name: file });
    console.log(`✅ ${file} applied.`);
  }

  await supabase.rpc('exec_sql', { sql_string: "NOTIFY pgrst, 'reload schema';" });
  console.log("✨ All migrations complete.");
}

migrate();
