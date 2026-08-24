import { createClient } from "@supabase/supabase-js";

// Publishable (anon) key — safe to ship in client bundle.
const SUPABASE_URL = "https://supabasekong-hzfocpuu60pnsz7ymsrcvj7o.194.233.66.66.sslip.io";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJzdXBhYmFzZSIsImlhdCI6MTc4NzQ2MjE2MCwiZXhwIjo0OTQzMTM1NzYwLCJyb2xlIjoiYW5vbiJ9.MKnYf63pLHjGrOVDZqHswu0V_WMu8Aa4Af7Eg-rrFgI";

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
