import pg from 'pg';
const { Client } = pg;

const dbUrl = "postgresql://postgres:9h%21wD4%40T-fF%2AM%26y@db.qdveirhlzuzrxaqjevxr.supabase.co:5432/postgres";

async function run() {
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log("Connected to DB");
    
    console.log("Adding column others_fees to university_programs...");
    await client.query("ALTER TABLE public.university_programs ADD COLUMN IF NOT EXISTS others_fees JSONB DEFAULT '[]'::jsonb;");
    
    console.log("Reloading PostgREST schema cache...");
    await client.query("NOTIFY pgrst, 'reload schema';");
    
    console.log("Success!");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
