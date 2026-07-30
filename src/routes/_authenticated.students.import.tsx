import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, Upload, FileSpreadsheet, Loader2, Download, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  createStudent, updateStudent, findStudentByPassport, validateStudentInput,
  writeStudentAudit, mapStudentDbError,
  STUDENT_STATUSES, STUDENT_GENDERS,
  type StudentInput, type StudentStatus, type StudentGender,
} from "@/lib/students";

export const Route = createFileRoute("/_authenticated/students/import")({
  component: () => (
    <RoleGuard roles={["admin"]}><ImportPage /></RoleGuard>
  ),
});

// Column header -> student field
const HEADER_MAP: Record<string, keyof StudentInput> = {
  "full name": "full_name", "name": "full_name",
  "email": "email",
  "phone": "phone",
  "date of birth": "date_of_birth", "dob": "date_of_birth",
  "gender": "gender",
  "nationality": "nationality",
  "passport no": "passport_no", "passport": "passport_no", "passport number": "passport_no",
  "passport expiry": "passport_expiry",
  "guardian": "guardian_name", "guardian name": "guardian_name",
  "guardian phone": "guardian_phone",
  "guardian relation": "guardian_relation",
  "emergency contact": "emergency_contact_name", "emergency name": "emergency_contact_name",
  "emergency phone": "emergency_contact_phone",
  "current address": "current_address",
  "permanent address": "permanent_address",
  "status": "status",
  "notes": "notes",
};

const TEMPLATE_HEADERS = [
  "Full name","Email","Phone","Date of birth","Gender","Nationality",
  "Passport no","Passport expiry",
  "Guardian name","Guardian phone","Guardian relation",
  "Emergency contact","Emergency phone",
  "Current address","Permanent address","Status","Notes",
];

interface ParsedRow {
  rowNum: number;                // 1-based excluding header
  raw: Record<string, string>;
  data: Partial<StudentInput>;
  errors: Record<string, string>;
  existingId?: string;           // existing student (by passport)
  existingName?: string;
  action: "create" | "update" | "skip";
}

