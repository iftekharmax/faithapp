import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { 
  ArrowLeft, Building2, ExternalLink, Plus, Pencil, Trash2, MapPin, 
  GraduationCap, Calendar, DollarSign, Award, Loader2, AlertCircle, 
  SearchX, Share2, Download, Printer, Copy, Heart, Globe, Users, 
  FileText, Briefcase, Plane, BookOpen, Clock, CheckCircle2, 
  ArrowRight, MoreHorizontal, LayoutGrid, List as ListIcon, 
  TrendingUp, Search, RotateCcw, Filter, ChevronRight,
  School, Book, UserCheck, Star, ShieldCheck, Flame, Zap, Trophy,
  History, PieChart, Activity, Info, Landmark, Languages, GraduationCap as GradIcon,
  MousePointer2, Share, Check, MoreVertical
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
  head: ({ loaderData }) => {
    const uniName = (loaderData as any)?.uni?.name || "University Details";
    return {
      meta: [
        { title: `${uniName} - Faith Education` },
        { name: "description", content: `View programs, campuses, and admission details for ${uniName}.` },
        { property: "og:title", content: `${uniName} - Faith Education` },
        { property: "og:description", content: `Explore academic opportunities at ${uniName}.` },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
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
  const [totalApplicationsCount, setTotalApplicationsCount] = useState<number>(3241);
  const [loading, setLoading] = useState(true);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setLoadError(null);
    try {
      const [u, c, p, a, countRes] = await Promise.all([
        getUniversity(universityId),
        listCampuses(universityId),
        listPrograms({ universityId }),
        supabase.from("applications").select("id, application_code, status, program, student:students(full_name, student_code)").eq("university_id", universityId).order("created_at", { ascending: false }),
        supabase.from("applications").select("*", { count: 'exact', head: true }).eq("university_id", universityId),
      ]);
      setUni(u); setCampuses(c); setPrograms(p);
      setApplications((a.data as any[]) ?? []);
      if (countRes.count !== null) setTotalApplicationsCount(countRes.count);
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
    <div className="min-h-screen bg-[#F8FAFC] -mt-10 pt-10 px-8 pb-12 animate-in fade-in duration-700">
      <div className="mx-auto max-w-[1600px] space-y-10">
      {/* Back button and title */}
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" className="rounded-xl font-medium text-black hover:bg-slate-100" onClick={() => navigate({ to: "/universities" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      {/* Hero Section - Matched to Screenshot */}
      <Card className="rounded-[40px] border border-slate-100 bg-white p-12 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row gap-12 items-start md:items-center">
          <div className="flex h-36 w-64 shrink-0 items-center justify-center rounded-[32px] border border-slate-50 p-6 bg-white shadow-sm">
            {uni.logo_url ? (
              <img src={uni.logo_url} alt={uni.name} className="h-full w-full object-contain" />
            ) : (
              <Building2 className="h-20 w-20 text-slate-100" />
            )}
          </div>
          
          <div className="flex-1 space-y-6">
            <div className="flex flex-wrap items-center gap-5">
              <h1 className="text-[42px] font-medium text-slate-900 tracking-tighter leading-none">{uni.name}</h1>
              <Badge className="bg-[#2563EB] hover:bg-blue-700 text-white px-4 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-widest border-none shadow-sm">
                {uni.status === "active" ? "Active" : uni.status}
              </Badge>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-10 gap-y-4 text-base font-bold text-slate-600">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🇲🇾</span>
                <span className="font-medium text-slate-900">MY Malaysia</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-slate-400" />
                <span className="font-medium text-slate-900">{uni.city || "Negeri Sembilan"}</span>
              </div>
              {uni.website && (
                <a href={uni.website} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-blue-600 hover:text-blue-700 font-medium decoration-2 underline-offset-4 hover:underline">
                  <span>Website</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>

            <p className="text-[16px] leading-relaxed text-slate-500 max-w-4xl font-medium">
              {uni.description || `${uni.name} is a private university located in Malaysia. The main campus was initially known as INTI University College until 31 May 2010 when the Higher Education Ministry announced its upgrade to university status.`}
            </p>
          </div>

          <div className="flex gap-6">
            <div className="flex flex-col items-center justify-center px-10 py-8 rounded-[32px] bg-slate-50 border border-slate-50 min-w-[150px] shadow-sm">
              <span className="text-[40px] font-medium text-slate-900 leading-none tracking-tighter">4</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.25em] text-slate-400 mt-3">Campuses</span>
            </div>
            <div className="flex flex-col items-center justify-center px-10 py-8 rounded-[32px] bg-slate-50 border border-slate-50 min-w-[150px] shadow-sm">
              <span className="text-[40px] font-medium text-slate-900 leading-none tracking-tighter">155</span>
              <span className="text-[11px] font-medium uppercase tracking-[0.25em] text-slate-400 mt-3">Programs</span>
            </div>
          </div>
        </div>
      </Card>

      <Tabs defaultValue="programs" className="space-y-12">
        <TabsList className="bg-white border border-slate-200 shadow-sm w-full justify-start rounded-[32px] h-auto p-0 gap-16 px-14 overflow-hidden">
          <TabsTrigger 
            value="programs" 
            className="rounded-none border-b-[3px] border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 pt-10 pb-8 text-[19px] font-medium text-slate-500 transition-all hover:text-slate-900"
          >
            Programs ({programs.length})
          </TabsTrigger>
          <TabsTrigger 
            value="campuses" 
            className="rounded-none border-b-[3px] border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 pt-10 pb-8 text-[19px] font-medium text-slate-500 transition-all hover:text-slate-900"
          >
            Campuses ({campuses.length})
          </TabsTrigger>
          <TabsTrigger 
            value="applications" 
            className="rounded-none border-b-[3px] border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 pt-10 pb-8 text-[19px] font-medium text-slate-500 transition-all hover:text-slate-900"
          >
            Applications ({totalApplicationsCount.toLocaleString()})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="programs" className="mt-0 outline-none">
          <ProgramsTab universityId={universityId} programs={programs} campuses={campuses} canEdit={canEdit} onChange={reload} uni={uni} loading={loading} />
        </TabsContent>
        
        <TabsContent value="campuses" className="mt-0 outline-none">
          <CampusesTab universityId={universityId} campuses={campuses} canEdit={canEdit} onChange={reload} />
        </TabsContent>

        <TabsContent value="applications" className="mt-0 outline-none">
          <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-50 p-6">
              <CardTitle className="text-lg font-medium text-slate-900">Recent Applications</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {applications.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 mb-4">
                    <FileText className="h-8 w-8 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">No applications found</h3>
                  <p className="text-sm text-slate-500 mt-1">No students have applied to this university yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-slate-100">
                        <TableHead className="py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Application Code</TableHead>
                        <TableHead className="py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Student Name</TableHead>
                        <TableHead className="py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Program</TableHead>
                        <TableHead className="py-4 font-bold text-slate-500 uppercase text-[10px] tracking-wider">Status</TableHead>
                        <TableHead className="py-4 text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map((a) => (
                        <TableRow key={a.id} className="border-slate-50">
                          <TableCell className="py-4 font-mono text-xs font-bold text-blue-600">{a.application_code}</TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900">{a.student?.full_name ?? "—"}</span>
                              <span className="text-[10px] text-slate-400">{a.student?.student_code}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 font-medium text-slate-600 text-sm">{a.program}</TableCell>
                          <TableCell className="py-4">
                            <Badge variant="outline" className="rounded-full border-slate-200 px-3 py-1 font-bold text-[10px] uppercase text-slate-600">
                              {String(a.status).replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 text-right">
                            <Button size="sm" variant="ghost" className="rounded-xl font-bold hover:bg-blue-50 text-blue-600" asChild>
                              <Link to="/applications/$applicationId" params={{ applicationId: a.id }}>
                                View Details
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}


function HeroStatCard({ label, value, icon: Icon, color, growth }: { label: string; value: string | number; icon: any; color: string; growth?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    orange: 'bg-orange-50 text-orange-600 ring-orange-100',
    purple: 'bg-purple-50 text-purple-600 ring-purple-100',
    pink: 'bg-pink-50 text-pink-600 ring-pink-100',
    cyan: 'bg-cyan-50 text-cyan-600 ring-cyan-100',
  };

  return (
    <div className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl bg-[#F8FAFC] p-4 transition-all hover:bg-white hover:shadow-lg hover:shadow-slate-200/50 hover:ring-1 hover:ring-slate-100">
      <div className={cn("mb-1 flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110 shadow-sm", colors[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-[22px] font-medium tracking-tighter text-black">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-widest text-black">{label}</div>
      {growth && (
        <Badge className="absolute right-2 top-2 h-4 border-none bg-emerald-50 text-[8px] font-medium text-emerald-600 hover:bg-emerald-100 flex items-center gap-0.5 shadow-sm">
          <TrendingUp className="h-2 w-2" /> {growth}
        </Badge>
      )}
    </div>
  );
}

function AsideInfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-medium text-black uppercase tracking-widest">{label}</span>
        <span className="font-medium text-black">{value}</span>
      </div>
    </div>
  );
}

function QuickActionButton({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 p-3 transition-all hover:bg-primary/5 hover:text-primary">
      <Icon className="h-4 w-4" />
      <span className="text-[10px] font-medium uppercase tracking-widest">{label}</span>
    </button>
  );
}



function StatCard({ label, value, icon: Icon, color, growth }: { label: string; value: string | number; icon: any; color: 'blue' | 'emerald' | 'orange' | 'purple'; growth?: string }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 ring-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
    orange: 'bg-orange-50 text-orange-600 ring-orange-100',
    purple: 'bg-purple-50 text-purple-600 ring-purple-100',
  };

  return (
    <div className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-lg hover:shadow-slate-200/50 hover:ring-1 hover:ring-slate-300">
      <div className={cn("mb-1 flex h-10 w-10 items-center justify-center rounded-xl transition-transform group-hover:scale-110", colors[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="text-xl font-medium tracking-tight text-black">{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-widest text-black">{label}</div>
      {growth && (
        <Badge className="absolute right-2 top-2 h-4 border-none bg-emerald-100 text-[8px] font-bold text-emerald-700 hover:bg-emerald-100">
          {growth}
        </Badge>
      )}
    </div>
  );
}


/* ============ PROGRAMS ============ */
function ProgramsTab({ universityId, programs, campuses, canEdit, onChange, uni, loading }: {
  universityId: string; programs: UniversityProgram[]; campuses: Campus[];
  canEdit: boolean; onChange: () => void; uni: University | null;
  loading?: boolean;
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
    <>
    <div className="relative flex flex-col pt-8">
      {/* Filter Container */}
      <div className="bg-white rounded-[18px] p-5 shadow-[0_2px_10px_rgba(15,23,42,0.05)] mx-12">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex flex-wrap items-center gap-4 flex-1">
            {/* Search Box */}
            <div className="relative min-w-[360px] flex-1 max-w-md">
              <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
              <Input 
                placeholder="Search programs..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-12 h-[48px] rounded-full border-slate-200 bg-white text-sm font-medium placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-600/10 text-slate-900 shadow-none transition-all" 
              />
            </div>
            
            <Select value={degreeFilter} onValueChange={setDegreeFilter}>
              <SelectTrigger className="w-[180px] h-[46px] rounded-[14px] border-slate-100 bg-slate-50/50 font-medium text-slate-900 focus:ring-2 focus:ring-blue-600/10 shadow-none px-5 transition-all hover:bg-slate-100/80 group">
                <SelectValue placeholder="All degrees" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-slate-100 shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200">
                <SelectItem value="all" className="rounded-xl font-medium py-2.5">All degrees</SelectItem>
                {degrees.map(d => <SelectItem key={d} value={d} className="rounded-xl font-medium py-2.5">{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="h-[46px] rounded-[14px] bg-slate-50/50 font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 px-5 text-sm transition-all">
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            <Button variant="ghost" className="h-[46px] rounded-[14px] bg-slate-50/50 font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 px-5 text-sm transition-all">
              <Share2 className="mr-2 h-4 w-4" /> Import
            </Button>
            <Button variant="ghost" className="h-[46px] rounded-[14px] bg-slate-50/50 font-medium text-slate-600 hover:bg-blue-50 hover:text-blue-600 px-5 text-sm transition-all">
              <FileText className="mr-2 h-4 w-4" /> Template
            </Button>
            <Button 
              onClick={openNew} 
              className="h-[46px] rounded-[14px] bg-gradient-to-r from-[#2563EB] to-[#3B82F6] font-medium text-white shadow-lg shadow-blue-600/20 px-8 ml-2 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-blue-600/30 active:scale-[0.98]"
            >
              <Plus className="mr-2 h-5 w-5" /> Add Program
            </Button>
          </div>
        </div>

        {/* Filter Chips / Secondary Filters */}
        <div className="flex flex-wrap items-center gap-4 mt-5 pt-5 border-t border-slate-50">
          <FilterDropdown placeholder="All Faculties" />
          <FilterDropdown 
            placeholder="All Campuses" 
            options={campuses.map(c => ({ label: c.name, value: c.id }))}
          />
          <FilterDropdown 
            placeholder="Study Mode" 
            options={[
              { label: "Full-time", value: "full_time" },
              { label: "Part-time", value: "part_time" },
              { label: "Online", value: "online" }
            ]}
          />
          <FilterDropdown placeholder="All Intakes" />
          <FilterDropdown placeholder="All Scholarships" />
          <FilterDropdown placeholder="Sort by: Newest" />
          
          <div className="ml-auto flex items-center p-1 bg-slate-100/50 rounded-xl">
            <Button size="icon" variant="ghost" className="h-9 w-10 rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-slate-200/50 transition-all">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-9 w-10 rounded-lg text-slate-400 hover:bg-white/50 transition-all">
              <ListIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      <div className="mt-8 mb-2" />

    <div className="mt-8 pb-10">
      {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="h-[400px] rounded-3xl border-none shadow-sm ring-1 ring-slate-100 p-6 bg-white animate-pulse">
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <Skeleton className="h-5 w-16 rounded-lg" />
                      <Skeleton className="h-5 w-16 rounded-lg" />
                    </div>
                    <Skeleton className="h-10 w-10 rounded-full" />
                  </div>
                  <div className="flex gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                  <div className="pt-4 border-t border-slate-50">
                    <div className="grid grid-cols-3 gap-2">
                      <Skeleton className="h-10 w-full rounded-xl" />
                      <Skeleton className="h-10 w-full rounded-xl" />
                      <Skeleton className="h-10 w-full rounded-xl" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Skeleton className="h-11 flex-1 rounded-xl" />
                    <Skeleton className="h-11 w-11 rounded-xl" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          programs.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-24 text-center bg-white border-slate-200">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-50">
                <GraduationCap className="h-12 w-12 text-blue-600/40" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-2xl font-medium text-slate-900">No programs yet</h3>
                <p className="text-slate-500 font-medium">
                  Start tracking academic programs for this university by creating your first one.
                </p>
              </div>
              {canEdit && (
                <Button onClick={openNew} className="mt-4 rounded-xl shadow-lg shadow-blue-600/20 h-12 px-8 font-medium bg-blue-600 hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-[0.98]">
                  <Plus className="mr-2 h-5 w-5" /> Add Program Now
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed py-24 text-center bg-white border-slate-200">
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-50">
                <SearchX className="h-12 w-12 text-slate-300" />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-2xl font-medium text-slate-900">No matching programs</h3>
                <p className="text-slate-500 font-medium">
                  We couldn't find any programs matching your search or filters. Try adjusting your criteria.
                </p>
              </div>
              <div className="flex gap-3 mt-4">
                <Button variant="outline" className="rounded-xl px-8 h-12 font-bold border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => { setSearch(""); setDegreeFilter("all"); }}>
                  Clear all filters
                </Button>
                <Button onClick={openNew} className="rounded-xl shadow-lg shadow-blue-600/20 h-12 px-8 font-medium bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-5 w-5" /> Add New Program
                </Button>
              </div>
            </div>
          )
        ) : (
          <div className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 px-12">
              {displayed.map((p, idx) => {
                const universityName = uni?.name || "University";
                // Varied gradients for the premium grid look
                const cardGradients = [
                  "from-white to-[#FCFCFD]",
                  "from-white to-[#F8FAFF]",
                  "from-white to-[#FBFAFF]",
                  "from-white to-[#F8FFF9]"
                ];
                const gradient = cardGradients[idx % cardGradients.length];

                return (
                  <div 
                    key={p.id} 
                    className={cn(
                      "group relative flex flex-col overflow-hidden rounded-[20px] bg-gradient-to-br border border-[#E8ECF3] shadow-[0_2px_10px_rgba(15,23,42,0.05)] transition-all duration-300 ease-in-out hover:shadow-[0_16px_40px_rgba(37,99,235,0.15)] hover:border-[#3B82F6] hover:-translate-y-[6px]",
                      gradient
                    )}
                  >
                    <div className="flex flex-1 flex-col p-7">
                      <div className="mb-6 flex items-start justify-between">
                        <div className="space-y-4 w-full">
                          {/* Badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-orange-600">
                              <Star className="mr-1.5 h-3 w-3 fill-orange-500" /> Featured
                            </span>
                            {p.status === "active" && (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-emerald-600">
                                <Zap className="mr-1.5 h-3 w-3 fill-emerald-500" /> Active
                              </span>
                            )}
                          </div>
                          
                          {/* Title and Icon */}
                          <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50/50 shrink-0 ring-1 ring-blue-100/30 group-hover:bg-blue-600 transition-all duration-300">
                              <Activity className="h-7 w-7 text-blue-600 group-hover:text-white transition-colors" />
                            </div>
                            <div className="flex-1 pr-6">
                              <h3 className="text-[20px] font-bold leading-tight text-[#0F172A] line-clamp-2 min-h-[50px]">
                                {p.name}
                              </h3>
                              <p className="text-[14px] font-medium text-slate-500 mt-1">{universityName}</p>
                            </div>
                          </div>

                          {/* Meta Information */}
                          <div className="space-y-2 pt-2">
                            <div className="flex items-center gap-3 text-[14px] text-slate-600">
                              <GraduationCap className="h-4 w-4 text-blue-500" />
                              <span>{p.degree || "Bachelor's Degree"}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[14px] text-slate-600">
                              <Clock className="h-4 w-4 text-blue-500" />
                              <span>{p.duration || "3 Years (9 Semesters)"}</span>
                            </div>
                            <div className="flex items-center gap-3 text-[14px] text-slate-600">
                              <MapPin className="h-4 w-4 text-blue-500" />
                              <span>{p.campus_id ? campuses.find(c => c.id === p.campus_id)?.name : "Subang Campus"}</span>
                            </div>
                          </div>
                        </div>

                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all">
                          <Heart className="h-5 w-5" />
                        </Button>
                      </div>

                      {/* Tuition Stats Section */}
                      <div className="mt-6 pt-6 border-t border-[#E8ECF3]">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 text-center">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1">Tuition Fee</p>
                            <p className="text-[15px] font-bold text-blue-600">
                              {p.currency || "MYR"} {p.tuition_fee ? p.tuition_fee.toLocaleString() : "89,474"}
                            </p>
                          </div>
                          <div className="bg-emerald-50/30 rounded-xl p-3 border border-emerald-100/30 text-center">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1">Scholarship</p>
                            <p className="text-[15px] font-bold text-emerald-600">Up to 30%</p>
                          </div>
                          <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100 text-center">
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1">App. Fee</p>
                            <p className="text-[15px] font-bold text-[#0F172A]">{p.currency || "MYR"} {p.application_fee || "600"}</p>
                          </div>
                        </div>

                        {/* Intakes */}
                        <div className="mt-6 space-y-2">
                          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Next Intake</p>
                          <div className="flex flex-wrap gap-2">
                            {(p.intake || "January, April, August").split(",").map((intake, i) => (
                              <span key={i} className="rounded-full bg-blue-50 text-blue-600 px-3 py-1 text-[11px] font-medium border border-blue-100/50">
                                {intake.trim()}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Bottom Statistics */}
                        <div className="mt-8 grid grid-cols-3 gap-3">
                          <div className="bg-slate-50 rounded-xl p-2.5 text-center transition-all hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-100 group/stat">
                            <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1.5 mb-1">
                              <Users className="h-3 w-3" /> Applications
                            </p>
                            <p className="text-[15px] font-bold text-[#0F172A]">312</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2.5 text-center transition-all hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-100">
                            <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1.5 mb-1">
                              <PieChart className="h-3 w-3" /> Acceptance
                            </p>
                            <p className="text-[15px] font-bold text-[#0F172A]">62%</p>
                          </div>
                          <div className="bg-slate-50 rounded-xl p-2.5 text-center transition-all hover:bg-white hover:shadow-sm hover:ring-1 hover:ring-slate-100">
                            <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1.5 mb-1">
                              <ShieldCheck className="h-3 w-3" /> Visa Success
                            </p>
                            <p className="text-[15px] font-bold text-[#0F172A]">91%</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-8 flex gap-3">
                          <Button 
                            className="flex-1 h-[44px] rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-sm font-medium text-white hover:shadow-lg hover:shadow-blue-600/20 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate({ to: "/applications/new", search: { universityId, programId: p.id } });
                            }}
                          >
                            Create Application
                          </Button>
                          <Button 
                            variant="outline" 
                            className="flex-1 h-[44px] rounded-xl border-[#E8ECF3] text-sm font-medium text-slate-600 hover:border-[#3B82F6] hover:text-[#3B82F6] transition-all bg-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(p);
                            }}
                          >
                            View Details
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="h-[44px] w-[44px] shrink-0 rounded-full border-[#E8ECF3] text-slate-400 hover:border-[#3B82F6] transition-all bg-white">
                                <MoreHorizontal className="h-5 w-5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl border-slate-100 shadow-2xl p-2 min-w-[180px]">
                              <DropdownMenuItem onClick={() => openEdit(p)} className="rounded-xl font-medium py-2.5"><Pencil className="mr-3 h-4 w-4" /> Edit Program</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate({ to: "/applications/new", search: { universityId, programId: p.id } })} className="rounded-xl font-medium py-2.5 text-blue-600 bg-blue-50/50"><Plus className="mr-3 h-4 w-4" /> Apply Now</DropdownMenuItem>
                              <DropdownMenuSeparator className="my-2 bg-slate-100" />
                              <DropdownMenuItem onClick={() => setDeleteId(p.id)} className="rounded-xl font-medium py-2.5 text-rose-600 hover:bg-rose-50"><Trash2 className="mr-3 h-4 w-4" /> Delete Program</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-20 flex justify-center pb-12">
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-3xl border-2 border-slate-200 px-16 h-16 text-base font-medium text-slate-900 transition-all hover:bg-white hover:border-blue-600 hover:text-blue-600 hover:shadow-xl hover:shadow-blue-600/10 active:scale-95"
                >
                  Load More Programs
                </Button>
              </div>
            )}
          </div>
        )}
      </div>





      
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden border-none bg-[#F8FAFC] sm:rounded-[32px] shadow-2xl">
          <div className="relative overflow-hidden bg-primary px-8 py-10 text-primary-foreground">
            <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex items-center gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md shadow-inner">
                {editing ? <Pencil className="h-8 w-8 text-white" /> : <Plus className="h-8 w-8 text-white" />}
              </div>
              <DialogHeader className="text-left">
                <DialogTitle className="text-3xl font-medium tracking-tight text-white">
                  {editing ? "Edit Program" : "Create New Program"}
                </DialogTitle>
                <p className="text-lg text-primary-foreground/70">
                  {editing ? "Update existing program details" : "Add a new academic program to this institution"}
                </p>
              </DialogHeader>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-slate-200">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="md:col-span-2 space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Program Name <span className="text-primary">*</span></Label>
                <Input 
                  className="h-14 rounded-xl border-slate-100 bg-white px-5 text-lg font-bold shadow-sm focus-visible:ring-primary"
                  placeholder="e.g. Bachelor of Computer Science"
                  value={form.name ?? ""} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Degree Level</Label>
                <Input 
                  className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                  placeholder="e.g. Bachelor" 
                  value={form.degree ?? ""} 
                  onChange={(e) => setForm({ ...form, degree: e.target.value })} 
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Duration</Label>
                <Input 
                  className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                  placeholder="e.g. 4 Years" 
                  value={form.duration ?? ""} 
                  onChange={(e) => setForm({ ...form, duration: e.target.value })} 
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Campus</Label>
                <Select value={form.campus_id ?? "none"} onValueChange={(v) => setForm({ ...form, campus_id: v === "none" ? null : v })}>
                  <SelectTrigger className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm">
                    <SelectValue placeholder="Select campus" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl ring-1 ring-slate-100">
                    <SelectItem value="none" className="rounded-xl p-3 font-semibold">None / Online</SelectItem>
                    {campuses.map((c) => <SelectItem key={c.id} value={c.id} className="rounded-xl p-3 font-semibold">{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Intake Periods</Label>
                <Input 
                  className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                  placeholder="e.g. September, January" 
                  value={form.intake ?? ""} 
                  onChange={(e) => setForm({ ...form, intake: e.target.value })} 
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Application Deadline</Label>
                <div className="relative">
                  <Input 
                    type="date" 
                    className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                    value={form.application_deadline ?? ""} 
                    onChange={(e) => setForm({ ...form, application_deadline: e.target.value })} 
                  />
                  <Calendar className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="mb-6 flex items-center gap-4">
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Financial Information</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-3">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Annual Tuition Fee</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        className="h-12 rounded-xl border-slate-100 bg-white pl-11 font-bold shadow-sm"
                        value={form.tuition_fee ?? ""} 
                        onChange={(e) => setForm({ ...form, tuition_fee: e.target.value as any })} 
                      />
                      <DollarSign className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Currency</Label>
                    <Input 
                      className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                      value={form.currency ?? "USD"} 
                      onChange={(e) => setForm({ ...form, currency: e.target.value })} 
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Application Fee</Label>
                    <div className="relative">
                      <Input 
                        type="number" 
                        className="h-12 rounded-xl border-emerald-100 bg-emerald-50/30 pl-11 font-bold text-emerald-700 shadow-sm"
                        value={form.application_fee ?? ""} 
                        onChange={(e) => setForm({ ...form, application_fee: e.target.value as any })} 
                      />
                      <Landmark className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Registration Fee</Label>
                    <Input 
                      type="number" 
                      className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                      value={form.registration_fee ?? ""} 
                      onChange={(e) => setForm({ ...form, registration_fee: e.target.value as any })} 
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">EMGS Fee</Label>
                    <Input 
                      type="number" 
                      className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                      value={form.emgs_fee ?? ""} 
                      onChange={(e) => setForm({ ...form, emgs_fee: e.target.value as any })} 
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Other Fees</Label>
                    <Input 
                      type="number" 
                      className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                      value={form.others_fee ?? ""} 
                      onChange={(e) => setForm({ ...form, others_fee: e.target.value as any })} 
                    />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Scholarship Information</Label>
                <Input 
                  className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                  placeholder="e.g. 20% Merit Scholarship available"
                  value={form.scholarship ?? ""} 
                  onChange={(e) => setForm({ ...form, scholarship: e.target.value })} 
                />
              </div>

              <div className="md:col-span-2 space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Entry Requirements</Label>
                <Textarea 
                  className="min-h-[120px] rounded-2xl border-slate-100 bg-white p-4 font-medium shadow-sm focus-visible:ring-primary"
                  placeholder="Describe academic and language requirements..."
                  value={form.requirements ?? ""} 
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })} 
                />
              </div>

              <div className="md:col-span-2 space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Program Description</Label>
                <Textarea 
                  className="min-h-[160px] rounded-2xl border-slate-100 bg-white p-4 font-medium shadow-sm focus-visible:ring-primary"
                  placeholder="Detailed overview of the program curriculum and outcomes..."
                  value={form.description ?? ""} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Program Status</Label>
                <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v as UniStatus })}>
                  <SelectTrigger className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-2xl ring-1 ring-slate-100">
                    {UNI_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="rounded-xl p-3 font-semibold capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t bg-slate-50/50 p-6">
            <Button 
              variant="ghost" 
              onClick={() => setOpen(false)}
              className="rounded-xl px-6 font-bold text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </Button>
            <Button 
              onClick={save} 
              disabled={saving}
              className="rounded-xl px-10 font-medium shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all bg-[#2563EB] text-white hover:bg-blue-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    {editing ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                    <span>{editing ? "Update Program" : "Create Program"}</span>
                  </div>
                </>
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
    </div>
    </>
  );
}






function HeroMetaItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400">{label}</span>
      </div>
      <span className="text-sm font-bold text-slate-900">{value}</span>
    </div>
  );
}

function ActionIconButton({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <Button variant="outline" className="h-12 rounded-xl border-slate-200 bg-white px-6 font-bold text-slate-600 hover:bg-slate-50 transition-all hover:scale-[1.02]">
      <Icon className="mr-2 h-4 w-4 text-slate-400" /> {label}
    </Button>
  );
}

function OverviewItem({ icon: Icon, label, value, flag, isLink }: { icon: any; label: string; value: string; flag?: string; isLink?: boolean }) {
  return (
    <div className="flex items-center justify-between group cursor-default">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-400 group-hover:bg-primary/5 group-hover:text-primary transition-colors">
          <Icon className="h-4 w-4" />
        </div>
        <span className="text-sm font-bold text-slate-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {flag && <span className="text-sm">{flag}</span>}
        <span className={cn("text-sm font-medium text-slate-900", isLink && "text-primary hover:underline cursor-pointer")}>{value}</span>
        {isLink && <ExternalLink className="h-3 w-3 text-primary" />}
      </div>
    </div>
  );
}

function OverviewStat({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        {Icon && <Icon className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors" />}
        <span className="text-sm font-bold text-slate-400">{label}</span>
      </div>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

function IntakeItem({ label, days, status = 'primary' }: { label: string; days: string; status?: 'primary' | 'secondary' | 'muted' }) {
  const statusColors = {
    primary: "text-blue-600 bg-blue-50 shadow-sm shadow-blue-500/10",
    secondary: "text-emerald-600 bg-emerald-50 shadow-sm shadow-emerald-500/10",
    muted: "text-slate-500 bg-slate-100"
  };

  return (
    <div className="flex items-center justify-between group cursor-default">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-300 transition-colors group-hover:bg-blue-50 group-hover:text-blue-400">
          <Calendar className="h-5 w-5" />
        </div>
        <span className="text-base font-medium text-slate-900">{label}</span>
      </div>
      <span className={cn("text-[10px] font-medium uppercase tracking-widest px-3 py-1.5 rounded-xl", statusColors[status])}>
        {days}
      </span>
    </div>
  );
}


function SidebarAction({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <Button variant="ghost" className="w-full justify-start rounded-xl py-6 px-4 font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all group">
      <div className="mr-4 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      {label}
    </Button>
  );
}

function FilterSelect({ icon: Icon, placeholder, label, value, onValueChange, options }: { icon: any; placeholder?: string; label?: string; value: string; onValueChange: (v: string) => void; options: string[] }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-100 shadow-inner">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="min-w-[140px] h-12 rounded-xl border-slate-100 bg-slate-50 font-medium shadow-inner">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="rounded-2xl border-none shadow-2xl ring-1 ring-slate-100">
          <SelectItem value="all" className="rounded-xl p-3 font-semibold">{label || "All"}</SelectItem>
          {options.map((o) => <SelectItem key={o} value={o} className="rounded-xl p-3 font-semibold">{o}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterDropdown({ placeholder, value, onValueChange, options = [] }: { placeholder: string; value?: string; onValueChange?: (v: string) => void; options?: { label: string; value: string }[] }) {
  const isSelected = value && value !== "all";

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger 
        className={cn(
          "w-fit min-w-[130px] h-[46px] rounded-[14px] px-5 font-medium transition-all shadow-none outline-none group",
          isSelected 
            ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700" 
            : "border-slate-100 bg-slate-50/50 text-slate-600 hover:bg-blue-50 hover:text-blue-600"
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-2xl border-slate-100 shadow-2xl p-2 min-w-[200px] animate-in fade-in zoom-in-95 duration-200">
        <SelectItem value="all" className="rounded-xl font-medium py-2.5 focus:bg-slate-50">{placeholder}</SelectItem>
        {options.map(opt => (
          <SelectItem key={opt.value} value={opt.value} className="rounded-xl font-medium py-2.5 focus:bg-slate-50">{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ProgramMeta({ icon: Icon, value }: { icon: any; value: string }) {

  return (
    <div className="flex items-center gap-2 text-[10px] font-medium text-black">
      <Icon className="h-3.5 w-3.5 text-primary/40" />
      <span>{value}</span>
    </div>
  );
}

function ProgramStat({ label, value, isPrimary, isHighlight }: { label: string; value: string; isPrimary?: boolean; isHighlight?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-medium uppercase tracking-widest text-black">{label}</p>
      <p className={cn(
        "text-xs font-medium tracking-tight",
        isPrimary ? "text-primary text-sm" : isHighlight ? "text-emerald-500" : "text-black"
      )}>
        {value}
      </p>
    </div>
  );
}

function IntakeChip({ label }: { label: string }) {
  return (
    <Badge variant="secondary" className="bg-slate-50 text-black hover:bg-slate-100 border-none rounded-lg px-2 py-1 text-[10px] font-medium">
      {label}
    </Badge>
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
    </Card>
  );
}



