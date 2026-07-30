import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ScrollText, Search } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listAuditLogs, type AuditLog } from "@/lib/user-management";

export const Route = createFileRoute("/_authenticated/audit-logs")({
  component: () => (
    <RoleGuard roles={["admin"]}>
      <AuditLogsPage />
    </RoleGuard>
  ),
});

function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      try { setRows(await listAuditLogs(500)); }
      catch (e: any) { toast.error(e.message ?? "Failed"); }
      finally { setLoading(false); }
    })();
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) =>
      r.action.toLowerCase().includes(t) ||
      (r.actor_email?.toLowerCase().includes(t)) ||
      (r.entity?.toLowerCase().includes(t))
    );
  }, [rows, q]);

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-2">
        <ScrollText className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground">A trail of administrative actions.</p>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search action, actor, entity…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No log entries.
                  </TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm">{r.actor_email ?? "—"}</TableCell>
                    <TableCell><Badge variant="secondary">{r.action}</Badge></TableCell>
                    <TableCell className="text-sm">{r.entity ?? "—"}</TableCell>
                    <TableCell className="max-w-md truncate text-xs text-muted-foreground">
                      {r.metadata ? JSON.stringify(r.metadata) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
