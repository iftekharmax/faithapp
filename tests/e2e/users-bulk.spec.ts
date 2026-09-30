import { test, expect, type Page, type Route } from "@playwright/test";

/**
 * End-to-end tests for the User Management bulk assignment flow.
 *
 * Because the app talks to a hosted Supabase project, these tests intercept
 * every request to that project and serve canned JSON. This lets the test
 * run offline and keeps the assertions focused on UI behavior:
 *   - bulk role assignment across paginated selections
 *   - inline validation errors anchored to the right field
 *   - the BulkResultsDialog per-user breakdown + accessibility announcements
 */

const SUPABASE_HOST = "api.applywaybd.com";
const STORAGE_KEY = "sb-api-auth-token";
const ADMIN_ID = "00000000-0000-0000-0000-000000000001";

// 25 fake users so pagination (PAGE_SIZE = 10) engages.
function seedUsers() {
  const users = [
    {
      id: ADMIN_ID,
      email: "admin@test.local",
      full_name: "Test Admin",
      phone: null,
      avatar_url: null,
      department: "Ops",
      status: "active",
      is_locked: false,
      last_login_at: null,
      created_at: "2026-01-01T00:00:00Z",
      roles: ["admin"],
    },
  ];
  for (let i = 1; i <= 24; i++) {
    users.push({
      id: `10000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
      email: `user${i}@test.local`,
      full_name: `User ${i}`,
      phone: null,
      avatar_url: null,
      department: i % 2 === 0 ? "Admissions" : null,
      status: "active",
      is_locked: false,
      last_login_at: null,
      created_at: `2026-01-${String((i % 27) + 1).padStart(2, "0")}T00:00:00Z`,
      // Every 5th user is a student → useful for validation error scenarios.
      roles: i % 5 === 0 ? ["student"] : ["counselor"],
    });
  }
  return users;
}

async function stubSupabase(page: Page) {
  const state = {
    users: seedUsers(),
    userRoles: [{ user_id: ADMIN_ID, role: "admin" }] as Array<{ user_id: string; role: string }>,
    departments: [
      { id: "d1", name: "Admissions", description: null, created_at: "2026-01-01T00:00:00Z" },
      { id: "d2", name: "Ops", description: null, created_at: "2026-01-01T00:00:00Z" },
    ],
    calls: {
      userRolesDeletes: 0,
      userRolesInserts: 0,
      profileUpdates: 0,
      audits: 0,
    },
  };
  // Expose state for assertions.
  (page as any)._stubState = state;

  const json = (data: unknown, init: number | Partial<{ status: number; headers: Record<string, string> }> = 200) => {
    const status = typeof init === "number" ? init : init.status ?? 200;
    return {
      status,
      contentType: "application/json",
      body: JSON.stringify(data),
    };
  };

  await page.route(`**://${SUPABASE_HOST}/**`, async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    // Auth token refresh — respond with same fake session.
    if (path.startsWith("/auth/v1/token") || path.startsWith("/auth/v1/user")) {
      return route.fulfill(json({
        access_token: "fake",
        refresh_token: "fake",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id: ADMIN_ID, email: "admin@test.local" },
      }));
    }

    if (path === "/rest/v1/profiles") {
      if (method === "GET") {
        return route.fulfill(json([{ id: ADMIN_ID, email: "admin@test.local", full_name: "Test Admin", phone: null, avatar_url: null }]));
      }
      if (method === "PATCH") {
        state.calls.profileUpdates++;
        const body = req.postDataJSON() ?? {};
        const idFilter = url.searchParams.get("id")?.replace(/^eq\./, "");
        const u = state.users.find((x) => x.id === idFilter);
        if (u) Object.assign(u, body);
        return route.fulfill(json(u ? [u] : []));
      }
    }

    if (path === "/rest/v1/user_roles") {
      if (method === "GET") {
        const uidFilter = url.searchParams.get("user_id")?.replace(/^eq\./, "");
        const rows = state.userRoles.filter((r) => !uidFilter || r.user_id === uidFilter);
        return route.fulfill(json(rows));
      }
      if (method === "DELETE") {
        state.calls.userRolesDeletes++;
        const uidFilter = url.searchParams.get("user_id")?.replace(/^eq\./, "");
        state.userRoles = state.userRoles.filter((r) => r.user_id !== uidFilter);
        return route.fulfill(json([]));
      }
      if (method === "POST") {
        state.calls.userRolesInserts++;
        const body = req.postDataJSON();
        const rows = Array.isArray(body) ? body : [body];
        rows.forEach((r: any) => state.userRoles.push({ user_id: r.user_id, role: r.role }));
        // Reflect on users list for future GET admin_users_view.
        rows.forEach((r: any) => {
          const u = state.users.find((x) => x.id === r.user_id);
          if (u && !u.roles.includes(r.role)) u.roles.push(r.role);
        });
        return route.fulfill(json(rows));
      }
    }

    if (path === "/rest/v1/admin_users_view") {
      return route.fulfill(json(state.users));
    }

    if (path === "/rest/v1/departments") {
      return route.fulfill(json(state.departments));
    }

    if (path === "/rest/v1/audit_logs") {
      state.calls.audits++;
      return route.fulfill(json([]));
    }

    // Fallback: empty array so callers do not crash.
    return route.fulfill(json([]));
  });
}

