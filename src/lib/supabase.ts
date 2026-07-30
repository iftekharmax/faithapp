import { createClient } from "@supabase/supabase-js";

// Publishable (anon) key — safe to ship in client bundle.
const SUPABASE_URL = "https://qdveirhlzuzrxaqjevxr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BKdIW3Wk9DQ5-oBiNPHGmw_2lpXrA0Z";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
  global: {
    fetch: (input, init) => {
      // Opaque sb_* keys aren't JWTs; strip the default Bearer to avoid PostgREST JWT parse errors.
      const h = new Headers(init?.headers);
      if (h.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) h.delete("Authorization");
      h.set("apikey", SUPABASE_PUBLISHABLE_KEY);
      return fetch(input, { ...init, headers: h });
    },
  },
});

export type AppRole = "admin" | "counselor" | "application_team" | "student";