/** Minimal RFC4180 CSV parser. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  const s = text.replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQ = false; }
      else { field += c; }
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function normalizeGender(v: string): StudentGender | undefined {
  const g = v.trim().toLowerCase().replace(/[-\s]+/g, "_");
  if ((STUDENT_GENDERS as string[]).includes(g)) return g as StudentGender;
  if (g === "m" || g === "male") return "male";
  if (g === "f" || g === "female") return "female";
  return undefined;
}

function normalizeStatus(v: string): StudentStatus | undefined {
  const s = v.trim().toLowerCase();
  return (STUDENT_STATUSES as string[]).includes(s) ? (s as StudentStatus) : undefined;
}

function normalizeDate(v: string): string | undefined {
  const t = v.trim();
  if (!t) return undefined;
  // Accept YYYY-MM-DD or DD/MM/YYYY or MM/DD/YYYY (assume DD/MM/YYYY)
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) {
    const [, a, b, y] = m;
    const d = Number(a), mo = Number(b);
    if (d > 12) return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return `${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  }
  const d = new Date(t);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return t; // let validator reject
}

function ImportPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const summary = useMemo(() => {
    const total = rows.length;
    const withErrors = rows.filter((r) => Object.keys(r.errors).length > 0).length;
    const create = rows.filter((r) => r.action === "create" && !Object.keys(r.errors).length).length;
    const update = rows.filter((r) => r.action === "update" && !Object.keys(r.errors).length).length;
    return { total, withErrors, create, update };
  }, [rows]);

  const downloadTemplate = () => {
    const csv = TEMPLATE_HEADERS.join(",") + "\n";
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "students-import-template.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file?: File | null) => {
    if (!file) return;
    setFileName(file.name);
    setParsing(true);
    setRows([]);
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (grid.length < 2) { toast.error("CSV must contain a header and at least one row"); return; }
      const headers = grid[0].map((h) => h.trim().toLowerCase());
      const fieldForCol = headers.map((h) => HEADER_MAP[h]);
      if (!fieldForCol.includes("full_name")) {
        toast.error('Missing required "Full name" column');
        return;
      }

      const parsed: ParsedRow[] = [];
      for (let i = 1; i < grid.length; i++) {
        const raw: Record<string, string> = {};
        const data: Partial<StudentInput> = {};
        grid[i].forEach((val, idx) => {
          const key = fieldForCol[idx];
          raw[headers[idx]] = val;
          if (!key) return;
          const v = val.trim();
          if (!v) return;
          if (key === "gender") { const g = normalizeGender(v); if (g) (data as any)[key] = g; else (data as any)[key] = v; }
          else if (key === "status") { const s = normalizeStatus(v); if (s) (data as any)[key] = s; }
          else if (key === "date_of_birth" || key === "passport_expiry") {
            (data as any)[key] = normalizeDate(v);
          } else {
            (data as any)[key] = v;
          }
        });

        const errors = validateStudentInput(data);
        if (!data.full_name) errors.full_name = "Full name is required";

        // Duplicate check
        let existingId: string | undefined;
        let existingName: string | undefined;
        if (data.passport_no) {
          try {
            const existing = await findStudentByPassport(String(data.passport_no));
            if (existing) { existingId = existing.id; existingName = existing.full_name; }
          } catch { /* ignore lookup errors */ }
        }

        const action: ParsedRow["action"] = Object.keys(errors).length
          ? "skip"
          : existingId ? "update" : "create";

        parsed.push({ rowNum: i, raw, data, errors, existingId, existingName, action });
      }
      setRows(parsed);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to parse CSV");
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runImport = async () => {
    const usable = rows.filter((r) => !Object.keys(r.errors).length && r.action !== "skip");
    if (!usable.length) { toast.error("Nothing to import"); return; }
    setImporting(true);
    setProgress({ done: 0, total: usable.length });
    let created = 0, updated = 0, failed = 0;

    for (let i = 0; i < usable.length; i++) {
      const r = usable[i];
      try {
        if (r.action === "update" && r.existingId) {
          await updateStudent(r.existingId, r.data as any);
          await writeStudentAudit(r.existingId, "student.updated", { source: "csv_import", fields: Object.keys(r.data) });
          updated++;
        } else {
          const created_student = await createStudent(r.data as StudentInput);
          await writeStudentAudit(created_student.id, "student.created", { source: "csv_import" });
          created++;
        }
      } catch (e: any) {
        failed++;
        const mapped = mapStudentDbError(e);
        setRows((prev) => prev.map((x) => x.rowNum === r.rowNum
          ? { ...x, errors: { ...x.errors, [mapped.field ?? "_"]: mapped.message } }
          : x));
      }
      setProgress({ done: i + 1, total: usable.length });
    }

    setImporting(false);
    if (failed === 0) {
      toast.success(`${created} created, ${updated} updated`);
      navigate({ to: "/students" });
    } else {
      toast.error(`${created} created, ${updated} updated, ${failed} failed`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/students"><ArrowLeft className="mr-1 h-4 w-4" /> Back to students</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" /> Download template
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import students from CSV</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a spreadsheet, review validation, then create new records or update existing ones (matched by passport number).
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">1. Choose file</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <label>
              <div className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent">
                <Upload className="h-4 w-4" /> Select CSV
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onFile(e.target.files?.[0])}
              />
            </label>
            {fileName && (
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" /> {fileName}
              </span>
            )}
            {parsing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Required column: <b>Full name</b>. Rows with a matching passport number will update the existing student.
          </p>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">2. Preview & validate</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="secondary">Total: {summary.total}</Badge>
                <Badge className="bg-emerald-500/15 text-emerald-600">Create: {summary.create}</Badge>
                <Badge className="bg-blue-500/15 text-blue-600">Update: {summary.update}</Badge>
                {summary.withErrors > 0 && (
                  <Badge className="bg-destructive/15 text-destructive">Errors: {summary.withErrors}</Badge>
                )}
              </div>

              {summary.withErrors > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Some rows have validation errors</AlertTitle>
                  <AlertDescription>
                    Fix them in your spreadsheet and re-upload, or import only the valid rows.
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-[480px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead className="w-12">Row</TableHead>
                      <TableHead>Full name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Passport</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Issues</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => {
                      const errList = Object.entries(r.errors);
                      return (
                        <TableRow key={r.rowNum} className={errList.length ? "bg-destructive/5" : undefined}>
                          <TableCell className="text-xs text-muted-foreground">{r.rowNum + 1}</TableCell>
                          <TableCell className="text-sm">{r.data.full_name ?? <span className="text-destructive">missing</span>}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.data.email ?? "—"}</TableCell>
                          <TableCell className="text-xs">{r.data.passport_no ?? "—"}</TableCell>
                          <TableCell>
                            {errList.length ? (
                              <Badge variant="outline" className="text-destructive border-destructive/40">Skip</Badge>
                            ) : r.action === "update" ? (
                              <Badge className="bg-blue-500/15 text-blue-600" title={r.existingName}>Update {r.existingName ? `· ${r.existingName}` : ""}</Badge>
                            ) : (
                              <Badge className="bg-emerald-500/15 text-emerald-600">Create</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {errList.length === 0 ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" /> OK
                              </span>
                            ) : (
                              <ul className="space-y-0.5">
                                {errList.map(([k, msg]) => (
                                  <li key={k} className="text-destructive"><b>{k}</b>: {msg}</li>
                                ))}
                              </ul>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">3. Import</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {summary.create + summary.update} valid row{summary.create + summary.update === 1 ? "" : "s"} will be imported.
                Rows with errors are skipped.
              </p>
              {progress && (
                <div className="text-xs text-muted-foreground">
                  Processed {progress.done} / {progress.total}
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={runImport}
                  disabled={importing || (summary.create + summary.update) === 0}
                >
                  {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                  Import {summary.create + summary.update} row{summary.create + summary.update === 1 ? "" : "s"}
                </Button>
                <Button variant="ghost" onClick={() => { setRows([]); setFileName(""); }} disabled={importing}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
