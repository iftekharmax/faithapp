import os
import psycopg2

db_url = "postgresql://postgres:9h%21wD4%40T-fF%2AM%26y@db.qdveirhlzuzrxaqjevxr.supabase.co:5432/postgres"

try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    with conn.cursor() as cur:
        print("Adding column others_fees to university_programs...")
        cur.execute("ALTER TABLE public.university_programs ADD COLUMN IF NOT EXISTS others_fees JSONB DEFAULT '[]'::jsonb;")
        
        print("Reloading PostgREST schema cache...")
        cur.execute("NOTIFY pgrst, 'reload schema';")
        
        print("Success!")
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
