import { supabase } from "./supabase";
import { toast } from "sonner";
import { reloadPostgrestSchemaAndRecheck } from "./schema-reload";

// One-time client-side probe that verifies the students table has the columns
// added by the latest student-fields migration. When the DB is behind, we now
// automatically call the pgrst_reload_schema RPC (admin) and re-probe up to a
// few times before surfacing a persistent, admin-facing toast.
let checked = false;
let retrying = false;

const TOAST_ID = "schema-missing-students";

function looksMissing(err: any): boolean {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "");
  return (
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    /Could not find the '.*' column/i.test(msg) ||
    /does not exist/i.test(msg)
  );
}

export async function verifyStudentSchema(force = false): Promise<boolean> {
  if (checked && !force) return true;
  checked = true;
  try {
    const { error } = await supabase
      .from("students")
      .select("preferred_universities,test_scores")
      .limit(1);
    if (!error) return true;
    if (!looksMissing(error)) return true;
  } catch {
    return true; // network — handled elsewhere
  }
  return retrySchemaReload();
}

// Runs the reload + recheck cycle. Safe to call from any UI action (toast
// "Retry" button, PDF export fallback, admin page). De-duped so overlapping
// callers share one in-flight attempt.
let inflight: Promise<boolean> | null = null;
export function retrySchemaReload(): Promise<boolean> {
  if (inflight) return inflight;
  inflight = (async () => {
    if (retrying) return false;
    retrying = true;
    toast.loading("Reloading database schema…", {
      id: TOAST_ID,
      description: "Asking PostgREST to reload and re-checking the students table.",
    });
    try {
      const { reloaded, reloadError, report, attempts } =
        await reloadPostgrestSchemaAndRecheck();
      if (report.ok) {
        toast.success("Database schema is up to date", {
          id: TOAST_ID,
          description:
            attempts === 1
              ? "PostgREST reloaded — all expected columns are present."
              : `Recovered after ${attempts} checks.`,
          duration: 5000,
        });
        return true;
      }
      const missing = report.missing.map((m) => m.column).join(", ");
      const explain = reloaded
        ? "PostgREST reloaded but the columns are still absent — an admin must apply the pending migration."
        : reloadError
          ? `Automatic reload failed (${reloadError}). An admin must apply the pending migration.`
          : "An admin must apply the pending migration.";
      toast.error("Database migration required", {
        id: TOAST_ID,
        duration: Infinity,
        description: `Missing: ${missing}. ${explain} Open Admin → Schema status (/admin/schema).`,
        action: {
          label: "Retry",
          onClick: () => {
            void retrySchemaReload();
          },
        },
      });
      return false;
    } finally {
      retrying = false;
      inflight = null;
    }
  })();
  return inflight;
}
