import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { CheckCircle2, XCircle, RefreshCw, Copy, Database, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { probeStudentSchema, type SchemaReport } from "@/lib/schema-probe";

export const Route = createFileRoute("/_authenticated/admin/schema")({
  component: () => (
    <RoleGuard roles={["admin"]}>
      <SchemaStatusPage />
    </RoleGuard>
  ),
});

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Copied to clipboard");
        } catch {
          toast.error("Copy failed");
        }
      }}
    >
      <Copy className="mr-2 h-3.5 w-3.5" /> {label}
    </Button>
  );
}

function SchemaStatusPage() {
  const [report, setReport] = useState<SchemaReport | null>(null);
  const [loading, setLoading] = useState(true);

  const run = async () => {
    setLoading(true);
    try {
      setReport(await probeStudentSchema());
    } catch (e: any) {
      toast.error(e?.message ?? "Schema probe failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { run(); }, []);

  const missingMigrations = useMemo(() => {
    if (!report) return [] as string[];
    return Array.from(new Set(report.missing.map((m) => m.migration))).sort();
  }, [report]);

  const psqlCommands = useMemo(() => {
    if (missingMigrations.length === 0) return "";
    const lines = [
      '# Set your Supabase database URL (postgres connection string):',
      'export SUPABASE_DB_URL="postgresql://postgres:<PASSWORD>@<HOST>:5432/postgres"',
      "",
      "# Apply all pending migrations in order:",
      "bash scripts/db-push.sh",
      "",
      "# …or apply only the ones missing here:",
      ...missingMigrations.map(
        (m) => `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/${m}`,
      ),
      "",
      "# Reload PostgREST schema cache so the API sees the new columns:",
      `psql "$SUPABASE_DB_URL" -c "NOTIFY pgrst, 'reload schema';"`,
    ];
    return lines.join("\n");
  }, [missingMigrations]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Database className="h-6 w-6 text-primary" /> Schema status
          </h1>
          <p className="text-sm text-muted-foreground">
            Live check of columns this app expects on <code>public.students</code>.
          </p>
        </div>
        <Button variant="outline" onClick={run} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Re-check
        </Button>
      </div>

      {report && (
        <Card className={report.ok ? "border-emerald-500/40" : "border-destructive/50"}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              {report.ok ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  All expected columns present
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  {report.missing.length} column{report.missing.length === 1 ? "" : "s"} missing
                </>
              )}
            </CardTitle>
            <CardDescription>
              Checked {new Date(report.checkedAt).toLocaleString()} — {report.columns.length} columns probed.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {report && !report.ok && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fix — run these commands on your Supabase DB</CardTitle>
            <CardDescription>
              Requires an admin with <code>psql</code> access. The runner is idempotent and skips
              already-applied migrations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="max-h-80 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
{psqlCommands}
            </pre>
            <div className="flex flex-wrap gap-2">
              <CopyBtn text={psqlCommands} label="Copy all commands" />
              {missingMigrations.map((m) => (
                <CopyBtn
                  key={m}
                  text={`psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f db/migrations/${m}`}
                  label={`Copy ${m}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Columns</CardTitle>
          <CardDescription>Per-column probe result against the live database.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Column</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[26%]">Migration</TableHead>
                <TableHead className="w-[110px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !report && (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    Probing schema…
                  </TableCell>
                </TableRow>
              )}
              {report?.columns.map((c) => (
                <TableRow key={c.column}>
                  <TableCell className="font-mono text-xs">{c.column}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.description}
                    {c.errorMessage && !c.present && (
                      <div className="mt-1 text-xs text-destructive">{c.errorMessage}</div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.migration}</TableCell>
                  <TableCell>
                    {c.present ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Present
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="mr-1 h-3 w-3" /> Missing
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
