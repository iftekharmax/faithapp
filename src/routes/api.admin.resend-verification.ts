import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qdveirhlzuzrxaqjevxr.supabase.co";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/admin/resend-verification")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const serviceKey = process.env.SB_SERVICE_ROLE_KEY || import.meta.env.SB_SERVICE_ROLE_KEY;
        if (!serviceKey) {
          console.error("[Auth] Critical: SB_SERVICE_ROLE_KEY is missing in environment");
          return json({ error: "Configuration error: Admin service is temporarily unavailable." }, 500);
        }

        const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
        if (!token) return json({ error: "Unauthorized" }, 401);

        const admin: any = createClient(SUPABASE_URL, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: userData, error: uErr } = await admin.auth.getUser(token);
        if (uErr || !userData.user) return json({ error: "Unauthorized" }, 401);
        const callerId = userData.user.id;
        const callerEmail = userData.user.email ?? null;

        const { data: isAdmin, error: rErr } = await admin.rpc("has_role", {
          _user_id: callerId,
          _role: "admin",
        });
        
        if (rErr || !isAdmin) {
          console.warn(`[Auth] Forbidden access attempt to resend-verification by user ${callerId}`);
          return json({ error: "Access denied. Admin privileges required." }, 403);
        }

        const body = await request.json().catch(() => ({}));
        const { user_id, email } = body ?? {};
        if (!user_id || typeof user_id !== "string") return json({ error: "user_id required" }, 400);
        if (!email || typeof email !== "string") return json({ error: "email required" }, 400);

        // Generate a signup magic link (Supabase emails it via configured SMTP).
        const { error: linkErr } = await admin.auth.admin.generateLink({
          type: "signup",
          email,
        });

        const status = linkErr ? "failed" : "success";
        try {
          await admin.from("audit_logs").insert({
            actor_id: callerId,
            actor_email: callerEmail,
            target_user_id: user_id,
            action: `user.verification.resend.${status}`,
            entity: "user",
            metadata: { email, error: linkErr?.message ?? null },
          });
        } catch {}

        if (linkErr) return json({ error: linkErr.message }, 400);
        return json({ ok: true });
      },
    },
  },
});
