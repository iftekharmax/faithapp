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
  if (!fs.existsSync(migrationsDir)) {
    console.error(`❌ Migrations directory not found at ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log("🔍 Checking migrations...");

  // 1. Ensure tracking table exists
  try {
    await supabase.rpc('exec_sql', { 
      sql_string: `
        CREATE TABLE IF NOT EXISTS public._migrations (
          version text PRIMARY KEY,
          name text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        );
      ` 
    });
  } catch (err: any) {
    if (err.message?.includes('exec_sql')) {
      console.warn("⚠️  'exec_sql' RPC not found. If this is a fresh database, you may need to apply the helper first.");
      // We can't apply the helper via the helper if it doesn't exist, chicken-and-egg.
      // But usually this script is run by the agent who has access to the SQL editor or knows how to bootstrap.
    }
    console.error("❌ Error initializing migration table:", err.message);
    process.exit(1);
  }

  // 2. Get applied migrations
  const { data: appliedData, error: fetchError } = await supabase
    .from('_migrations')
    .select('version');
  
  if (fetchError) {
    console.error("❌ Error fetching applied migrations:", fetchError.message);
    process.exit(1);
  }
  
  const applied = new Set((appliedData || []).map((m: any) => m.version));

  // 3. Apply pending migrations
  let count = 0;
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

    const { error: insertError } = await supabase.from('_migrations').insert({ version, name: file });
    if (insertError) {
      console.error(`❌ Failed to record migration ${file}: `, insertError.message);
      process.exit(1);
    }
    
    console.log(`✅ ${file} applied.`);
    count++;
  }

  // 4. Reload PostgREST
  if (count > 0) {
    await supabase.rpc('exec_sql', { sql_string: "NOTIFY pgrst, 'reload schema';" });
    console.log(`✨ Applied ${count} new migration(s). PostgREST reloaded.`);
  } else {
    console.log("✨ All migrations are already up to date.");
  }
}

migrate().catch(err => {
  console.error("❌ Migration runner crashed:", err);
  process.exit(1);
});
