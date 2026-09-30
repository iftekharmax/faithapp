import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Globe2, Search, MapPin, Sparkles, Filter, LayoutGrid, List as ListIcon, X, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  listCountries, createCountry, updateCountry, deleteCountry, uploadCountryFlag,
  type Country, UNI_STATUSES, type UniStatus,
} from "@/lib/universities";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/countries")({
  component: CountriesPage,
});

const STATUS_META: Record<UniStatus, { label: string; dot: string; badge: string }> = {
  active:   { label: "Active",   dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20" },
  inactive: { label: "Inactive", dot: "bg-amber-500",   badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20" },
  archived: { label: "Archived", dot: "bg-slate-400",   badge: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20" },
};

function CountriesPage() {
  const { roles } = useAuth();
  const canEdit = roles.includes("admin");
  const [items, setItems] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UniStatus>("all");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [sortKey, setSortKey] = useState<"name" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Country | null>(null);
  const [form, setForm] = useState<Partial<Country>>({ status: "active" });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastFailedFile, setLastFailedFile] = useState<File | null>(null);
  const [confirmRemoveFlag, setConfirmRemoveFlag] = useState(false);
  const filtersActive = search !== "" || statusFilter !== "all";
  function clearFilters() { setSearch(""); setStatusFilter("all"); }
  function toggleSort(key: "name" | "status") {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  async function reload() {
    setLoading(true);
    try { setItems(await listCountries()); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    const list = items.filter((c) => {
      const okSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
      const okStatus = statusFilter === "all" || c.status === statusFilter;
      return okSearch && okStatus;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const statusOrder: Record<UniStatus, number> = { active: 0, inactive: 1, archived: 2 };
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else cmp = statusOrder[a.status] - statusOrder[b.status];
      return cmp * dir;
    });
  }, [items, search, statusFilter, sortKey, sortDir]);

  // Show a subtle updating indicator while filters/sort recompute
  useEffect(() => {
    setUpdating(true);
    const t = setTimeout(() => setUpdating(false), 180);
    return () => clearTimeout(t);
  }, [search, statusFilter, sortKey, sortDir, pageSize]);

  // Reset to first page when filters/sort/pageSize change
  useEffect(() => { setPage(1); }, [search, statusFilter, sortKey, sortDir, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, filtered.length);
  const paged = useMemo(() => filtered.slice(pageStart, pageEnd), [filtered, pageStart, pageEnd]);

  const counts = useMemo(() => ({
    total: items.length,
    active: items.filter((c) => c.status === "active").length,
    inactive: items.filter((c) => c.status === "inactive").length,
    archived: items.filter((c) => c.status === "archived").length,
  }), [items]);

  function resetUploadState() {
    setUploadError(null);
    setLastFailedFile(null);
    setLocalPreview(null);
    setUploadProgress(0);
  }
  function openNew() { setEditing(null); setForm({ status: "active" }); resetUploadState(); setOpen(true); }
  function openEdit(c: Country) { setEditing(c); setForm({ ...c }); resetUploadState(); setOpen(true); }

  async function runUpload(file: File) {
    setUploadError(null);
    // Type check
    if (!file.type.startsWith("image/")) {
      const msg = "Please choose an image file (PNG, JPG, WebP, SVG, GIF).";
      toast.error(msg); setUploadError(msg); setLastFailedFile(file); return;
    }
    if (file.size > 2 * 1024 * 1024) {
      const msg = `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is 2 MB.`;
      toast.error(msg); setUploadError(msg); setLastFailedFile(file); return;
    }
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    if (file.type !== "image/svg+xml") {
      try {
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            if (img.width < 16 || img.height < 12) reject(new Error(`Image too small (${img.width}×${img.height}). Minimum 16×12 px.`));
            else if (img.width > 4096 || img.height > 4096) reject(new Error(`Image too large (${img.width}×${img.height}). Maximum 4096×4096 px.`));
            else resolve();
          };
          img.onerror = () => reject(new Error("Could not read image — file may be corrupt."));
          img.src = previewUrl;
        });
      } catch (err: any) {
        URL.revokeObjectURL(previewUrl);
        setLocalPreview(null);
        const msg = err.message ?? "Invalid image";
        toast.error(msg); setUploadError(msg); setLastFailedFile(file);
        return;
      }
    }
    setUploading(true);
    setUploadProgress(10);
    const tick = setInterval(() => setUploadProgress((p) => Math.min(p + 10, 90)), 150);
    try {
      const key = form.name?.trim() || editing?.id || "new";
      const url = await uploadCountryFlag(key, file);
      setUploadProgress(100);
      setForm((f) => ({ ...f, flag_url: url }));
      setUploadError(null);
      setLastFailedFile(null);
      toast.success("Flag uploaded successfully");
    } catch (err: any) {
      const msg = err.message ?? "Upload failed";
      toast.error(msg);
      setUploadError(msg);
      setLastFailedFile(file);
    } finally {
      clearInterval(tick);
      setUploading(false);
      setUploadProgress(0);
      URL.revokeObjectURL(previewUrl);
      setLocalPreview(null);
    }
  }

  function confirmRemoveFlagNow() {
    setForm((f) => ({ ...f, flag_url: null }));
    setLocalPreview(null);
    setUploadError(null);
    setLastFailedFile(null);
    setConfirmRemoveFlag(false);
    toast.success("Flag removed — showing placeholder");
  }

  async function save() {
    if (saving || uploading) return;
    if (!form.name?.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      if (editing) await updateCountry(editing.id, form);
      else await createCountry(form);
      toast.success(editing ? "Country updated" : "Country created");
      setOpen(false);
      resetUploadState();
      await reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }
  async function confirmDelete() {
    if (!deleteId) return;
    try { await deleteCountry(deleteId); toast.success("Deleted"); setDeleteId(null); reload(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-8">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Reference data
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Countries</h1>
              <p className="max-w-xl text-sm text-muted-foreground">
                Manage the countries used across universities, campuses, and student applications.
              </p>
            </div>
            {canEdit && (
              <Button size="lg" onClick={openNew} className="shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> Add country
              </Button>
            )}
          </div>

          {/* Stat pills */}
          <div className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatPill label="Total" value={counts.total} icon={<Globe2 className="h-4 w-4" />} tone="primary" />
            <StatPill label="Active" value={counts.active} tone="emerald" />
            <StatPill label="Inactive" value={counts.inactive} tone="amber" />
            <StatPill label="Archived" value={counts.archived} tone="slate" />
          </div>
        </div>

        {/* Toolbar */}
        <div className="sticky top-2 z-10 rounded-xl border bg-background/70 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or ISO code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {UNI_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {filtersActive && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" /> Clear
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {view === "table" && (
                <Select value={`${sortKey}:${sortDir}`} onValueChange={(v) => { const [k, d] = v.split(":") as ["name"|"status", "asc"|"desc"]; setSortKey(k); setSortDir(d); }}>
                  <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Sort" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name:asc">Name (A–Z)</SelectItem>
                    <SelectItem value="name:desc">Name (Z–A)</SelectItem>
                    <SelectItem value="status:asc">Status (Active first)</SelectItem>
                    <SelectItem value="status:desc">Status (Archived first)</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="flex items-center rounded-lg border bg-background p-0.5">
                <Button size="sm" variant={view === "grid" ? "secondary" : "ghost"} onClick={() => setView("grid")} className="h-8 px-2">
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button size="sm" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")} className="h-8 px-2">
                  <ListIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="rounded-full bg-primary/10 p-4"><Globe2 className="h-8 w-8 text-primary" /></div>
              <h3 className="text-lg font-semibold">No countries found</h3>
              <p className="max-w-sm text-sm text-muted-foreground">
                {search || statusFilter !== "all"
                  ? "Try clearing filters or searching for something else."
                  : "Add your first country to start linking universities and applications."}
              </p>
              {(search || statusFilter !== "all") ? (
                <Button variant="outline" onClick={() => { setSearch(""); setStatusFilter("all"); }}>Reset filters</Button>
              ) : canEdit ? (
                <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Add country</Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className={`relative space-y-3 transition-opacity ${updating ? "opacity-60" : "opacity-100"}`}>
            {updating && (
              <div className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur">
                <Loader2 className="h-3 w-3 animate-spin" /> Updating…
              </div>
            )}
            {view === "grid" ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paged.map((c) => (
                  <div
                    key={c.id}
                    className="group relative overflow-hidden rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                  >
                    <div className="absolute inset-x-0 -top-16 h-32 bg-gradient-to-b from-primary/10 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background shadow-sm">
                          {c.flag_url ? (
                            <img src={c.flag_url} alt={c.name} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <Globe2 className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{c.name}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span>{STATUS_META[c.status].label}</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={`gap-1.5 ${STATUS_META[c.status].badge}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[c.status].dot}`} />
                        {STATUS_META[c.status].label}
                      </Badge>
                    </div>

                    {canEdit && (
                      <div className="relative mt-4 flex items-center justify-end gap-1 border-t pt-3 opacity-0 transition-opacity group-hover:opacity-100">
                        <Tooltip><TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => openEdit(c)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                        <Tooltip><TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Flag</TableHead>
                        <TableHead><SortHeader label="Name" active={sortKey==="name"} dir={sortDir} onClick={() => toggleSort("name")} /></TableHead>
                        <TableHead><SortHeader label="Status" active={sortKey==="status"} dir={sortDir} onClick={() => toggleSort("status")} /></TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paged.map((c) => (
                        <TableRow key={c.id} className="group">
                          <TableCell>
                            <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md border bg-background">
                              {c.flag_url ? <img src={c.flag_url} alt={c.name} className="h-full w-full object-cover" loading="lazy" /> : <Globe2 className="h-4 w-4 text-muted-foreground" />}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`gap-1.5 ${STATUS_META[c.status].badge}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[c.status].dot}`} />
                              {STATUS_META[c.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {canEdit && (
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" onClick={() => openEdit(c)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Pagination footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/60 px-3 py-2 text-sm backdrop-blur">
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>
                  Showing <span className="font-medium text-foreground tabular-nums">{filtered.length === 0 ? 0 : pageStart + 1}</span>
                  {"–"}
                  <span className="font-medium text-foreground tabular-nums">{pageEnd}</span>
                  {" of "}
                  <span className="font-medium text-foreground tabular-nums">{filtered.length}</span>
                </span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor="page-size" className="text-xs text-muted-foreground">Rows per page</Label>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger id="page-size" className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[10, 25, 50, 100].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="mr-2 text-xs text-muted-foreground tabular-nums">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setPage(1)} aria-label="First page">
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setPage(totalPages)} aria-label="Last page">
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit dialog */}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit country" : "New country"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Name *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div>
                <Label>Flag image</Label>
                <div className="mt-1 flex items-center gap-3">
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background">
                    {localPreview || form.flag_url ? (
                      <img src={localPreview ?? form.flag_url ?? ""} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Globe2 className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        id="flag-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          await runUpload(file);
                        }}
                      />
                      <Button type="button" variant="outline" size="sm" disabled={uploading || saving} onClick={() => document.getElementById("flag-upload")?.click()}>
                        {uploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                        {uploading ? "Uploading…" : form.flag_url ? "Replace image" : "Upload image"}
                      </Button>
                      {uploadError && lastFailedFile && !uploading && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => runUpload(lastFailedFile)}
                        >
                          <Loader2 className="mr-1.5 h-3.5 w-3.5" /> Retry upload
                        </Button>
                      )}
                      {(form.flag_url || localPreview) && !uploading && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          disabled={saving}
                          onClick={() => setConfirmRemoveFlag(true)}
                        >
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove flag
                        </Button>
                      )}
                    </div>
                    {uploading && (
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
                      </div>
                    )}
                    {uploadError && !uploading && (
                      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
                        {uploadError}
                      </div>
                    )}
                    <Input
                      placeholder="…or paste image URL (https://…)"
                      value={form.flag_url ?? ""}
                      disabled={uploading}
                      onChange={(e) => setForm({ ...form, flag_url: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">PNG, JPG, WebP, SVG, or GIF. Up to 2 MB. Min 16×12 px.</p>
                  </div>

                </div>
              </div>
              <div><Label>Status</Label>
                <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v as UniStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNI_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={saving || uploading}>Cancel</Button>
              <Button onClick={save} disabled={saving || uploading}>
                {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete country?</AlertDialogTitle>
              <AlertDialogDescription>Universities linked to this country will be unlinked.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={confirmRemoveFlag} onOpenChange={setConfirmRemoveFlag}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove flag image?</AlertDialogTitle>
              <AlertDialogDescription>
                The current flag will be cleared and the country will show the default globe placeholder until you upload a new one. This change is saved when you press Save.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmRemoveFlagNow} className="bg-destructive text-destructive-foreground">
                Remove flag
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}

function StatPill({ label, value, icon, tone }: { label: string; value: number; icon?: React.ReactNode; tone: "primary" | "emerald" | "amber" | "slate" }) {
  const tones: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
    amber:   "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
    slate:   "from-slate-500/15 to-slate-500/5 text-slate-600 dark:text-slate-400",
  };
  return (
    <div className={`flex items-center justify-between rounded-xl border bg-gradient-to-br ${tones[tone]} p-3 backdrop-blur`}>
      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      </div>
      {icon && <div className="opacity-70">{icon}</div>}
    </div>
  );
}

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 text-left text-sm font-medium transition-colors hover:bg-muted ${active ? "text-foreground" : "text-muted-foreground"}`}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}
      <Icon className={`h-3.5 w-3.5 ${active ? "opacity-100" : "opacity-50"}`} />
    </button>
  );
}
