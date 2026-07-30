import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Loader2, MoreHorizontal, Lock, Unlock, KeyRound, ShieldCheck,
  UserCog, Trash2, Upload, RefreshCw, UserPlus, Eye, EyeOff, Undo2, X,
  MailCheck, MailWarning, Send,
} from "lucide-react";

import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SmartPagination } from "@/components/ui/smart-pagination";

import { ROLE_LABELS } from "@/lib/auth-context";
import type { AppRole } from "@/lib/supabase";
import {
  ALL_ROLES, listUsers, updateProfile, setUserRoles, lockUser, setStatus,
  sendPasswordReset, writeAudit, deleteUserProfile, uploadAvatar, validateAvatarFile,
  AVATAR_MAX_BYTES, AVATAR_ALLOWED_EXTS, adminCreateUser, resendVerification, listDepartments,
  type AdminUser, type UserStatus, type Department,
} from "@/lib/user-management";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton as TableSkeletonRows } from "@/components/ui/table-skeleton";
import {
  validateRoleDepartment, describeRoleDeptRules,
  previewBulkRoles, previewBulkDepartment,
  type BulkResult, type BulkPreviewRow,
} from "@/lib/role-department-rules";




export const Route = createFileRoute("/_authenticated/users")({
  component: () => (
    <RoleGuard roles={["admin"]}>
      <UsersPage />
    </RoleGuard>
  ),
});

const PAGE_SIZE = 10;

