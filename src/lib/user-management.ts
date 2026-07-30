import { supabase, type AppRole } from "./supabase";

export const ALL_ROLES: AppRole[] = ["admin", "counselor", "application_team", "student"];

export type UserStatus = "active" | "inactive";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  department: string | null;
  status: UserStatus;
  is_locked: boolean;
  last_login_at: string | null;
  created_at: string;
  roles: AppRole[];
  email_verified: boolean;
  email_confirmed_at: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  target_user_id: string | null;
  action: string;
  entity: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function listUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase
    .from("admin_users_view")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    roles: (r.roles ?? []) as AppRole[],
    email_verified: !!r.email_verified,
    email_confirmed_at: r.email_confirmed_at ?? null,
  }));
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<AdminUser, "full_name" | "phone" | "department" | "status" | "is_locked" | "avatar_url">>
) {
  const { error } = await supabase.from("profiles").update(patch).eq("id", id);
  if (error) throw error;
}

export async function setUserRoles(userId: string, roles: AppRole[]) {
  // Delete then insert to sync
  const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
  if (delErr) throw delErr;
  if (roles.length === 0) return;
  const rows = roles.map((role) => ({ user_id: userId, role }));
  const { error } = await supabase.from("user_roles").insert(rows);
  if (error) throw error;
}

export async function deleteUserProfile(id: string) {
  // Cannot delete auth.users from client (needs service role). Marks the profile
  // inactive and removes the profile row (auth account remains).
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) throw error;
}

export async function lockUser(id: string, locked: boolean) {
  await updateProfile(id, { is_locked: locked });
}

export async function setStatus(id: string, status: UserStatus) {
  await updateProfile(id, { status });
}

export async function sendPasswordReset(email: string) {
  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/reset-password` : undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw error;
}

export async function writeAudit(entry: {
  action: string;
  target_user_id?: string | null;
  entity?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const { data: sess } = await supabase.auth.getUser();
  const actor_id = sess.user?.id ?? null;
  const actor_email = sess.user?.email ?? null;
  if (!actor_id) return;
  await supabase.from("audit_logs").insert({
    actor_id,
    actor_email,
    target_user_id: entry.target_user_id ?? null,
    action: entry.action,
    entity: entry.entity ?? "user",
    metadata: entry.metadata ?? null,
  });
}

export async function listAuditLogs(limit = 200): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as AuditLog[]) ?? [];
}

export interface RolePermission {
  id: string;
  role: AppRole;
  permission: string;
}

export async function listPermissions(): Promise<RolePermission[]> {
  const { data, error } = await supabase.from("role_permissions").select("*");
  if (error) throw error;
  return (data as RolePermission[]) ?? [];
}

export async function togglePermission(role: AppRole, permission: string, enabled: boolean) {
  if (enabled) {
    const { error } = await supabase
      .from("role_permissions")
      .insert({ role, permission })
      .select();
    if (error && !/duplicate/i.test(error.message)) throw error;
  } else {
    const { error } = await supabase
      .from("role_permissions")
      .delete()
      .eq("role", role)
      .eq("permission", permission);
    if (error) throw error;
  }
}

export const KNOWN_PERMISSIONS: { key: string; label: string; group: string }[] = [
  { group: "Users", key: "users.manage", label: "Manage users" },
  { group: "Users", key: "roles.manage", label: "Manage roles" },
  { group: "Users", key: "permissions.manage", label: "Manage permissions" },
  { group: "Applications", key: "applications.view", label: "View applications" },
  { group: "Applications", key: "applications.edit", label: "Edit applications" },
  { group: "Applications", key: "applications.manage", label: "Full manage applications" },
  { group: "Applications", key: "applications.view.own", label: "View own applications" },
  { group: "Students", key: "students.view", label: "View students" },
  { group: "Students", key: "students.edit", label: "Edit students" },
  { group: "Students", key: "students.manage", label: "Full manage students" },
  { group: "Programs", key: "programs.view", label: "View programs" },
  { group: "Programs", key: "programs.manage", label: "Manage programs" },
  { group: "Tasks", key: "tasks.view", label: "View tasks" },
  { group: "Tasks", key: "tasks.manage", label: "Manage tasks" },
  { group: "Reports", key: "reports.view", label: "View reports" },
  { group: "Profile", key: "profile.edit.own", label: "Edit own profile" },
];

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
export const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const AVATAR_ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];

export function validateAvatarFile(file: File): string | null {
  if (!file) return "No file selected";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const typeOk = AVATAR_ALLOWED_TYPES.includes(file.type);
  const extOk = AVATAR_ALLOWED_EXTS.includes(ext);
  if (!typeOk && !extOk) {
    return "Unsupported file type. Use JPG, PNG, WEBP or GIF.";
  }
  if (file.size <= 0) return "File is empty";
  if (file.size > AVATAR_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(2);
    return `File is too large (${mb} MB). Max 2 MB.`;
  }
  return null;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const err = validateAvatarFile(file);
  if (err) throw new Error(err);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}

// ---------- Departments ----------
export type DepartmentStatus = "active" | "inactive";
export interface Department {
  id: string;
  name: string;
  description: string | null;
  status: DepartmentStatus;
  created_at: string;
}

export interface DepartmentInput {
  name: string;
  description?: string | null;
  status?: DepartmentStatus;
}

export async function listDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from("departments")
    .select("id,name,description,status,created_at")
    .order("name");
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    status: (r.status as DepartmentStatus) ?? "active",
    created_at: r.created_at,
  }));
}
export async function createDepartment(input: DepartmentInput) {
  const { data, error } = await supabase
    .from("departments")
    .insert({
      name: input.name,
      description: input.description || null,
      status: input.status ?? "active",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data?.id as string;
}
export async function updateDepartment(id: string, patch: Partial<DepartmentInput>) {
  const { error } = await supabase.from("departments").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteDepartment(id: string) {
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Custom Role Templates ----------
export interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  created_at: string;
}
export async function listCustomRoles(): Promise<CustomRole[]> {
  const { data, error } = await supabase.from("custom_roles").select("*").order("name");
  if (error) throw error;
  return (data as CustomRole[]) ?? [];
}
export async function createCustomRole(row: { name: string; description?: string; permissions: string[] }) {
  const { error } = await supabase.from("custom_roles").insert({
    name: row.name,
    description: row.description || null,
    permissions: row.permissions,
  });
  if (error) throw error;
}
export async function updateCustomRole(id: string, patch: Partial<Pick<CustomRole, "name" | "description" | "permissions">>) {
  const { error } = await supabase.from("custom_roles").update(patch).eq("id", id);
  if (error) throw error;
}
export async function deleteCustomRole(id: string) {
  const { error } = await supabase.from("custom_roles").delete().eq("id", id);
  if (error) throw error;
}

// ---------- Create User (Admin API via server route) ----------
export async function adminCreateUser(input: {
  email: string;
  password: string;
  full_name?: string;
  phone?: string;
  department?: string;
  status?: UserStatus;
  roles: AppRole[];
  require_verification?: boolean;
}) {
  if (!Array.isArray(input.roles) || input.roles.length === 0) {
    throw new Error("Assign at least one role");
  }
  const invalid = input.roles.filter((r) => !ALL_ROLES.includes(r));
  if (invalid.length) throw new Error(`Invalid role: ${invalid.join(", ")}`);

  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const res = await fetch("/api/admin/create-user", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(input),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || "Failed to create user");
  return payload.user_id as string;
}

// ---------- Resend Verification Email ----------
export async function resendVerification(userId: string, email: string) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/admin/resend-verification", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId, email }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload?.error || "Failed to resend verification");
  return true;
}



