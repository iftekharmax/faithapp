import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Building2, ExternalLink, Plus, Pencil, Trash2, MapPin, GraduationCap, Calendar, DollarSign, Award, Loader2, AlertCircle, SearchX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  getUniversity, listCampuses, createCampus, updateCampus, deleteCampus,
  listPrograms, createProgram, updateProgram, deleteProgram,
  DuplicateError,
  type University, type Campus, type UniversityProgram, UNI_STATUSES, type UniStatus,
} from "@/lib/universities";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { CsvToolbar } from "@/components/universities/CsvToolbar";
import {
  exportCampusesCsv, previewCampusesCsv,
  exportProgramsCsv, previewProgramsCsv,
} from "@/lib/university-csv";

export const Route = createFileRoute("/_authenticated/universities/$universityId/")({
  component: UniversityDetail,
});

function UniversityDetail() {
  const { universityId } = Route.useParams();
  const navigate = useNavigate();
  const { roles } = useAuth();
  const canEdit = roles.some((r) => ["admin", "counselor", "application_team"].includes(r));
  const [uni, setUni] = useState<University | null>(null);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [programs, setPrograms] = useState<UniversityProgram[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const [u, c, p, a] = await Promise.all([
        getUniversity(universityId),
        listCampuses(universityId),
        listPrograms({ universityId }),
        supabase.from("applications").select("id, application_code, status, program, student:students(full_name, student_code)").eq("university_id", universityId).order("created_at", { ascending: false }),
      ]);
      setUni(u); setCampuses(c); setPrograms(p);
      setApplications((a.data as any[]) ?? []);
    } catch (e: any) {
      const msg = e?.message ?? "Something went wrong while loading this university.";
      setLoadError(msg);
      toast.error(msg);
    }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [universityId]);

  if (loading) {
    return <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>;
  }

  if (loadError || !uni) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed p-12 text-center">
        <div className="rounded-full bg-destructive/10 p-4"><AlertCircle className="h-8 w-8 text-destructive" /></div>
        <div>
          <h2 className="text-lg font-semibold">Couldn't load this university</h2>
          <p className="mt-1 text-sm text-muted-foreground">{loadError ?? "This university no longer exists."}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-xl" onClick={reload}>Try again</Button>
          <Button asChild className="rounded-xl"><Link to="/universities">Back to universities</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild><Link to="/universities"><ArrowLeft className="mr-1 h-4 w-4" />Back</Link></Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-4 p-6">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-muted ring-1 ring-border">
            {uni.logo_url ? <img src={uni.logo_url} alt={uni.name} className="h-full w-full object-cover" /> : <Building2 className="h-10 w-10 text-muted-foreground" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{uni.name}</h1>
              <Badge variant={uni.status === "active" ? "default" : "secondary"} className="capitalize">{uni.status}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {uni.country && <span className="inline-flex items-center gap-1.5">{uni.country.flag_url && <img src={uni.country.flag_url} alt="" className="h-3 w-4 rounded-sm object-cover" />}{uni.country.name}</span>}
              {uni.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{uni.city}</span>}
              {uni.website && <a href={uni.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Website <ExternalLink className="h-3 w-3" /></a>}
            </div>
            {uni.description && <p className="mt-3 text-sm text-muted-foreground">{uni.description}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <MiniStat label="Campuses" value={campuses.length} />
            <MiniStat label="Programs" value={programs.length} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs">Programs ({programs.length})</TabsTrigger>
          <TabsTrigger value="campuses">Campuses ({campuses.length})</TabsTrigger>
          <TabsTrigger value="applications">Applications ({applications.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="mt-4">
          <ProgramsTab
            universityId={universityId} programs={programs}
            campuses={campuses} canEdit={canEdit} onChange={reload}
          />
        </TabsContent>

        <TabsContent value="campuses" className="mt-4">
          <CampusesTab universityId={universityId} campuses={campuses} canEdit={canEdit} onChange={reload} />
        </TabsContent>


        <TabsContent value="applications" className="mt-4">
          <Card><CardHeader><CardTitle>Applications</CardTitle></CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No applications linked to this university yet.</p>
              ) : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Code</TableHead><TableHead>Student</TableHead>
                    <TableHead>Program</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {applications.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs">{a.application_code}</TableCell>
                        <TableCell>{a.student?.full_name ?? "—"}</TableCell>
                        <TableCell>{a.program}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize">{String(a.status).replace(/_/g, " ")}</Badge></TableCell>
                        <TableCell><Button size="sm" variant="ghost" asChild>
                          <Link to="/applications/$applicationId" params={{ applicationId: a.id }}>Open</Link>
                        </Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-2">
      <div className="text-xl font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

/* ============ PROGRAMS ============ */
function ProgramsTab({ universityId, programs, campuses, canEdit, onChange }: {
  universityId: string; programs: UniversityProgram[]; campuses: Campus[];
  canEdit: boolean; onChange: () => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<UniversityProgram | null>(null);
  const [form, setForm] = useState<Partial<UniversityProgram>>({ status: "active", currency: "USD" });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [degreeFilter, setDegreeFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dup, setDup] = useState<{ id: string; name: string; payload: any } | null>(null);

  const degrees = Array.from(new Set(programs.map((p) => p.degree).filter(Boolean) as string[]));
  const filtered = programs.filter((p) =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
    (degreeFilter === "all" || p.degree === degreeFilter)
  );

  function openNew() { navigate({ to: "/universities/$universityId/programs/new", params: { universityId } }); }
  function openEdit(p: UniversityProgram) { navigate({ to: "/universities/$universityId/programs/$programId/edit", params: { universityId, programId: p.id } }); }


  async function save() {
    if (!form.name?.trim()) { toast.error("Program name required"); return; }
    if (form.tuition_fee != null && form.tuition_fee !== "" as any) {
      const n = Number(form.tuition_fee); if (!Number.isFinite(n) || n < 0) { toast.error("Tuition fee must be a positive number"); return; }
    }
    if (form.application_deadline && Number.isNaN(new Date(form.application_deadline).getTime())) {
      toast.error("Invalid application deadline"); return;
    }
    setSaving(true);
    try {
      const payload: any = { ...form, university_id: universityId };
      delete payload.campus;
      if (payload.tuition_fee === "" || payload.tuition_fee == null) payload.tuition_fee = null;
      else payload.tuition_fee = Number(payload.tuition_fee);
      if (!payload.application_deadline) payload.application_deadline = null;
      if (editing) await updateProgram(editing.id, payload);
      else await createProgram(payload);
      toast.success("Saved"); setOpen(false); onChange();
    } catch (e: any) {
      if (e instanceof DuplicateError) {
        const payload: any = { ...form, university_id: universityId };
        delete payload.campus;
        if (payload.tuition_fee === "" || payload.tuition_fee == null) payload.tuition_fee = null;
        else payload.tuition_fee = Number(payload.tuition_fee);
        if (!payload.application_deadline) payload.application_deadline = null;
        setDup({ id: e.existingId, name: e.entityName, payload });
      } else toast.error(e.message);
    }
    finally { setSaving(false); }
  }

  async function mergeDuplicate() {
    if (!dup) return;
    setSaving(true);
    try { await updateProgram(dup.id, dup.payload); toast.success("Existing program updated"); setDup(null); setOpen(false); onChange(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }


  async function confirmDelete() {
    if (!deleteId) return;
    try { await deleteProgram(deleteId); toast.success("Deleted"); setDeleteId(null); onChange(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div className="flex flex-1 flex-wrap gap-2">
          <Input placeholder="Search programs..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={degreeFilter} onValueChange={setDegreeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Degree" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All degrees</SelectItem>
              {degrees.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CsvToolbar label="programs"
            onExport={() => exportProgramsCsv(universityId)}
            onPreview={canEdit ? (text) => previewProgramsCsv(text, universityId) : undefined}
            onImportDone={onChange}
            templateHeaders={["name","degree","duration","campus","intake","application_deadline","tuition_fee","currency","scholarship","requirements","description","status"]}
            templateName="programs-template" canImport={canEdit} />
          {canEdit && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Add program</Button>}
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          programs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
              <div className="rounded-full bg-primary/10 p-3"><GraduationCap className="h-6 w-6 text-primary" /></div>
              <div>
                <p className="font-semibold">No programs yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Add your first program or import a CSV to get started.</p>
              </div>
              {canEdit && <Button onClick={openNew} className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Add program</Button>}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
              <div className="rounded-full bg-muted p-3"><SearchX className="h-6 w-6 text-muted-foreground" /></div>
              <div>
                <p className="font-semibold">No matching programs</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a different search term or degree filter.</p>
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => { setSearch(""); setDegreeFilter("all"); }}>Clear filters</Button>
            </div>
          )
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {filtered.map((p) => (
              <div key={p.id} className="rounded-xl border p-4 transition hover:shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{p.name}</h3>
                      <Badge variant={p.status === "active" ? "default" : "secondary"} className="capitalize">{p.status}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {p.degree && <span className="inline-flex items-center gap-1"><GraduationCap className="h-3 w-3" />{p.degree}</span>}
                      {p.duration && <span>{p.duration}</span>}
                      {p.campus?.name && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{p.campus.name}</span>}
                      
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setDeleteId(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {p.intake && <InfoLine icon={Calendar} label="Intake" value={p.intake} />}
                  {p.application_deadline && <InfoLine icon={Calendar} label="Deadline" value={new Date(p.application_deadline).toLocaleDateString()} />}
                  {p.tuition_fee != null && <InfoLine icon={DollarSign} label="Tuition" value={`${p.currency ?? ""} ${p.tuition_fee.toLocaleString()}`} />}
                  {p.scholarship && <InfoLine icon={Award} label="Scholarship" value={p.scholarship} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-none bg-background sm:rounded-3xl shadow-2xl">
          <div className="relative overflow-hidden bg-primary px-6 py-8 text-primary-foreground">
            <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
            <div className="relative">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                <Plus className="h-6 w-6 text-white" />
              </div>
              <DialogHeader className="text-left">
                <DialogTitle className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  {editing ? "Edit Program" : "Add New Program"}
                </DialogTitle>
                <p className="text-primary-foreground/80">
                  {editing ? "Update details for the existing program" : "Define the details for a new academic program"}
                </p>
              </DialogHeader>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-muted-foreground/20">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="md:col-span-2 space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Program Name *</Label>
                <Input 
                  className="h-12 rounded-xl border-muted/60 bg-muted/20 focus-visible:ring-primary shadow-sm"
                  placeholder="e.g. B.Sc. in Computer Science"
                  value={form.name ?? ""} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Degree Level</Label>
                <Input 
                  className="h-11 rounded-xl border-muted/60 bg-muted/20 shadow-sm"
                  placeholder="e.g. Bachelor, Master, PhD" 
                  value={form.degree ?? ""} 
                  onChange={(e) => setForm({ ...form, degree: e.target.value })} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Duration</Label>
                <Input 
                  className="h-11 rounded-xl border-muted/60 bg-muted/20 shadow-sm"
                  placeholder="e.g. 4 years" 
                  value={form.duration ?? ""} 
                  onChange={(e) => setForm({ ...form, duration: e.target.value })} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Campus</Label>
                <Select value={form.campus_id ?? "none"} onValueChange={(v) => setForm({ ...form, campus_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-11 rounded-xl border-muted/60 bg-muted/20 shadow-sm">
                    <SelectValue placeholder="Select campus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {campuses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>


              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Intake</Label>
                <Input 
                  className="h-11 rounded-xl border-muted/60 bg-muted/20 shadow-sm"
                  placeholder="e.g. Sep 2026, Jan 2027" 
                  value={form.intake ?? ""} 
                  onChange={(e) => setForm({ ...form, intake: e.target.value })} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Application Deadline</Label>
                <Input 
                  type="date" 
                  className="h-11 rounded-xl border-muted/60 bg-muted/20 shadow-sm"
                  value={form.application_deadline ?? ""} 
                  onChange={(e) => setForm({ ...form, application_deadline: e.target.value })} 
                />
              </div>

              <div className="md:col-span-2 mt-2">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">Financial Information</span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tuition Fee</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        className="h-11 rounded-xl border-muted/60 bg-muted/20 pl-10 shadow-sm"
                        value={form.tuition_fee ?? ""} 
                        onChange={(e) => setForm({ ...form, tuition_fee: e.target.value as any })} 
                      />
                      <DollarSign className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Currency</Label>
                    <Input 
                      className="h-11 rounded-xl border-muted/60 bg-muted/20 shadow-sm"
                      value={form.currency ?? "USD"} 
                      onChange={(e) => setForm({ ...form, currency: e.target.value })} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-primary/80">Application Fee</Label>
                    <Input 
                      type="number" 
                      className="h-11 rounded-xl border-primary/20 bg-primary/5 shadow-sm focus-visible:ring-primary"
                      value={form.application_fee ?? ""} 
                      onChange={(e) => setForm({ ...form, application_fee: e.target.value as any })} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-primary/80">Registration Fee</Label>
                    <Input 
                      type="number" 
                      className="h-11 rounded-xl border-primary/20 bg-primary/5 shadow-sm focus-visible:ring-primary"
                      value={form.registration_fee ?? ""} 
                      onChange={(e) => setForm({ ...form, registration_fee: e.target.value as any })} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-primary/80">EMGS Fee</Label>
                    <Input 
                      type="number" 
                      className="h-11 rounded-xl border-primary/20 bg-primary/5 shadow-sm focus-visible:ring-primary"
                      value={form.emgs_fee ?? ""} 
                      onChange={(e) => setForm({ ...form, emgs_fee: e.target.value as any })} 
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground text-primary/80">Others Fee</Label>
                    <Input 
                      type="number" 
                      className="h-11 rounded-xl border-primary/20 bg-primary/5 shadow-sm focus-visible:ring-primary"
                      value={form.others_fee ?? ""} 
                      onChange={(e) => setForm({ ...form, others_fee: e.target.value as any })} 
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scholarship</Label>
                <Input 
                  className="h-11 rounded-xl border-muted/60 bg-muted/20 shadow-sm"
                  placeholder="e.g. Up to 50% merit-based scholarship"
                  value={form.scholarship ?? ""} 
                  onChange={(e) => setForm({ ...form, scholarship: e.target.value })} 
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Entry Requirements</Label>
                <Textarea 
                  className="min-h-[100px] rounded-2xl border-muted/60 bg-muted/20 shadow-sm focus-visible:ring-primary"
                  placeholder="List academic and language requirements..."
                  value={form.requirements ?? ""} 
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })} 
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</Label>
                <Textarea 
                  className="min-h-[100px] rounded-2xl border-muted/60 bg-muted/20 shadow-sm focus-visible:ring-primary"
                  placeholder="Program overview and key highlights..."
                  value={form.description ?? ""} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
                <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v as UniStatus })}>
                  <SelectTrigger className="h-11 rounded-xl border-muted/60 bg-muted/20 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNI_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t bg-muted/20 px-6 py-4">
            <Button 
              variant="ghost" 
              className="rounded-xl font-semibold text-muted-foreground hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              className="min-w-[140px] rounded-xl font-bold shadow-lg shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              onClick={save} 
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                editing ? "Update Program" : "Create Program"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this program?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!dup} onOpenChange={(o) => !o && setDup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Program already exists</AlertDialogTitle>
            <AlertDialogDescription>
              A program named <span className="font-medium">"{dup?.name}"</span> already exists for this campus at this university.
              Update the existing program with your changes instead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={mergeDuplicate} disabled={saving}>Update existing</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function InfoLine({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 text-muted-foreground" />
      <div><div className="text-[10px] uppercase text-muted-foreground">{label}</div><div>{value}</div></div>
    </div>
  );
}

/* ============ CAMPUSES ============ */
function CampusesTab({ universityId, campuses, canEdit, onChange }: {
  universityId: string; campuses: Campus[]; canEdit: boolean; onChange: () => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Campus | null>(null);
  const [form, setForm] = useState<Partial<Campus>>({ status: "active", is_main: false });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dup, setDup] = useState<{ id: string; name: string; payload: any } | null>(null);
  const [saving, setSaving] = useState(false);

  function openNew() { navigate({ to: "/universities/$universityId/campuses/new", params: { universityId } }); }
  function openEdit(c: Campus) { navigate({ to: "/universities/$universityId/campuses/$campusId/edit", params: { universityId, campusId: c.id } }); }

  async function save() {
    if (!form.name?.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      const payload = { ...form, university_id: universityId };
      if (editing) await updateCampus(editing.id, payload);
      else await createCampus(payload);
      toast.success("Saved"); setOpen(false); onChange();
    } catch (e: any) {
      if (e instanceof DuplicateError) setDup({ id: e.existingId, name: e.entityName, payload: { ...form, university_id: universityId } });
      else toast.error(e.message);
    }
    finally { setSaving(false); }
  }
  async function mergeDuplicate() {
    if (!dup) return;
    setSaving(true);
    try { await updateCampus(dup.id, dup.payload); toast.success("Existing campus updated"); setDup(null); setOpen(false); onChange(); }
    catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }
  async function confirmDelete() {
    if (!deleteId) return;
    try { await deleteCampus(deleteId); toast.success("Deleted"); setDeleteId(null); onChange(); }
    catch (e: any) { toast.error(e.message); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle>Campuses</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <CsvToolbar label="campuses"
            onExport={() => exportCampusesCsv(universityId)}
            onPreview={canEdit ? (text) => previewCampusesCsv(text, universityId) : undefined}
            onImportDone={onChange}
            templateHeaders={["name","city","address","is_main","status"]}
            templateName="campuses-template" canImport={canEdit} />
          {canEdit && <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Add campus</Button>}
        </div>
      </CardHeader>
      <CardContent>
        {campuses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-12 text-center">
            <div className="rounded-full bg-primary/10 p-3"><MapPin className="h-6 w-6 text-primary" /></div>
            <div>
              <p className="font-semibold">No campuses yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Add a campus so programs can be linked to a location.</p>
            </div>
            {canEdit && <Button onClick={openNew} className="rounded-xl"><Plus className="mr-2 h-4 w-4" />Add campus</Button>}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {campuses.map((c) => (
              <div key={c.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 font-semibold">{c.name} {c.is_main && <Badge variant="outline">Main</Badge>}</div>
                    {c.city && <div className="text-xs text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />{c.city}</div>}
                    {c.address && <div className="mt-1 text-xs text-muted-foreground">{c.address}</div>}
                  </div>
                  <Badge variant={c.status === "active" ? "default" : "secondary"} className="capitalize">{c.status}</Badge>
                </div>
                {canEdit && (
                  <div className="mt-3 flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="mr-1 h-3 w-3" />Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(c.id)}><Trash2 className="mr-1 h-3 w-3 text-destructive" />Delete</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit campus" : "New campus"}</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Name *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>City</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Address</Label><Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.is_main ?? false} onCheckedChange={(v) => setForm({ ...form, is_main: v })} /><Label>Main campus</Label></div>
            <div><Label>Status</Label>
              <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v as UniStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNI_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete campus?</AlertDialogTitle><AlertDialogDescription>Programs referencing it will lose the link.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!dup} onOpenChange={(o) => !o && setDup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Campus already exists</AlertDialogTitle>
            <AlertDialogDescription>
              A campus named <span className="font-medium">"{dup?.name}"</span> already exists at this university.
              Update the existing campus with your changes instead?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={mergeDuplicate} disabled={saving}>Update existing</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

