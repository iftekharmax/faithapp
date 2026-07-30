import type { AppRole } from "./supabase";

/**
 * Role ↔ Department compatibility rules.
 *
 * - `student` cannot be assigned a staff department (students are not staff).
 * - `student` cannot be combined with staff roles.
 * - Non-admin staff roles (`counselor`, `application_team`) must have a
 *   department set so records and workload are attributable.
 * - `admin` has no department constraint.
 * - A user with no role at all has no department constraint.
 *
 * The `field` on a failure indicates which form control the error is best
 * anchored to for inline display in Add / Edit dialogs.
 */
export type RoleDeptField = "roles" | "department";
export type RoleDeptCheck =
  | { ok: true }
  | { ok: false; error: string; field: RoleDeptField };

const STAFF_ROLES: AppRole[] = ["counselor", "application_team"];

export function validateRoleDepartment(
  roles: AppRole[],
  department: string | null | undefined,
): RoleDeptCheck {
  const dept = (department ?? "").trim();
  const hasStudent = roles.includes("student");
  const hasAdmin = roles.includes("admin");
  const staff = roles.filter((r) => STAFF_ROLES.includes(r));

  if (hasStudent && roles.some((r) => r !== "student")) {
    return {
      ok: false,
      field: "roles",
      error: "Student role cannot be combined with staff roles.",
    };
  }
  if (hasStudent && dept) {
    return {
      ok: false,
      field: "department",
      error: "Students cannot be assigned to a staff department.",
    };
  }
  if (staff.length > 0 && !dept && !hasAdmin) {
    return {
      ok: false,
      field: "department",
      error: "Staff roles (Counselor, Application Team) require a department.",
    };
  }
  return { ok: true };
}

export function describeRoleDeptRules(): string {
  return [
    "Students: no department, no other roles.",
    "Counselor / Application Team: must have a department.",
    "Admin: no department constraint.",
  ].join(" ");
}

/**
 * Compute the resulting role set for a user under a bulk role operation.
 */
export function computeNextRoles(
  current: AppRole[],
  target: AppRole[],
  mode: "replace" | "add" | "remove",
): AppRole[] {
  if (mode === "replace") return [...target];
  const set = new Set(current);
  if (mode === "add") target.forEach((r) => set.add(r));
  else target.forEach((r) => set.delete(r));
  return Array.from(set);
}

export type BulkPreviewInput = {
  id: string;
  email: string;
  roles: AppRole[];
  department: string | null;
};

export type BulkPreviewRow = {
  id: string;
  email: string;
  willUpdate: boolean;
  reason?: string;
  field?: RoleDeptField;
  /** roles/department the user would end up with if applied */
  nextRoles: AppRole[];
  nextDepartment: string | null;
};

export function previewBulkRoles(
  users: BulkPreviewInput[],
  target: AppRole[],
  mode: "replace" | "add" | "remove",
): BulkPreviewRow[] {
  return users.map((u) => {
    const nextRoles = computeNextRoles(u.roles, target, mode);
    const check = validateRoleDepartment(nextRoles, u.department);
    return {
      id: u.id,
      email: u.email,
      willUpdate: check.ok,
      reason: check.ok ? undefined : check.error,
      field: check.ok ? undefined : check.field,
      nextRoles,
      nextDepartment: u.department,
    };
  });
}

export function previewBulkDepartment(
  users: BulkPreviewInput[],
  dept: string | null,
): BulkPreviewRow[] {
  return users.map((u) => {
    const check = validateRoleDepartment(u.roles, dept);
    return {
      id: u.id,
      email: u.email,
      willUpdate: check.ok,
      reason: check.ok ? undefined : check.error,
      field: check.ok ? undefined : check.field,
      nextRoles: u.roles,
      nextDepartment: dept,
    };
  });
}

export type BulkResult = {
  id: string;
  email: string;
  status: "updated" | "skipped" | "failed";
  reason?: string;
};
