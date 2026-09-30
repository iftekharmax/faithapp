import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listUsers } from "@/lib/user-management";

import { Search, Plus, RefreshCw, Filter, X, Eye, Trash2, GraduationCap, PowerOff, Power, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { SmartPagination } from "@/components/ui/smart-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";

import {
  listStudents, deleteStudent, updateStudent, writeStudentAudit,
  STUDENT_STATUSES, STUDENT_STATUS_LABELS, STUDENT_GENDERS, GENDER_LABELS,
  type Student, type StudentStatus,
} from "@/lib/students";
import { exportStudentsCSV, exportStudentsPDF } from "@/lib/student-export";


export const Route = createFileRoute("/_authenticated/students/")({
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team"]}>
      <StudentsPage />
    </RoleGuard>
  ),
});

const PAGE_SIZE = 10;

const statusColor: Record<StudentStatus, string> = {
  prospect: "bg-blue-500/15 text-blue-600 hover:bg-blue-500/20",
  active: "bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20",
  enrolled: "bg-purple-500/15 text-purple-600 hover:bg-purple-500/20",
  inactive: "bg-muted text-muted-foreground",
  archived: "bg-muted text-muted-foreground",
};

function StudentsPage() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isAppTeam = hasRole("application_team");
  const canSeeCreator = isAdmin || isAppTeam;

  const [users, setUsers] = useState<Record<string, string>>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [createdBy, setCreatedBy] = useState<string>("all");


  const [nationality, setNationality] = useState<string>("all");
  const [gender, setGender] = useState<string>("all");

  
  const [passportExpiring, setPassportExpiring] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"activate" | "deactivate" | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [data, userList] = await Promise.all([
        listStudents(),
        canSeeCreator ? listUsers() : Promise.resolve([]),
      ]);
      setStudents(data);
      if (canSeeCreator) {
        const map: Record<string, string> = {};
        userList.forEach((u) => { map[u.id] = u.full_name || u.email; });
        setUsers(map);
      }
    }
    catch (e: any) { toast.error(e.message ?? "Failed to load students"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [isAdmin, isAppTeam]);



  const nationalities = useMemo(() => {
    const s = new Set<string>();
    students.forEach((x) => x.nationality && s.add(x.nationality));
    return Array.from(s).sort();
  }, [students]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const in6mo = new Date(); in6mo.setMonth(in6mo.getMonth() + 6);
    return students.filter((s) => {
      if (term) {
        const hay = [s.full_name, s.email, s.phone, s.passport_no, s.student_code, s.nationality]
          .filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (status !== "all" && s.status !== status) return false;
      if (nationality !== "all" && s.nationality !== nationality) return false;
      if (gender !== "all" && s.gender !== gender) return false;
      if (canSeeCreator && createdBy !== "all" && s.created_by !== createdBy) return false;
      if (passportExpiring) {
        if (!s.passport_expiry) return false;
        const d = new Date(s.passport_expiry);
        if (isNaN(d.getTime()) || d > in6mo) return false;
      }
      return true;
    });

  }, [students, q, status, nationality, gender, passportExpiring]);

  useEffect(() => { setPage(1); }, [q, status, nationality, gender, passportExpiring, createdBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const clearFilters = () => {
    setQ(""); setStatus("all"); setNationality("all"); setGender("all");
    setCreatedBy("all"); setPassportExpiring(false);

  };
  const activeFilterCount = [
    status !== "all", nationality !== "all", gender !== "all",
    createdBy !== "all", passportExpiring,
  ].filter(Boolean).length;


  const toggleSelect = (id: string) => setSelected((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const togglePage = (checked: boolean) => setSelected((prev) => {
    const n = new Set(prev);
    if (checked) paged.forEach((s) => n.add(s.id));
    else paged.forEach((s) => n.delete(s.id));
    return n;
  });
  const pageAllSelected = paged.length > 0 && paged.every((s) => selected.has(s.id));

  const runBulk = async () => {
    if (!bulkAction) return;
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const nextStatus: StudentStatus = bulkAction === "activate" ? "active" : "inactive";
    const action = bulkAction === "activate" ? "student.reactivated" : "student.deactivated";
    setBulkBusy(true);
    let ok = 0, fail = 0;
    for (const id of ids) {
      const cur = students.find((s) => s.id === id);
      if (!cur || cur.status === nextStatus) { ok++; continue; }
      try {
        await updateStudent(id, { status: nextStatus });
        await writeStudentAudit(id, action, {
          fields: ["status"],
          changes: { status: { from: cur.status, to: nextStatus } },
          bulk: true,
        });
        ok++;
      } catch { fail++; }
    }
    setBulkBusy(false);
    setBulkAction(null);
    setSelected(new Set());
    await load();
    if (fail === 0) toast.success(`${ok} student${ok === 1 ? "" : "s"} updated`);
    else toast.error(`${ok} updated, ${fail} failed`);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage student profiles, documents, and history.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={loading || filtered.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {filtered.length} student{filtered.length === 1 ? "" : "s"} (current filter)
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  exportStudentsCSV(filtered, `students-${new Date().toISOString().slice(0,10)}.csv`);
                  toast.success("CSV downloaded");
                }}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV (all fields)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  exportStudentsPDF(filtered, `students-${new Date().toISOString().slice(0,10)}.pdf`);
                  toast.success("PDF downloaded");
                }}
              >
                <FileText className="mr-2 h-4 w-4" /> PDF (summary)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild variant="outline" size="sm">
            <Link to="/students/import"><FileSpreadsheet className="mr-2 h-4 w-4" /> Import CSV</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/students/new"><Plus className="mr-2 h-4 w-4" /> New student</Link>
          </Button>

        </div>

      </header>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, passport, student ID…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STUDENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{STUDENT_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => setShowFilters((v) => !v)}>
                <Filter className="mr-2 h-4 w-4" />
                Filters {activeFilterCount > 0 && <Badge variant="secondary" className="ml-2">{activeFilterCount}</Badge>}
              </Button>
              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className={`grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-${canSeeCreator ? "5" : "4"}`}>

              <div>
                <Label className="text-[11px] uppercase text-muted-foreground">Nationality</Label>
                <Select value={nationality} onValueChange={setNationality}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {nationalities.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase text-muted-foreground">Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {STUDENT_GENDERS.map((g) => <SelectItem key={g} value={g}>{GENDER_LABELS[g]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase text-muted-foreground">Passport</Label>
                <Button
                  type="button"
                  variant={passportExpiring ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setPassportExpiring((v) => !v)}
                >
                  Expiring in 6 months
                </Button>
              </div>
              {canSeeCreator && (
                <div>
                  <Label className="text-[11px] uppercase text-muted-foreground">Created</Label>
                  <Select value={createdBy} onValueChange={setCreatedBy}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      {Object.entries(users).map(([id, name]) => (
                        <SelectItem key={id} value={id}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

          )}

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-primary/5 px-3 py-2">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={bulkBusy}
                  onClick={() => {
                    const rows = students.filter((s) => selected.has(s.id));
                    exportStudentsCSV(rows, `students-selected-${new Date().toISOString().slice(0,10)}.csv`);
                    toast.success(`Exported ${rows.length} to CSV`);
                  }}>
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button size="sm" variant="outline" disabled={bulkBusy}
                  onClick={() => {
                    const rows = students.filter((s) => selected.has(s.id));
                    exportStudentsPDF(rows, `students-selected-${new Date().toISOString().slice(0,10)}.pdf`);
                    toast.success(`Exported ${rows.length} to PDF`);
                  }}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" /> Export PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkAction("activate")} disabled={bulkBusy}>
                  <Power className="mr-1.5 h-3.5 w-3.5" /> Reactivate
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBulkAction("deactivate")} disabled={bulkBusy}>
                  <PowerOff className="mr-1.5 h-3.5 w-3.5" /> Deactivate
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
              </div>
            </div>
          )}


          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={pageAllSelected}
                      onCheckedChange={(v) => togglePage(Boolean(v))}
                      aria-label="Select page"
                    />
                  </TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden lg:table-cell">Nationality</TableHead>
                  <TableHead className="hidden lg:table-cell">Passport expiry</TableHead>
                  <TableHead>Status</TableHead>
                  {canSeeCreator && <TableHead>Created</TableHead>}
                  <TableHead className="w-24 text-right">Actions</TableHead>

                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeleton rows={6} columns={7} />
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canSeeCreator ? 8 : 7} className="p-0">
                      <EmptyState
                        icon={GraduationCap}
                        title="No students match your filters"
                        description="Adjust filters or add a new student to see them here."
                        className="border-0 bg-transparent"
                      />
                    </TableCell>
                  </TableRow>

                ) : paged.map((s) => (
                  <TableRow key={s.id} data-state={selected.has(s.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(s.id)}
                        onCheckedChange={() => toggleSelect(s.id)}
                        aria-label={`Select ${s.full_name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={s.photo_url ?? undefined} alt="" />
                          <AvatarFallback>{s.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{s.full_name}</div>
                          <div className="truncate text-[11px] text-muted-foreground">{s.student_code}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-xs">{s.email || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{s.phone || "—"}</div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{s.nationality || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {s.passport_expiry ? new Date(s.passport_expiry).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor[s.status]}>{STUDENT_STATUS_LABELS[s.status]}</Badge>
                    </TableCell>
                    {canSeeCreator && (
                      <TableCell className="text-xs text-muted-foreground">
                        {s.created_by ? (users[s.created_by] || "User") : "—"}
                      </TableCell>
                    )}
                    <TableCell className="text-right">

                      <div className="flex justify-end gap-1">
                        <Button asChild size="icon" variant="ghost" title="View">
                          <Link to="/students/$studentId" params={{ studentId: s.id }}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleting(s)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
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



      

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete student?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <b>{deleting?.full_name}</b>, their documents, and timeline. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                try {
                  await writeStudentAudit(deleting.id, "student.deleted", { full_name: deleting.full_name, student_code: deleting.student_code });
                  await deleteStudent(deleting.id);
                  toast.success("Student deleted");
                  setDeleting(null);
                  await load();
                } catch (e: any) { toast.error(e.message ?? "Failed"); }
              }}
            >Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!bulkAction} onOpenChange={(o) => !o && setBulkAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkAction === "activate" ? "Reactivate selected students?" : "Deactivate selected students?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkAction === "activate"
                ? `${selected.size} student(s) will be set to Active. Each change is recorded in the audit log.`
                : `${selected.size} student(s) will be set to Inactive. Each change is recorded in the audit log.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runBulk} disabled={bulkBusy}>
              {bulkBusy ? "Working…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
