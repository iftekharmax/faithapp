import { describe, it, expect } from "vitest";
import {
  validateRoleDepartment,
  computeNextRoles,
  previewBulkRoles,
  previewBulkDepartment,
  type BulkPreviewInput,
} from "../role-department-rules";
import type { AppRole } from "../supabase";

describe("validateRoleDepartment", () => {
  it("accepts student with no department", () => {
    expect(validateRoleDepartment(["student"], null).ok).toBe(true);
    expect(validateRoleDepartment(["student"], "").ok).toBe(true);
  });

  it("rejects student combined with staff role and anchors to roles", () => {
    const r = validateRoleDepartment(["student", "counselor"], "Admissions");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("roles");
  });

  it("rejects student with a department and anchors to department", () => {
    const r = validateRoleDepartment(["student"], "Admissions");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.field).toBe("department");
  });

  it("requires department for counselor / application_team", () => {
    const r1 = validateRoleDepartment(["counselor"], null);
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.field).toBe("department");

    const r2 = validateRoleDepartment(["application_team"], "  ");
    expect(r2.ok).toBe(false);

    expect(validateRoleDepartment(["counselor"], "Admissions").ok).toBe(true);
  });

  it("admin has no department constraint", () => {
    expect(validateRoleDepartment(["admin"], null).ok).toBe(true);
    expect(validateRoleDepartment(["admin", "counselor"], null).ok).toBe(true);
  });

  it("empty role set is always valid", () => {
    expect(validateRoleDepartment([], null).ok).toBe(true);
    expect(validateRoleDepartment([], "Admissions").ok).toBe(true);
  });
});

describe("computeNextRoles", () => {
  it("replace overwrites current roles", () => {
    expect(computeNextRoles(["student"], ["counselor"], "replace")).toEqual(["counselor"]);
  });
  it("add merges without duplicates", () => {
    const out = computeNextRoles(["counselor"], ["counselor", "admin"], "add").sort();
    expect(out).toEqual(["admin", "counselor"]);
  });
  it("remove strips target roles", () => {
    expect(computeNextRoles(["counselor", "admin"], ["counselor"], "remove")).toEqual(["admin"]);
  });
});

const mkUsers = (): BulkPreviewInput[] => [
  { id: "u1", email: "a@x.com", roles: ["student"] as AppRole[], department: null },
  { id: "u2", email: "b@x.com", roles: ["counselor"] as AppRole[], department: "Admissions" },
  { id: "u3", email: "c@x.com", roles: [] as AppRole[], department: null },
  { id: "u4", email: "d@x.com", roles: ["admin"] as AppRole[], department: null },
];

describe("previewBulkRoles (pagination-independent selection)", () => {
  it("skips users whose next role set is incompatible with their department", () => {
    const users = mkUsers();
    // Replace all with counselor: only u2 has a department, others are skipped.
    const rows = previewBulkRoles(users, ["counselor"], "replace");
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.u1.willUpdate).toBe(false);
    expect(byId.u1.field).toBe("department");
    expect(byId.u2.willUpdate).toBe(true);
    expect(byId.u3.willUpdate).toBe(false);
    expect(byId.u4.willUpdate).toBe(false); // admin replaced → counselor with no dept
  });

  it("evaluates each user independently across paginated selections", () => {
    const users = mkUsers();
    const page1 = users.slice(0, 2);
    const page2 = users.slice(2);
    const combined = previewBulkRoles([...page1, ...page2], ["admin"], "add");
    expect(combined).toHaveLength(4);
    // u1 is a student — adding admin combines student+admin → skipped by "roles"
    const byId = Object.fromEntries(combined.map((r) => [r.id, r]));
    expect(byId.u1.willUpdate).toBe(false);
    expect(byId.u1.field).toBe("roles");
    // Non-students accept admin regardless of department
    expect(byId.u2.willUpdate).toBe(true);
    expect(byId.u3.willUpdate).toBe(true);
    expect(byId.u4.willUpdate).toBe(true);
  });

  it("add-mode preserves users who already violate rules on their existing state", () => {
    // A pre-corrupt user: counselor with no department (shouldn't happen but be defensive).
    const users: BulkPreviewInput[] = [
      { id: "x", email: "x@x.com", roles: ["counselor"], department: null },
    ];
    const rows = previewBulkRoles(users, ["admin"], "add");
    // adding admin resolves the missing-dept requirement (hasAdmin skips staff-dept rule)
    expect(rows[0].willUpdate).toBe(true);
  });
});

describe("previewBulkDepartment", () => {
  it("clearing department skips staff without admin", () => {
    const users = mkUsers();
    const rows = previewBulkDepartment(users, null);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.u2.willUpdate).toBe(false); // counselor loses dept
    expect(byId.u2.field).toBe("department");
    expect(byId.u1.willUpdate).toBe(true);
    expect(byId.u4.willUpdate).toBe(true);
  });

  it("assigning a department skips students", () => {
    const users = mkUsers();
    const rows = previewBulkDepartment(users, "Admissions");
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.u1.willUpdate).toBe(false);
    expect(byId.u1.field).toBe("department");
    expect(byId.u2.willUpdate).toBe(true);
    expect(byId.u3.willUpdate).toBe(true);
    expect(byId.u4.willUpdate).toBe(true);
  });
});
