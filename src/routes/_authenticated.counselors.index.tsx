import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Users, Search, Loader2, RefreshCw, ShieldCheck,
  ChevronLeft, ChevronRight, X, Lock, Unlock,
  CheckCircle2, PauseCircle, ArrowUpDown, Eye, Pencil, Trash2,
  SlidersHorizontal, Filter as FilterIcon, MailCheck, MailWarning, Send,
} from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listUsers, lockUser, setStatus, writeAudit, deleteUserProfile, resendVerification, type AdminUser,
} from "@/lib/user-management";

type SortKey = "name" | "email" | "department" | "status" | "last_login_at";
type SavedFilters = {
  q: string;
  dept: string;
  status: "all" | "active" | "inactive" | "locked";
  pageSize: number;
  page: number;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
};

const STORAGE_KEY = "counselors.filters.v2";
const DEFAULTS: SavedFilters = {
  q: "", dept: "", status: "all", pageSize: 20, page: 1,
  sortKey: "name", sortDir: "asc",
};

function loadFilters(): SavedFilters {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<SavedFilters>) };
  } catch { return DEFAULTS; }
}
function saveFilters(f: SavedFilters) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* ignore */ }
}

type StatusFilter = "all" | "active" | "inactive" | "locked";
const STATUS_VALUES: readonly StatusFilter[] = ["all", "active", "inactive", "locked"];

export const Route = createFileRoute("/_authenticated/counselors/")({
  validateSearch: (search: Record<string, unknown>): { status?: StatusFilter } => {
    const s = typeof search.status === "string" ? (search.status as StatusFilter) : undefined;
    return { status: s && STATUS_VALUES.includes(s) ? s : undefined };
  },
  component: () => (
    <RoleGuard roles={["admin"]}>
      <CounselorsPage />
    </RoleGuard>
  ),
});


function initials(name: string | null, email: string) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2);
  return chars.toUpperCase();
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString(); } catch { return v; }
}

type BulkAction = "delete" | "resend";

const RESEND_COOLDOWN_MS = 60_000;

