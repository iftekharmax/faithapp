import { useRef, useState } from "react";
import { Download, Upload, Loader2, AlertCircle, CheckCircle2, XCircle, SkipForward, FileText, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ImportPlan, ImportResult, ImportOptions, PlanAction } from "@/lib/university-csv";
import { executeImportPlan } from "@/lib/university-csv";

type Props = {
  label?: string;
  onExport: () => Promise<void> | void;
  onPreview?: (text: string) => Promise<ImportPlan>;
  onImportDone?: () => void;
  templateHeaders?: string[];
  templateName?: string;
  canImport?: boolean;
};

const ACTION_STYLE: Record<PlanAction, { color: string; icon: any; label: string }> = {
  create: { color: "text-emerald-600 border-emerald-200 bg-emerald-50", icon: CheckCircle2, label: "Create" },
  update: { color: "text-blue-600 border-blue-200 bg-blue-50", icon: Info, label: "Update" },
  skip:   { color: "text-amber-600 border-amber-200 bg-amber-50", icon: SkipForward, label: "Skip" },
  error:  { color: "text-destructive border-destructive/30 bg-destructive/5", icon: XCircle, label: "Error" },
};

export function CsvToolbar({
  label = "CSV", onExport, onPreview, onImportDone,
  templateHeaders, templateName, canImport = true,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"import" | "export" | "confirm" | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [upsert, setUpsert] = useState(true);
  const [dryRun, setDryRun] = useState(false);

  async function handleExport() {
    setBusy("export");
    try { await onExport(); toast.success("Export ready"); }
    catch (e: any) { toast.error(e.message ?? "Export failed"); }
    finally { setBusy(null); }
  }

  async function handleFile(file: File) {
    if (!onPreview) return;
    setBusy("import");
    try {
      const text = await file.text();
      const p = await onPreview(text);
      setPlan(p);
      setResult(null);
    } catch (e: any) { toast.error(e.message ?? "Import failed"); }
    finally { setBusy(null); if (inputRef.current) inputRef.current.value = ""; }
  }

  async function confirmImport() {
    if (!plan) return;
    setBusy("confirm");
    try {
      const opts: ImportOptions = { upsert, dryRun };
      const res = await executeImportPlan(plan, opts);
      setResult(res);
      if (!dryRun) {
        if (res.errors.length === 0) toast.success(`Imported: ${res.created} created, ${res.updated} updated${res.skipped ? `, ${res.skipped} skipped` : ""}`);
        else toast.warning(`Imported with ${res.errors.length} error(s)`);
        onImportDone?.();
      } else toast.info("Dry run complete — nothing was written");
    } catch (e: any) { toast.error(e.message ?? "Import failed"); }
    finally { setBusy(null); }
  }

  function closeDialog() { setPlan(null); setResult(null); setDryRun(false); setUpsert(true); }

  function downloadTemplate() {
    if (!templateHeaders) return;
    const csv = templateHeaders.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${templateName ?? "template"}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={handleExport} 
          disabled={busy !== null}
          className="h-9 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
        >
          {busy === "export" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Export
        </Button>
        {onPreview && canImport && (
          <>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => inputRef.current?.click()} 
              disabled={busy !== null}
              className="h-9 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
            >
              {busy === "import" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import
            </Button>
            {templateHeaders && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={downloadTemplate}
                className="h-9 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium"
              >
                <FileText className="mr-2 h-4 w-4" />
                Template
              </Button>
            )}
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </>
        )}
      </div>

      <Dialog open={!!plan} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Import preview — {label}</DialogTitle>
            <DialogDescription>Review parsed rows and validation before confirming.</DialogDescription>
          </DialogHeader>

          {plan && !result && (
            <div className="space-y-4">
              {/* Header mapping */}
              <div className="rounded-lg border p-3 text-sm">
                <div className="mb-2 font-medium">Detected columns</div>
                <div className="flex flex-wrap gap-1.5">
                  {plan.knownHeaders.map((h) => (
                    <Badge key={h} variant="secondary" className="border-emerald-200 bg-emerald-50 text-emerald-700">{h}</Badge>
                  ))}
                  {plan.unmappedHeaders.map((h) => (
                    <Badge key={h} variant="outline" className="border-amber-300 text-amber-700" title="Unrecognized column — will be ignored">
                      {h} (ignored)
                    </Badge>
                  ))}
                  {plan.headers.length === 0 && <span className="text-muted-foreground">No columns detected.</span>}
                </div>
                {plan.requiredMissing.length > 0 && (
                  <div className="mt-2 flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" /> Missing required column(s): {plan.requiredMissing.join(", ")}
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="grid grid-cols-4 gap-2 text-sm">
                <SummaryTile action="create" value={plan.summary.create} />
                <SummaryTile action="update" value={plan.summary.update} />
                <SummaryTile action="skip"   value={plan.summary.skip} />
                <SummaryTile action="error"  value={plan.summary.error} />
              </div>

              {/* Options */}
              <div className="flex flex-wrap items-center gap-6 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <Switch id="upsert" checked={upsert} onCheckedChange={setUpsert} />
                  <Label htmlFor="upsert" className="cursor-pointer">
                    Update existing rows
                    <div className="text-xs font-normal text-muted-foreground">If off, duplicates are skipped instead of updated.</div>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch id="dry" checked={dryRun} onCheckedChange={setDryRun} />
                  <Label htmlFor="dry" className="cursor-pointer">
                    Dry run
                    <div className="text-xs font-normal text-muted-foreground">Validate without writing to the database.</div>
                  </Label>
                </div>
              </div>

              {/* Row table */}
              <ScrollArea className="max-h-72 rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-14">Row</TableHead>
                      <TableHead className="w-24">Action</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {plan.rows.length === 0 && (
                      <TableRow><TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">No data rows found in the file.</TableCell></TableRow>
                    )}
                    {plan.rows.map((r) => {
                      const effective: PlanAction = r.action === "update" && !upsert ? "skip" : r.action;
                      const s = ACTION_STYLE[effective]; const Icon = s.icon;
                      return (
                        <TableRow key={r.rowNumber}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{r.rowNumber}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${s.color}`}>
                              <Icon className="h-3 w-3" /> {s.label}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[240px] truncate">{r.displayName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.action === "error" ? r.message
                              : effective === "skip" && r.action === "update" ? "Duplicate — will be skipped (upsert off)"
                              : r.message ?? (r.action === "update" ? "Will update existing record" : "New record")}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {result && (
            <div className="space-y-3 text-sm">
              {result.dryRun && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                  Dry run — no changes were written to the database.
                </div>
              )}
              <div className="flex flex-wrap gap-4">
                <div><span className="font-semibold text-emerald-600">{result.created}</span> created</div>
                <div><span className="font-semibold text-blue-600">{result.updated}</span> updated</div>
                <div><span className="font-semibold text-amber-600">{result.skipped}</span> skipped</div>
                <div><span className="font-semibold text-destructive">{result.errors.length}</span> errors</div>
              </div>
              {result.errors.length > 0 && (
                <ScrollArea className="max-h-64 rounded-md border p-2">
                  <ul className="space-y-1 text-xs">
                    {result.errors.map((e, i) => (
                      <li key={i}><span className="font-mono text-muted-foreground">Row {e.row}:</span> {e.message}</li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>
          )}

          <DialogFooter>
            {!result && plan && (
              <>
                <Button variant="outline" onClick={closeDialog} disabled={busy === "confirm"}>Cancel</Button>
                <Button
                  onClick={confirmImport}
                  disabled={busy === "confirm" || plan.rows.length === 0 || plan.requiredMissing.length > 0}
                >
                  {busy === "confirm" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  {dryRun ? "Run dry-run" : "Confirm import"}
                </Button>
              </>
            )}
            {result && <Button onClick={closeDialog}>Close</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SummaryTile({ action, value }: { action: PlanAction; value: number }) {
  const s = ACTION_STYLE[action]; const Icon = s.icon;
  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${s.color}`}>
      <div className="flex items-center gap-1.5 text-xs font-medium"><Icon className="h-3.5 w-3.5" />{s.label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