async function injectSession(page: Page) {
  await page.addInitScript(
    ([key, id]) => {
      const session = {
        access_token: "fake",
        refresh_token: "fake",
        token_type: "bearer",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        user: { id, email: "admin@test.local", aud: "authenticated", role: "authenticated" },
      };
      window.localStorage.setItem(key as string, JSON.stringify(session));
    },
    [STORAGE_KEY, ADMIN_ID],
  );
}

test.beforeEach(async ({ page }) => {
  await stubSupabase(page);
  await injectSession(page);
});

test.describe("User Management · bulk assignment", () => {
  test("selection persists across pagination and bulk applies to all pages", async ({ page }) => {
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: /User Management/i })).toBeVisible();
    // Wait for table rows to render.
    await expect(page.getByRole("row")).toHaveCount(11, { timeout: 10_000 }); // 10 + header

    // Select all on page 1.
    await page.getByRole("checkbox", { name: /Select all on page/i }).check();
    await expect(page.getByText(/10 selected/)).toBeVisible();

    // Move to page 2 → previous selection remains.
    await page.getByRole("button", { name: /^2$/ }).click();
    await expect(page.getByText(/10 selected/)).toBeVisible();
    await expect(page.getByText(/10 on other pages/)).toBeVisible();

    // Add page 2's rows too.
    await page.getByRole("checkbox", { name: /Select all on page/i }).check();
    await expect(page.getByText(/20 selected/)).toBeVisible();

    // Open bulk department dialog and set Ops.
    await page.getByRole("button", { name: /Set department/i }).click();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Ops" }).click();

    // Preview panel is an aria-live region.
    const preview = page.getByTestId("bulk-preview-panel");
    await expect(preview).toHaveAttribute("aria-live", "polite");
    await expect(preview).toContainText(/will update/);

    await page.getByRole("button", { name: /^Apply to/ }).click();

    // BulkResultsDialog shows summary with role="status".
    const summary = page.locator("#bulk-results-summary");
    await expect(summary).toBeVisible();
    await expect(summary).toHaveAttribute("aria-live", "polite");
    await expect(summary).toContainText(/updated/);

    // Undo button is present.
    await expect(page.getByTestId("bulk-results-undo")).toBeVisible();
  });

  test("inline validation error announces on incompatible role/department combination", async ({ page }) => {
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: /User Management/i })).toBeVisible();

    await page.getByRole("button", { name: /Add user/i }).click();
    await expect(page.getByRole("heading", { name: /Add new user/i })).toBeVisible();

    // Default selected role is "student". Choose a department → dept error should appear.
    await page.locator("#add-user-dept").click();
    await page.getByRole("option", { name: "Admissions" }).click();

    const deptError = page.getByTestId("add-user-dept-error");
    await expect(deptError).toBeVisible();
    await expect(deptError).toHaveAttribute("role", "alert");
    await expect(deptError).toHaveAttribute("aria-live", "assertive");

    // The department control is marked aria-invalid.
    await expect(page.locator("#add-user-dept")).toHaveAttribute("aria-invalid", "true");

    // Adding a staff role while student is checked triggers the roles error.
    await page.getByRole("checkbox", { name: /Counselor/i }).check();
    const rolesError = page.getByTestId("add-user-roles-error");
    await expect(rolesError).toBeVisible();
    await expect(rolesError).toContainText(/cannot be combined/i);
  });

  test("BulkResultsDialog reports per-user updated/skipped rows", async ({ page }) => {
    await page.goto("/users");
    await expect(page.getByRole("heading", { name: /User Management/i })).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount(11, { timeout: 10_000 });

    // Select entire page — some rows will be students (skipped when assigning a staff dept).
    await page.getByRole("checkbox", { name: /Select all on page/i }).check();
    await page.getByRole("button", { name: /Set department/i }).click();
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Admissions" }).click();

    // Preview panel enumerates skipped rows.
    const preview = page.getByTestId("bulk-preview-panel");
    await expect(preview).toContainText(/will be skipped/);

    await page.getByRole("button", { name: /^Apply to/ }).click();

    // Results dialog shows updated + skipped counts.
    const summary = page.locator("#bulk-results-summary");
    await expect(summary).toContainText(/updated/);
    await expect(summary).toContainText(/skipped/);

    // Per-user table has rows for each selected user.
    const region = page.getByRole("region", { name: /Per-user bulk results/i });
    await expect(region).toBeVisible();
    await expect(region.getByText("updated").first()).toBeVisible();
    await expect(region.getByText("skipped").first()).toBeVisible();
  });
});
