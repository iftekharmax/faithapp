import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function bootstrap() {
  // Use the password provided by the user in context
  const DB_PASSWORD = "faithapp_password_2024"; 
  const PROJECT_ID = "qdveirhlzuzrxaqjevxr";
  const DB_USER = "postgres";
  const DB_HOST = `db.${PROJECT_ID}.supabase.co`;
  const DB_PORT = 5432;
  const DB_NAME = "postgres";

  const connectionString = `postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;

  console.log(`🔗 Connecting to database at ${DB_HOST}...`);
  const client = new Client({
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log("✅ Connected to database.");

    const helperPath = path.join(process.cwd(), 'db/migrations/20260812000000_exec_sql_helper.sql');
    if (!fs.existsSync(helperPath)) {
      throw new Error(`Migration helper file not found at ${helperPath}`);
    }

    const sql = fs.readFileSync(helperPath, 'utf8');
    console.log("🚀 Applying exec_sql helper...");
    
    await client.query(sql);
    console.log("✅ exec_sql helper applied successfully.");

    // Also reload schema just in case
    await client.query("NOTIFY pgrst, 'reload schema';");
    console.log("✨ PostgREST schema reload notified.");

  } catch (err: any) {
    console.error("❌ Bootstrap failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

bootstrap();
