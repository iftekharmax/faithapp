import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qdveirhlzuzrxaqjevxr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BKdIW3Wk9DQ5-oBiNPHGmw_2lpXrA0Z";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: (input, init) => {
      const h = new Headers(init?.headers);
      if (h.get("Authorization") === \`Bearer \${SUPABASE_PUBLISHABLE_KEY}\`) h.delete("Authorization");
      h.set("apikey", SUPABASE_PUBLISHABLE_KEY);
      return fetch(input, { ...init, headers: h });
    },
  },
});

async function check() {
  console.log('--- Testing applications -> assigned_team (profiles) ---');
  const { data: appData, error: appError } = await supabase
    .from('applications')
    .select('id, assigned_team:profiles(id, full_name, email)')
    .limit(1);

  if (appError) {
    console.error('Relationship failed:', appError.message);
    if (appError.details) console.error('Details:', appError.details);
    if (appError.hint) console.error('Hint:', appError.hint);
  } else {
    console.log('Relationship works!', appData);
  }

  console.log('\n--- Testing application_timeline -> actor_profile (profiles) ---');
  const { data: timelineData, error: timelineError } = await supabase
    .from('application_timeline')
    .select('id, actor_profile:profiles(id, full_name)')
    .limit(1);

  if (timelineError) {
    console.error('Timeline relationship failed:', timelineError.message);
  } else {
    console.log('Timeline relationship works!', timelineData);
  }
}

check();
