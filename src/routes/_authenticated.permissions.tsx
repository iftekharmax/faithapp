import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS } from "@/lib/auth-context";
import type { AppRole } from "@/lib/supabase";
import {
  ALL_ROLES, KNOWN_PERMISSIONS, listPermissions, togglePermission, writeAudit,
} from "@/lib/user-management";

export const Route = createFileRoute("/_authenticated/permissions")({
  component: () => (
    <RoleGuard roles={["admin"]}>
      <PermissionsPage />
    </RoleGuard>
  ),
});

function PermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [matrix, setMatrix] = useState<Record<string, Set<AppRole>>>({});

  const load = async () => {
    setLoading(true);
    try {
      const rows = await listPermissions();
      const m: Record<string, Set<AppRole>> = {};
      rows.forEach((p) => {
        if (!m[p.permission]) m[p.permission] = new Set();
        m[p.permission].add(p.role);
      });
      setMatrix(m);
    } catch (e: any) {
      toast.error(e.message ?? "Load failed");
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggle = async (permission: string, role: AppRole, enabled: boolean) => {
    // optimistic
    setMatrix((prev) => {
      const next = { ...prev };
      const set = new Set(next[permission] ?? []);
      enabled ? set.add(role) : set.delete(role);
      next[permission] = set;
      return next;
    });
    try {
      await togglePermission(role, permission, enabled);
      await writeAudit({
        action: enabled ? "permission.grant" : "permission.revoke",
        entity: "permission",
        metadata: { role, permission },
      });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
      load();
    }
  };

  const grouped = useMemo(() => {
    const g: Record<string, typeof KNOWN_PERMISSIONS> = {};
    KNOWN_PERMISSIONS.forEach((p) => {
      (g[p.group] ??= []).push(p);
    });
    return g;
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Permissions</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Grant capabilities to each role. Changes apply immediately.
        </p>
      </header>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Permission</TableHead>
                    {ALL_ROLES.map((r) => <TableHead key={r} className="text-center">{ROLE_LABELS[r]}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(grouped).map(([group, perms]) => (
                    <>
                      <TableRow key={`g-${group}`} className="bg-muted/40">
                        <TableCell colSpan={1 + ALL_ROLES.length} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group}
                        </TableCell>
                      </TableRow>
                      {perms.map((p) => (
                        <TableRow key={p.key}>
                          <TableCell>
                            <div className="text-sm font-medium">{p.label}</div>
                            <div className="text-[11px] text-muted-foreground">{p.key}</div>
                          </TableCell>
                          {ALL_ROLES.map((r) => {
                            const enabled = matrix[p.key]?.has(r) ?? false;
                            return (
                              <TableCell key={r} className="text-center">
                                <Checkbox
                                  checked={enabled}
                                  onCheckedChange={(v) => toggle(p.key, r, Boolean(v))}
                                />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
