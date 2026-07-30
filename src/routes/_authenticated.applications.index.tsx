import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Search, Plus, RefreshCw, Filter, X, Eye, FileText } from "lucide-react";
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
  APPLICATION_STATUSES, APPLICATION_STATUS_LABELS,
  type Application, type ApplicationStatus,
} from "@/lib/applications";

export const Route = createFileRoute("/_authenticated/applications/")({
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


function ApplicationsPage() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  
  const [country, setCountry] = useState<string>("all");
  const [university, setUniversity] = useState<string>("all");
  const [intake, setIntake] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const load = async () => {
    setLoading(true);
    try { setApps(await listApplications()); }
    catch (e: any) { toast.error(e.message ?? "Failed to load applications"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const uniq = (arr: (string | null | undefined)[]) =>
    Array.from(new Set(arr.filter(Boolean) as string[])).sort();
  const countries = useMemo(() => uniq(apps.map((a) => a.country)), [apps]);
  const universities = useMemo(() => uniq(apps.map((a) => a.university)), [apps]);
  const intakes = useMemo(() => uniq(apps.map((a) => a.intake)), [apps]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return apps.filter((a) => {
      if (term) {
        const hay = [
          a.application_code, a.university, a.program, a.campus,
          a.country, a.intake, a.student?.full_name, a.student?.student_code,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      if (status !== "all" && a.status !== status) return false;
      
      if (country !== "all" && a.country !== country) return false;
      if (university !== "all" && a.university !== university) return false;
      if (intake !== "all" && a.intake !== intake) return false;
      return true;
    });
  }, [apps, q, status, country, university, intake]);

  useEffect(() => { setPage(1); }, [q, status, country, university, intake]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const clearFilters = () => {
    setQ(""); setStatus("all");
    setCountry("all"); setUniversity("all"); setIntake("all");
  };
  const activeFilterCount = [
    status !== "all", country !== "all",
    university !== "all", intake !== "all",
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
            <div className="flex items-center gap-2">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
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
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-3">
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
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                <TableHead>Application</TableHead>
                  <TableHead className="hidden md:table-cell">Student</TableHead>
                  <TableHead className="hidden lg:table-cell">University / Program</TableHead>
                  <TableHead className="hidden lg:table-cell">Intake</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-16 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableSkeleton rows={6} columns={6} />
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="p-0">
                      <EmptyState
                        icon={FileText}
                        title="No applications match your filters"
                        description="Try adjusting search or clearing filters to see more results."
                        className="border-0 bg-transparent"
                      />
                    </TableCell>
                  </TableRow>

                ) : paged.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer"
                    onClick={() => navigate({ to: "/applications/$applicationId", params: { applicationId: a.id } })}>
                    <TableCell>
                      <div className="text-sm font-medium">{a.application_code}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {a.country || "—"} {a.campus ? `· ${a.campus}` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-sm">{a.student?.full_name || "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{a.student?.student_code || ""}</div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="text-sm truncate max-w-[240px]">{a.university}</div>
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
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button asChild variant="ghost" size="icon">
                        <Link to="/applications/$applicationId" params={{ applicationId: a.id }}>
                          <Eye className="h-4 w-4" />
                        </Link>
                      </Button>
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
    </div>
  );
}

