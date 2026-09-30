/**
 * Verification contract tests.
 *
 * Covers:
 *  1. Public signup at /auth/signup uses supabase.auth.signUp — it never
 *     bypasses email confirmation, so Supabase's provider setting decides
 *     whether the confirmation email is sent.
 *  2. Admin-created users go through /api/admin/create-user, which sets
 *     `email_confirm: true` unless the caller explicitly requests
 *     verification. adminCreateUser() must not send require_verification
 *     by default.
 *  3. resendVerification() calls /api/admin/resend-verification with the
 *     admin bearer token and surfaces server errors.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "test-token" } },
      })),
    },
  },
}));

import { adminCreateUser, resendVerification } from "@/lib/user-management";

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn(async () =>
    new Response(JSON.stringify({ user_id: "new-user", email_verified: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })
  ) as unknown as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("public signup flow", () => {
  it("uses supabase.auth.signUp with no admin bypass so confirmation stays enforced", () => {
    const source = readFileSync(resolve("src/routes/auth.signup.tsx"), "utf8");
    expect(source).toMatch(/supabase\.auth\.signUp\s*\(/);
    // Public route must not touch the service-role admin API.
    expect(source).not.toMatch(/admin\.createUser|\/api\/admin\/create-user|email_confirm/);
  });
});

describe("adminCreateUser", () => {
  it("posts to /api/admin/create-user with the bearer token and no require_verification by default", async () => {
    await adminCreateUser({
      email: "new@example.com",
      password: "password12",
      roles: ["counselor"],
    });

    const call = (global.fetch as any).mock.calls[0];
    const [url, init] = call;
    expect(url).toBe("/api/admin/create-user");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer test-token");

    const body = JSON.parse(init.body);
    expect(body.email).toBe("new@example.com");
    expect(body.roles).toEqual(["counselor"]);
    // Default admin-create flow must NOT request verification.
    expect(body.require_verification === true).toBe(false);
  });

  it("surfaces the server error message on failure", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "email exists" }), { status: 400 })
    ) as unknown as typeof fetch;

    await expect(
      adminCreateUser({
        email: "dup@example.com",
        password: "password12",
        roles: ["admin"],
      })
    ).rejects.toThrow(/email exists/);
  });
});

describe("admin create-user server route", () => {
  const source = readFileSync(
    resolve("src/routes/api.admin.create-user.ts"),
    "utf8"
  );

  it("sets email_confirm to true unless require_verification === true", () => {
    // Default behaviour: bypass verification for admin-created users.
    expect(source).toMatch(/require_verification\s*===\s*true\s*\?\s*false\s*:\s*true/);
    expect(source).toMatch(/email_confirm:\s*emailConfirm/);
  });

  it("enforces admin-only access via has_role before creating", () => {
    expect(source).toMatch(/has_role/);
    expect(source).toMatch(/Forbidden/);
  });

  it("audits both success and failure outcomes", () => {
    expect(source).toMatch(/user\.create\.success/);
    expect(source).toMatch(/user\.create\.failed/);
  });
});

describe("resendVerification", () => {
  it("calls /api/admin/resend-verification and resolves on success", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    ) as unknown as typeof fetch;

    await expect(resendVerification("uid-1", "u@example.com")).resolves.toBe(true);

    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe("/api/admin/resend-verification");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer test-token");
    const body = JSON.parse(init.body);
    expect(body).toEqual({ user_id: "uid-1", email: "u@example.com" });
  });

  it("throws the server error message when the request fails", async () => {
    global.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: "rate limited" }), { status: 429 })
    ) as unknown as typeof fetch;

    await expect(resendVerification("uid-1", "u@example.com")).rejects.toThrow(
      /rate limited/
    );
  });
});

describe("resend-verification server route", () => {
  const source = readFileSync(
    resolve("src/routes/api.admin.resend-verification.ts"),
    "utf8"
  );

  it("issues a signup-type magic link so Supabase re-sends the confirmation email", () => {
    expect(source).toMatch(/generateLink/);
    expect(source).toMatch(/type:\s*["']signup["']/);
  });

  it("is admin-only and audits both success and failure", () => {
    expect(source).toMatch(/has_role/);
    expect(source).toMatch(/user\.verification\.resend\.\$\{status\}/);
    expect(source).toMatch(/status\s*=\s*linkErr\s*\?\s*["']failed["']\s*:\s*["']success["']/);
  });
});
