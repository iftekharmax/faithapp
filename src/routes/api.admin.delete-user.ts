import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://api.applywaybd.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function getAdminContext(request: Request) {
  const serviceKey = process.env.SB_SERVICE_ROLE_KEY || import.meta.env.SB_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error("[Auth] Critical: SB_SERVICE_ROLE_KEY is missing in environment");
    return { error: json({ error: "Configuration error: Admin service is temporarily unavailable. Please contact support." }, 500) };
  }

  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: json({ error: "Unauthorized" }, 401) };

  const admin: any = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !userData.user) return { error: json({ error: "Unauthorized" }, 401) };

  const callerId = userData.user.id;
  const { data: isAdmin, error: rErr } = await admin.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });

  if (rErr || !isAdmin) {
    console.warn(`[Auth] Forbidden access attempt to delete-user by user ${callerId}`);
    return { error: json({ error: "Access denied. Admin privileges required." }, 403) };
  }

  return { admin, callerId, callerEmail: userData.user.email ?? null };
}

async function audit(
  admin: any,
  entry: {
    actor_id: string;
    actor_email: string | null;
    target_user_id?: string | null;
    action: string;
    metadata: Record<string, unknown>;
  },
) {
  try {
    await admin.from("audit_logs").insert({
      actor_id: entry.actor_id,
      actor_email: entry.actor_email,
      target_user_id: entry.target_user_id ?? null,
      action: entry.action,
      entity: "user",
      metadata: entry.metadata,
    });
  } catch {
    // Audit should not block user deletion.
  }
}

async function clearProfileReferences(admin: any, userId: string) {
  const cleanupJobs = [
    () => admin.from("applications").update({ assigned_team_id: null }).eq("assigned_team_id", userId),
    () => admin.from("application_timeline").update({ actor_id: null }).eq("actor_id", userId),
  ];

  for (const job of cleanupJobs) {
    try {
      await job();
    } catch {
      // Older databases may not have every column/relationship yet.
    }
  }
}

export const Route = createFileRoute("/api/admin/delete-user")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await getAdminContext(request);
        if ("error" in ctx) return ctx.error;
        const { admin, callerId, callerEmail } = ctx;

        const body = await request.json().catch(() => ({}));
        const { user_id } = body ?? {};

        if (!isUuid(user_id)) return json({ error: "Valid user_id is required" }, 400);
        if (user_id === callerId) return json({ error: "You cannot delete your own account from this panel." }, 400);

        const { data: targetData } = await admin.auth.admin.getUserById(user_id);
        const targetEmail = targetData?.user?.email ?? null;

        const { data: profileData } = await admin
          .from("profiles")
          .select("email, full_name")
          .eq("id", user_id)
          .maybeSingle();

        await clearProfileReferences(admin, user_id);

        const authExists = Boolean(targetData?.user?.id);
        if (authExists) {
          const { error: deleteErr } = await admin.auth.admin.deleteUser(user_id, false);
          const notFound = deleteErr && /not found/i.test(deleteErr.message || "");
          if (deleteErr && !notFound) {
            await audit(admin, {
              actor_id: callerId,
              actor_email: callerEmail,
              action: "user.delete.failed",
              metadata: {
                deleted_user_id: user_id,
                email: targetEmail ?? profileData?.email ?? null,
                error: deleteErr.message,
              },
            });
            return json({ error: deleteErr.message }, 400);
          }
        }

        // Remove app-level records even when the auth account is already gone,
        // otherwise the user keeps appearing in the users list.
        try {
          await admin.from("user_roles").delete().eq("user_id", user_id);
        } catch {
          // table may not exist on older databases
        }
        const { error: profileErr } = await admin.from("profiles").delete().eq("id", user_id);
        if (profileErr) return json({ error: profileErr.message }, 400);


        await audit(admin, {
          actor_id: callerId,
          actor_email: callerEmail,
          action: "user.delete.success",
          metadata: {
            deleted_user_id: user_id,
            email: targetEmail ?? profileData?.email ?? null,
            full_name: profileData?.full_name ?? null,
          },
        });

        return json({ ok: true });
      },
    },
  },
});