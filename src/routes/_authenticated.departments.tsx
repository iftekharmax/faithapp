import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Building2, Plus, Pencil, Trash2, Loader2, RefreshCw, Search, X,
  LayoutGrid, List, CalendarDays, SlidersHorizontal, ArrowUpDown,
  CheckCircle2, CircleSlash, AlertTriangle, Info, MoreHorizontal,
  Sparkles, FileText, Clock, Hash,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger, SheetFooter,
} from "@/components/ui/sheet";
import { EmptyState } from "@/components/ui/empty-state";
import {
  listDepartments, createDepartment, updateDepartment, deleteDepartment,
  writeAudit, type Department, type DepartmentStatus,
} from "@/lib/user-management";

export const Route = createFileRoute("/_authenticated/departments")({
  component: () => (
    <RoleGuard roles={["admin"]}>
      <DepartmentsPage />
    </RoleGuard>
  ),
});


// ---------- helpers ----------
const GRADIENTS = [
  "from-sky-500 to-indigo-500",
  "from-violet-500 to-fuchsia-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-cyan-500 to-blue-500",
  "from-lime-500 to-emerald-500",
  "from-purple-500 to-indigo-500",
];
function gradientFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "D";
}
function formatDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

type SortKey = "name-asc" | "name-desc" | "created-desc" | "created-asc";
type StatusFilter = "all" | DepartmentStatus;
type CreatedFilter = "any" | "7d" | "30d" | "90d";

const SORT_LABEL: Record<SortKey, string> = {
  "name-asc": "Name (A–Z)",
  "name-desc": "Name (Z–A)",
  "created-desc": "Newest first",
  "created-asc": "Oldest first",
};

