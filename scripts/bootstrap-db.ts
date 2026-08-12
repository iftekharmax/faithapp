import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

async function bootstrap() {
  const DB_PASSWORD = "bxwhgrS6uoBsEEru"; 
  const PROJECT_ID = "qdveirhlzuzrxaqjevxr";
  
  // Try common Supabase connection hosts
  const hosts = [
    `db.${PROJECT_ID}.supabase.co`,
    `aws-0-us-east-1.pooler.supabase.com`
  ];

  for (const host of hosts) {
    // Try both direct (5432) and pooler (6543) ports
    const ports = [5432, 6543];
    
    for (const port of ports) {
      // Use postgres.project_id for pooler if host is common pooler
      const user = host.includes('pooler') ? `postgres.${PROJECT_ID}` : 'postgres';
      
      console.log(`🔗 Trying to connect to ${host}:${port} as ${user}...`);
      
      const client = new Client({
        host,
        port,
        database: 'postgres',
        user,
        password: DB_PASSWORD,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 5000,
      });

      try {
        await client.connect();
        console.log("✅ Connected!");

        const helperPath = path.join(process.cwd(), 'db/migrations/20260812000000_exec_sql_helper.sql');
        const sql = fs.readFileSync(helperPath, 'utf8');
        
        console.log("🚀 Applying exec_sql helper...");
        await client.query(sql);
        console.log("✅ Applied!");
        
        await client.query("NOTIFY pgrst, 'reload schema';");
        await client.end();
        return; // Success!
      } catch (err: any) {
        console.log(`❌ Failed: ${err.message}`);
        try { await client.end(); } catch {}
      }
    }
  }
  
  console.error("❌ All connection attempts failed.");
  process.exit(1);
}

bootstrap();
