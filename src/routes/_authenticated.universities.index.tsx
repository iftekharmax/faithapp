import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Building2, Globe, Plus, Search, ExternalLink, Pencil, Trash2, GraduationCap, FileText, ChevronLeft, ChevronRight } from "lucide-react";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Universities</h1>
          <p className="text-sm text-muted-foreground">Manage partner universities, campuses, faculties and programs.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CsvToolbar
            label="universities"
            onExport={exportUniversitiesCsv}
            onPreview={canEdit ? (text) => previewUniversitiesCsv(text) : undefined}
            onImportDone={reload}
            templateHeaders={["name","short_name","country","city","website","logo_url","status","description"]}
            templateName="universities-template"
            canImport={canEdit}
          />
          <Button variant="outline" asChild><Link to="/countries">Countries</Link></Button>
          {canEdit && <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />New university</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Universities" value={stats.total} icon={Building2} />
        <StatCard label="Active" value={stats.active} icon={Building2} />
        <StatCard label="Countries" value={stats.countries} icon={Globe} />
        <StatCard label="Programs" value={stats.programs} icon={GraduationCap} />
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search universities..." className="pl-9" />
        </div>
        <div className="relative min-w-[220px] flex-1">
          <GraduationCap className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={programFilter} onChange={(e) => setProgramFilter(e.target.value)} placeholder="Filter by program/faculty..." className="pl-9" />
        </div>
        <Select value={countryFilter} onValueChange={setCountryFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Country" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countries.map((c) => <SelectItem key={c.id} value={c.id}><span className="inline-flex items-center gap-2">{c.flag_url && <img src={c.flag_url} alt="" className="h-3 w-4 rounded-sm object-cover" />}{c.name}</span></SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {UNI_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          <Building2 className="mx-auto mb-3 h-10 w-10 opacity-40" />
          No universities match your filters. {canEdit && <button className="text-primary underline" onClick={openCreate}>Add one</button>}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((u) => (
              <Card key={u.id} className="group overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="relative flex items-start gap-4 p-5">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-50 ring-1 ring-slate-100">
                    {u.logo_url ? <img src={u.logo_url} alt={u.name} className="h-full w-full object-cover" /> : <Building2 className="h-8 w-8 text-slate-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => navigate({ to: "/universities/$universityId", params: { universityId: u.id } })}
                      className="line-clamp-2 text-left text-lg font-bold text-slate-900 hover:text-primary"
                    >{u.name}</button>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <div className="flex items-center gap-1.5 font-medium text-slate-700">
                        {u.country?.flag_url && <img src={u.country.flag_url} alt="" className="h-4 w-6 rounded-sm object-cover shadow-sm" />}
                        {u.country?.name ?? "Global"}
                      </div>
                      {u.city && <span>• {u.city}</span>}
                    </div>
                  </div>
                  <div className="absolute right-4 top-4">
                    <StatusBadge status={u.status} />
                  </div>
                </div>
                
                <CardContent className="px-5 pb-5 pt-0">
                  <p className="mb-4 line-clamp-2 text-sm text-slate-600 leading-relaxed">{u.description || "No description available."}</p>
                  
                  <div className="mb-4 grid grid-cols-2 gap-2">
                    <StatChip label="Programs" value={u.program_count ?? 0} />
                    <StatChip label="Campuses" value={(u as any).campus_count ?? 0} />
                    <StatChip label="Applications" value={u.application_count ?? 0} />
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t pt-4">
                    <div className="flex gap-1.5">
                      <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full hover:bg-slate-100" title="View Details" asChild>
                        <Link to="/universities/$universityId" params={{ universityId: u.id }}><GraduationCap className="h-4 w-4 text-slate-600" /></Link>
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
                      <Button variant="secondary" size="sm" className="rounded-full px-4 text-xs" asChild>
                        <a href={u.website} target="_blank" rel="noreferrer">Visit Website</a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 text-sm">
            <div className="text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>Page {page} / {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                <ChevronRight className="h-4 w-4" />
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

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: UniStatus }) {
  const variant = status === "active" ? "default" : status === "inactive" ? "secondary" : "outline";
  return <Badge variant={variant} className="capitalize">{status}</Badge>;
}
