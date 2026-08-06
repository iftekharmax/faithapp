import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { 
  ArrowLeft, Building2, ExternalLink, Plus, Pencil, Trash2, MapPin, 
  GraduationCap, Calendar, DollarSign, Award, Loader2, AlertCircle, 
  SearchX, Share2, Download, Printer, Copy, Heart, Globe, Users, 
  FileText, Briefcase, Plane, BookOpen, Clock, CheckCircle2, 
  ArrowRight, MoreVertical, LayoutGrid, List as ListIcon, 
  TrendingUp, Search, RotateCcw, Filter, ChevronRight,
  School, Book, UserCheck
} from "lucide-react";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
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
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/universities/$universityId/")({
  component: () => (
    <div className="bg-[#F8FAFC] min-h-screen">
      <UniversityDetail />
    </div>
  ),
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
    return (
      <div className="mx-auto max-w-[1600px] space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
        
        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <aside className="space-y-6">
            <Card className="rounded-3xl border-none shadow-sm ring-1 ring-border p-6 bg-white">
              <div className="flex flex-col items-center">
                <Skeleton className="h-24 w-24 rounded-3xl" />
                <Skeleton className="h-6 w-48 mt-4" />
                <Skeleton className="h-5 w-20 mt-2 rounded-full" />
                <div className="mt-8 w-full space-y-3">
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <div className="flex gap-2">
                    <Skeleton className="h-9 flex-1 rounded-xl" />
                    <Skeleton className="h-9 flex-1 rounded-xl" />
                  </div>
                </div>
              </div>
              <div className="mt-8 space-y-4 border-t pt-8">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            </Card>
          </aside>

          <main className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
            
            <div className="space-y-6">
              <div className="flex gap-2 p-1 bg-muted/30 w-fit rounded-2xl">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-28 rounded-xl" />
                ))}
              </div>
              
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Card key={i} className="h-[280px] rounded-3xl border-none shadow-sm ring-1 ring-border p-6 bg-white">
                    <div className="space-y-4">
                      <div className="flex justify-between">
                        <Skeleton className="h-5 w-20 rounded-full" />
                        <Skeleton className="h-8 w-8 rounded-full" />
                      </div>
                      <Skeleton className="h-7 w-3/4" />
                      <div className="flex gap-2">
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                      <div className="pt-4 border-t space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-8 w-28" />
                          <Skeleton className="h-9 w-24 rounded-xl" />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
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
    <div className="mx-auto max-w-[1600px] space-y-6 animate-in fade-in duration-500 py-6">
      <div className="flex items-center gap-2">

        <Button variant="ghost" size="sm" className="rounded-xl hover:bg-white" asChild><Link to="/universities"><ArrowLeft className="mr-1 h-4 w-4" />Back to List</Link></Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="space-y-6">
          <Card className="rounded-3xl border-none shadow-sm ring-1 ring-border bg-white p-6">
            <div className="flex flex-col items-center text-center">
              <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-3xl bg-muted ring-1 ring-border shadow-inner">
                {uni.logo_url ? <img src={uni.logo_url} alt={uni.name} className="h-full w-full object-cover" /> : <Building2 className="h-12 w-12 text-muted-foreground" />}
              </div>
              <h1 className="mt-4 text-xl font-bold tracking-tight leading-tight">{uni.name}</h1>
              <Badge variant={uni.status === "active" ? "default" : "secondary"} className="mt-2 capitalize">{uni.status}</Badge>
              
              <div className="mt-6 flex flex-col gap-3 w-full">
                <Button className="rounded-xl w-full font-bold shadow-sm" onClick={() => navigate({ to: "/applications/new", search: { universityId } })}>Create Application</Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 rounded-xl text-xs font-semibold" onClick={() => navigate({ to: "/universities/$universityId/programs/new", params: { universityId } })}>Add Program</Button>
                  {canEdit && <Button variant="outline" className="flex-1 rounded-xl text-xs font-semibold" asChild><Link to="/universities/$universityId/edit" params={{ universityId }}>Edit Profile</Link></Button>}
                </div>
              </div>
            </div>
            <div className="mt-8 space-y-4 border-t pt-8">
              <div className="flex items-center gap-3 text-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 text-primary">
                  <MapPin className="h-4 w-4" />
                </div>
                <span className="text-muted-foreground font-medium">{uni.country?.name || 'N/A'} • {uni.city || 'N/A'}</span>
              </div>
              {uni.website && (
                <a href={uni.website} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-primary hover:underline transition-all group">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10">
                    <Globe className="h-4 w-4" />
                  </div>
                  <span className="font-medium">Visit Official Website</span>
                </a>
              )}
            </div>
          </Card>

          <Card className="rounded-3xl border-none shadow-sm ring-1 ring-border bg-white p-6">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">University Summary</h3>
            <p className="text-sm leading-relaxed text-muted-foreground/80">{uni.description || 'No description available for this university.'}</p>
          </Card>
        </aside>

        <main className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Programs" value={programs.length} icon={GraduationCap} color="blue" />
            <StatCard label="Campuses" value={campuses.length} icon={School} color="emerald" />
            <StatCard label="Applications" value={applications.length} icon={FileText} color="orange" />
            <StatCard label="Students" value="0" icon={Users} color="purple" />
          </div>

          <Tabs defaultValue="programs" className="w-full">
            <TabsList className="bg-muted/50 p-1 rounded-2xl h-12 inline-flex">
              <TabsTrigger value="programs" className="rounded-xl px-8 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">Programs</TabsTrigger>
              <TabsTrigger value="campuses" className="rounded-xl px-8 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">Campuses</TabsTrigger>
              <TabsTrigger value="applications" className="rounded-xl px-8 h-10 data-[state=active]:bg-white data-[state=active]:shadow-sm">Applications</TabsTrigger>
            </TabsList>
            <TabsContent value="programs" className="mt-6 border-none p-0 focus-visible:ring-0">
              <ProgramsTab
                universityId={universityId} programs={programs}
                campuses={campuses} canEdit={canEdit} onChange={reload}
              />
            </TabsContent>

            <TabsContent value="campuses" className="mt-6 border-none p-0 focus-visible:ring-0">
              <CampusesTab universityId={universityId} campuses={campuses} canEdit={canEdit} onChange={reload} />
            </TabsContent>

            <TabsContent value="applications" className="mt-6 border-none p-0 focus-visible:ring-0">
              <Card className="rounded-3xl border-none shadow-sm ring-1 ring-border"><CardHeader><CardTitle className="text-xl">Linked Applications</CardTitle></CardHeader>
                <CardContent>
                  {applications.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-center">
                      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground font-medium">No applications linked to this university yet.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader><TableRow className="hover:bg-transparent border-muted/50">
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider">Code</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider">Student</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider">Program</TableHead><TableHead className="text-[11px] font-bold uppercase tracking-wider">Status</TableHead><TableHead></TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {applications.map((a) => (
                          <TableRow key={a.id} className="group border-muted/50 hover:bg-muted/30 transition-colors">
                            <TableCell className="font-mono text-xs font-medium text-primary">{a.application_code}</TableCell>
                            <TableCell className="font-medium">{a.student?.full_name ?? "—"}</TableCell>
                            <TableCell className="text-muted-foreground">{a.program}</TableCell>
                            <TableCell><Badge variant="outline" className="capitalize bg-white text-[10px] font-bold tracking-wide">{String(a.status).replace(/_/g, " ")}</Badge></TableCell>
                            <TableCell className="text-right"><Button size="sm" variant="ghost" className="rounded-lg hover:bg-primary hover:text-primary-foreground group-hover:translate-x-1 transition-all" asChild>
                              <Link to="/applications/$applicationId" params={{ applicationId: a.id }}>Details <ChevronRight className="ml-1 h-3.5 w-3.5" /></Link>
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
        </main>
      </div>
    </div>
  );
}