// ---------- page ----------
function DepartmentsPage() {
  const [rows, setRows] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Department | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Department | null>(null);
  const [viewing, setViewing] = useState<Department | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const [status, setStatus] = useState<StatusFilter>("all");
  const [created, setCreated] = useState<CreatedFilter>("any");
  const [sort, setSort] = useState<SortKey>("name-asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const announce = (msg: string) => {
    // Reset first so identical consecutive messages re-announce.
    setLiveMessage("");
    // Defer to next frame to ensure SR picks up the change.
    requestAnimationFrame(() => setLiveMessage(msg));
  };

  const load = async () => {
    setLoading(true);
    try { setRows(await listDepartments()); }
    catch (e: any) {
      toast.error("Couldn't load departments", {
        description: e?.message ?? "Please check your connection and try again.",
      });
    }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const toggleStatus = async (dept: Department, next: DepartmentStatus) => {
    if (togglingId === dept.id) return;
    const prev = dept.status;
    if (prev === next) return;
    // Optimistic update
    setRows((rs) => rs.map((r) => (r.id === dept.id ? { ...r, status: next } : r)));
    setTogglingId(dept.id);
    try {
      await updateDepartment(dept.id, { status: next });
      await writeAudit({
        action: "department.status",
        entity: "department",
        metadata: { id: dept.id, name: dept.name, from: prev, to: next },
      });
      const label = next === "active" ? "activated" : "deactivated";
      toast.success(`Department ${label}`, { description: dept.name });
      announce(`${dept.name} ${label}.`);
    } catch (e: any) {
      // Rollback on failure
      setRows((rs) => rs.map((r) => (r.id === dept.id ? { ...r, status: prev } : r)));
      toast.error("Couldn't update status", {
        description: e?.message ?? "Change reverted. Please try again.",
      });
      announce(`Status change for ${dept.name} failed. Reverted to ${prev}.`);
    } finally {
      setTogglingId((id) => (id === dept.id ? null : id));
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    const cutoff =
      created === "7d" ? now - 7 * 864e5 :
      created === "30d" ? now - 30 * 864e5 :
      created === "90d" ? now - 90 * 864e5 : 0;

    let out = rows.filter((d) => {
      if (q && !(d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q))) return false;
      if (status !== "all" && d.status !== status) return false;
      if (cutoff && new Date(d.created_at).getTime() < cutoff) return false;
      return true;
    });

    out = [...out].sort((a, b) => {
      switch (sort) {
        case "name-asc": return a.name.localeCompare(b.name);
        case "name-desc": return b.name.localeCompare(a.name);
        case "created-asc": return +new Date(a.created_at) - +new Date(b.created_at);
        case "created-desc": return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
    return out;
  }, [rows, query, status, created, sort]);

  const activeCount = rows.filter((r) => r.status === "active").length;
  const inactiveCount = rows.length - activeCount;
  const activeFilters =
    (status !== "all" ? 1 : 0) + (created !== "any" ? 1 : 0) + (sort !== "name-asc" ? 1 : 0);

  const clearFilters = () => { setStatus("all"); setCreated("any"); setSort("name-asc"); };

  return (
    <div className="space-y-5 pb-8" aria-busy={loading}>
      {/* Screen-reader-only live region for status/delete announcements */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground shadow-lg shadow-primary/25">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">Departments</h1>
                <p className="hidden text-sm text-muted-foreground sm:block">
                  Organize your team into departments used across profiles and permissions.
                </p>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground sm:hidden">
              Organize your team across the workspace.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="hidden sm:inline-flex">
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button variant="outline" size="icon" onClick={load} disabled={loading} className="sm:hidden" aria-label="Refresh">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button size="sm" onClick={() => setCreating(true)} className="shadow-md shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Add department</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* Stat chips */}
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatChip label="Total" value={rows.length} icon={<Building2 className="h-3.5 w-3.5" />} />
          <StatChip label="Active" value={activeCount} icon={<CheckCircle2 className="h-3.5 w-3.5" />} tone="emerald" />
          <StatChip label="Inactive" value={inactiveCount} icon={<CircleSlash className="h-3.5 w-3.5" />} tone="muted" />
          <StatChip label="Showing" value={filtered.length} icon={<Search className="h-3.5 w-3.5" />} />
        </div>
      </div>

      {/* Sticky toolbar */}
      <div className="sticky top-2 z-20 -mx-1 rounded-xl border bg-background/70 p-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search departments…"
              className="pl-9 pr-9"
              aria-label="Search departments"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Desktop: inline sort + filter popover trigger via Sheet */}
          <div className="hidden items-center gap-2 md:flex">
            <div className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="h-9 w-[160px] border-0 bg-transparent px-1 focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                    <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Filters trigger */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="relative">
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
                {activeFilters > 0 && (
                  <span className="ml-2 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {activeFilters}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Filter & sort</SheetTitle>
                <SheetDescription>Narrow down departments by status, when they were created, and sort order.</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <FilterGroup label="Status" hint="Show only active or inactive departments.">
                  <div className="grid grid-cols-3 gap-2">
                    {(["all", "active", "inactive"] as StatusFilter[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStatus(s)}
                        className={`rounded-lg border px-3 py-2 text-sm capitalize transition ${
                          status === s ? "border-primary bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
                        }`}
                        aria-pressed={status === s}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </FilterGroup>

                <FilterGroup label="Created" hint="Filter by when the department was added.">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {([
                      ["any", "Any time"],
                      ["7d", "Last 7 days"],
                      ["30d", "Last 30 days"],
                      ["90d", "Last 90 days"],
                    ] as [CreatedFilter, string][]).map(([k, lbl]) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setCreated(k)}
                        className={`rounded-lg border px-3 py-2 text-sm transition ${
                          created === k ? "border-primary bg-primary text-primary-foreground shadow-sm" : "hover:bg-muted"
                        }`}
                        aria-pressed={created === k}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </FilterGroup>

                <FilterGroup label="Sort by">
                  <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                        <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FilterGroup>
              </div>

              <SheetFooter className="mt-6 gap-2 sm:justify-between">
                <Button variant="ghost" onClick={clearFilters} disabled={activeFilters === 0}>
                  <X className="mr-2 h-4 w-4" /> Reset
                </Button>
                <Button onClick={() => setFiltersOpen(false)}>Apply</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>

          <div className="inline-flex overflow-hidden rounded-md border">
            <button
              type="button"
              onClick={() => setView("grid")}
              className={`inline-flex h-9 w-9 items-center justify-center transition ${
                view === "grid" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              }`}
              aria-label="Grid view"
              aria-pressed={view === "grid"}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex h-9 w-9 items-center justify-center transition ${
                view === "list" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
              }`}
              aria-label="List view"
              aria-pressed={view === "list"}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilters > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {status !== "all" && (
              <FilterChip label={`Status: ${status}`} onClear={() => setStatus("all")} />
            )}
            {created !== "any" && (
              <FilterChip
                label={`Created: ${created === "7d" ? "7d" : created === "30d" ? "30d" : "90d"}`}
                onClear={() => setCreated("any")}
              />
            )}
            {sort !== "name-asc" && (
              <FilterChip label={SORT_LABEL[sort]} onClear={() => setSort("name-asc")} />
            )}
            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 text-xs font-medium text-primary hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-2"}>
          {Array.from({ length: view === "grid" ? 8 : 6 }).map((_, i) =>
            view === "grid" ? <CardSkeleton key={i} /> : <RowSkeleton key={i} />
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border bg-card">
          <EmptyState
            icon={query || activeFilters > 0 ? Search : Building2}
            title={
              rows.length === 0
                ? "No departments yet"
                : query || activeFilters > 0
                ? "No matches"
                : "Nothing here"
            }
            description={
              rows.length === 0
                ? "Create your first department to organize users, roles, and permissions."
                : "Try a different search term or reset your filters."
            }
            className="border-0 bg-transparent"
            action={
              rows.length === 0 ? (
                <Button onClick={() => setCreating(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Add department
                </Button>
              ) : (
                <div className="flex flex-wrap justify-center gap-2">
                  {query && <Button variant="outline" onClick={() => setQuery("")}>Clear search</Button>}
                  {activeFilters > 0 && <Button variant="outline" onClick={clearFilters}>Reset filters</Button>}
                </div>
              )
            }
          />
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((d) => (
            <DepartmentCard
              key={d.id}
              dept={d}
              busy={togglingId === d.id}
              onView={() => setViewing(d)}
              onEdit={() => setEditing(d)}
              onDelete={() => setDeleting(d)}
              onToggleStatus={(next) => toggleStatus(d, next)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card divide-y">
          {filtered.map((d) => (
            <DepartmentRow
              key={d.id}
              dept={d}
              busy={togglingId === d.id}
              onView={() => setViewing(d)}
              onEdit={() => setEditing(d)}
              onDelete={() => setDeleting(d)}
              onToggleStatus={(next) => toggleStatus(d, next)}
            />
          ))}
        </div>
      )}

      <DepartmentDialog
        open={creating}
        initial={null}
        onClose={() => setCreating(false)}
        onSaved={async () => { await load(); }}
      />
      <DepartmentDialog
        open={!!editing}
        initial={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => { await load(); }}
      />

      <DepartmentDetailsSheet
        dept={viewing}
        onOpenChange={(o) => { if (!o) setViewing(null); }}
        onEdit={() => { const d = viewing; setViewing(null); setEditing(d); }}
        onDelete={() => { const d = viewing; setViewing(null); setDeleting(d); }}
        onToggleStatus={(next) => viewing && toggleStatus(viewing, next)}
        busy={viewing ? togglingId === viewing.id : false}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o && !deletingBusy) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mb-2 grid h-11 w-11 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the department. Users currently in this department will keep their existing label but the department won't be available to select going forward. This action can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleting?.status === "active" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Tip: prefer deactivating with the status toggle if you might need it back later.</span>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingBusy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!deleting) return;
                setDeletingBusy(true);
                const name = deleting.name;
                try {
                  await deleteDepartment(deleting.id);
                  await writeAudit({ action: "department.delete", entity: "department", metadata: { name } });
                  toast.success("Department deleted", {
                    description: `“${name}” has been removed.`,
                  });
                  announce(`Department ${name} deleted.`);
                  setDeleting(null);
                  await load();
                } catch (err: any) {
                  toast.error("Delete failed", {
                    description: err?.message ?? "The department wasn't deleted. Please try again.",
                  });
                  announce(`Deleting ${name} failed.`);
                } finally {
                  setDeletingBusy(false);
                }
              }}
            >
              {deletingBusy ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…</>) : (<><Trash2 className="mr-2 h-4 w-4" /> Delete</>)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------- small building blocks ----------
function StatChip({
  label, value, icon, tone,
}: {
  label: string; value: string | number; icon: React.ReactNode;
  tone?: "emerald" | "muted";
}) {
  const bg =
    tone === "emerald" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
    tone === "muted" ? "bg-muted text-muted-foreground" :
    "bg-primary/10 text-primary";
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-background/70 px-3 py-2 backdrop-blur">
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${bg}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

function FilterGroup({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs">
      {label}
      <button type="button" onClick={onClear} className="rounded-full p-0.5 hover:bg-muted" aria-label={`Remove ${label}`}>
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

function StatusBadge({ status, onLight = false }: { status: DepartmentStatus; onLight?: boolean }) {
  if (onLight) {
    return status === "active" ? (
      <Badge className="gap-1 border-0 bg-white/25 text-white backdrop-blur hover:bg-white/30">
        <CheckCircle2 className="h-3 w-3" /> Active
      </Badge>
    ) : (
      <Badge className="gap-1 border-0 bg-black/25 text-white backdrop-blur hover:bg-black/30">
        <CircleSlash className="h-3 w-3" /> Inactive
      </Badge>
    );
  }
  return status === "active" ? (
    <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300">
      <CheckCircle2 className="h-3 w-3" /> Active
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1">
      <CircleSlash className="h-3 w-3" /> Inactive
    </Badge>
  );
}

function InitialsTile({ dept, size = 56, ring = true }: { dept: Department; size?: number; ring?: boolean }) {
  const grad = gradientFor(dept.name);
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${grad} text-white shadow-lg ${ring ? "ring-4 ring-background" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="text-lg font-black tracking-wide drop-shadow-sm">{initialsOf(dept.name)}</span>
    </div>
  );
}

// ---------- cards / rows ----------
type CardProps = {
  dept: Department;
  busy?: boolean;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: (next: DepartmentStatus) => void;
};

function DepartmentCard({ dept, busy, onView, onEdit, onDelete, onToggleStatus }: CardProps) {
  const grad = gradientFor(dept.name);
  const active = dept.status === "active";
  const stop = (e: React.MouseEvent | React.KeyboardEvent) => e.stopPropagation();
  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-2xl focus-within:ring-2 focus-within:ring-primary/40"
    >
      {/* Gradient banner */}
      <div className={`relative h-20 bg-gradient-to-br ${grad}`}>
        <div aria-hidden className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.5),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.35),transparent_45%)]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10" />
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1.5" onClick={stop}>
          <StatusBadge status={dept.status} onLight />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 rounded-full bg-white/20 text-white backdrop-blur hover:bg-white/30 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-0"
                aria-label={`Actions for ${dept.name}`}
                aria-haspopup="menu"
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44"
              aria-label={`${dept.name} actions`}
              loop
            >
              <DropdownMenuItem onSelect={onView} aria-label={`View details for ${dept.name}`}>
                <Info className="mr-2 h-4 w-4" aria-hidden="true" /> View details
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEdit} aria-label={`Edit ${dept.name}`}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onDelete}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                aria-label={`Delete ${dept.name}`}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Clickable body opens details drawer */}
      <button
        type="button"
        onClick={onView}
        aria-label={`Open details for ${dept.name}`}
        className="relative -mt-8 flex flex-1 flex-col px-5 pb-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-b-2xl"
      >
        <InitialsTile dept={dept} />
        <div className="mt-3">
          <h3 className="truncate text-lg font-bold leading-tight group-hover:text-primary transition-colors">{dept.name}</h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" aria-hidden="true" />
            Added {formatDate(dept.created_at)}
          </div>
        </div>
        {dept.description ? (
          <p className="mt-2.5 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{dept.description}</p>
        ) : (
          <p className="mt-2.5 min-h-[2.5rem] text-sm italic text-muted-foreground/60">No description added.</p>
        )}
      </button>

      {/* Footer status toggle */}
      <div
        className="mx-5 mb-5 mt-1 flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2"
        role="group"
        aria-label={`Status controls for ${dept.name}`}
        onClick={stop}
      >
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-block h-2 w-2 rounded-full ${active ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]" : "bg-muted-foreground/40"}`}
            aria-hidden="true"
          />
          <span className="font-medium">{active ? "Active" : "Inactive"}</span>
          {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />}
        </div>
        <Switch
          checked={active}
          disabled={busy}
          onCheckedChange={(v) => onToggleStatus(v ? "active" : "inactive")}
          aria-label={`${dept.name} status. Currently ${active ? "active" : "inactive"}. Toggle to ${active ? "deactivate" : "activate"}.`}
          aria-busy={busy}
        />
      </div>
    </div>
  );
}

function DepartmentRow({ dept, busy, onView, onEdit, onDelete, onToggleStatus }: CardProps) {
  const active = dept.status === "active";
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onView(); } }}
      aria-label={`Open details for ${dept.name}`}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 transition hover:bg-muted/40 focus:outline-none focus-visible:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 sm:p-4 cursor-pointer"
    >
      <InitialsTile dept={dept} size={44} ring={false} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate font-semibold">{dept.name}</div>
          <StatusBadge status={dept.status} />
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {dept.description || "No description"} · Added {formatDate(dept.created_at)}
        </div>
      </div>
      <div
        className="flex shrink-0 items-center gap-2"
        role="group"
        aria-label={`Actions for ${dept.name}`}
        onClick={stop}
      >
        <label className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          <Switch
            checked={active}
            disabled={busy}
            onCheckedChange={(v) => onToggleStatus(v ? "active" : "inactive")}
            aria-label={`${dept.name} status. Currently ${active ? "active" : "inactive"}. Toggle to ${active ? "deactivate" : "activate"}.`}
            aria-busy={busy}
          />
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              aria-label={`Actions for ${dept.name}`}
              aria-haspopup="menu"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44" aria-label={`${dept.name} actions`} loop>
            <DropdownMenuItem onSelect={onView}>
              <Info className="mr-2 h-4 w-4" aria-hidden="true" /> View details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ---------- details drawer ----------
function DepartmentDetailsSheet({
  dept, onOpenChange, onEdit, onDelete, onToggleStatus, busy,
}: {
  dept: Department | null;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleStatus: (next: DepartmentStatus) => void;
  busy: boolean;
}) {
  const open = !!dept;
  const grad = dept ? gradientFor(dept.name) : GRADIENTS[0];
  const active = dept?.status === "active";
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        {dept && (
          <>
            {/* Gradient hero */}
            <div className={`relative bg-gradient-to-br ${grad} px-5 pb-6 pt-8 text-white`}>
              <div aria-hidden className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.5),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.35),transparent_45%)]" />
              <div className="relative flex items-start gap-4">
                <InitialsTile dept={dept} size={64} />
                <div className="min-w-0 flex-1 pt-1">
                  <SheetHeader className="space-y-1 text-left">
                    <SheetTitle className="truncate text-2xl font-bold text-white drop-shadow">{dept.name}</SheetTitle>
                    <SheetDescription className="text-white/85">
                      Department details and quick actions.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-2"><StatusBadge status={dept.status} onLight /></div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="space-y-5 overflow-y-auto p-5">
              <DetailRow icon={<Sparkles className="h-4 w-4" />} label="Status">
                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${active ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]" : "bg-muted-foreground/40"}`}
                      aria-hidden="true"
                    />
                    <span className="font-medium">{active ? "Active" : "Inactive"}</span>
                    {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />}
                  </div>
                  <Switch
                    checked={!!active}
                    disabled={busy}
                    onCheckedChange={(v) => onToggleStatus(v ? "active" : "inactive")}
                    aria-label={`${dept.name} status. Currently ${active ? "active" : "inactive"}. Toggle to ${active ? "deactivate" : "activate"}.`}
                    aria-busy={busy}
                  />
                </div>
              </DetailRow>

              <DetailRow icon={<CalendarDays className="h-4 w-4" />} label="Created">
                <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                  <div className="font-medium">{formatDate(dept.created_at)}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {new Date(dept.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </DetailRow>

              <DetailRow icon={<FileText className="h-4 w-4" />} label="Description">
                {dept.description ? (
                  <p className="rounded-lg border bg-muted/30 px-3 py-2 text-sm leading-relaxed">{dept.description}</p>
                ) : (
                  <p className="rounded-lg border border-dashed px-3 py-2 text-sm italic text-muted-foreground">No description added.</p>
                )}
              </DetailRow>

              <DetailRow icon={<Hash className="h-4 w-4" />} label="Department ID">
                <code className="block truncate rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs">{dept.id}</code>
              </DetailRow>
            </div>

            {/* Footer actions */}
            <SheetFooter className="gap-2 border-t bg-muted/30 p-4 sm:justify-between">
              <Button
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Delete
              </Button>
              <Button onClick={onEdit}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Edit department
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="text-primary" aria-hidden="true">{icon}</span>
        {label}
      </div>
      {children}
    </div>
  );
}



// ---------- skeletons ----------
function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card" aria-hidden>
      <div className="h-1.5 w-full animate-pulse bg-muted" />
      <div className="animate-pulse space-y-3 p-5">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-4/5 rounded bg-muted" />
        <div className="flex items-center justify-between pt-2">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-6 w-16 rounded-md bg-muted" />
        </div>
      </div>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-xl border bg-card p-4" aria-hidden>
      <div className="h-11 w-11 rounded-xl bg-muted" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded bg-muted" />
        <div className="h-3 w-2/3 rounded bg-muted" />
      </div>
      <div className="h-6 w-16 rounded-md bg-muted" />
    </div>
  );
}

// ---------- form dialog ----------
const departmentSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name must be 60 characters or less"),
  description: z.string().trim().max(300, "Description must be 300 characters or less").optional(),
  status: z.enum(["active", "inactive"]),
});
type DepartmentForm = z.infer<typeof departmentSchema>;
type FieldErrors = Partial<Record<keyof DepartmentForm, string>>;