const ROLE_CHIP_STYLES: Record<AppRole, string> = {
  admin:
    "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  counselor:
    "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  application_team:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  student:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

function RoleChip({ role }: { role: AppRole }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${ROLE_CHIP_STYLES[role] ?? "border-border bg-muted text-foreground"}`}
      aria-label={`Role: ${ROLE_LABELS[role]}`}
    >
      <ShieldCheck className="h-3 w-3" aria-hidden />
      {ROLE_LABELS[role]}
    </span>
  );
}

type BulkScope = "roles" | "department";
type LastBulkChange = {
  scope: BulkScope;
  label: string;
  snapshots: Array<{
    userId: string;
    email: string;
    prevRoles: AppRole[];
    prevDepartment: string | null;
  }>;
};

function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("recent");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [departmentsList, setDepartmentsList] = useState<Department[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRolesOpen, setBulkRolesOpen] = useState(false);
  const [bulkDeptOpen, setBulkDeptOpen] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ title: string; rows: BulkResult[] } | null>(null);
  // Rollback state: snapshot of prior values for the most recent successful bulk change.
  const [lastBulk, setLastBulk] = useState<LastBulkChange | null>(null);
  const [undoing, setUndoing] = useState(false);
  const undoToastRef = useRef<string | number | null>(null);


  const load = async () => {
    setLoading(true);
    try {
      setUsers(await listUsers());
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    listDepartments().then(setDepartmentsList).catch(() => {});
  }, []);


  const departments = useMemo(() => {
    const s = new Set<string>();
    users.forEach((u) => u.department && s.add(u.department));
    return Array.from(s).sort();
  }, [users]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = users.filter((u) => {
      if (term && !(u.email.toLowerCase().includes(term) ||
        (u.full_name?.toLowerCase().includes(term)) ||
        (u.phone?.toLowerCase().includes(term)) ||
        (u.department?.toLowerCase().includes(term)))) return false;
      if (roleFilter !== "all" && !u.roles.includes(roleFilter as AppRole)) return false;
      if (statusFilter === "locked" && !u.is_locked) return false;
      if (statusFilter === "active" && (u.status !== "active" || u.is_locked)) return false;
      if (statusFilter === "inactive" && u.status !== "inactive") return false;
      if (deptFilter !== "all" && u.department !== deptFilter) return false;
      return true;
    });
    const roleRank: Record<string, number> = { admin: 0, counselor: 1, application_team: 2, student: 3 };
    const nameOf = (u: AdminUser) => (u.full_name || u.email || "").toLowerCase();
    const topRole = (u: AdminUser) =>
      u.roles.length === 0 ? 99 : Math.min(...u.roles.map((r) => roleRank[r] ?? 50));
    const loginTs = (u: AdminUser) => (u.last_login_at ? new Date(u.last_login_at).getTime() : 0);
    const createdTs = (u: AdminUser) => (u.created_at ? new Date(u.created_at).getTime() : 0);
    const sorted = [...list].sort((a, b) => {
      switch (sortBy) {
        case "name_asc": return nameOf(a).localeCompare(nameOf(b));
        case "name_desc": return nameOf(b).localeCompare(nameOf(a));
        case "role": {
          const d = topRole(a) - topRole(b);
          return d !== 0 ? d : nameOf(a).localeCompare(nameOf(b));
        }
        case "last_login_desc": return loginTs(b) - loginTs(a);
        case "last_login_asc": return loginTs(a) - loginTs(b);
        case "recent":
        default: return createdTs(b) - createdTs(a);
      }
    });
    return sorted;
  }, [users, q, roleFilter, statusFilter, deptFilter, sortBy]);

  useEffect(() => { setPage(1); }, [q, roleFilter, statusFilter, deptFilter, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const pageIds = paged.map((u) => u.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPageSelected = pageIds.some((id) => selected.has(id));
  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());
  const selectedUsers = users.filter((u) => selected.has(u.id));

  const handleQuickAction = async (u: AdminUser, action: string, fn: () => Promise<void>) => {
    try {
      await fn();
      await writeAudit({ action, target_user_id: u.id, entity: "user", metadata: { email: u.email } });
      toast.success("Done");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Action failed");
    }
  };

  const applyBulkRoles = async (roles: AppRole[], mode: "replace" | "add" | "remove") => {
    if (selectedUsers.length === 0 || roles.length === 0) return;
    const preview = previewBulkRoles(
      selectedUsers.map((u) => ({ id: u.id, email: u.email, roles: u.roles, department: u.department })),
      roles, mode,
    );
    const results: BulkResult[] = [];
    const snapshots: LastBulkChange["snapshots"] = [];
    for (const row of preview) {
      if (!row.willUpdate) {
        results.push({ id: row.id, email: row.email, status: "skipped", reason: row.reason });
        continue;
      }
      const src = selectedUsers.find((u) => u.id === row.id)!;
      try {
        await setUserRoles(row.id, row.nextRoles);
        await writeAudit({ action: `user.roles.bulk_${mode}`, target_user_id: row.id, entity: "user", metadata: { email: row.email, roles, mode } });
        snapshots.push({ userId: row.id, email: row.email, prevRoles: [...src.roles], prevDepartment: src.department });
        results.push({ id: row.id, email: row.email, status: "updated" });
      } catch (e: any) {
        results.push({ id: row.id, email: row.email, status: "failed", reason: e?.message ?? "Failed" });
      }
    }
    setBulkRolesOpen(false);
    const label = `Roles · ${mode}`;
    setBulkResults({ title: label, rows: results });
    if (snapshots.length) registerUndo({ scope: "roles", label, snapshots });
    clearSelection();
    await load();
  };

  const applyBulkDepartment = async (dept: string | null) => {
    if (selectedUsers.length === 0) return;
    const preview = previewBulkDepartment(
      selectedUsers.map((u) => ({ id: u.id, email: u.email, roles: u.roles, department: u.department })),
      dept,
    );
    const results: BulkResult[] = [];
    const snapshots: LastBulkChange["snapshots"] = [];
    for (const row of preview) {
      if (!row.willUpdate) {
        results.push({ id: row.id, email: row.email, status: "skipped", reason: row.reason });
        continue;
      }
      const src = selectedUsers.find((u) => u.id === row.id)!;
      try {
        await updateProfile(row.id, { department: dept });
        await writeAudit({ action: "user.department.bulk_set", target_user_id: row.id, entity: "user", metadata: { email: row.email, department: dept } });
        snapshots.push({ userId: row.id, email: row.email, prevRoles: [...src.roles], prevDepartment: src.department });
        results.push({ id: row.id, email: row.email, status: "updated" });
      } catch (e: any) {
        results.push({ id: row.id, email: row.email, status: "failed", reason: e?.message ?? "Failed" });
      }
    }
    setBulkDeptOpen(false);
    const label = dept ? `Department · ${dept}` : "Department · cleared";
    setBulkResults({ title: label, rows: results });
    if (snapshots.length) registerUndo({ scope: "department", label, snapshots });
    clearSelection();
    await load();
  };

  const registerUndo = (change: LastBulkChange) => {
    setLastBulk(change);
    if (undoToastRef.current) toast.dismiss(undoToastRef.current);
    undoToastRef.current = toast.success(
      `${change.label} · ${change.snapshots.length} user${change.snapshots.length === 1 ? "" : "s"} updated`,
      {
        duration: 10000,
        action: { label: "Undo", onClick: () => { void undoLastBulk(change); } },
      },
    );
  };

  const undoLastBulk = async (change?: LastBulkChange) => {
    const target = change ?? lastBulk;
    if (!target || undoing) return;
    setUndoing(true);
    const results: BulkResult[] = [];
    for (const snap of target.snapshots) {
      try {
        if (target.scope === "roles") {
          await setUserRoles(snap.userId, snap.prevRoles);
          await writeAudit({ action: "user.roles.bulk_undo", target_user_id: snap.userId, entity: "user", metadata: { email: snap.email, restored: snap.prevRoles } });
        } else {
          await updateProfile(snap.userId, { department: snap.prevDepartment });
          await writeAudit({ action: "user.department.bulk_undo", target_user_id: snap.userId, entity: "user", metadata: { email: snap.email, restored: snap.prevDepartment } });
        }
        results.push({ id: snap.userId, email: snap.email, status: "updated" });
      } catch (e: any) {
        results.push({ id: snap.userId, email: snap.email, status: "failed", reason: e?.message ?? "Undo failed" });
      }
    }
    setUndoing(false);
    setLastBulk(null);
    if (undoToastRef.current) { toast.dismiss(undoToastRef.current); undoToastRef.current = null; }
    setBulkResults({ title: `Undo · ${target.label}`, rows: results });
    await load();
  };

  const selectAllFiltered = () => setSelected(new Set(filtered.map((u) => u.id)));
  const selectedOnOtherPages = selectedUsers.filter((u) => !pageIds.includes(u.id)).length;
  const filteredIdSet = useMemo(() => new Set(filtered.map((u) => u.id)), [filtered]);
  const selectedInFilter = selectedUsers.filter((u) => filteredIdSet.has(u.id)).length;
  const allFilteredSelected = filtered.length > 0 && selectedInFilter === filtered.length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Administer accounts, roles, departments, and access controls.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add user
          </Button>
        </div>

      </header>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_repeat(4,170px)]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email, phone, department…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger aria-label="Filter by role"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ALL_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filter by status"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger aria-label="Filter by department"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger aria-label="Sort users"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Newest first</SelectItem>
                <SelectItem value="name_asc">Name (A–Z)</SelectItem>
                <SelectItem value="name_desc">Name (Z–A)</SelectItem>
                <SelectItem value="role">Role (Admin first)</SelectItem>
                <SelectItem value="last_login_desc">Last login (recent)</SelectItem>
                <SelectItem value="last_login_asc">Last login (oldest)</SelectItem>
              </SelectContent>
            </Select>
          </div>


          {selected.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-primary/5 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span><span className="font-medium">{selected.size}</span> selected</span>
                {selectedOnOtherPages > 0 && (
                  <Badge variant="outline" className="text-[11px]">
                    {selectedOnOtherPages} on other pages
                  </Badge>
                )}
                {!allFilteredSelected && filtered.length > paged.length && (
                  <Button size="sm" variant="link" className="h-auto p-0 text-xs" onClick={selectAllFiltered}>
                    Select all {filtered.length} matching
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setBulkRolesOpen(true)}>
                  <ShieldCheck className="mr-2 h-4 w-4" /> Assign roles
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkDeptOpen(true)}>
                  <UserCog className="mr-2 h-4 w-4" /> Set department
                </Button>
                <Button size="sm" variant="ghost" onClick={clearSelection}>Clear</Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAllOnPage}
                      aria-label="Select all on page"
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="sticky right-0 w-12 bg-card/95 backdrop-blur" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeletonRows rows={6} columns={7} />
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState
                        icon={UserCog}
                        title="No users match your filters"
                        description="Try clearing search or adjusting role, status, or department filters."
                        className="border-0 bg-transparent"
                      />
                    </TableCell>
                  </TableRow>
                ) : paged.map((u) => (

                  <TableRow key={u.id} data-state={selected.has(u.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(u.id)}
                        onCheckedChange={() => toggleOne(u.id)}
                        aria-label={`Select ${u.email}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={u.avatar_url ?? undefined} alt="" />
                          <AvatarFallback>{(u.full_name ?? u.email).slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{u.full_name || "—"}</div>
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs text-muted-foreground">{u.email}</span>
                            {u.email_verified ? (
                              <span
                                title={`Verified${u.email_confirmed_at ? " · " + new Date(u.email_confirmed_at).toLocaleDateString() : ""}`}
                                className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600"
                                aria-label="Email verified"
                              >
                                <MailCheck className="h-3 w-3" /> Verified
                              </span>
                            ) : (
                              <span
                                title="Email not verified"
                                className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600"
                                aria-label="Email not verified"
                              >
                                <MailWarning className="h-3 w-3" /> Unverified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0
                          ? <span className="text-xs text-muted-foreground">—</span>
                          : u.roles.map((r) => <RoleChip key={r} role={r} />)}
                      </div>
                    </TableCell>
                    <TableCell><span className="text-sm">{u.department || "—"}</span></TableCell>
                    <TableCell>
                      {u.is_locked
                        ? <Badge variant="destructive">Locked</Badge>
                        : u.status === "active"
                          ? <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">Active</Badge>
                          : <Badge variant="outline">Inactive</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell className="sticky right-0 bg-background/95 backdrop-blur">

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setEditing(u)}>
                            <UserCog className="mr-2 h-4 w-4" /> Edit / Assign role
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleQuickAction(u, "password.reset", () => sendPasswordReset(u.email))}
                          >
                            <KeyRound className="mr-2 h-4 w-4" /> Send password reset
                          </DropdownMenuItem>
                          {!u.email_verified && (
                            <DropdownMenuItem
                              onClick={() => handleQuickAction(u, "verification.resend", async () => { await resendVerification(u.id, u.email); })}
                            >
                              <Send className="mr-2 h-4 w-4" /> Resend verification email
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {u.is_locked ? (
                            <DropdownMenuItem
                              onClick={() => handleQuickAction(u, "user.unlock", () => lockUser(u.id, false))}
                            >
                              <Unlock className="mr-2 h-4 w-4" /> Unlock account
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleQuickAction(u, "user.lock", () => lockUser(u.id, true))}
                            >
                              <Lock className="mr-2 h-4 w-4" /> Lock account
                            </DropdownMenuItem>
                          )}
                          {u.status === "active" ? (
                            <DropdownMenuItem
                              onClick={() => handleQuickAction(u, "user.deactivate", () => setStatus(u.id, "inactive"))}
                            >
                              <ShieldCheck className="mr-2 h-4 w-4" /> Mark inactive
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleQuickAction(u, "user.activate", () => setStatus(u.id, "active"))}
                            >
                              <ShieldCheck className="mr-2 h-4 w-4" /> Mark active
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(u)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete profile
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <SmartPagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            totalItems={filtered.length}
            pageSize={PAGE_SIZE}
          />

        </CardContent>
      </Card>

      <EditUserDialog user={editing} onClose={() => setEditing(null)} onSaved={load} departments={departmentsList} />
      <AddUserDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={load}
        departments={departmentsList}
      />

      <BulkRolesDialog
        open={bulkRolesOpen}
        onClose={() => setBulkRolesOpen(false)}
        selectedUsers={selectedUsers}
        onApply={applyBulkRoles}
      />
      <BulkDepartmentDialog
        open={bulkDeptOpen}
        onClose={() => setBulkDeptOpen(false)}
        selectedUsers={selectedUsers}
        departments={departmentsList}
        onApply={applyBulkDepartment}
      />
      <BulkResultsDialog
        data={bulkResults}
        onClose={() => setBulkResults(null)}
        canUndo={!!lastBulk && !undoing}
        undoing={undoing}
        onUndo={() => { void undoLastBulk(); }}
      />




      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the profile row and role assignments for <b>{deleting?.email}</b>. The underlying
              auth account is not removed (requires service role); use "Mark inactive" for a soft disable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                try {
                  await setUserRoles(deleting.id, []);
                  await deleteUserProfile(deleting.id);
                  await writeAudit({ action: "user.delete", target_user_id: deleting.id, metadata: { email: deleting.email } });
                  toast.success("Profile deleted");
                  setDeleting(null);
                  await load();
                } catch (e: any) {
                  toast.error(e.message ?? "Failed");
                }
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditUserDialog({ user, onClose, onSaved, departments }: { user: AdminUser | null; onClose: () => void; onSaved: () => void; departments: Department[] }) {
  const [full_name, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatusVal] = useState<UserStatus>("active");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmRoles, setConfirmRoles] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [locallyVerified, setLocallyVerified] = useState(false);

  useEffect(() => {
    setResendError(null);
    setResendCooldown(0);
    setLocallyVerified(false);
  }, [user?.id]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setInterval(() => setResendCooldown((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => clearInterval(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (!user) return;
    setFullName(user.full_name ?? "");
    setPhone(user.phone ?? "");
    setDepartment(user.department ?? "");
    setStatusVal(user.status);
    setRoles(user.roles);
    setAvatarUrl(user.avatar_url);
    setUploadError(null);
    setConfirmRoles(false);
    setRoleError(null);
  }, [user]);

  // Clear inline role error whenever the user changes the role selection.
  useEffect(() => { setRoleError(null); }, [roles]);

  const toggleRole = (r: AppRole) =>
    setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  const onFile = async (f?: File | null) => {
    if (!f || !user) return;
    setUploadError(null);
    const validationError = validateAvatarFile(f);
    if (validationError) {
      setUploadError(validationError);
      return;
    }
    setUploading(true);
    try {
      const url = await uploadAvatar(user.id, f);
      setAvatarUrl(url);
      toast.success("Avatar uploaded");
    } catch (e: any) {
      const msg = e?.message ?? "Upload failed";
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };


  const rolesChanged = user
    ? (() => {
        const a = [...user.roles].sort().join("|");
        const b = [...roles].sort().join("|");
        return a !== b;
      })()
    : false;

  const attemptSave = () => {
    if (!user) return;
    const deptTrim = department.trim() || null;
    const check = validateRoleDepartment(roles, deptTrim);
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    if (rolesChanged) {
      setConfirmRoles(true);
      return;
    }
    void doSave();
  };

  const doSave = async () => {
    if (!user) return;
    const deptTrim = department.trim() || null;
    const prevRoles = [...user.roles].sort();
    const nextRoles = [...roles].sort();
    const didRolesChange = prevRoles.join("|") !== nextRoles.join("|");
    setSaving(true);
    try {
      await updateProfile(user.id, {
        full_name: full_name.trim() || null,
        phone: phone.trim() || null,
        department: deptTrim,
        status,
        avatar_url: avatarUrl,
      });
      await setUserRoles(user.id, roles);
      await writeAudit({
        action: "user.update",
        target_user_id: user.id,
        metadata: { email: user.email, roles, department, status, prev_roles: prevRoles },
      });
      if (didRolesChange) {
        const fmt = (rs: string[]) =>
          rs.length ? rs.map((r) => ROLE_LABELS[r as AppRole] ?? r).join(", ") : "None";
        toast.success("Role updated", {
          description: `${fmt(prevRoles)} → ${fmt(nextRoles)}`,
        });
      } else {
        toast.success("User updated");
      }
      setConfirmRoles(false);
      onSaved();
      onClose();
    } catch (e: any) {
      const fmt = (rs: string[]) =>
        rs.length ? rs.map((r) => ROLE_LABELS[r as AppRole] ?? r).join(", ") : "None";
      const msg = e?.message ?? "Save failed";
      if (didRolesChange) {
        const inline = `Role update failed — kept previous role: ${fmt(prevRoles)}. ${msg}`;
        setRoleError(inline);
        toast.error("Role update failed", {
          description: `Kept previous role: ${fmt(prevRoles)}. ${msg}`,
        });
        // Reset local UI to match server-side (previous) state.
        setRoles(user.roles);
      } else {
        setRoleError(null);
        toast.error(msg);
      }
      setConfirmRoles(false);
      // Refresh from server so UI matches actual persisted state.
      try { onSaved(); } catch {}
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update profile details, roles, and status.</DialogDescription>
        </DialogHeader>

        {user && (
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={avatarUrl ?? undefined} alt="" />
                <AvatarFallback>{(full_name || user.email).slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <Label htmlFor="avatar" className="cursor-pointer">
                  <div className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-accent ${uploadError ? "border-destructive text-destructive" : ""}`}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    Upload photo
                  </div>
                </Label>
                <input
                  id="avatar"
                  type="file"
                  accept={AVATAR_ALLOWED_EXTS.map((e) => `.${e}`).join(",") + ",image/jpeg,image/png,image/webp,image/gif"}
                  className="hidden"
                  onChange={(e) => {
                    onFile(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">{user.email}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  JPG, PNG, WEBP or GIF · max {(AVATAR_MAX_BYTES / (1024 * 1024)).toFixed(0)} MB
                </p>
                {uploadError && (
                  <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                    {uploadError}
                  </p>
                )}
              </div>
            </div>

            {user && (() => {
              const isVerified = user.email_verified || locallyVerified;
              return (
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      {isVerified ? (
                        <>
                          <MailCheck className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium text-emerald-700">Email verified</span>
                          {user.email_confirmed_at && (
                            <span className="text-xs text-muted-foreground">· {new Date(user.email_confirmed_at).toLocaleString()}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <MailWarning className="h-4 w-4 text-amber-600" />
                          <span className="font-medium text-amber-700">Email not verified</span>
                        </>
                      )}
                    </div>
                    {!isVerified && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resending || resendCooldown > 0}
                        aria-label={resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : "Resend verification email"}
                        onClick={async () => {
                          setResendError(null);
                          setResending(true);
                          try {
                            await resendVerification(user.id, user.email);
                            toast.success("Verification email sent");
                            setResendCooldown(30);
                          } catch (e: any) {
                            const msg = e?.message ?? "Failed to resend verification";
                            setResendError(msg);
                            toast.error(msg);
                          } finally {
                            setResending(false);
                          }
                        }}
                      >
                        {resending ? (
                          <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Sending…</>
                        ) : resendCooldown > 0 ? (
                          <>Resend in {resendCooldown}s</>
                        ) : (
                          <><Send className="mr-2 h-3.5 w-3.5" /> Resend</>
                        )}
                      </Button>
                    )}
                  </div>
                  {resendError && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      data-testid="edit-user-resend-server-error"
                      className="mt-2 flex items-start justify-between gap-2 rounded border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
                    >
                      <span>Resend failed: {resendError}</span>
                      <button
                        type="button"
                        onClick={() => setResendError(null)}
                        aria-label="Dismiss resend error"
                        className="opacity-70 hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}


            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Full name</Label>
                <Input value={full_name} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-user-dept">Department</Label>
                {(() => {
                  const c = validateRoleDepartment(roles, department.trim() || null);
                  const deptError = !c.ok && c.field === "department" ? c.error : null;
                  return (
                    <>
                      {departments.length > 0 ? (
                        <Select value={department || "__none"} onValueChange={(v) => setDepartment(v === "__none" ? "" : v)}>
                          <SelectTrigger
                            id="edit-user-dept"
                            aria-invalid={!!deptError}
                            aria-describedby={deptError ? "edit-user-dept-error" : undefined}
                          >
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">None</SelectItem>
                            {departments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id="edit-user-dept"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder="e.g. Admissions"
                          aria-invalid={!!deptError}
                          aria-describedby={deptError ? "edit-user-dept-error" : undefined}
                        />
                      )}
                      {deptError && (
                        <p
                          id="edit-user-dept-error"
                          role="alert"
                          aria-live="assertive"
                          data-testid="edit-user-dept-error"
                          className="mt-1 text-[11px] font-medium text-destructive"
                        >
                          {deptError}
                        </p>
                      )}
                    </>
                  );
                })()}
              </div>
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatusVal(v as UserStatus)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {roleError && (
              <div
                role="alert"
                aria-live="assertive"
                data-testid="edit-user-role-server-error"
                className="flex items-start justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                <span className="leading-relaxed">{roleError}</span>
                <button
                  type="button"
                  onClick={() => setRoleError(null)}
                  className="shrink-0 rounded p-0.5 hover:bg-destructive/10"
                  aria-label="Dismiss role error"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {(() => {
              const check = validateRoleDepartment(roles, department.trim() || null);
              const rolesError = !check.ok && check.field === "roles" ? check.error : null;
              return (
                <div role="group" aria-labelledby="edit-user-roles-label" aria-describedby={rolesError ? "edit-user-roles-error" : "edit-user-roles-hint"}>
                  <Label id="edit-user-roles-label" className="mb-2 block">Roles</Label>
                  <div className="grid grid-cols-2 gap-2 rounded-md border p-3" aria-invalid={!!rolesError}>
                    {ALL_ROLES.map((r) => (
                      <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
                        <Checkbox checked={roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                        {ROLE_LABELS[r]}
                      </label>
                    ))}
                  </div>
                  {rolesError ? (
                    <p
                      id="edit-user-roles-error"
                      role="alert"
                      aria-live="assertive"
                      data-testid="edit-user-roles-error"
                      className="mt-1.5 text-[11px] font-medium text-destructive"
                    >
                      {rolesError}
                    </p>
                  ) : (
                    <p id="edit-user-roles-hint" className="mt-1.5 text-[11px] text-muted-foreground">{describeRoleDeptRules()}</p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={attemptSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmRoles} onOpenChange={(o) => !o && !saving && setConfirmRoles(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change role assignment?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  You're about to change the roles for <b>{user?.email}</b>. This updates their
                  access immediately.
                </p>
                <div className="grid gap-2 rounded-md border bg-muted/40 p-3 sm:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Current</div>
                    <div className="flex flex-wrap gap-1">
                      {(user?.roles ?? []).length === 0
                        ? <span className="text-xs text-muted-foreground">None</span>
                        : (user?.roles ?? []).map((r) => <RoleChip key={r} role={r} />)}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">New</div>
                    <div className="flex flex-wrap gap-1">
                      {roles.length === 0
                        ? <span className="text-xs text-muted-foreground">None</span>
                        : roles.map((r) => <RoleChip key={r} role={r} />)}
                    </div>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void doSave(); }}
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
              ) : (
                "Confirm change"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function AddUserDialog({
  open, onClose, onCreated, departments,
}: { open: boolean; onClose: () => void; onCreated: () => void; departments: Department[] }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [full_name, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [status, setStatusVal] = useState<UserStatus>("active");
  const [roles, setRoles] = useState<AppRole[]>(["admin"]);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<{ email?: string; password?: string; roles?: string }>({});

  useEffect(() => {
    if (!open) return;
    setEmail(""); setPassword(""); setFullName(""); setPhone("");
    setDepartment(""); setStatusVal("active"); setRoles(["admin"]);
    setShowPassword(false);
    setFormErrors({});
  }, [open]);

  const toggleRole = (r: AppRole) => {
    setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
    setFormErrors((e) => ({ ...e, roles: undefined }));
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p);
    setShowPassword(true);
  };

  const submit = async () => {
    const errs: { email?: string; password?: string; roles?: string } = {};
    if (!email.trim()) errs.email = "Email is required";
    if (!password.trim()) errs.password = "Password is required";
    else if (password.length < 8) errs.password = "Password must be at least 8 characters";
    if (roles.length === 0) {
      errs.roles = "Assign at least one role";
    } else {
      const invalid = roles.filter((r) => !ALL_ROLES.includes(r));
      if (invalid.length) errs.roles = `Invalid role: ${invalid.join(", ")}`;
    }
    if (Object.keys(errs).length) {
      setFormErrors(errs);
      return;
    }
    const check = validateRoleDepartment(roles, department.trim() || null);
    if (!check.ok) {
      // Field-level rule error is already rendered inline near roles/department.
      return;
    }
    setFormErrors({});
    setSaving(true);
    try {
      const newId = await adminCreateUser({
        email: email.trim(),
        password,
        full_name: full_name.trim() || undefined,
        phone: phone.trim() || undefined,
        department: department.trim() || undefined,
        status,
        roles,
      });
      await writeAudit({
        action: "user.create",
        target_user_id: newId,
        entity: "user",
        metadata: { email: email.trim(), roles, department },
      });
      const roleNames = roles.map((r) => ROLE_LABELS[r]).join(", ");
      toast.success(`User created · assigned role: ${roleNames}`, {
        description: email.trim(),
      });
      onCreated();
      onClose();
    } catch (e: any) {
      const msg = e?.message ?? "Failed to create user";
      if (/role/i.test(msg)) {
        setFormErrors((prev) => ({ ...prev, roles: msg }));
      } else if (/email/i.test(msg)) {
        setFormErrors((prev) => ({ ...prev, email: msg }));
      } else if (/password/i.test(msg)) {
        setFormErrors((prev) => ({ ...prev, password: msg }));
      }
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">Add new user</DialogTitle>
                <DialogDescription>Create an account and assign roles, department, and status.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="grid gap-4 px-6 py-5 max-h-[70vh] overflow-y-auto">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="add-user-email">Email <span className="text-destructive">*</span></Label>
              <Input
                id="add-user-email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFormErrors((p) => ({ ...p, email: undefined })); }}
                placeholder="user@example.com"
                autoComplete="off"
                aria-invalid={!!formErrors.email}
                aria-describedby={formErrors.email ? "add-user-email-error" : undefined}
              />
              {formErrors.email && (
                <p id="add-user-email-error" role="alert" data-testid="add-user-email-error" className="mt-1 text-[11px] font-medium text-destructive">
                  {formErrors.email}
                </p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="add-user-password">Password <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="add-user-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setFormErrors((p) => ({ ...p, password: undefined })); }}
                    placeholder="Min 8 characters"
                    autoComplete="new-password"
                    className="pr-9"
                    aria-invalid={!!formErrors.password}
                    aria-describedby={formErrors.password ? "add-user-password-error" : undefined}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button type="button" variant="outline" onClick={generatePassword}>Generate</Button>
              </div>
              {formErrors.password && (
                <p id="add-user-password-error" role="alert" data-testid="add-user-password-error" className="mt-1 text-[11px] font-medium text-destructive">
                  {formErrors.password}
                </p>
              )}
            </div>
            <div>
              <Label>Full name</Label>
              <Input value={full_name} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="add-user-dept">Department</Label>
              {(() => {
                const c = validateRoleDepartment(roles, department.trim() || null);
                const deptError = !c.ok && c.field === "department" ? c.error : null;
                return (
                  <>
                    {departments.length > 0 ? (
                      <Select value={department || "__none"} onValueChange={(v) => setDepartment(v === "__none" ? "" : v)}>
                        <SelectTrigger
                          id="add-user-dept"
                          aria-invalid={!!deptError}
                          aria-describedby={deptError ? "add-user-dept-error" : undefined}
                        >
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">None</SelectItem>
                          {departments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="add-user-dept"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="e.g. Admissions"
                        aria-invalid={!!deptError}
                        aria-describedby={deptError ? "add-user-dept-error" : undefined}
                      />
                    )}
                    {deptError && (
                      <p
                        id="add-user-dept-error"
                        role="alert"
                        aria-live="assertive"
                        data-testid="add-user-dept-error"
                        className="mt-1 text-[11px] font-medium text-destructive"
                      >
                        {deptError}
                      </p>
                    )}
                  </>
                );
              })()}
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatusVal(v as UserStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(() => {
            const check = validateRoleDepartment(roles, department.trim() || null);
            const ruleError = !check.ok && check.field === "roles" ? check.error : null;
            const rolesError = formErrors.roles ?? ruleError;
            return (
              <div role="group" aria-labelledby="add-user-roles-label" aria-describedby={rolesError ? "add-user-roles-error" : "add-user-roles-hint"}>
                <Label id="add-user-roles-label" className="mb-2 block">Roles <span className="text-destructive">*</span></Label>
                <div
                  className={`grid grid-cols-2 gap-2 rounded-md border p-3 ${rolesError ? "border-destructive/60 bg-destructive/5" : ""}`}
                  aria-invalid={!!rolesError}
                >
                  {ALL_ROLES.map((r) => (
                    <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox checked={roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                      {ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
                {rolesError ? (
                  <p
                    id="add-user-roles-error"
                    role="alert"
                    aria-live="assertive"
                    data-testid="add-user-roles-error"
                    className="mt-1.5 text-[11px] font-medium text-destructive"
                  >
                    {rolesError}
                  </p>
                ) : (
                  <p id="add-user-roles-hint" className="mt-1.5 text-[11px] text-muted-foreground">{describeRoleDeptRules()}</p>
                )}
              </div>
            );
          })()}
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkPreviewPanel({ preview }: { preview: BulkPreviewRow[] }) {
  const willUpdate = preview.filter((p) => p.willUpdate);
  const willSkip = preview.filter((p) => !p.willUpdate);
  if (preview.length === 0) return null;
  return (
    <div
      className="rounded-md border bg-muted/30 p-3 text-xs"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="bulk-preview-panel"
    >
      <div className="flex items-center gap-3">
        <Badge variant="secondary">{willUpdate.length} will update</Badge>
        <Badge variant={willSkip.length ? "destructive" : "outline"}>
          {willSkip.length} will be skipped
        </Badge>
      </div>
      {willSkip.length > 0 && (
        <div className="mt-2 max-h-40 overflow-y-auto rounded border bg-background/70 p-2">
          <p className="mb-1 font-medium" id="bulk-skipped-heading">Skipped users and reasons:</p>
          <ul className="space-y-0.5" aria-labelledby="bulk-skipped-heading">
            {willSkip.slice(0, 20).map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-1">
                <span className="font-mono">{r.email}</span>
                <span className="text-muted-foreground">— {r.reason}</span>
              </li>
            ))}
            {willSkip.length > 20 && (
              <li className="text-muted-foreground">…and {willSkip.length - 20} more</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function BulkRolesDialog({
  open, onClose, selectedUsers, onApply,
}: {
  open: boolean; onClose: () => void; selectedUsers: AdminUser[];
  onApply: (roles: AppRole[], mode: "replace" | "add" | "remove") => Promise<void>;
}) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [mode, setMode] = useState<"replace" | "add" | "remove">("replace");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setRoles([]); setMode("replace"); } }, [open]);
  const toggle = (r: AppRole) =>
    setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);

  const preview = useMemo(
    () => roles.length === 0
      ? []
      : previewBulkRoles(
          selectedUsers.map((u) => ({ id: u.id, email: u.email, roles: u.roles, department: u.department })),
          roles, mode,
        ),
    [selectedUsers, roles, mode],
  );
  const updatable = preview.filter((p) => p.willUpdate).length;

  const submit = async () => {
    if (roles.length === 0) { toast.error("Pick at least one role"); return; }
    if (updatable === 0) { toast.error("No selected users are compatible with this change"); return; }
    setSaving(true);
    try { await onApply(roles, mode); } finally { setSaving(false); }
  };
  const count = selectedUsers.length;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assign roles to {count} user{count === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>Choose how the selected roles apply to each user.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Mode</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="replace">Replace existing roles</SelectItem>
                <SelectItem value="add">Add to existing roles</SelectItem>
                <SelectItem value="remove">Remove from existing roles</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-2 block">Roles</Label>
            <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
              {ALL_ROLES.map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox checked={roles.includes(r)} onCheckedChange={() => toggle(r)} />
                  {ROLE_LABELS[r]}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {describeRoleDeptRules()}
            </p>
          </div>
          <BulkPreviewPanel preview={preview} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || updatable === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply to {updatable}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkDepartmentDialog({
  open, onClose, selectedUsers, departments, onApply,
}: {
  open: boolean; onClose: () => void; selectedUsers: AdminUser[]; departments: Department[];
  onApply: (dept: string | null) => Promise<void>;
}) {
  const [dept, setDept] = useState<string>("__none");
  const [custom, setCustom] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setDept("__none"); setCustom(""); } }, [open]);
  const resolvedDept = useMemo<string | null>(() => {
    if (dept === "__none") return null;
    if (dept === "__custom") return custom.trim() || null;
    return dept;
  }, [dept, custom]);
  const preview = useMemo(
    () => previewBulkDepartment(
      selectedUsers.map((u) => ({ id: u.id, email: u.email, roles: u.roles, department: u.department })),
      resolvedDept,
    ),
    [selectedUsers, resolvedDept],
  );
  const updatable = preview.filter((p) => p.willUpdate).length;
  const submit = async () => {
    if (updatable === 0) { toast.error("No selected users are compatible with this change"); return; }
    setSaving(true);
    try { await onApply(resolvedDept); } finally { setSaving(false); }
  };
  const count = selectedUsers.length;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Set department for {count} user{count === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>Assign or clear the department for the selected users.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-2 block">Department</Label>
            <Select value={dept} onValueChange={setDept}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Clear department</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                <SelectItem value="__custom">Custom…</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {dept === "__custom" && (
            <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Department name" />
          )}
          <p className="text-[11px] text-muted-foreground">
            {describeRoleDeptRules()}
          </p>
          <BulkPreviewPanel preview={preview} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving || updatable === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Apply to {updatable}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkResultsDialog({
  data, onClose, canUndo, undoing, onUndo,
}: {
  data: { title: string; rows: BulkResult[] } | null;
  onClose: () => void;
  canUndo?: boolean;
  undoing?: boolean;
  onUndo?: () => void;
}) {
  const open = !!data;
  const rows = data?.rows ?? [];
  const updated = rows.filter((r) => r.status === "updated").length;
  const skipped = rows.filter((r) => r.status === "skipped").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const summary = `${updated} updated, ${skipped} skipped${failed ? `, ${failed} failed` : ""}`;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" aria-describedby="bulk-results-summary">
        <DialogHeader>
          <DialogTitle>Bulk assignment results</DialogTitle>
          <DialogDescription>{data?.title}</DialogDescription>
        </DialogHeader>
        <div
          id="bulk-results-summary"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="flex flex-wrap items-center gap-2"
        >
          <span className="sr-only" data-testid="bulk-results-sr">{summary}</span>
          <Badge variant="default">{updated} updated</Badge>
          <Badge variant={skipped ? "destructive" : "outline"}>{skipped} skipped</Badge>
          {failed > 0 && <Badge variant="destructive">{failed} failed</Badge>}
        </div>
        <div className="max-h-[50vh] overflow-y-auto rounded-md border" role="region" aria-label="Per-user bulk results">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">User</TableHead>
                <TableHead scope="col" className="w-[110px]">Result</TableHead>
                <TableHead scope="col">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.email}</TableCell>
                  <TableCell>
                    <Badge
                      aria-label={`Result: ${r.status}`}
                      variant={
                        r.status === "updated" ? "default"
                          : r.status === "skipped" ? "secondary"
                          : "destructive"
                      }
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.reason ?? "—"}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No rows</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {canUndo && onUndo ? (
            <Button
              variant="outline"
              onClick={onUndo}
              disabled={undoing}
              data-testid="bulk-results-undo"
            >
              {undoing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Undo2 className="mr-2 h-4 w-4" />}
              Undo last change
            </Button>
          ) : <span />}
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




