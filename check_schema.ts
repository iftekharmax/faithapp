
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking applications table...');
  const { data, error } = await supabase
    .from('applications')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching applications:', error);
  } else {
    console.log('Applications columns:', data.length > 0 ? Object.keys(data[0]) : 'Table is empty');
  }

  console.log('\nChecking assigned_team relationship...');
  const { data: relData, error: relError } = await supabase
    .from('applications')
    .select('id, assigned_team:profiles(id, full_name)')
    .limit(1);

  if (relError) {
    console.error('Error fetching assigned_team relationship:', relError);
  } else {
    console.log('assigned_team relationship result:', relData);
  }
}

checkSchema();
