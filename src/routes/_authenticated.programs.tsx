import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Search, X, GraduationCap, MapPin, Calendar, Coins,
  Award, Clock, Sparkles, SlidersHorizontal, ArrowRight, BookOpen,
  Bookmark, BookmarkCheck, Share2, ArrowUpDown, FileText, ListChecks,
  Plus, ChevronLeft, ChevronRight, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  listPrograms, listCountriesLite, listUniversitiesLite, listIntakes,
  type ProgramRow, type ProgramFilters,
} from "@/lib/programs";

export const Route = createFileRoute("/_authenticated/programs")({
  head: () => ({
    meta: [
      { title: "Programs — Faith AMS" },
      { name: "description", content: "Discover academic programs across universities." },
      { property: "og:title", content: "Programs — Faith AMS" },
      { property: "og:description", content: "Discover academic programs across universities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team", "student"]}>
      <ProgramsPage />
    </RoleGuard>
  ),
});

type ApplyIntent = "apply" | "enroll";
const APPLY_BUSY_MS = 2400;

function notifyApply(r: { id: string; name: string }, intent: ApplyIntent) {
  const verb = intent === "enroll" ? "Enrollment" : "Application";
  toast.success(`${verb} started for “${r.name}”`, {
    description:
      intent === "enroll"
        ? "Opening the enrollment form. Confirm the remaining details to secure your seat."
        : "Opening the application form. Complete the remaining details to submit.",
    duration: APPLY_BUSY_MS + 1600,
    action: {
      label: "View application status",
      onClick: () => {
        if (typeof window !== "undefined") window.location.href = "/applications";
      },
    },
  });
}

function ApplyButton({
  program, intent = "apply", size = "sm", className, label,
}: {
  program: { id: string; name: string };
  intent?: ApplyIntent;
  size?: "sm" | "lg" | "default";
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const text = label ?? (intent === "enroll" ? "Apply / Enroll" : "Apply");
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (busy) { e.preventDefault(); e.stopPropagation(); return; }
    setBusy(true);
    notifyApply(program, intent);
    window.setTimeout(() => setBusy(false), APPLY_BUSY_MS);
  };
  return (
    <Button
      asChild
      size={size}
      disabled={busy}
      aria-disabled={busy}
      className={cn(
        "bg-gradient-to-r from-primary to-purple-600",
        busy && "pointer-events-none opacity-80",
        className,
      )}
    >
      <Link to="/applications/new" onClick={onClick} aria-live="polite">
        {busy ? (
          <>
            <Loader2 className={cn("mr-1 animate-spin", size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5")} />
            {intent === "enroll" ? "Enrolling…" : "Applying…"}
          </>
        ) : (
          <>
            {text}
            <ArrowRight className={cn("ml-1", size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5")} />
          </>
        )}
      </Link>
    </Button>
  );
}


const GRADIENTS = [
  "from-blue-500/90 via-indigo-500/80 to-purple-600/90",
  "from-emerald-500/90 via-teal-500/80 to-cyan-600/90",
  "from-orange-500/90 via-rose-500/80 to-pink-600/90",
  "from-violet-500/90 via-fuchsia-500/80 to-pink-500/90",
  "from-amber-500/90 via-orange-500/80 to-red-500/90",
  "from-sky-500/90 via-blue-500/80 to-indigo-600/90",
];
const gradientFor = (id: string) => GRADIENTS[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADIENTS.length];

const BOOKMARK_KEY = "program_bookmarks_v1";
const DENSITY_KEY = "program_density_v1";
type SortKey = "name" | "fee_asc" | "fee_desc" | "duration" | "deadline";
type Density = "compact" | "comfortable";
const SORT_LABELS: Record<SortKey, string> = {
  name: "Name (A-Z)",
  fee_asc: "Tuition: Low to High",
  fee_desc: "Tuition: High to Low",
  duration: "Duration (shortest)",
  deadline: "Deadline (soonest)",
};

function parseDurationMonths(d: string | null): number {
  if (!d) return Number.POSITIVE_INFINITY;
  const m = d.match(/(\d+(?:\.\d+)?)/);
  if (!m) return Number.POSITIVE_INFINITY;
  const n = parseFloat(m[1]);
  return /year|yr/i.test(d) ? n * 12 : n;
}

function ProgramsPage() {
  const [filters, setFilters] = useState<ProgramFilters>({});
  const [sort, setSort] = useState<SortKey>("name");
  const [rows, setRows] = useState<ProgramRow[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string; flag_url?: string | null }[]>([]);
  const [universities, setUniversities] = useState<{ id: string; name: string; country_id: string | null }[]>([]);
  const [intakes, setIntakes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);
  const view = "grid"; // Fixed to grid view
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<ProgramRow | null>(null);
  const density = "comfortable"; // Fixed to comfortable density
  const setDensity = (_: Density) => {}; // No-op to satisfy potential usages

  // Load bookmarks
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BOOKMARK_KEY);
      if (raw) setBookmarks(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(DENSITY_KEY, density); } catch { /* ignore */ }
  }, [density]);

  useEffect(() => {
    (async () => {
      try {
        const [c, u, i] = await Promise.all([listCountriesLite(), listUniversitiesLite(), listIntakes()]);
        setCountries(c as any); setUniversities(u as any); setIntakes(i as any);
      } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const data = await listPrograms(filters);
        if (!cancel) setRows(data);
      } catch (e: any) { toast.error(e.message ?? "Failed to load"); }
      finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [filters]);

  // Open shared program via ?p=<id>
  useEffect(() => {
    if (!rows.length) return;
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("p");
    if (pid) {
      const p = rows.find((r) => r.id === pid);
      if (p) setDetail(p);
    }
  }, [rows]);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    switch (sort) {
      case "fee_asc": arr.sort((a, b) => (a.tuition_fee ?? Infinity) - (b.tuition_fee ?? Infinity)); break;
      case "fee_desc": arr.sort((a, b) => (b.tuition_fee ?? -Infinity) - (a.tuition_fee ?? -Infinity)); break;
      case "duration": arr.sort((a, b) => parseDurationMonths(a.duration) - parseDurationMonths(b.duration)); break;
      case "deadline": arr.sort((a, b) => {
        const av = a.application_deadline ? Date.parse(a.application_deadline) : Infinity;
        const bv = b.application_deadline ? Date.parse(b.application_deadline) : Infinity;
        return av - bv;
      }); break;
      default: arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    return arr;
  }, [rows, sort]);

  const availableUniversities = useMemo(() =>
    filters.country_id ? universities.filter((u) => u.country_id === filters.country_id) : universities,
    [universities, filters.country_id]);

  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const toggleBookmark = (id: string, name: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast("Removed bookmark", { description: name }); }
      else { next.add(id); toast.success("Saved to bookmarks", { description: name }); }
      try { localStorage.setItem(BOOKMARK_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  const share = async (r: ProgramRow) => {
    const url = `${window.location.origin}/programs?p=${r.id}`;
    try {
      if (navigator.share) { await navigator.share({ title: r.name, url }); return; }
    } catch { /* fallthrough */ }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: url });
    } catch {
      toast.error("Could not copy link");
    }
  };

  const compareRows = sortedRows.filter((r) => selected.has(r.id));
  const activeFilterCount = Object.values(filters).filter((v) => v !== undefined && v !== "" && v !== false).length;
  const showBookmarks = !!(filters as any).bookmarks_only;

  const visibleRows = useMemo(() =>
    showBookmarks ? sortedRows.filter((r) => bookmarks.has(r.id)) : sortedRows,
    [sortedRows, showBookmarks, bookmarks],
  );

  // Compare highlights
  const cheapestId = compareRows.length
    ? compareRows.reduce((best, r) => (r.tuition_fee ?? Infinity) < (best.tuition_fee ?? Infinity) ? r : best, compareRows[0]).id
    : null;
  const shortestId = compareRows.length
    ? compareRows.reduce((best, r) => parseDurationMonths(r.duration) < parseDurationMonths(best.duration) ? r : best, compareRows[0]).id
    : null;
  const earliestId = compareRows.length
    ? compareRows.reduce((best, r) => {
      const rv = r.application_deadline ? Date.parse(r.application_deadline) : Infinity;
      const bv = best.application_deadline ? Date.parse(best.application_deadline) : Infinity;
      return rv < bv ? r : best;
    }, compareRows[0]).id
    : null;

  const stats = useMemo(() => {
    const uniqUnis = new Set(rows.map((r) => r.university?.id).filter(Boolean)).size;
    const scholarships = rows.filter((r) => r.scholarship).length;
    return { total: rows.length, uniqUnis, scholarships };
  }, [rows]);

  const filtersPanel = (
    <div className="space-y-5">
      <FilterField label="Country">
        <Select value={filters.country_id ?? "all"} onValueChange={(v) => setFilters({ ...filters, country_id: v === "all" ? undefined : v, university_id: undefined })}>
          <SelectTrigger className="h-10"><SelectValue placeholder="All countries" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countries.map((c) => <SelectItem key={c.id} value={c.id}><span className="inline-flex items-center gap-2">{c.flag_url && <img src={c.flag_url} alt="" className="h-3 w-4 rounded-sm object-cover" />}{c.name}</span></SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="University">
        <Select value={filters.university_id ?? "all"} onValueChange={(v) => setFilters({ ...filters, university_id: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-10"><SelectValue placeholder="All universities" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All universities</SelectItem>
            {availableUniversities.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Intake">
        <Select value={filters.intake ?? "all"} onValueChange={(v) => setFilters({ ...filters, intake: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-10"><SelectValue placeholder="All intakes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All intakes</SelectItem>
            {intakes.map((i) => <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterField>
      <FilterField label="Tuition range">
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" min="0" placeholder="Min" className="h-10" value={filters.min_fee ?? ""}
            onChange={(e) => setFilters({ ...filters, min_fee: e.target.value ? Number(e.target.value) : undefined })} />
          <Input type="number" min="0" placeholder="Max" className="h-10" value={filters.max_fee ?? ""}
            onChange={(e) => setFilters({ ...filters, max_fee: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      </FilterField>
      <FilterField label="Duration">
        <Input placeholder="e.g. 2 years" className="h-10" value={filters.duration ?? ""}
          onChange={(e) => setFilters({ ...filters, duration: e.target.value || undefined })} />
      </FilterField>
      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 p-3 text-sm dark:from-amber-950/30 dark:to-orange-950/30">
        <Checkbox checked={filters.scholarship_only ?? false}
          onCheckedChange={(v) => setFilters({ ...filters, scholarship_only: Boolean(v) })} />
        <Award className="h-4 w-4 text-amber-600" />
        <span className="font-medium">Scholarship only</span>
      </label>
      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border bg-gradient-to-br from-primary/5 to-purple-500/5 p-3 text-sm">
        <Checkbox checked={showBookmarks}
          onCheckedChange={(v) => setFilters({ ...filters, bookmarks_only: Boolean(v) } as any)} />
        <Bookmark className="h-4 w-4 text-primary" />
        <span className="font-medium">Bookmarks only</span>
      </label>
      {activeFilterCount > 0 && (
        <Button size="sm" variant="ghost" className="w-full" onClick={() => setFilters({})}>
          <X className="mr-1 h-3 w-3" /> Clear all filters
        </Button>
      )}
    </div>
  );

  // Filter chips
  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.q) chips.push({ key: "q", label: `"${filters.q}"`, onRemove: () => setFilters({ ...filters, q: undefined }) });
  if (filters.country_id) {
    const c = countries.find((x) => x.id === filters.country_id);
    chips.push({ key: "country", label: `Country: ${c?.name ?? "—"}`, onRemove: () => setFilters({ ...filters, country_id: undefined, university_id: undefined }) });
  }
  if (filters.university_id) {
    const u = universities.find((x) => x.id === filters.university_id);
    chips.push({ key: "uni", label: `University: ${u?.name ?? "—"}`, onRemove: () => setFilters({ ...filters, university_id: undefined }) });
  }
  if (filters.intake) chips.push({ key: "intake", label: `Intake: ${filters.intake}`, onRemove: () => setFilters({ ...filters, intake: undefined }) });
  if (typeof filters.min_fee === "number") chips.push({ key: "min", label: `Min fee: ${filters.min_fee}`, onRemove: () => setFilters({ ...filters, min_fee: undefined }) });
  if (typeof filters.max_fee === "number") chips.push({ key: "max", label: `Max fee: ${filters.max_fee}`, onRemove: () => setFilters({ ...filters, max_fee: undefined }) });
  if (filters.duration) chips.push({ key: "dur", label: `Duration: ${filters.duration}`, onRemove: () => setFilters({ ...filters, duration: undefined }) });
  if (filters.scholarship_only) chips.push({ key: "sch", label: "Scholarship only", onRemove: () => setFilters({ ...filters, scholarship_only: false }) });
  if (showBookmarks) chips.push({ key: "bm", label: "Bookmarks only", onRemove: () => setFilters({ ...filters, bookmarks_only: false } as any) });

  return (
    <div className="space-y-4">
      {/* Hero — ultra-compact */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-r from-primary/10 via-purple-500/5 to-transparent px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="absolute -right-10 -top-10 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-sm font-semibold tracking-tight sm:text-base">Explore programs</h1>
              <p className="hidden truncate text-[11px] text-muted-foreground sm:block">Compare and apply in one click.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatChip icon={BookOpen} value={stats.total} label="Programs" />
            <StatChip icon={GraduationCap} value={stats.uniqUnis} label="Unis" />
            <StatChip icon={Award} value={stats.scholarships} label="Scholar." />
            <StatChip icon={Bookmark} value={bookmarks.size} label="Saved" />
          </div>
        </div>
      </div>

      {/* Sticky search + sort + filter bar */}
      <div className="sticky top-0 z-30 -mx-4 border-b bg-background/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 rounded-full border bg-background pl-9 pr-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-primary/40"
              placeholder="Search programs…"
              value={filters.q ?? ""}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-10 w-auto min-w-0 gap-1 rounded-full px-3 sm:min-w-[160px]">
              <ArrowUpDown className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline"><SelectValue /></span>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>{SORT_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-10 rounded-full px-3">
                <SlidersHorizontal className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Filters</span>
                {activeFilterCount > 0 && <Badge className="ml-1 h-5 px-1.5">{activeFilterCount}</Badge>}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md">
              <SheetHeader><SheetTitle>Refine programs</SheetTitle></SheetHeader>
              <div className="mt-6">{filtersPanel}</div>
            </SheetContent>
          </Sheet>
          <Button
            variant={showBookmarks ? "default" : "outline"}
            onClick={() => setFilters({ ...filters, bookmarks_only: !showBookmarks } as any)}
            title={showBookmarks ? "Showing bookmarks only" : "Show bookmarks only"}
            aria-pressed={showBookmarks}
            className={cn(
              "h-10 rounded-full px-3",
              showBookmarks && "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/25 hover:from-amber-500 hover:to-orange-500",
            )}
          >
            {showBookmarks ? <BookmarkCheck className="h-4 w-4 sm:mr-2" /> : <Bookmark className="h-4 w-4 sm:mr-2" />}
            <span className="hidden sm:inline">Favorites</span>
            {bookmarks.size > 0 && (
              <Badge
                variant="secondary"
                className={cn("ml-1 h-5 px-1.5", showBookmarks && "bg-white/25 text-white hover:bg-white/25")}
              >
                {bookmarks.size}
              </Badge>
            )}
          </Button>
          {/* View toggles and compare button removed as per request */}
        </div>

        {/* Filter chips */}
        {chips.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Active:</span>
            {chips.map((c) => (
              <button
                key={c.key}
                onClick={c.onRemove}
                className="group inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-[11px] font-medium transition-colors hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive"
              >
                {c.label}
                <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
              </button>
            ))}
            <button onClick={() => { setFilters({}); }} className="ml-1 text-[11px] font-medium text-primary hover:underline">
              Clear all
            </button>
          </div>
        )}
      </div>


      {/* Results */}
      {(() => {
        const gridCls = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
        if (loading) {
          return (
            <div className={cn(view === "grid" ? gridCls : "space-y-2")}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border bg-card">
                  <div className="h-28 rounded-t-2xl bg-muted/60" />
                  <div className="space-y-2 p-4">
                    <div className="h-4 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                    <div className="mt-3 h-8 rounded bg-muted/70" />
                  </div>
                </div>
              ))}
            </div>
          );
        }
        if (visibleRows.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed p-16 text-center">
              <div className="rounded-full bg-primary/10 p-4"><Search className="h-6 w-6 text-primary" /></div>
              <div className="text-lg font-semibold">No programs found</div>
              <p className="max-w-sm text-sm text-muted-foreground">Try adjusting your filters or search terms to discover more programs.</p>
              {(activeFilterCount > 0 || showBookmarks) && <Button variant="outline" onClick={() => setFilters({})}>Reset filters</Button>}
            </div>
          );
        }
        return (
          <div className={gridCls}>
            {visibleRows.map((r) => (
              <ProgramCard key={r.id} r={r} density={density}
                selected={false} onToggle={() => {}} // Disabled selection
                bookmarked={bookmarks.has(r.id)} onBookmark={() => toggleBookmark(r.id, r.name)}
                onShare={() => share(r)} onOpen={() => setDetail(r)}
              />
            ))}
          </div>
        );
      })()}


      {/* Selection and Compare functionality removed */}

      {/* Details drawer */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {detail && <ProgramDetail r={detail}
            bookmarked={bookmarks.has(detail.id)}
            onBookmark={() => toggleBookmark(detail.id, detail.name)}
            onShare={() => share(detail)}
          />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function StatChip({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full border bg-background/70 px-2 py-1 backdrop-blur sm:gap-2 sm:rounded-2xl sm:px-3 sm:py-1.5">
      <div className="rounded-md bg-primary/10 p-1"><Icon className="h-3 w-3 text-primary sm:h-3.5 sm:w-3.5" /></div>
      <div className="leading-none">
        <div className="text-xs font-bold sm:text-sm">{value}</div>
        <div className="hidden text-[9px] uppercase tracking-wide text-muted-foreground sm:block">{label}</div>
      </div>
    </div>
  );
}

interface CardProps {
  r: ProgramRow;
  selected: boolean; onToggle: () => void;
  bookmarked: boolean; onBookmark: () => void;
  onShare: () => void; onOpen: () => void;
  density?: Density;
}

function ProgramCard({ r, selected, onToggle, bookmarked, onBookmark, onShare, onOpen, density = "comfortable" }: CardProps) {
  const compact = density === "compact";
  return (
    <div className={cn(
      "group relative overflow-hidden rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10",
      selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
    )}>
      <div className={cn("relative bg-gradient-to-br h-28", gradientFor(r.id))}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.3),transparent_60%)]" />
        <div className="absolute flex items-center gap-1.5 right-3 top-3">
          <IconButton title="Share" onClick={onShare}><Share2 className="h-3.5 w-3.5 text-white" /></IconButton>
          <IconButton title={bookmarked ? "Remove bookmark" : "Save"} onClick={onBookmark}>
            {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5 text-white" /> : <Bookmark className="h-3.5 w-3.5 text-white" />}
          </IconButton>
          {/* Selection label removed */}
        </div>
        <div className="absolute bottom-3 left-4 right-14">
          <GraduationCap className="mb-1 h-6 w-6 text-white/90" />
          {r.degree && <div className="text-[11px] font-medium uppercase tracking-wider text-white/80">{r.degree}</div>}
        </div>
        {r.scholarship && (
          <div className="absolute flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow-lg left-3 top-3">
            <Award className="h-3 w-3" /> SCHOLARSHIP
          </div>
        )}
      </div>

      <div className="space-y-3 p-4">
        <button onClick={onOpen} className="block w-full text-left">
          <h3 className="font-semibold transition-colors group-hover:text-primary line-clamp-2 leading-snug">{r.name}</h3>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{r.university?.name}{r.campus ? ` · ${r.campus.name}` : ""}</span>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-2 border-y text-xs py-3">
          <MetaCell icon={Clock} label="Duration" value={r.duration} />
          <MetaCell icon={Calendar} label="Intake" value={r.intake} />
          <MetaCell icon={Coins} label="Tuition" value={r.tuition_fee ? `${r.currency ?? ""} ${r.tuition_fee.toLocaleString()}` : null} />
          <MetaCell icon={Calendar} label="Deadline" value={r.application_deadline} />
        </div>


        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={onOpen}>
            Details
          </Button>
          <ApplyButton
            program={r}
            label="Apply now"
            className="flex-1 rounded-xl shadow-md shadow-primary/20 transition-transform group-hover:scale-[1.02]"
          />
        </div>
      </div>
    </div>
  );
}

function IconButton({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 backdrop-blur transition-colors hover:bg-white/30"
    >
      {children}
    </button>
  );
}

function MetaCell({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 truncate text-xs font-medium">{value || "—"}</div>
    </div>
  );
}

{/* ProgramRowItem removed */}

function ProgramDetail({ r, bookmarked, onBookmark, onShare }: { r: ProgramRow; bookmarked: boolean; onBookmark: () => void; onShare: () => void }) {
  // Derive modules from description bullet points, if any
  const modules = (r.description ?? "")
    .split(/\r?\n|•|·|;/)
    .map((s) => s.replace(/^[-*\s]+/, "").trim())
    .filter((s) => s.length > 3);
  const requirements = (r.requirements ?? "")
    .split(/\r?\n|•|·|;/)
    .map((s) => s.replace(/^[-*\s]+/, "").trim())
    .filter((s) => s.length > 2);

  return (
    <div className="space-y-5">
      <SheetHeader className="space-y-1 text-left">
        <div className={cn("relative -mx-6 -mt-6 mb-2 flex h-32 items-end overflow-hidden bg-gradient-to-br p-5 text-white", gradientFor(r.id))}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_60%)]" />
          <div className="relative">
            {r.degree && <div className="text-[11px] font-medium uppercase tracking-wider text-white/80">{r.degree}</div>}
            <SheetTitle className="text-2xl text-white">{r.name}</SheetTitle>
            <SheetDescription className="text-white/85">
              {r.university?.name}{r.campus ? ` · ${r.campus.name}` : ""}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onBookmark}>
          {bookmarked ? <BookmarkCheck className="mr-1.5 h-4 w-4 text-primary" /> : <Bookmark className="mr-1.5 h-4 w-4" />}
          {bookmarked ? "Bookmarked" : "Save"}
        </Button>
        <Button variant="outline" size="sm" onClick={onShare}>
          <Share2 className="mr-1.5 h-4 w-4" /> Share link
        </Button>
        {r.scholarship && (
          <Badge className="bg-amber-500 hover:bg-amber-500"><Award className="mr-1 h-3 w-3" />Scholarship available</Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-muted/30 p-4">
        <DetailCell icon={Clock} label="Duration" value={r.duration} />
        <DetailCell icon={Calendar} label="Intake" value={r.intake} />
        <DetailCell icon={Coins} label="Tuition" value={r.tuition_fee ? `${r.currency ?? ""} ${r.tuition_fee.toLocaleString()}` : null} />
        <DetailCell icon={Calendar} label="Deadline" value={r.application_deadline} />
      </div>

      {r.description && (
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4 text-primary" /> About this program
          </h4>
          <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{r.description}</p>
        </section>
      )}

      {modules.length > 1 && (
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-primary" /> Modules & highlights
          </h4>
          <ul className="space-y-1.5">
            {modules.slice(0, 12).map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {requirements.length > 0 ? (
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ListChecks className="h-4 w-4 text-primary" /> Entry requirements
          </h4>
          <ul className="space-y-1.5">
            {requirements.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          <ListChecks className="mb-1 h-4 w-4 text-muted-foreground" />
          Entry requirements will be shared by the counselor after you apply.
        </section>
      )}

      <div className="sticky bottom-0 -mx-6 border-t bg-background/95 p-4 backdrop-blur">
        <ApplyButton
          program={r}
          intent="enroll"
          size="lg"
          className="w-full rounded-xl shadow-lg shadow-primary/20"
        />
      </div>
    </div>
  );
}

function DetailCell({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </div>
      <div className="mt-0.5 text-sm font-medium">{value || "—"}</div>
    </div>
  );
}

function CompareMobileCarousel({
  rows, allRows, cheapestId, shortestId, earliestId, onRemove, onReplace, onOpen,
}: {
  rows: ProgramRow[];
  allRows: ProgramRow[];
  cheapestId: string | null;
  shortestId: string | null;
  earliestId: string | null;
  onRemove: (id: string) => void;
  onReplace: (oldId: string, newId: string) => void;
  onOpen: (r: ProgramRow) => void;
}) {
  const scrollerRef = useMemo(() => ({ current: null as HTMLDivElement | null }), []);
  const [active, setActive] = useState(0);
  const [replaceFor, setReplaceFor] = useState<string | null>(null);

  useEffect(() => {
    if (active >= rows.length && rows.length > 0) setActive(rows.length - 1);
  }, [rows.length, active]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    if (idx !== active) setActive(idx);
  };

  const scrollTo = (idx: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * el.clientWidth, behavior: "smooth" });
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Select at least two programs to compare.
      </div>
    );
  }

  const replacementOptions = allRows.filter((r) => !rows.some((s) => s.id === r.id));

  return (
    <div className="space-y-3">
      {/* Nav header */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline" size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          disabled={active === 0}
          onClick={() => scrollTo(active - 1)}
          aria-label="Previous program"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-xs font-medium text-muted-foreground">
          {active + 1} of {rows.length} · swipe to browse
        </div>
        <Button
          variant="outline" size="icon"
          className="h-9 w-9 shrink-0 rounded-full"
          disabled={active >= rows.length - 1}
          onClick={() => scrollTo(active + 1)}
          aria-label="Next program"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Snap scroller */}
      <div
        ref={(el) => { scrollerRef.current = el; }}
        onScroll={onScroll}
        className="-mx-4 flex snap-x snap-mandatory overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {rows.map((r) => {
          const badges: { label: string; color: string; icon: any }[] = [];
          if (r.id === cheapestId && r.tuition_fee != null) badges.push({ label: "Best value", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30", icon: CheckCircle2 });
          if (r.id === shortestId && r.duration) badges.push({ label: "Shortest", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30", icon: Clock });
          if (r.id === earliestId && r.application_deadline) badges.push({ label: "Earliest", color: "bg-amber-500/15 text-amber-700 dark:text-amber-500 border-amber-500/30", icon: Calendar });
          return (
            <div key={r.id} className="w-full shrink-0 snap-center px-1">
              <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className={cn("relative flex h-24 items-end bg-gradient-to-br p-3", gradientFor(r.id))}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.3),transparent_60%)]" />
                  <div className="relative">
                    {r.degree && <div className="text-[10px] font-medium uppercase tracking-wider text-white/85">{r.degree}</div>}
                    <div className="line-clamp-2 text-base font-semibold leading-tight text-white">{r.name}</div>
                    <div className="mt-0.5 line-clamp-1 text-[11px] text-white/80">{r.university?.name}{r.campus ? ` · ${r.campus.name}` : ""}</div>
                  </div>
                </div>

                {badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
                    {badges.map((b) => (
                      <span key={b.label} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold", b.color)}>
                        <b.icon className="h-3 w-3" /> {b.label}
                      </span>
                    ))}
                  </div>
                )}

                <dl className="divide-y text-sm">
                  <CompareRow label="Campus" value={r.campus?.name} />
                  <CompareRow label="Duration" value={r.duration} highlight={r.id === shortestId && !!r.duration} tone="blue" />
                  <CompareRow label="Intake" value={r.intake} />
                  <CompareRow
                    label="Tuition"
                    value={r.tuition_fee ? `${r.currency ?? ""} ${r.tuition_fee.toLocaleString()}` : null}
                    highlight={r.id === cheapestId && r.tuition_fee != null}
                    tone="emerald"
                  />
                  <CompareRow label="Scholarship" value={r.scholarship} />
                  <CompareRow
                    label="Deadline"
                    value={r.application_deadline}
                    highlight={r.id === earliestId && !!r.application_deadline}
                    tone="amber"
                  />
                </dl>

                {/* Actions */}
                <div className="space-y-2 border-t bg-muted/30 p-3">
                  {replaceFor === r.id ? (
                    <div className="space-y-2 rounded-xl border bg-background p-2">
                      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Replace with
                      </Label>
                      {replacementOptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No other programs available.</p>
                      ) : (
                        <Select onValueChange={(v) => { onReplace(r.id, v); setReplaceFor(null); }}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Choose a program…" /></SelectTrigger>
                          <SelectContent>
                            {replacementOptions.map((opt) => (
                              <SelectItem key={opt.id} value={opt.id}>
                                {opt.name}{opt.university?.name ? ` — ${opt.university.name}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button variant="ghost" size="sm" className="w-full" onClick={() => setReplaceFor(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline" size="sm"
                        onClick={() => setReplaceFor(r.id)}
                        disabled={replacementOptions.length === 0}
                        className="rounded-xl"
                      >
                        <Replace className="mr-1.5 h-3.5 w-3.5" /> Replace
                      </Button>
                      <Button
                        variant="outline" size="sm"
                        onClick={() => onRemove(r.id)}
                        className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                      </Button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => onOpen(r)}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Details
                    </Button>
                    <ApplyButton program={r} className="rounded-xl" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5">
        {rows.map((r, i) => (
          <button
            key={r.id}
            onClick={() => scrollTo(i)}
            aria-label={`Go to program ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all",
              i === active ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function CompareRow({
  label, value, highlight, tone,
}: {
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
  tone?: "emerald" | "blue" | "amber";
}) {
  const toneCls = tone === "emerald" ? "text-emerald-700 dark:text-emerald-400"
    : tone === "blue" ? "text-blue-700 dark:text-blue-400"
    : tone === "amber" ? "text-amber-700 dark:text-amber-500"
    : "";
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("text-right text-sm font-medium", highlight && `font-semibold ${toneCls}`)}>
        <span className="inline-flex items-center gap-1">
          {highlight && <CheckCircle2 className="h-3 w-3" />}
          {value || "—"}
        </span>
      </dd>
    </div>
  );
}
