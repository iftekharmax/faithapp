import { supabase } from "./supabase";
import { probeStudentSchema, type SchemaReport } from "./schema-probe";

// Result of an automatic reload + recheck cycle.
export interface ReloadResult {
  attempts: number;
  // True when the RPC accepted (admin) — false when denied or errored.
  reloaded: boolean;
  reloadError?: string;
  report: SchemaReport;
}

// Ask PostgREST to reload its schema cache (admin-only RPC), then poll the
// students table until the expected columns appear or we exhaust retries.
// Non-admins still get a useful re-probe — the cache may have already caught
// up if the migration was applied out-of-band.
export async function reloadPostgrestSchemaAndRecheck(
  opts: { maxAttempts?: number; delayMs?: number } = {},
): Promise<ReloadResult> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const delayMs = Math.max(200, opts.delayMs ?? 1200);

  let reloaded = false;
  let reloadError: string | undefined;
  try {
    const { error } = await supabase.rpc("pgrst_reload_schema");
    if (error) reloadError = error.message;
    else reloaded = true;
  } catch (e: any) {
    reloadError = e?.message ?? String(e);
  }

  let report = await probeStudentSchema();
  let attempts = 1;
  while (!report.ok && attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, delayMs));
    report = await probeStudentSchema();
    attempts++;
  }
  return { attempts, reloaded, reloadError, report };
}
