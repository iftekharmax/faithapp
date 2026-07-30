import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Plus, Pencil, Trash2, Loader2, RefreshCw, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ROLE_LABELS } from "@/lib/auth-context";
import type { AppRole } from "@/lib/supabase";
import {
  ALL_ROLES, KNOWN_PERMISSIONS, listPermissions, togglePermission,
  listCustomRoles, createCustomRole, updateCustomRole, deleteCustomRole,
  writeAudit, type CustomRole,
} from "@/lib/user-management";

export const Route = createFileRoute("/_authenticated/roles")({
  component: () => (
    <RoleGuard roles={["admin"]}>
      <RolesPage />
    </RoleGuard>
  ),
});

function RolesPage() {
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState<Record<string, Set<AppRole>>>({});
  const [custom, setCustom] = useState<CustomRole[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [deleting, setDeleting] = useState<CustomRole | null>(null);
  const [editingBuiltIn, setEditingBuiltIn] = useState<AppRole | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [perms, cr] = await Promise.all([listPermissions(), listCustomRoles()]);
      const m: Record<string, Set<AppRole>> = {};
      perms.forEach((p) => {
        if (!m[p.permission]) m[p.permission] = new Set();
        m[p.permission].add(p.role);
      });
      setMatrix(m);
      setCustom(cr);
    } catch (e: any) {
      toast.error(e.message ?? "Load failed");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const builtInPermissions = useMemo(() => {
    const map: Record<AppRole, string[]> = {
      admin: [], counselor: [], application_team: [], student: [],
    };
    Object.entries(matrix).forEach(([perm, set]) => {
      set.forEach((role) => map[role].push(perm));
    });
    return map;
  }, [matrix]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Roles</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage built-in role permissions and create custom role templates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add role
          </Button>
        </div>
      </header>

      {loading ? (
        <div className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Built-in roles
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {ALL_ROLES.map((r) => (
                <RoleCard
                  key={r}
                  title={ROLE_LABELS[r]}
                  subtitle="System role"
                  badge="Built-in"
                  permissions={builtInPermissions[r]}
                  onEdit={() => setEditingBuiltIn(r)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Custom roles
            </div>
            {custom.length === 0 ? (
              <Card>
                <CardContent className="p-0">
                  <EmptyState
                    icon={ShieldCheck}
                    title="No custom roles"
                    description="Create a custom role template to group a specific set of permissions."
                    className="border-0 bg-transparent"
                  />
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {custom.map((c) => (
                  <RoleCard
                    key={c.id}
                    title={c.name}
                    subtitle={c.description ?? "Custom role"}
                    badge="Custom"
                    permissions={c.permissions}
                    onEdit={() => setEditing(c)}
                    onDelete={() => setDeleting(c)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <RoleDialog
        open={creating}
        initial={null}
        builtInRole={null}
        matrix={matrix}
        onClose={() => setCreating(false)}
        onSaved={load}
      />
      <RoleDialog
        open={!!editing}
        initial={editing}
        builtInRole={null}
        matrix={matrix}
        onClose={() => setEditing(null)}
        onSaved={load}
      />
      <RoleDialog
        open={!!editingBuiltIn}
        initial={null}
        builtInRole={editingBuiltIn}
        matrix={matrix}
        onClose={() => setEditingBuiltIn(null)}
        onSaved={load}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete custom role <b>{deleting?.name}</b>? This does not affect built-in roles or existing user assignments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                try {
                  await deleteCustomRole(deleting.id);
                  await writeAudit({ action: "role.delete", entity: "role", metadata: { name: deleting.name } });
                  toast.success("Role deleted");
                  setDeleting(null);
                  await load();
                } catch (e: any) { toast.error(e.message ?? "Failed"); }
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RoleCard({
  title, subtitle, badge, permissions, onEdit, onDelete,
}: {
  title: string; subtitle: string; badge: string;
  permissions: string[];
  onEdit: () => void; onDelete?: () => void;
}) {
  const labelFor = (key: string) =>
    KNOWN_PERMISSIONS.find((p) => p.key === key)?.label ?? key;
  return (
    <div className="group rounded-xl border bg-card p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-semibold">{title}</div>
                <Badge variant="outline" className="text-[10px]">{badge}</Badge>
              </div>
              <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-60 transition group-hover:opacity-100">
          <Button size="icon" variant="ghost" onClick={onEdit} aria-label="Edit permissions">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {onDelete && (
            <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {permissions.length === 0 ? (
          <span className="text-xs text-muted-foreground">No permissions assigned</span>
        ) : permissions.slice(0, 8).map((p) => (
          <Badge key={p} variant="secondary" className="text-[10px] font-normal">{labelFor(p)}</Badge>
        ))}
        {permissions.length > 8 && (
          <Badge variant="outline" className="text-[10px] font-normal">+{permissions.length - 8} more</Badge>
        )}
      </div>
    </div>
  );
}

function RoleDialog({
  open, initial, builtInRole, matrix, onClose, onSaved,
}: {
  open: boolean;
  initial: CustomRole | null;
  builtInRole: AppRole | null;
  matrix: Record<string, Set<AppRole>>;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (builtInRole) {
      const perms = new Set<string>();
      Object.entries(matrix).forEach(([perm, set]) => { if (set.has(builtInRole)) perms.add(perm); });
      setSelected(perms);
      setName(ROLE_LABELS[builtInRole]);
      setDescription("");
    } else if (initial) {
      setName(initial.name);
      setDescription(initial.description ?? "");
      setSelected(new Set(initial.permissions));
    } else {
      setName(""); setDescription(""); setSelected(new Set());
    }
  }, [open, initial, builtInRole, matrix]);

  const toggle = (key: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  };

  const grouped = useMemo(() => {
    const g: Record<string, typeof KNOWN_PERMISSIONS> = {};
    KNOWN_PERMISSIONS.forEach((p) => { (g[p.group] ??= []).push(p); });
    return g;
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      if (builtInRole) {
        // Diff and apply toggles to role_permissions
        const current = new Set<string>();
        Object.entries(matrix).forEach(([perm, set]) => { if (set.has(builtInRole)) current.add(perm); });
        const toAdd = [...selected].filter((p) => !current.has(p));
        const toRemove = [...current].filter((p) => !selected.has(p));
        for (const p of toAdd) await togglePermission(builtInRole, p, true);
        for (const p of toRemove) await togglePermission(builtInRole, p, false);
        await writeAudit({
          action: "role.permissions.update",
          entity: "role",
          metadata: { role: builtInRole, added: toAdd, removed: toRemove },
        });
        toast.success("Permissions updated");
      } else if (initial) {
        if (!name.trim()) { toast.error("Name required"); setSaving(false); return; }
        await updateCustomRole(initial.id, {
          name: name.trim(),
          description: description.trim() || null,
          permissions: [...selected],
        });
        await writeAudit({ action: "role.update", entity: "role", metadata: { name: name.trim() } });
        toast.success("Role updated");
      } else {
        if (!name.trim()) { toast.error("Name required"); setSaving(false); return; }
        await createCustomRole({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: [...selected],
        });
        await writeAudit({ action: "role.create", entity: "role", metadata: { name: name.trim() } });
        toast.success("Role created");
      }
      await onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Save failed");
    } finally { setSaving(false); }
  };

  const isBuiltIn = !!builtInRole;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl overflow-hidden p-0">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl">
                  {isBuiltIn ? `Edit permissions · ${name}` : initial ? "Edit role" : "Add role"}
                </DialogTitle>
                <DialogDescription>
                  {isBuiltIn
                    ? "Toggle the permissions granted to this built-in role."
                    : "Name the role and choose the permissions it should grant."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="grid gap-5 px-6 py-5 max-h-[70vh] overflow-y-auto">
          {!isBuiltIn && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Regional Officer" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm">Permissions</Label>
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
            </div>
            <div className="space-y-3">
              {Object.entries(grouped).map(([group, perms]) => (
                <div key={group} className="rounded-lg border">
                  <div className="border-b bg-muted/40 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </div>
                  <div className="grid gap-2 p-3 sm:grid-cols-2">
                    {perms.map((p) => (
                      <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 text-sm hover:bg-accent/60">
                        <Checkbox
                          checked={selected.has(p.key)}
                          onCheckedChange={(v) => toggle(p.key, Boolean(v))}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="text-sm">{p.label}</div>
                          <div className="text-[10px] text-muted-foreground">{p.key}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t bg-muted/30 px-6 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isBuiltIn ? "Save permissions" : initial ? "Save changes" : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