function fmtRelative(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CounselorsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const initial = useMemo(loadFilters, []);
  const urlSearch = Route.useSearch();
  const [q, setQ] = useState(initial.q);
  const [dept, setDept] = useState<string>(initial.dept);
  const [status, setStatusFilter] = useState<SavedFilters["status"]>(urlSearch.status ?? initial.status);
  const [page, setPage] = useState<number>(initial.page);
  const [pageSize, setPageSize] = useState<number>(initial.pageSize);
  const [sortKey, setSortKey] = useState<SortKey>(initial.sortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initial.sortDir);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAction, setPendingAction] = useState<BulkAction | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [working, setWorking] = useState(false);

  const [resending, setResending] = useState<Set<string>>(new Set());
  const [lastResendAt, setLastResendAt] = useState<Record<string, number>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Debounced query for smooth status-count updates while typing
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(q), 200);
    return () => window.clearTimeout(id);
  }, [q]);

  useEffect(() => {
    const anyActive = Object.values(lastResendAt).some((t) => Date.now() - t < RESEND_COOLDOWN_MS);
    if (!anyActive) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lastResendAt, nowTick]);

  const cooldownRemaining = (userId: string): number => {
    const t = lastResendAt[userId];
    if (!t) return 0;
    return Math.max(0, RESEND_COOLDOWN_MS - (nowTick - t));
  };

  const doResend = async (u: AdminUser) => {
    if (resending.has(u.id) || cooldownRemaining(u.id) > 0) return;
    setResending((prev) => new Set(prev).add(u.id));
    try {
      await resendVerification(u.id, u.email);
      await writeAudit({ action: "user.verification.resend", target_user_id: u.id, metadata: { via: "counselors.row" } });
      setLastResendAt((prev) => ({ ...prev, [u.id]: Date.now() }));
      setNowTick(Date.now());
      toast.success(`Verification email sent to ${u.email}`);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to resend verification");
    } finally {
      setResending((prev) => { const n = new Set(prev); n.delete(u.id); return n; });
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const all = await listUsers();
      setUsers(all.filter((u) => u.roles.includes("counselor")));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load counselors");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    saveFilters({ q, dept, status, pageSize, page, sortKey, sortDir });
  }, [q, dept, status, pageSize, page, sortKey, sortDir]);

  useEffect(() => { setPage(1); }, [q, dept, status, pageSize]);

  // Sync status filter with URL query string
  useEffect(() => {
    const urlStatus = urlSearch.status;
    if (status === "all" && urlStatus !== undefined) {
      navigate({ to: "/counselors", search: {}, replace: true });
    } else if (status !== "all" && urlStatus !== status) {
      navigate({ to: "/counselors", search: { status }, replace: true });
    }
  }, [status, urlSearch.status, navigate]);

  // React to back/forward changes in URL
  useEffect(() => {
    const next = urlSearch.status ?? "all";
    if (next !== status) setStatusFilter(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch.status]);


  const departments = useMemo(
    () => Array.from(new Set(users.map((u) => u.department).filter(Boolean))) as string[],
    [users],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = users.filter((u) => {
      if (dept && u.department !== dept) return false;
      if (status === "active" && (u.status !== "active" || u.is_locked)) return false;
      if (status === "inactive" && u.status !== "inactive") return false;
      if (status === "locked" && !u.is_locked) return false;
      if (!needle) return true;
      return (
        (u.full_name ?? "").toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle) ||
        (u.phone ?? "").toLowerCase().includes(needle) ||
        (u.department ?? "").toLowerCase().includes(needle)
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const val = (u: AdminUser): string => {
      switch (sortKey) {
        case "name": return (u.full_name ?? u.email).toLowerCase();
        case "email": return u.email.toLowerCase();
        case "department": return (u.department ?? "").toLowerCase();
        case "status": return u.is_locked ? "locked" : u.status;
        case "last_login_at": return u.last_login_at ?? "";
      }
    };
    return [...rows].sort((a, b) => val(a).localeCompare(val(b)) * dir);
  }, [users, q, dept, status, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Status counts respect current search + department filters (ignore status).
  // Uses debouncedQ so counts update smoothly while typing rather than on every keystroke.
  const statusCounts = useMemo(() => {
    const needle = debouncedQ.trim().toLowerCase();
    const base = users.filter((u) => {
      if (dept && u.department !== dept) return false;
      if (!needle) return true;
      return (
        (u.full_name ?? "").toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle) ||
        (u.phone ?? "").toLowerCase().includes(needle) ||
        (u.department ?? "").toLowerCase().includes(needle)
      );
    });
    return {
      all: base.length,
      active: base.filter((u) => u.status === "active" && !u.is_locked).length,
      inactive: base.filter((u) => u.status === "inactive").length,
      locked: base.filter((u) => u.is_locked).length,
    };
  }, [users, debouncedQ, dept]);


  const activeCount = users.filter((u) => u.status === "active" && !u.is_locked).length;
  const hasActiveFilters = q !== "" || dept !== "" || status !== "all";

  const clearFilters = () => { setQ(""); setDept(""); setStatusFilter("all"); setPage(1); };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const pageIds = paged.map((u) => u.id);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPageSelected = pageIds.some((id) => selected.has(id));

  const togglePage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      pageIds.forEach((id) => checked ? next.add(id) : next.delete(id));
      return next;
    });
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  const selectedUnverified = useMemo(
    () => users.filter((u) => selected.has(u.id) && !u.email_verified),
    [users, selected],
  );

  const runBulk = async () => {
    if (!pendingAction || selected.size === 0) return;
    setWorking(true);
    try {
      if (pendingAction === "delete") {
        const ids = Array.from(selected);
        for (const id of ids) {
          await deleteUserProfile(id);
          await writeAudit({ action: "user.delete", target_user_id: id, metadata: { via: "counselors.bulk" } });
        }
        toast.success(`Deleted ${ids.length} counselor${ids.length === 1 ? "" : "s"}`);
      } else if (pendingAction === "resend") {
        const targets = selectedUnverified.filter((u) => cooldownRemaining(u.id) === 0);
        let ok = 0;
        const now = Date.now();
        const updates: Record<string, number> = {};
        for (const u of targets) {
          try {
            await resendVerification(u.id, u.email);
            await writeAudit({ action: "user.verification.resend", target_user_id: u.id, metadata: { via: "counselors.bulk" } });
            updates[u.id] = now;
            ok++;
          } catch (err: any) {
            toast.error(`${u.email}: ${err.message ?? "Failed"}`);
          }
        }
        if (Object.keys(updates).length) {
          setLastResendAt((prev) => ({ ...prev, ...updates }));
          setNowTick(Date.now());
        }
        const skipped = selectedUnverified.length - targets.length;
        toast.success(
          `Verification email sent to ${ok} counselor${ok === 1 ? "" : "s"}` +
            (skipped ? ` (${skipped} on cooldown skipped)` : ""),
        );
      }
      clearSelection();
      setPendingAction(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Bulk action failed");
    } finally {
      setWorking(false);
    }
  };

  const bulkLabel: Record<BulkAction, string> = {
    delete: "Delete",
    resend: "Resend verification email",
  };


  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Counselors</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            All users with the Counselor role. {users.length} total · {activeCount} active.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" asChild>
            <Link to="/users">
              <ShieldCheck className="mr-2 h-4 w-4" /> Manage in Users
            </Link>
          </Button>
        </div>
      </header>

      <Card className="border-border/60 bg-gradient-to-br from-card to-muted/20 shadow-sm">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search counselors by name, email, phone…"
                className="pl-9 h-10 bg-background/60"
              />
              {q && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select value={status} onValueChange={(v) => setStatusFilter(v as typeof status)}>
                <SelectTrigger
                  className="h-9 w-[170px] bg-background/60"
                  aria-label={`Filter by status. Current: ${status === "all" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}`}
                >
                  <FilterIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent aria-label="Status filter options">
                  <SelectItem value="all" aria-label="All counselors">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-slate-400" />
                      <span className="font-medium text-slate-600 dark:text-slate-300">All</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="active" aria-label="Active counselors">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">Active</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="inactive" aria-label="Inactive counselors">
                    <span className="inline-flex items-center gap-1.5">
                      <PauseCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
                      <span className="font-medium text-amber-600 dark:text-amber-400">Inactive</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="locked" aria-label="Locked counselors">
                    <span className="inline-flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                      <span className="font-medium text-rose-600 dark:text-rose-400">Locked</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>




              {departments.length > 0 && (
                <Select value={dept === "" ? "__all" : dept} onValueChange={(v) => setDept(v === "__all" ? "" : v)}>
                  <SelectTrigger className="h-9 w-[180px] bg-background/60">
                    <FilterIcon className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">All departments</SelectItem>
                    {departments.map((d) => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="h-9 w-[110px] bg-background/60">
                  <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button size="sm" variant="ghost" onClick={clearFilters} className="h-9">
                  <X className="mr-1 h-3.5 w-3.5" /> Clear
                </Button>
              )}
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t pt-3 text-xs text-muted-foreground">
              <span>Filters:</span>
              {q && <Badge variant="secondary" className="gap-1">Search: “{q}”<button onClick={() => setQ("")} aria-label="Remove"><X className="h-3 w-3" /></button></Badge>}
              {status !== "all" && <Badge variant="secondary" className="gap-1">Status: {status}<button onClick={() => setStatusFilter("all")} aria-label="Remove"><X className="h-3 w-3" /></button></Badge>}
              {dept && <Badge variant="secondary" className="gap-1">Dept: {dept}<button onClick={() => setDept("")} aria-label="Remove"><X className="h-3 w-3" /></button></Badge>}
              <span className="ml-auto">{filtered.length} result{filtered.length === 1 ? "" : "s"}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div className="sticky top-2 z-20 overflow-hidden rounded-xl border border-primary/30 bg-primary/95 text-primary-foreground shadow-lg backdrop-blur supports-[backdrop-filter]:bg-primary/90">
          <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-xs font-bold">
                {selected.size}
              </span>
              selected
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="h-8 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 border-0 disabled:opacity-40"
                disabled={selected.size !== 1}
                onClick={() => {
                  const id = Array.from(selected)[0];
                  if (id) navigate({ to: "/counselors/$counselorId", params: { counselorId: id } });
                }}
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" /> View
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 border-0 disabled:opacity-40"
                disabled={selected.size !== 1}
                onClick={() => {
                  const id = Array.from(selected)[0];
                  if (id) navigate({ to: "/counselors/$counselorId", params: { counselorId: id }, hash: "edit" });
                }}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-8 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 border-0 disabled:opacity-40"
                disabled={selectedUnverified.length === 0}
                onClick={() => setPendingAction("resend")}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" /> Resend verify
                {selectedUnverified.length > 0 && (
                  <span className="ml-1.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary-foreground/25 px-1 text-[10px] font-bold">
                    {selectedUnverified.length}
                  </span>
                )}
              </Button>
              <div className="mx-1 h-5 w-px bg-primary-foreground/25" />
              <Button size="sm" variant="secondary" className="h-8 bg-destructive/90 text-destructive-foreground hover:bg-destructive border-0" onClick={() => setPendingAction("delete")}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-primary-foreground hover:bg-primary-foreground/15" onClick={clearSelection}>
                <X className="h-4 w-4" />
              </Button>
            </div>

          </div>
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            {(() => {
              const statusOnly = status !== "all" && q === "" && dept === "";
              const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
              return (
                <EmptyState
                  icon={Users}
                  title={
                    users.length === 0
                      ? "No counselors yet"
                      : statusOnly
                        ? `No ${statusLabel.toLowerCase()} counselors`
                        : "No matches"
                  }
                  description={
                    users.length === 0
                      ? "Assign the Counselor role to a user from the Users page to see them here."
                      : statusOnly
                        ? `No counselors currently match the "${statusLabel}" status. Reset the filter to see everyone.`
                        : "Try clearing filters or adjusting your search."
                  }
                  action={
                    users.length > 0 && status !== "all" ? (
                      <Button size="sm" variant="outline" onClick={() => setStatusFilter("all")}>
                        <X className="mr-1.5 h-3.5 w-3.5" /> Reset to All
                      </Button>
                    ) : users.length > 0 && hasActiveFilters ? (
                      <Button size="sm" variant="outline" onClick={clearFilters}>
                        <X className="mr-1.5 h-3.5 w-3.5" /> Clear filters
                      </Button>
                    ) : undefined
                  }
                  className="border-0 bg-transparent"
                />
              );
            })()}
          </CardContent>
        </Card>

      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all on this page"
                      checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
                      onCheckedChange={(v) => togglePage(v === true)}
                    />
                  </TableHead>
                  <SortHead label="Name" k="name" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortHead label="Email" k="email" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <TableHead>Phone</TableHead>
                  <SortHead label="Department" k="department" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortHead label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortHead label="Last login" k="last_login_at" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <TableHead className="w-10 text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((u) => {
                  const isSelected = selected.has(u.id);
                  return (
                    <TableRow
                      key={u.id}
                      data-state={isSelected ? "selected" : undefined}
                      className="cursor-pointer"
                      onClick={(e) => {
                        const target = e.target as HTMLElement;
                        if (target.closest("[data-no-row-click]")) return;
                        navigate({ to: "/counselors/$counselorId", params: { counselorId: u.id } });
                      }}
                    >
                      <TableCell data-no-row-click onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          aria-label={`Select ${u.full_name ?? u.email}`}
                          checked={isSelected}
                          onCheckedChange={(v) => toggleOne(u.id, v === true)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            {u.avatar_url && <AvatarImage src={u.avatar_url} alt={u.full_name ?? u.email} />}
                            <AvatarFallback className="text-xs">{initials(u.full_name, u.email)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate font-medium">{u.full_name || u.email.split("@")[0]}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell className="text-muted-foreground">{u.phone ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.department ?? "—"}</TableCell>
                      <TableCell>
                        {u.email_verified ? (
                          <Badge variant="outline" className="gap-1 text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                            <MailCheck className="h-3 w-3" /> Verified
                          </Badge>
                        ) : (
                          (() => {
                            const remaining = cooldownRemaining(u.id);
                            const lastAt = lastResendAt[u.id];
                            const busy = resending.has(u.id);
                            const disabled = busy || remaining > 0;
                            const tip = busy
                              ? "Sending…"
                              : remaining > 0
                                ? `Please wait ${Math.ceil(remaining / 1000)}s before resending`
                                : lastAt
                                  ? `Last sent ${fmtRelative(nowTick - lastAt)} · click to resend`
                                  : "Resend verification email";
                            return (
                              <div className="flex items-center gap-1.5">
                                <Badge variant="outline" className="gap-1 text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
                                  <MailWarning className="h-3 w-3" /> Unverified
                                </Badge>
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 rounded-full text-amber-700 hover:bg-amber-500/10 dark:text-amber-300 disabled:opacity-40"
                                        disabled={disabled}
                                        onClick={() => doResend(u)}
                                        aria-label="Resend verification email"
                                      >
                                        {busy ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : remaining > 0 ? (
                                          <span className="text-[10px] font-semibold tabular-nums">{Math.ceil(remaining / 1000)}</span>
                                        ) : (
                                          <Send className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>{tip}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                {lastAt && (
                                  <span className="text-[10px] text-muted-foreground">
                                    Sent {fmtRelative(nowTick - lastAt)}
                                  </span>
                                )}
                              </div>
                            );
                          })()
                        )}

                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">{fmtDate(u.last_login_at)}</TableCell>
                      <TableCell data-no-row-click className="text-right" onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider delayDuration={200}>
                          <div className="inline-flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary"
                                  onClick={() => navigate({ to: "/counselors/$counselorId", params: { counselorId: u.id } })}
                                  aria-label="View"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>View</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
                                  onClick={() => navigate({ to: "/counselors/$counselorId", params: { counselorId: u.id }, hash: "edit" })}
                                  aria-label="Edit"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setPendingDelete(u)}
                                  aria-label="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Delete</TooltipContent>
                            </Tooltip>
                          </div>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs text-muted-foreground">
            <div>
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
            </div>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2">Page {currentPage} of {totalPages}</span>
              <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <AlertDialog open={pendingAction !== null} onOpenChange={(o) => !o && setPendingAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === "resend"
                ? `Send verification email to ${selectedUnverified.length} counselor${selectedUnverified.length === 1 ? "" : "s"}?`
                : pendingAction
                  ? `${bulkLabel[pendingAction]} ${selected.size} counselor${selected.size === 1 ? "" : "s"}?`
                  : ""}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === "delete"
                ? "This removes the selected profiles and cannot be undone. Auth accounts remain in Supabase."
                : pendingAction === "resend"
                  ? `A new verification email will be sent to each unverified counselor in your selection. Any counselors on cooldown will be skipped.${
                      selected.size - selectedUnverified.length > 0
                        ? ` ${selected.size - selectedUnverified.length} already-verified counselor${selected.size - selectedUnverified.length === 1 ? "" : "s"} will be ignored.`
                        : ""
                    }`
                  : "This will apply the change immediately and record an audit entry for each user."}
            </AlertDialogDescription>

          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runBulk(); }}
              disabled={working}
              className={pendingAction === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
            >
              {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {pendingDelete?.full_name || pendingDelete?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes their profile record and cannot be undone. The Supabase auth account itself is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={working}
              onClick={async (e) => {
                e.preventDefault();
                if (!pendingDelete) return;
                setWorking(true);
                try {
                  await deleteUserProfile(pendingDelete.id);
                  await writeAudit({ action: "user.delete", target_user_id: pendingDelete.id, metadata: { via: "counselors.row" } });
                  toast.success("Counselor deleted");
                  setPendingDelete(null);
                  await load();
                } catch (err: any) {
                  toast.error(err.message ?? "Delete failed");
                } finally {
                  setWorking(false);
                }
              }}
            >
              {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortHead({
  label, k, sortKey, sortDir, onSort,
}: {
  label: string; k: SortKey; sortKey: SortKey; sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <TableHead>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 text-xs font-medium hover:text-foreground ${active ? "text-foreground" : "text-muted-foreground"}`}
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "opacity-100" : "opacity-40"}`} />
        {active && <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
      </button>
    </TableHead>
  );
}