function DepartmentDialog({
  open, initial, onClose, onSaved,
}: { open: boolean; initial: Department | null; onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<DepartmentStatus>("active");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setStatus(initial?.status ?? "active");
    setErrors({});
  }, [open, initial]);

  const dirty =
    (initial?.name ?? "") !== name ||
    (initial?.description ?? "") !== description ||
    (initial?.status ?? "active") !== status;

  const nameCount = name.length;
  const descCount = description.length;

  const previewName = name.trim() || "New department";
  const previewDept: Department = {
    id: "preview",
    name: previewName,
    description: description || null,
    status,
    created_at: new Date().toISOString(),
  };

  const submit = async () => {
    const parsed = departmentSchema.safeParse({
      name, description: description || undefined, status,
    });
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof DepartmentForm;
        if (!fe[key]) fe[key] = issue.message;
      }
      setErrors(fe);
      toast.error("Please fix the highlighted fields");
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        status: parsed.data.status,
      };
      if (initial) {
        await updateDepartment(initial.id, payload);
        await writeAudit({ action: "department.update", entity: "department", metadata: { id: initial.id, name: payload.name } });
        toast.success("Department updated", { description: payload.name });
      } else {
        await createDepartment(payload);
        await writeAudit({ action: "department.create", entity: "department", metadata: { name: payload.name } });
        toast.success("Department created", { description: payload.name });
      }
      await onSaved();
      onClose();
    } catch (e: any) {
      const msg: string = e?.message ?? "Save failed";
      if (/duplicate|unique/i.test(msg)) {
        setErrors((p) => ({ ...p, name: "A department with this name already exists" }));
        toast.error("Duplicate name", { description: "Choose a different department name." });
      } else {
        toast.error("Save failed", { description: msg });
      }
    } finally { setSaving(false); }
  };

  const requestClose = () => {
    if (saving) return;
    if (dirty && !window.confirm("Discard your changes?")) return;
    onClose();
  };

  const grad = gradientFor(previewName);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && requestClose()}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:rounded-2xl">
        {/* Gradient hero header */}
        <div className={`relative bg-gradient-to-br ${grad} px-6 pb-8 pt-6 text-white`}>
          <div aria-hidden className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.5),transparent_40%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.35),transparent_45%)]" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10" />
          <DialogHeader className="relative space-y-1 text-left">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-white/85">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {initial ? "Edit department" : "New department"}
            </div>
            <DialogTitle className="truncate text-2xl font-bold text-white drop-shadow">
              {previewName}
            </DialogTitle>
            <DialogDescription className="text-white/85">
              {initial ? "Update the department details and status." : "Create a department to organize users across the workspace."}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Preview tile bridging hero and body */}
        <div className="relative -mt-6 flex items-center gap-3 px-6">
          <InitialsTile dept={previewDept} size={56} />
          <div className="min-w-0 flex-1 pt-6">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Live preview</div>
            <div className="truncate text-sm font-semibold">{previewName}</div>
          </div>
          <div className="pt-6"><StatusBadge status={status} /></div>
        </div>

        <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 pb-5 pt-5">
          {/* Name */}
          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="dept-name">Name <span className="text-destructive">*</span></Label>
              <span className={`text-[11px] ${nameCount > 60 ? "text-destructive" : "text-muted-foreground"}`}>{nameCount}/60</span>
            </div>
            <Input
              id="dept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Admissions"
              autoFocus
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "dept-name-err" : undefined}
              className={errors.name ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.name && (
              <p id="dept-name-err" className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {errors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="dept-desc">Description</Label>
              <span className={`text-[11px] ${descCount > 300 ? "text-destructive" : "text-muted-foreground"}`}>{descCount}/300</span>
            </div>
            <Textarea
              id="dept-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What does this department do?"
              aria-invalid={!!errors.description}
              aria-describedby={errors.description ? "dept-desc-err" : undefined}
              className={errors.description ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.description && (
              <p id="dept-desc-err" className="mt-1 flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" /> {errors.description}
              </p>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3">
            <div className="min-w-0">
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">
                Inactive departments are hidden from assignment pickers.
              </div>
            </div>
            <Switch
              checked={status === "active"}
              onCheckedChange={(v) => setStatus(v ? "active" : "inactive")}
              aria-label="Toggle active status"
            />
          </div>

          {initial && (
            <div className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-xs text-muted-foreground">
              <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Created {formatDate(initial.created_at)} · Changes save immediately.</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t bg-muted/30 p-4 sm:justify-end">
          <Button variant="outline" onClick={requestClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            {initial ? "Save changes" : "Create department"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

