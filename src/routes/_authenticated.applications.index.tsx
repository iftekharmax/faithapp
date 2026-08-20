import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { listUsers } from "@/lib/user-management";

import { Search, Plus, RefreshCw, Filter, X, FileText, Pencil, Trash2, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SmartPagination } from "@/components/ui/smart-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/table-skeleton";

import {
  listApplications,
  deleteApplication,
  APPLICATION_STATUSES, APPLICATION_STATUS_LABELS,
  type Application, type ApplicationStatus,
} from "@/lib/applications";
import {
  listDocumentStatusByApplication,
  type DocSummaryStatus,
} from "@/lib/document-requests";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/applications/")({
  head: () => ({
    meta: [
      { title: "Applications - Faith AMS" },
      { name: "description", content: "Manage and track student applications across the entire admission lifecycle." },
      { property: "og:title", content: "Applications - Faith AMS" },
      { property: "og:description", content: "Manage and track student applications across the entire admission lifecycle." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team", "student"]}>
      <ApplicationsPage />
    </RoleGuard>
  ),
});

const PAGE_SIZE = 10;

const statusColor: Record<ApplicationStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-blue-500/15 text-blue-600",
  under_review: "bg-amber-500/15 text-amber-600",
  offer_received: "bg-indigo-500/15 text-indigo-600",
  conditional_offer: "bg-indigo-500/15 text-indigo-600",
  unconditional_offer: "bg-emerald-500/15 text-emerald-600",
  deposit_paid: "bg-emerald-500/15 text-emerald-600",
  cas_issued: "bg-teal-500/15 text-teal-600",
  visa_applied: "bg-sky-500/15 text-sky-600",
  visa_granted: "bg-emerald-500/15 text-emerald-600",
  visa_refused: "bg-red-500/15 text-red-600",
  enrolled: "bg-purple-500/15 text-purple-600",
  withdrawn: "bg-muted text-muted-foreground",
  rejected: "bg-red-500/15 text-red-600",
};
const docStatusLabel: Record<Exclude<DocSummaryStatus, "none">, string> = {
  required: "Required",
  pending: "Pending",
  approved: "Approved",
  rejected: "Reject",
};

const docStatusColor: Record<Exclude<DocSummaryStatus, "none">, string> = {
  required: "bg-amber-500/15 text-amber-600",
  pending: "bg-blue-500/15 text-blue-600",
  approved: "bg-emerald-500/15 text-emerald-600",
  rejected: "bg-red-500/15 text-red-600",
};



function ApplicationsPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isAppTeam = hasRole("application_team");
  const canSeeCreator = isAdmin || isAppTeam;

  const [users, setUsers] = useState<Record<string, string>>({});
  const [apps, setApps] = useState<Application[]>([]);
  const [docStatuses, setDocStatuses] = useState<Record<string, DocSummaryStatus>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [createdBy, setCreatedBy] = useState<string>("all");

  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  
  const [country, setCountry] = useState<string>("all");
  const [university, setUniversity] = useState<string>("all");
  const [intake, setIntake] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Application | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [list, docs, userList] = await Promise.all([
        listApplications(),
        listDocumentStatusByApplication().catch(() => ({} as Record<string, DocSummaryStatus>)),
        canSeeCreator ? listUsers() : Promise.resolve([]),
      ]);

      setApps(list);
      setDocStatuses(docs);
      if (canSeeCreator) {
        const map: Record<string, string> = {};
        userList.forEach((u) => { map[u.id] = u.full_name || u.email; });
        setUsers(map);
      }

    }
    catch (e: any) { toast.error(e.message ?? "Failed to load applications"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [isAdmin, isAppTeam]);



  const uniq = (arr: (string | null | undefined)[]) =>
    Array.from(new Set(arr.filter(Boolean) as string[])).sort();
  const countries = useMemo(() => uniq(apps.map((a) => a.country)), [apps]);
  const universities = useMemo(() => uniq(apps.map((a) => a.university)), [apps]);
  const intakes = useMemo(() => uniq(apps.map((a) => a.intake)), [apps]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const result = apps.filter((a) => {
      if (term) {
        const hay = [
          a.application_code, a.university, a.program, a.campus,
          a.country, a.intake, a.student?.full_name, a.student?.student_code,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (status !== "all" && a.status !== status) return false;
      if (canSeeCreator && createdBy !== "all" && a.created_by !== createdBy) return false;
      
      if (country !== "all" && a.country !== country) return false;
      if (university !== "all" && a.university !== university) return false;
      if (intake !== "all" && a.intake !== intake) return false;
      return true;
    });


    return [...result].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });
  }, [apps, q, status, country, university, intake, sortBy]);

  useEffect(() => { setPage(1); }, [q, status, country, university, intake, createdBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const clearFilters = () => {
    setQ(""); setStatus("all"); setCreatedBy("all");
    setCountry("all"); setUniversity("all"); setIntake("all");

  };
  const activeFilterCount = [
    status !== "all", country !== "all",
    university !== "all", intake !== "all", createdBy !== "all",
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track student applications end-to-end.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild size="sm">
            <Link to="/applications/new"><Plus className="mr-2 h-4 w-4" /> New application</Link>
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by code, university, program, student…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[140px]">
                  <ArrowUpDown className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {APPLICATION_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</SelectItem>
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
            <div className={`grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-${canSeeCreator ? "4" : "3"}`}>

              <div>
                <Label className="text-[11px] uppercase text-muted-foreground">Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase text-muted-foreground">University</Label>
                <Select value={university} onValueChange={setUniversity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {universities.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[11px] uppercase text-muted-foreground">Intake</Label>
                <Select value={intake} onValueChange={setIntake}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {intakes.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {canSeeCreator && (
                <div>
                  <Label className="text-[11px] uppercase text-muted-foreground">Created By</Label>
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

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                <TableHead>Application No.</TableHead>
                  <TableHead className="hidden md:table-cell">Student</TableHead>
                  <TableHead className="hidden lg:table-cell">University / Program</TableHead>
                  <TableHead className="hidden lg:table-cell">Intake</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Documents</TableHead>
                  {canSeeCreator && <TableHead>Created By</TableHead>}
                <TableHead className="w-24">Created</TableHead>

                <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeleton rows={6} columns={8} />
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="p-0">
                      <EmptyState
                        icon={FileText}
                        title="No applications found"
                        description={q || status !== "all" || country !== "all" || university !== "all" || intake !== "all" 
                          ? "Try adjusting search or clearing filters to see more results." 
                          : "Start tracking student applications by creating your first one."}
                        className="border-0 bg-transparent"
                        action={!loading && apps.length === 0 ? (
                          <Button asChild size="sm" className="mt-4 rounded-xl">
                            <Link to="/applications/new"><Plus className="mr-2 h-4 w-4" /> New application</Link>
                          </Button>
                        ) : undefined}
                      />
                    </TableCell>
                  </TableRow>

                ) : paged.map((a) => (
                  <TableRow 
                    key={a.id} 
                    role="link"
                    tabIndex={0}
                    aria-label={`View application ${a.application_code}`}
                    onClick={() => navigate({ to: "/applications/$applicationId", params: { applicationId: a.id } })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate({ to: "/applications/$applicationId", params: { applicationId: a.id } });
                      }
                    }}
                    className="group cursor-pointer transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <TableCell>
                      <div className="text-sm font-medium hover:text-primary transition-colors">{a.application_code}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.country || "—"} {a.campus ? `· ${a.campus}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">{a.student?.full_name || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{a.student?.student_code || ""}</div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="text-sm truncate max-w-[240px] hover:text-primary transition-colors">{a.university}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[240px]">
                        {a.program}{a.degree ? ` · ${a.degree}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{a.intake || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusColor[a.status]}>
                        {APPLICATION_STATUS_LABELS[a.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {docStatuses[a.id] && docStatuses[a.id] !== "none" ? (
                        <Badge
                          variant="secondary"
                          className={docStatusColor[docStatuses[a.id] as Exclude<DocSummaryStatus, "none">]}
                        >
                          {docStatusLabel[docStatuses[a.id] as Exclude<DocSummaryStatus, "none">]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {canSeeCreator && (
                      <TableCell className="text-xs text-muted-foreground">
                        {a.created_by ? (users[a.created_by] || "User") : "—"}
                      </TableCell>
                    )}

                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">

                      {a.created_at ? new Date(a.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : "—"}
                    </TableCell>

                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          aria-label="Edit application"
                          title="View & Edit"
                          onClick={() => navigate({ to: "/applications/$applicationId", params: { applicationId: a.id } })}
                          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-all hover:bg-primary/10 hover:text-primary active:scale-95"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete application"
                          title="Delete"
                          onClick={() => { setSelected(a); setDeleteOpen(true); }}
                          className="grid h-8 w-8 place-items-center rounded-full text-destructive transition-all hover:bg-destructive/10 active:scale-95"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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

      

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        variant="destructive"
        title="Delete application?"
        description={
          selected
            ? `${selected.application_code} will be permanently deleted. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        loading={deleting}
        onConfirm={async () => {
          if (!selected) return;
          setDeleting(true);
          try {
            await deleteApplication(selected.id);
            toast.success("Application deleted");
            setDeleteOpen(false);
            await load();
          } catch (e: any) {
            toast.error(e.message ?? "Failed to delete application");
          } finally {
            setDeleting(false);
          }
        }}
      />
    </div>
  );
}

