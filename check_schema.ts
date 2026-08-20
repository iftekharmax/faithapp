
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qdveirhlzuzrxaqjevxr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BKdIW3Wk9DQ5-oBiNPHGmw_2lpXrA0Z";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (h.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) h.delete("Authorization");
      h.set("apikey", SUPABASE_PUBLISHABLE_KEY);
      return fetch(input, { ...init, headers: h });
    },
  },
});

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

  console.log('\nChecking application_timeline relationship...');
  const { data: timelineData, error: timelineError } = await supabase
    .from('application_timeline')
    .select('*, actor_profile:profiles(id, full_name)')
    .limit(1);

  if (timelineError) {
    console.error('Error fetching application_timeline relationship:', timelineError);
  } else {
    console.log('application_timeline relationship result:', timelineData);
  }
}

checkSchema();
