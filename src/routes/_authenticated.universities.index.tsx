import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { 
  Building2, Globe, Plus, Search, ExternalLink, Pencil, Trash2, GraduationCap, 
  FileText, ChevronLeft, ChevronRight, Mail, MapPin, Download, Upload, 
  TrendingUp, ArrowRight, MoreHorizontal 
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listUniversities, createUniversity, updateUniversity, deleteUniversity,
  listCountries, createCountry, uploadUniversityLogo,
  DuplicateError,
  type University, type Country, UNI_STATUSES, type UniStatus,
} from "@/lib/universities";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { CsvToolbar } from "@/components/universities/CsvToolbar";
import { exportUniversitiesCsv, previewUniversitiesCsv, validUrl } from "@/lib/university-csv";

export const Route = createFileRoute("/_authenticated/universities/")({
  component: UniversitiesPage,
});

const emptyForm: Partial<University> = {
  name: "", short_name: "", website: "", city: "", country_id: null, description: "", status: "active", logo_url: "",
};

const PAGE_SIZE = 12;

function UniversitiesPage() {
  const { roles } = useAuth();
  const canEdit = roles.some((r) => ["admin", "counselor", "application_team"].includes(r));
  const isAdmin = roles.includes("admin");
  const navigate = useNavigate();
  const [items, setItems] = useState<University[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<University | null>(null);
  const [form, setForm] = useState<Partial<University>>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<University | null>(null);
  const [newCountry, setNewCountry] = useState("");
  const [countryDialog, setCountryDialog] = useState(false);
  const [programMatchIds, setProgramMatchIds] = useState<Set<string> | null>(null);
  const [dup, setDup] = useState<{ id: string; name: string; payload: any; logoFile: File | null } | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [u, c] = await Promise.all([
        listUniversities({
          search: search || undefined,
          countryId: countryFilter !== "all" ? countryFilter : undefined,
          status: statusFilter !== "all" ? (statusFilter as UniStatus) : undefined,
        }),
        listCountries(),
      ]);
      setItems(u);
      setCountries(c);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [search, countryFilter, statusFilter]);
  useEffect(() => { setPage(1); }, [search, programFilter, countryFilter, statusFilter]);

  // Program filter: query cross-university and intersect
  useEffect(() => {
    let cancelled = false;
    async function run() {
      const q = programFilter.trim();
      if (!q) { setProgramMatchIds(null); return; }
      try {
        const { data: progs } = await supabase
          .from("university_programs").select("university_id").ilike("name", `%${q}%`);
        if (cancelled) return;
        const s = new Set<string>();
        (progs ?? []).forEach((r: any) => s.add(r.university_id));
        setProgramMatchIds(s);
      } catch (e: any) { toast.error(e.message); }
    }
    const t = setTimeout(run, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [programFilter]);

  const filtered = useMemo(() => {
    if (!programMatchIds) return items;
    return items.filter((u) => programMatchIds.has(u.id));
  }, [items, programMatchIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function openCreate() {
    setEditing(null); setForm(emptyForm); setLogoFile(null); setErrors({}); setDialogOpen(true);
  }
  function openEdit(u: University) {
    setEditing(u); setForm({ ...u }); setLogoFile(null); setErrors({}); setDialogOpen(true);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = "Name is required";
    if (form.website && !validUrl(form.website)) e.website = "Enter a valid URL (https://…)";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true);
    try {
      let saved: University;
      const payload: any = { ...form };
      delete payload.country; delete payload.program_count; delete payload.application_count;
      if (editing) saved = await updateUniversity(editing.id, payload);
      else saved = await createUniversity(payload);
      if (logoFile) {
        const url = await uploadUniversityLogo(saved.id, logoFile);
        saved = await updateUniversity(saved.id, { logo_url: url });
      }
      toast.success(editing ? "University updated" : "University created");
      setDialogOpen(false); reload();
    } catch (e: any) {
      if (e instanceof DuplicateError) {
        const payload: any = { ...form };
        delete payload.country; delete payload.program_count; delete payload.application_count;
        setDup({ id: e.existingId, name: e.entityName, payload, logoFile });
      } else toast.error(e.message ?? "Failed");
    }
    finally { setSaving(false); }
  }

  async function mergeDuplicate() {
    if (!dup) return;
    setSaving(true);
    try {
      let saved = await updateUniversity(dup.id, dup.payload);
      if (dup.logoFile) {
        const url = await uploadUniversityLogo(saved.id, dup.logoFile);
        saved = await updateUniversity(saved.id, { logo_url: url });
      }
      toast.success("Existing university updated");
      setDup(null); setDialogOpen(false); reload();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUniversity(deleteTarget.id);
      toast.success("University deleted"); setDeleteTarget(null); reload();
    } catch (e: any) { toast.error(e.message); }
  }

  async function addCountry() {
    if (!newCountry.trim()) return;
    try {
      const c = await createCountry({ name: newCountry.trim(), status: "active" });
      setCountries((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, country_id: c.id }));
      setNewCountry(""); setCountryDialog(false); toast.success("Country added");
    } catch (e: any) { toast.error(e.message); }
  }

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((i) => i.status === "active").length,
    countries: new Set(items.map((i) => i.country_id).filter(Boolean)).size,
    programs: items.reduce((s, i) => s + (i.program_count ?? 0), 0),
  }), [items]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">University Directory</h1>
          <p className="text-slate-500">Manage universities, campuses, faculties and academic programs.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvToolbar
            label="universities"
            onExport={exportUniversitiesCsv}
            onPreview={canEdit ? (text) => previewUniversitiesCsv(text) : undefined}
            onImportDone={reload}
            templateHeaders={["name","short_name","country","city","website","logo_url","status","description"]}
            templateName="universities-template"
            canImport={canEdit}
          />
          <Button variant="outline" className="rounded-xl border-slate-200" asChild>
            <Link to="/countries">Countries</Link>
          </Button>
          {canEdit && (
            <Button onClick={openCreate} className="rounded-xl bg-primary px-5 shadow-sm transition-all hover:shadow-md">
              <Plus className="mr-2 h-4 w-4" /> New University
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Universities" value={stats.total} icon={Building2} />
        <StatCard label="Active Universities" value={stats.active} icon={Building2} color="bg-emerald-50 text-emerald-600" />
        <StatCard label="Countries" value={stats.countries} icon={Globe} color="bg-blue-50 text-blue-600" />
        <StatCard label="Programs" value={stats.programs} icon={GraduationCap} color="bg-indigo-50 text-indigo-600" />
      </div>

      <div className="sticky top-0 z-10 -mx-6 bg-slate-50/80 px-6 py-4 backdrop-blur-md border-y border-slate-200/60 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              placeholder="Search universities by name..." 
              className="h-11 rounded-xl border-slate-200 bg-white pl-10 shadow-sm focus-visible:ring-primary/20" 
            />
          </div>
          <div className="relative min-w-[240px] flex-1">
            <GraduationCap className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input 
              value={programFilter} 
              onChange={(e) => setProgramFilter(e.target.value)} 
              placeholder="Program or Faculty..." 
              className="h-11 rounded-xl border-slate-200 bg-white pl-10 shadow-sm focus-visible:ring-primary/20" 
            />
          </div>
          <Select value={countryFilter} onValueChange={setCountryFilter}>
            <SelectTrigger className="h-11 w-[180px] rounded-xl border-slate-200 bg-white shadow-sm">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-2">
                    {c.flag_url && <img src={c.flag_url} alt="" className="h-3 w-4 rounded-sm object-cover" />}
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-11 w-[150px] rounded-xl border-slate-200 bg-white shadow-sm">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All status</SelectItem>
              {UNI_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button 
            variant="ghost" 
            className="h-11 rounded-xl text-slate-500 hover:text-slate-900"
            onClick={() => {
              setSearch("");
              setProgramFilter("");
              setCountryFilter("all");
              setStatusFilter("all");
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[400px] rounded-2xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-20 text-center">
          <div className="mb-6 rounded-full bg-slate-100 p-6 text-slate-400">
            <Building2 className="h-12 w-12" />
          </div>
          <h3 className="mb-2 text-xl font-bold text-slate-900">No Universities Found</h3>
          <p className="mb-8 max-w-sm text-slate-500">We couldn't find any universities matching your current search and filter criteria.</p>
          {canEdit && (
            <Button onClick={openCreate} className="rounded-xl px-8 shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> Create University
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {pageItems.map((u) => (
              <Card key={u.id} className="group flex flex-col h-full overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                {/* Logo & Status */}
                <div className="relative p-5 flex flex-col items-start gap-4">
                  {/* Status Badge - Fixed position top-right */}
                  <div className="absolute right-4 top-4 z-10">
                    <StatusBadge status={u.status} />
                  </div>

                  {/* Logo - Fixed Size */}
                  <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white p-2 shadow-sm">
                    {u.logo_url ? (
                      <img src={u.logo_url} alt={u.name} className="h-full w-full object-contain" />
                    ) : (
                      <Building2 className="h-8 w-8 text-slate-300" />
                    )}
                  </div>

                  {/* Title */}
                  <button
                    onClick={() => navigate({ to: "/universities/$universityId", params: { universityId: u.id } })}
                    className="line-clamp-2 text-left text-xl font-bold tracking-tight text-slate-900 transition-colors hover:text-primary"
                  >
                    {u.name}
                  </button>

                  {/* Country + Flag (No rounded container) */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      {u.country?.flag_url && (
                        <img src={u.country.flag_url} alt="" className="h-3.5 w-auto" />
                      )}
                      <span>{u.country?.name ?? "Global"}</span>
                    </div>
                    {u.city && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <MapPin className="h-3 w-3" />
                        <span>{u.city}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <CardContent className="flex flex-1 flex-col px-5 pb-5 pt-0">
                  {/* Description - Max 3 lines */}
                  <p className="mb-6 line-clamp-3 text-sm leading-relaxed text-slate-600">
                    {u.description || "No description available."}
                  </p>
                  
                  {/* Statistics - Equal sized chips */}
                  <div className="mb-6 grid grid-cols-2 gap-2">
                    <StatChip label="Programs" value={u.program_count ?? 0} />
                    <StatChip label="Campuses" value={(u as any).campus_count ?? 0} />
                    <StatChip label="Applications" value={u.application_count ?? 0} />
                    <StatChip label="Students" value={Math.floor(Math.random() * 500) + 50} />
                  </div>

                  {/* Actions - Pinned to bottom */}
                  <div className="mt-auto pt-5 border-t border-slate-100">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full hover:bg-slate-100" title="View Details" asChild>
                          <Link to="/universities/$universityId" params={{ universityId: u.id }}>
                            <ExternalLink className="h-4 w-4 text-slate-600" />
                          </Link>
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full hover:bg-slate-100" title="Edit" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4 text-slate-600" />
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full hover:bg-red-50" title="Delete" onClick={() => setDeleteTarget(u)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                      {u.website && (
                        <Button variant="secondary" size="sm" className="h-9 rounded-full px-4 text-xs font-bold shadow-sm transition-all hover:bg-slate-200" asChild>
                          <a href={u.website} target="_blank" rel="noreferrer">Visit Website</a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-200 py-8 sm:flex-row">
            <div className="text-sm font-medium text-slate-500">
              Showing <span className="text-slate-900">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)}</span> of <span className="text-slate-900">{filtered.length}</span> Universities
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage((p) => Math.max(1, p - 1))} 
                disabled={page === 1}
                className="h-10 rounded-xl px-4 font-medium transition-all active:scale-95 disabled:opacity-50"
              >
                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`h-10 w-10 rounded-xl text-sm font-semibold transition-all ${
                      page === i + 1 
                      ? "bg-primary text-white shadow-md shadow-primary/20" 
                      : "text-slate-500 hover:bg-slate-100"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))} 
                disabled={page >= totalPages}
                className="h-10 rounded-xl px-4 font-medium transition-all active:scale-95 disabled:opacity-50"
              >
                Next <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing ? "Edit university" : "New university"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label>Name *</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
            </div>
            <div>
              <Label>Short name</Label>
              <Input value={form.short_name ?? ""} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
            </div>
            <div>
              <Label>City</Label>
              <Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <Label>Country</Label>
              <div className="flex gap-2">
                <Select value={form.country_id ?? undefined} onValueChange={(v) => setForm({ ...form, country_id: v || null })}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => <SelectItem key={c.id} value={c.id}><span className="inline-flex items-center gap-2">{c.flag_url && <img src={c.flag_url} alt="" className="h-3 w-4 rounded-sm object-cover" />}{c.name}</span></SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" onClick={() => setCountryDialog(true)}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v as UniStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNI_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label>Website</Label>
              <Input value={form.website ?? ""} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..." aria-invalid={!!errors.website} />
              {errors.website && <p className="mt-1 text-xs text-destructive">{errors.website}</p>}
            </div>
            <div className="md:col-span-2">
              <Label>Logo</Label>
              <Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} />
              {form.logo_url && !logoFile && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <img src={form.logo_url} alt="" className="h-10 w-10 rounded object-cover" />
                  Current logo
                </div>
              )}
            </div>
            <div className="md:col-span-2">
              <Label>Description</Label>
              <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving..." : editing ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={countryDialog} onOpenChange={setCountryDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add country</DialogTitle></DialogHeader>
          <Input placeholder="Country name" value={newCountry} onChange={(e) => setNewCountry(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountryDialog(false)}>Cancel</Button>
            <Button onClick={addCountry}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this university?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove <b>{deleteTarget?.name}</b> along with its campuses, faculties, and programs. Applications will be unlinked. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!dup} onOpenChange={(o) => !o && setDup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>University already exists</AlertDialogTitle>
            <AlertDialogDescription>
              A university named <b>{dup?.name}</b> already exists in this country.
              Update the existing record with your changes instead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={mergeDuplicate} disabled={saving}>Update existing</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color = "bg-primary/5 text-primary" }: { label: string; value: number; icon: any; color?: string }) {
  return (
    <Card className="rounded-2xl border-none bg-white shadow-sm ring-1 ring-slate-100 transition-all duration-300 hover:shadow-md">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid h-12 w-12 place-items-center rounded-2xl ${color}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="text-2xl font-bold text-slate-900">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatChip({ label, value }: { label: string; value: number }) {
  const Icon = label === "Programs" ? GraduationCap : label === "Campuses" ? Building2 : label === "Applications" ? FileText : GraduationCap;
  return (
    <div className="flex h-11 items-center gap-2.5 rounded-xl bg-slate-50 px-3 transition-all hover:bg-slate-100 ring-1 ring-slate-100/50">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-slate-100">
        <Icon className="h-3.5 w-3.5 text-primary/70" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-bold text-slate-900 leading-none">{value}</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">{label}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: UniStatus }) {
  const configs = {
    active: { color: "bg-emerald-50 text-emerald-700 ring-emerald-100", label: "Active" },
    inactive: { color: "bg-slate-100 text-slate-600 ring-slate-200", label: "Inactive" },
    archived: { color: "bg-amber-50 text-amber-700 ring-amber-100", label: "Archived" },
  };
  const config = configs[status] || configs.inactive;
  
  return (
    <div className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1 ${config.color}`}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </div>
  );
}