function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: 'blue' | 'emerald' | 'orange' | 'purple' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    orange: 'bg-orange-50 text-orange-600 ring-orange-100',
    purple: 'bg-purple-50 text-purple-600 ring-purple-100',
  };

  return (
    <Card className="rounded-2xl border-none shadow-sm ring-1 ring-border p-4 bg-white transition-all hover:shadow-md hover:ring-primary/20 group">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 transition-all group-hover:scale-110", colors[color])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold tracking-tight">{value}</div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80 truncate">{label}</div>
        </div>
      </div>
    </Card>
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
  const [page, setPage] = useState(1);
  const itemsPerPage = 6;

  const degrees = Array.from(new Set(programs.map((p) => p.degree).filter(Boolean) as string[]));
  const filtered = programs.filter((p) =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
    (degreeFilter === "all" || p.degree === degreeFilter)
  );

  const displayed = filtered.slice(0, page * itemsPerPage);
  const hasMore = displayed.length < filtered.length;


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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search programs..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              className="pl-9 h-11 rounded-xl border-none shadow-sm ring-1 ring-border bg-white focus-visible:ring-primary" 
            />
          </div>
          <Select value={degreeFilter} onValueChange={setDegreeFilter}>
            <SelectTrigger className="w-[160px] h-11 rounded-xl border-none shadow-sm ring-1 ring-border bg-white">
              <SelectValue placeholder="Degree" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-none shadow-xl ring-1 ring-border">
              <SelectItem value="all">All degrees</SelectItem>
              {degrees.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <CsvToolbar label="programs"
            onExport={() => exportProgramsCsv(universityId)}
            onPreview={canEdit ? (text) => previewProgramsCsv(text, universityId) : undefined}
            onImportDone={onChange}
            templateHeaders={["name","degree","duration","campus","intake","application_deadline","tuition_fee","currency","scholarship","requirements","description","status"]}
            templateName="programs-template" canImport={canEdit} />
          {canEdit && (
            <Button onClick={openNew} className="rounded-xl h-11 px-6 font-bold shadow-sm">
              <Plus className="mr-2 h-4 w-4" /> Add Program
            </Button>
          )}
        </div>
      </div>

      <div>
        {filtered.length === 0 ? (
          programs.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-16 text-center bg-white">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <GraduationCap className="h-10 w-10 text-primary" />
              </div>
              <div className="max-w-xs space-y-2">
                <p className="text-xl font-bold">No programs yet</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Start tracking academic programs for this university by creating your first one.
                </p>
              </div>
              {canEdit && (
                <Button onClick={openNew} className="rounded-xl shadow-lg shadow-primary/25 h-11 px-6 font-bold transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <Plus className="mr-2 h-5 w-5" /> Create Program
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-16 text-center bg-white">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <SearchX className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="max-w-xs space-y-2">
                <p className="text-lg font-bold">No matching programs</p>
                <p className="text-sm text-muted-foreground">
                  We couldn't find any programs matching your search or filters.
                </p>
              </div>
              <Button variant="outline" className="rounded-xl px-6 h-10 font-semibold" onClick={() => { setSearch(""); setDegreeFilter("all"); }}>
                Clear all filters
              </Button>
            </div>
          )
        ) : (
          <div className="space-y-8">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {displayed.map((p) => (
                <div key={p.id} className="group relative flex flex-col overflow-hidden rounded-3xl border-none bg-white shadow-sm ring-1 ring-border transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl hover:shadow-primary/10 hover:ring-primary/20">

                  <div className="flex flex-1 flex-col p-6">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                            {p.degree || 'Program'}
                          </span>
                          {p.status === 'active' && <Badge variant="outline" className="h-4 border-emerald-200 bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 uppercase tracking-tighter">Active</Badge>}
                        </div>
                        <h3 className="text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-primary leading-tight">
                          {p.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-muted-foreground pt-1">
                          {p.duration && (
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
                              <span>{p.duration}</span>
                            </div>
                          )}
                          {p.intake && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                              <span>{p.intake}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-muted">
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 rounded-xl">
                            <DropdownMenuItem onClick={() => openEdit(p)} className="rounded-lg">
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate({ to: "/applications/new", search: { universityId, programId: p.id } })} className="rounded-lg">
                              <Plus className="mr-2 h-4 w-4" /> Apply
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDeleteId(p.id)} className="rounded-lg text-destructive focus:text-destructive focus:bg-destructive/5">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="mt-auto space-y-4 pt-4 border-t border-muted/50">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Tuition Fee</p>
                          <p className="text-lg font-bold text-primary tracking-tight">
                            {p.currency || 'USD'} {p.tuition_fee ? p.tuition_fee.toLocaleString() : 'N/A'}
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          className="rounded-xl font-bold bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all px-4 h-9 shadow-none"
                          onClick={() => navigate({ to: "/applications/new", search: { universityId, programId: p.id } })}
                        >
                          Apply Now <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

              ))}

          </div>

          {hasMore && (
            <div className="mt-12 flex justify-center">
              <Button
                variant="outline"
                size="lg"
                onClick={() => setPage(p => p + 1)}
                className="rounded-2xl border-2 px-12 font-bold transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-xl hover:shadow-primary/20"
              >
                Load More Programs
              </Button>
            </div>
          )}
        </div>
      )}

      
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
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function openNew() { navigate({ to: "/universities/$universityId/campuses/new", params: { universityId } }); }
  function openEdit(c: Campus) { navigate({ to: "/universities/$universityId/campuses/$campusId/edit", params: { universityId, campusId: c.id } }); }

  async function confirmDelete() {
    if (!deleteId) return;
    try {
      await deleteCampus(deleteId);
      toast.success("Campus deleted");
      setDeleteId(null);
      onChange();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete campus");
    }
  }

  return (
    <Card className="rounded-3xl border-none shadow-sm ring-1 ring-border overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 px-6 py-4">
        <div>
          <CardTitle className="text-xl">University Campuses</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">Manage physical locations for this institution.</p>
        </div>
        <div className="flex gap-2">
          <CsvToolbar label="campuses"
            onExport={() => exportCampusesCsv(universityId)}
            onImportDone={onChange}
            templateHeaders={["name", "city", "address", "is_main", "status"]}
            templateName="campuses-template" canImport={canEdit} />
          {canEdit && <Button onClick={openNew} className="rounded-xl shadow-sm"><Plus className="mr-2 h-4 w-4" /> Add Campus</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {campuses.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="h-20 w-20 rounded-full bg-primary/5 flex items-center justify-center mb-4">
              <School className="h-10 w-10 text-primary/40" />
            </div>
            <p className="text-xl font-bold">No campuses yet</p>
            <p className="text-muted-foreground max-w-xs mt-2 mb-6">Start by adding the main campus or regional locations for this university.</p>
            {canEdit && <Button onClick={openNew} className="rounded-xl"><Plus className="mr-2 h-4 w-4" /> Create First Campus</Button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {campuses.map((c) => (
              <div key={c.id} className="bg-white p-6 group transition-colors hover:bg-muted/30">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div className="flex gap-1">
                    {c.is_main && <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none rounded-full text-[10px] font-bold uppercase tracking-wider">Main</Badge>}
                    <Badge variant="outline" className="capitalize text-[10px] font-bold tracking-wider">{c.status}</Badge>
                  </div>
                </div>
                
                <h3 className="text-lg font-bold tracking-tight mb-2 group-hover:text-primary transition-colors">{c.name}</h3>
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{c.city || 'N/A'}</span>
                  </div>
                  {c.address && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{c.address}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-muted/50">
                  <div className="flex gap-2">
                    {canEdit && (
                      <>
                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-xl font-bold group-hover:bg-primary group-hover:text-white">
                    View Programs <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campus?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All programs associated with this campus may need to be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-white hover:bg-destructive/90 rounded-xl">Delete Campus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}


