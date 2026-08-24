import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://api.applywaybd.com";
const ALL_ROLES = ["admin", "counselor", "application_team", "student"] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function getAdminContext(request: Request) {
  const serviceKey = process.env.SB_SERVICE_ROLE_KEY || import.meta.env.SB_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error("[Auth] Critical: SB_SERVICE_ROLE_KEY is missing in environment");
    return { error: json({ error: "Configuration error: Admin service is temporarily unavailable. Please contact support." }, 500) };
  }
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return { error: json({ error: "Unauthorized" }, 401) };

  const admin = createClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  
  const { data: userData, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !userData.user) return { error: json({ error: "Unauthorized" }, 401) };
  
  const callerId = userData.user.id;
  // Use a secure RPC call to verify role. The 'has_role' function must be security definer.
  const { data: isAdmin, error: rErr } = await admin.rpc("has_role", {
    _user_id: callerId,
    _role: "admin",
  });

  if (rErr || !isAdmin) {
    console.warn(`[Auth] Forbidden access attempt to create-user by user ${callerId}`);
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
  }
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
    // Never let audit failure break the primary flow.
  }
}

export const Route = createFileRoute("/api/admin/create-user")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ctx = await getAdminContext(request);
        if ("error" in ctx) return ctx.error;
        const { admin, callerId, callerEmail } = ctx;

        const body = await request.json().catch(() => ({}));
        const {
          email,
          password,
          full_name,
          phone,
          department,
          status,
          roles,
          require_verification,
        } = body ?? {};

        // Backend validation
        if (typeof email !== "string" || !email.includes("@")) {
          return json({ error: "Valid email is required" }, 400);
        }
        if (typeof password !== "string" || password.length < 8) {
          return json({ error: "Password must be at least 8 characters" }, 400);
        }
        if (!Array.isArray(roles) || roles.length === 0) {
          return json({ error: "Assign at least one role" }, 400);
        }
        const invalid = roles.filter((r: string) => !ALL_ROLES.includes(r as never));
        if (invalid.length) {
          return json({ error: `Invalid role: ${invalid.join(", ")}` }, 400);
        }

        // Admin-created users skip verification unless `require_verification` is
        // explicitly true. Public signup goes through supabase.auth.signUp and
        // still respects Supabase's "Confirm email" setting.
        const emailConfirm = require_verification === true ? false : true;

        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: emailConfirm,
          user_metadata: { full_name: full_name || null },
        });

        if (cErr || !created?.user) {
          await audit(admin, {
            actor_id: callerId,
            actor_email: callerEmail,
            action: "user.create.failed",
            metadata: {
              email,
              email_confirm: emailConfirm,
              require_verification: require_verification === true,
              error: cErr?.message ?? "unknown",
            },
          });
          return json({ error: cErr?.message ?? "Failed to create user" }, 400);
        }

        const newUserId = created.user.id;

        // Populate profile row (trigger already created it).
        const { error: pErr } = await admin
          .from("profiles")
          .update({
            full_name: typeof full_name === "string" ? full_name.trim() || null : null,
            phone: typeof phone === "string" ? phone.trim() || null : null,
            department: typeof department === "string" ? department.trim() || null : null,
            status: status === "inactive" ? "inactive" : "active",
          })
          .eq("id", newUserId);
        if (pErr) {
          await audit(admin, {
            actor_id: callerId,
            actor_email: callerEmail,
            target_user_id: newUserId,
            action: "user.create.partial",
            metadata: { email, stage: "profile", error: pErr.message },
          });
        }

        // Sync roles.
        await admin.from("user_roles").delete().eq("user_id", newUserId);
        const roleRows = roles.map((role: string) => ({ user_id: newUserId, role }));
        const { error: rolesErr } = await admin.from("user_roles").insert(roleRows);
        if (rolesErr) {
          await audit(admin, {
            actor_id: callerId,
            actor_email: callerEmail,
            target_user_id: newUserId,
            action: "user.create.partial",
            metadata: { email, stage: "roles", error: rolesErr.message },
          });
          return json({ error: `User created but role sync failed: ${rolesErr.message}` }, 500);
        }

        await audit(admin, {
          actor_id: callerId,
          actor_email: callerEmail,
          target_user_id: newUserId,
          action: "user.create.success",
          metadata: {
            email,
            roles,
            email_confirm: emailConfirm,
            require_verification: require_verification === true,
            department: department || null,
          },
        });

        return json({
          user_id: newUserId,
          email_verified: emailConfirm,
        });
      },
    },
  },
});
