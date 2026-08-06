import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { 
  ArrowLeft, Building2, ExternalLink, Plus, Pencil, Trash2, MapPin, 
  GraduationCap, Calendar, DollarSign, Award, Loader2, AlertCircle, 
  SearchX, Share2, Download, Printer, Copy, Heart, Globe, Users, 
  FileText, Briefcase, Plane, BookOpen, Clock, CheckCircle2, 
  ArrowRight, MoreVertical, LayoutGrid, List as ListIcon, 
  TrendingUp, Search, RotateCcw, Filter, ChevronRight,
  School, Book, UserCheck, Star, ShieldCheck, Flame, Zap, Trophy,
  History, PieChart, Activity, Info, Landmark, Languages, GraduationCap as GradIcon,
  MousePointer2, Share, Check
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
    <div className="min-h-screen bg-[#FDFDFF]">
      {/* Top Utility Header - ApplyBoard Style */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-100 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 rounded-2xl hover:bg-slate-50 hover:text-blue-600 transition-all" asChild>
                <Link to="/universities"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <nav className="hidden items-center gap-2 overflow-hidden text-sm font-semibold md:flex">
                <Link to="/" className="text-slate-400 hover:text-blue-600 transition-colors">Dashboard</Link>
                <ChevronRight className="h-4 w-4 text-slate-300" />
                <Link to="/universities" className="text-slate-400 hover:text-blue-600 transition-colors">Universities</Link>
                <ChevronRight className="h-4 w-4 text-slate-300" />
                <span className="truncate text-slate-900 font-bold">{uni.name}</span>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" className="h-11 rounded-2xl border-slate-200 font-bold text-slate-600 hover:bg-slate-50 hover:border-blue-200 transition-all"><Share2 className="mr-2 h-4 w-4" /> Share</Button>
              <Button className="h-11 rounded-2xl bg-blue-600 px-6 font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all" onClick={() => navigate({ to: "/applications/new", search: { universityId } })}>
                <Plus className="mr-2 h-5 w-5" /> Start Application
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          
          {/* Hero Section - Agency Style */}
          <section className="relative overflow-hidden rounded-[40px] bg-white p-8 shadow-xl shadow-slate-200/50 ring-1 ring-slate-100 lg:p-12">
            <div className="absolute right-0 top-0 -mr-24 -mt-24 h-96 w-96 rounded-full bg-blue-50/50 blur-3xl" />
            
            <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center">
              <div className="flex h-[180px] w-[180px] shrink-0 items-center justify-center rounded-[32px] bg-white p-4 shadow-2xl shadow-blue-100 ring-1 ring-slate-50 lg:h-[220px] lg:w-[220px]">
                {uni.logo_url ? (
                  <img src={uni.logo_url} alt={uni.name} className="h-full w-full object-contain" />
                ) : (
                  <Building2 className="h-20 w-20 text-slate-200" />
                )}
              </div>
              
              <div className="flex flex-1 flex-col gap-6">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">{uni.name}</h1>
                    <Badge className={cn("rounded-2xl px-4 py-1.5 text-xs font-bold uppercase tracking-widest border-none shadow-sm", 
                      uni.status === "active" ? "bg-emerald-500 text-white" : "bg-slate-500 text-white"
                    )}>
                      {uni.status === "active" ? "Verified Institution" : uni.status}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600"><MapPin className="h-4 w-4" /></div>
                      <span className="text-sm font-bold text-slate-600">{uni.city || 'Kuala Lumpur'}, Malaysia</span>
                    </div>
                    {uni.website && (
                      <a href={uni.website} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-blue-600 hover:underline">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50"><Globe className="h-4 w-4" /></div>
                        <span className="text-sm font-bold uppercase tracking-widest">Official Site</span>
                      </a>
                    )}
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600"><ShieldCheck className="h-4 w-4" /></div>
                      <span className="text-sm font-bold text-slate-600">Accredited by MQA & MOHE</span>
                    </div>
                  </div>
                </div>

                <p className="max-w-4xl text-lg leading-relaxed text-slate-500 font-medium">
                  {uni.description || 'Global leader in education excellence, providing world-class programs and career-oriented learning environments. Explore a diverse range of undergraduate and postgraduate degrees designed for the future.'}
                </p>

                <div className="flex flex-wrap gap-4 pt-4">
                  <Button size="lg" className="h-14 rounded-2xl bg-blue-600 px-8 font-black text-lg text-white shadow-xl shadow-blue-600/30 hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all" onClick={() => navigate({ to: "/applications/new", search: { universityId } })}>
                    Start Application <ArrowRight className="ml-2 h-6 w-6" />
                  </Button>
                  <Button size="lg" variant="outline" className="h-14 rounded-2xl border-slate-200 bg-white px-8 font-black text-lg text-slate-700 hover:bg-slate-50 hover:border-blue-200 transition-all">
                    View Programs <ChevronRight className="ml-1 h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* KPI Dashboard Section */}
          <section className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-8">
            <HeroStatCard label="Programs" value="155+" icon={GradIcon} color="blue" growth="Top Rated" />
            <HeroStatCard label="Campuses" value="04" icon={School} color="emerald" />
            <HeroStatCard label="Global Rank" value="#12" icon={Trophy} color="orange" growth="Trending" />
            <HeroStatCard label="Students" value="8.9k" icon={Users} color="purple" growth="+14%" />
            <HeroStatCard label="Faculties" value="12" icon={BookOpen} color="cyan" />
            <HeroStatCard label="Partners" value="24" icon={Briefcase} color="pink" />
            <HeroStatCard label="Offers" value="1.2k" icon={Award} color="blue" growth="+16%" />
            <HeroStatCard label="Visa Rate" value="98%" icon={Zap} color="emerald" growth="Elite" />
          </section>

          {/* Main Layout Grid */}
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1fr),340px] lg:grid-cols-[minmax(0,1fr),380px] xl:grid-cols-[minmax(0,1fr),420px] items-start">
            
            {/* Left Content Area */}
            <div className="flex flex-col gap-8 min-w-0">
              <Tabs defaultValue="programs" className="w-full">
                <div className="sticky top-[80px] z-20">
                  <TabsList className="h-16 w-full justify-start gap-3 rounded-[24px] bg-white p-2 shadow-xl shadow-slate-200/50 ring-1 ring-slate-100 sm:w-auto">
                    <TabsTrigger value="programs" className="rounded-2xl px-10 font-black text-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all group">
                      Programs 
                      <Badge className="ml-3 bg-slate-100 text-slate-500 font-black group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">155</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="campuses" className="rounded-2xl px-10 font-black text-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all group">
                      Campuses
                      <Badge className="ml-3 bg-slate-100 text-slate-500 font-black group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white">4</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="applications" className="rounded-2xl px-10 font-black text-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all group">
                      Activity
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="programs" className="mt-8 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <ProgramsTab universityId={universityId} programs={programs} campuses={campuses} canEdit={canEdit} onChange={reload} />
                </TabsContent>
                
                <TabsContent value="campuses" className="mt-8 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <CampusesTab universityId={universityId} campuses={campuses} canEdit={canEdit} onChange={reload} />
                </TabsContent>

                <TabsContent value="applications" className="mt-8 outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <Card className="rounded-[40px] border-none bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-100 overflow-hidden">
                    <CardHeader className="border-b border-slate-50 bg-slate-50/30 p-8">
                      <CardTitle className="text-2xl font-black text-slate-900">Recent Applications</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {applications.length === 0 ? (

                        <div className="flex flex-col items-center py-20 text-center"><div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 mb-6"><FileText className="h-10 w-10 text-slate-300" /></div><h3 className="text-lg font-bold text-slate-900">No applications found</h3><p className="mt-2 text-slate-500">No students have applied to this university yet.</p><Button className="mt-8 rounded-xl font-bold" onClick={() => navigate({ to: "/applications/new", search: { universityId } })}>Start First Application</Button></div>
                      ) : (
                        <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-slate-100 bg-slate-50/50 hover:bg-slate-50/50"><TableHead className="py-4 font-bold uppercase tracking-wider text-slate-500">Application Code</TableHead><TableHead className="py-4 font-bold uppercase tracking-wider text-slate-500">Student Name</TableHead><TableHead className="py-4 font-bold uppercase tracking-wider text-slate-500">Program</TableHead><TableHead className="py-4 font-bold uppercase tracking-wider text-slate-500">Status</TableHead><TableHead className="py-4"></TableHead></TableRow></TableHeader><TableBody>{applications.map((a) => <TableRow key={a.id} className="group border-slate-50 transition-colors hover:bg-slate-50/80"><TableCell className="py-4 font-mono text-sm font-bold text-blue-600">{a.application_code}</TableCell><TableCell className="py-4"><div className="flex flex-col"><span className="font-bold text-slate-900">{a.student?.full_name ?? "—"}</span><span className="text-xs text-slate-400">{a.student?.student_code}</span></div></TableCell><TableCell className="py-4 font-medium text-slate-600">{a.program}</TableCell><TableCell className="py-4"><Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 font-bold text-slate-600 capitalize">{String(a.status).replace(/_/g, " ")}</Badge></TableCell><TableCell className="py-4 text-right"><Button size="sm" variant="ghost" className="rounded-xl font-bold hover:bg-blue-600 hover:text-white" asChild><Link to="/applications/$applicationId" params={{ applicationId: a.id }}>View <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></TableCell></TableRow>)}</TableBody></Table></div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>

            <aside className="sticky top-[100px] flex flex-col gap-6">
              <Card className="rounded-[32px] border-none bg-white p-8 shadow-xl shadow-slate-200/50 ring-1 ring-slate-100">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-900">Institution Info</h3>
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl hover:bg-slate-50"><MoreVertical className="h-5 w-5 text-slate-400" /></Button>
                </div>
                <div className="space-y-5">
                  <OverviewItem icon={Globe} label="Country" value={uni.country?.name || "Malaysia"} flag="🇲🇾" />
                  <OverviewItem icon={MapPin} label="State/Province" value={uni.city || "Negeri Sembilan"} />
                  <OverviewItem icon={ExternalLink} label="Official Link" value="Visit University Site" isLink />
                  <div className="pt-6 mt-6 border-t border-slate-50 space-y-5">
                    <OverviewStat label="Active Programs" value="155" icon={GradIcon} />
                    <OverviewStat label="Verified Status" value="MQA Certified" icon={ShieldCheck} />
                    <OverviewStat label="Institution" value="Private Research" icon={Building2} />
                  </div>
                </div>
              </Card>

              <Card className="rounded-[32px] border-none bg-white p-8 shadow-xl shadow-slate-200/50 ring-1 ring-slate-100">
                <div className="mb-6 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm"><Calendar className="h-6 w-6" /></div>
                  <h3 className="text-xl font-black text-slate-900">Upcoming Intakes</h3>
                </div>
                <div className="space-y-4">
                  <IntakeItem label="January 2025" days="Applications Open" status="primary" />
                  <IntakeItem label="April 2025" days="Early Bird" status="secondary" />
                  <IntakeItem label="August 2025" days="Upcoming" status="muted" />
                </div>
                <Button variant="ghost" className="mt-8 w-full h-12 rounded-2xl font-black text-slate-500 hover:text-blue-600 hover:bg-blue-50">View Academic Calendar <ArrowRight className="ml-2 h-5 w-5" /></Button>
              </Card>

              <Card className="rounded-[32px] border-none bg-white p-8 shadow-xl shadow-slate-200/50 ring-1 ring-slate-100">
                <h3 className="mb-6 text-xl font-black text-slate-900">Student Services</h3>
                <div className="grid grid-cols-2 gap-3">
                  <SidebarAction icon={Plus} label="New Application" />
                  <SidebarAction icon={Plus} label="Add Program" />
                  <SidebarAction icon={Download} label="Export List" />
                  <SidebarAction icon={Share2} label="Share Profile" />
                </div>
              </Card>

              <Card className="group relative overflow-hidden rounded-[32px] border-none bg-blue-600 p-8 text-white shadow-2xl shadow-blue-600/30">
                <div className="absolute right-0 top-0 -mr-12 -mt-12 h-32 w-32 rounded-full bg-white/10 blur-2xl transition-transform group-hover:scale-150" />
                <h3 className="mb-6 text-xl font-black tracking-tight">Application Goal</h3>
                <div className="space-y-5">
                  <div className="flex justify-between text-sm font-black">
                    <span>3,241 <span className="text-blue-200 font-bold">of 5,000</span></span>
                    <span className="text-white">64%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-white/20">
                    <div className="h-full bg-white shadow-lg shadow-white/50 transition-all duration-1000" style={{ width: '64%' }} />
                  </div>
                  <p className="text-sm font-bold text-blue-100 leading-relaxed">Reach the 5,000 application milestone to unlock Elite Partner rewards.</p>
                </div>
              </Card>
            </aside>

          </div>
        </div>
      </main>
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
      <div className="text-[22px] font-black tracking-tighter text-slate-900">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      {growth && (
        <Badge className="absolute right-2 top-2 h-4 border-none bg-emerald-50 text-[8px] font-black text-emerald-600 hover:bg-emerald-100 flex items-center gap-0.5 shadow-sm">
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
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</span>
        <span className="font-bold text-slate-700">{value}</span>
      </div>
    </div>
  );
}

function QuickActionButton({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <button className="flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 p-3 transition-all hover:bg-primary/5 hover:text-primary">
      <Icon className="h-4 w-4" />
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
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
      <div className="text-xl font-black tracking-tight text-slate-900">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</div>
      {growth && (
        <Badge className="absolute right-2 top-2 h-4 border-none bg-emerald-100 text-[8px] font-bold text-emerald-700 hover:bg-emerald-100">
          {growth}
        </Badge>
      )}
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


      <div className="relative overflow-hidden rounded-[32px] bg-white p-8 shadow-xl shadow-slate-200/50 ring-1 ring-slate-100">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-blue-50/30 blur-3xl" />
        <div className="relative flex flex-col gap-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative flex-1 min-w-[320px]">
              <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <Input 
                placeholder="Search programs by name, degree or keyword..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-14 h-14 rounded-2xl border-none bg-slate-50 text-base font-medium placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-blue-600/20 shadow-inner" 
              />
            </div>
            <div className="flex items-center gap-3">
              <Button size="icon" variant="ghost" className="h-14 w-14 rounded-2xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20">
                <LayoutGrid className="h-6 w-6" />
              </Button>
              <Button size="icon" variant="ghost" className="h-14 w-14 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 ring-1 ring-slate-100 shadow-inner">
                <ListIcon className="h-6 w-6" />
              </Button>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 pt-6 border-t border-slate-50">
            <FilterSelect icon={GraduationCap} placeholder="All Degrees" value={degreeFilter} onValueChange={setDegreeFilter} options={degrees} />
            <FilterSelect icon={Building2} placeholder="All Faculties" value="all" onValueChange={() => {}} options={[]} />
            <FilterSelect icon={MapPin} label="All Campuses" placeholder="All Campuses" value="all" onValueChange={() => {}} options={[]} />
            <FilterSelect icon={Calendar} label="All Intakes" placeholder="All Intakes" value="all" onValueChange={() => {}} options={[]} />
            
            <div className="ml-auto flex items-center gap-4">
              <Button variant="ghost" className="h-12 rounded-2xl font-black text-slate-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => { setSearch(""); setDegreeFilter("all"); }}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reset Filters
              </Button>
            </div>
          </div>
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
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {displayed.map((p) => (
                <div key={p.id} className="group relative flex flex-col overflow-hidden rounded-[32px] bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-100 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-600/10">
                  <div className="absolute right-0 top-0 h-24 w-24 translate-x-12 -translate-y-12 rounded-full bg-blue-50 transition-transform group-hover:scale-150" />
                  
                  <div className="flex flex-1 flex-col p-8">
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="inline-flex items-center rounded-xl bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-blue-600 shadow-sm shadow-blue-500/5">
                            {p.degree || "Bachelor's Degree"}
                          </span>
                          {p.status === 'active' && (
                            <Badge className="h-5 border-none bg-emerald-500 text-white text-[10px] font-black px-2.5 uppercase tracking-widest rounded-xl shadow-sm shadow-emerald-500/20">
                              Active
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-xl font-black tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors leading-tight min-h-[56px] line-clamp-2">
                          {p.name}
                        </h3>
                      </div>
                      
                      <div className="relative flex flex-col gap-2 items-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-10 w-10 rounded-2xl hover:bg-slate-50 text-slate-400">
                              <MoreVertical className="h-5 w-5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-2xl border-none shadow-2xl ring-1 ring-slate-100 p-2">
                            <DropdownMenuItem onClick={() => openEdit(p)} className="rounded-xl font-bold py-2.5"><Pencil className="mr-3 h-4 w-4" /> Edit Program</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate({ to: "/applications/new", search: { universityId, programId: p.id } })} className="rounded-xl font-bold py-2.5 text-blue-600 focus:text-blue-600"><Plus className="mr-3 h-4 w-4" /> Apply Now</DropdownMenuItem>
                            <DropdownMenuSeparator className="my-2 bg-slate-50" />
                            <DropdownMenuItem onClick={() => setDeleteId(p.id)} className="rounded-xl font-bold py-2.5 text-destructive focus:text-destructive"><Trash2 className="mr-3 h-4 w-4" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl text-slate-200 hover:text-rose-500 hover:bg-rose-50 transition-all hover:scale-110 group/heart">
                          <Heart className="h-5 w-5 absolute opacity-0 group-hover/heart:opacity-10" fill="currentColor" />
                          <Heart className="h-5 w-5" />
                        </Button>

                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400"><Clock className="h-4 w-4" /></div>
                        <span>{p.duration || '3 Years'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm font-bold text-slate-500">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-400"><Calendar className="h-4 w-4" /></div>
                        <span>{p.intake || 'Multiple'}</span>
                      </div>
                    </div>

                    <div className="mt-auto pt-6 border-t border-slate-50">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Tuition</p>
                          <p className="text-2xl font-black text-blue-600 tracking-tight">
                            {p.currency || 'MYR'} {p.tuition_fee ? p.tuition_fee.toLocaleString() : '89,474'}
                          </p>
                        </div>
                        <Button 
                          size="lg" 
                          className="rounded-[20px] font-black bg-blue-600 text-white hover:bg-blue-700 hover:shadow-xl hover:shadow-blue-600/30 transition-all px-6 h-12 group/btn"
                          onClick={() => navigate({ to: "/applications/new", search: { universityId, programId: p.id } })}
                        >
                          Apply <ArrowRight className="ml-2 h-5 w-5 group-hover/btn:translate-x-1 transition-transform" />
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
                <DialogTitle className="text-3xl font-black tracking-tight text-white">
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
                <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Program Name <span className="text-primary">*</span></Label>
                <Input 
                  className="h-14 rounded-xl border-slate-100 bg-white px-5 text-lg font-bold shadow-sm focus-visible:ring-primary"
                  placeholder="e.g. Bachelor of Computer Science"
                  value={form.name ?? ""} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Degree Level</Label>
                <Input 
                  className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                  placeholder="e.g. Bachelor" 
                  value={form.degree ?? ""} 
                  onChange={(e) => setForm({ ...form, degree: e.target.value })} 
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Duration</Label>
                <Input 
                  className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                  placeholder="e.g. 4 Years" 
                  value={form.duration ?? ""} 
                  onChange={(e) => setForm({ ...form, duration: e.target.value })} 
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Campus</Label>
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
                <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Intake Periods</Label>
                <Input 
                  className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                  placeholder="e.g. September, January" 
                  value={form.intake ?? ""} 
                  onChange={(e) => setForm({ ...form, intake: e.target.value })} 
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Application Deadline</Label>
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
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-primary">Financial Information</span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Annual Tuition Fee</Label>
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
                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Currency</Label>
                    <Input 
                      className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                      value={form.currency ?? "USD"} 
                      onChange={(e) => setForm({ ...form, currency: e.target.value })} 
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Application Fee</Label>
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
                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Registration Fee</Label>
                    <Input 
                      type="number" 
                      className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                      value={form.registration_fee ?? ""} 
                      onChange={(e) => setForm({ ...form, registration_fee: e.target.value as any })} 
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">EMGS Fee</Label>
                    <Input 
                      type="number" 
                      className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                      value={form.emgs_fee ?? ""} 
                      onChange={(e) => setForm({ ...form, emgs_fee: e.target.value as any })} 
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Other Fees</Label>
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
                <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Scholarship Information</Label>
                <Input 
                  className="h-12 rounded-xl border-slate-100 bg-white px-4 font-bold shadow-sm"
                  placeholder="e.g. 20% Merit Scholarship available"
                  value={form.scholarship ?? ""} 
                  onChange={(e) => setForm({ ...form, scholarship: e.target.value })} 
                />
              </div>

              <div className="md:col-span-2 space-y-3">
                <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Entry Requirements</Label>
                <Textarea 
                  className="min-h-[120px] rounded-2xl border-slate-100 bg-white p-4 font-medium shadow-sm focus-visible:ring-primary"
                  placeholder="Describe academic and language requirements..."
                  value={form.requirements ?? ""} 
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })} 
                />
              </div>

              <div className="md:col-span-2 space-y-3">
                <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Program Description</Label>
                <Textarea 
                  className="min-h-[160px] rounded-2xl border-slate-100 bg-white p-4 font-medium shadow-sm focus-visible:ring-primary"
                  placeholder="Detailed overview of the program curriculum and outcomes..."
                  value={form.description ?? ""} 
                  onChange={(e) => setForm({ ...form, description: e.target.value })} 
                />
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Program Status</Label>
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
              className="rounded-xl px-10 font-black shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-5 w-5" />
                  {editing ? "Update Program" : "Create Program"}
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

  );
}






function HeroMetaItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
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
        <span className={cn("text-sm font-black text-slate-900", isLink && "text-primary hover:underline cursor-pointer")}>{value}</span>
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
      <span className="text-sm font-black text-slate-900">{value}</span>
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
        <span className="text-base font-black text-slate-900">{label}</span>
      </div>
      <span className={cn("text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl", statusColors[status])}>
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
        <SelectTrigger className="min-w-[140px] h-12 rounded-xl border-slate-100 bg-slate-50 font-black shadow-inner">
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

function ProgramMeta({ icon: Icon, value }: { icon: any; value: string }) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
      <Icon className="h-3.5 w-3.5 text-primary/40" />
      <span>{value}</span>
    </div>
  );
}

function ProgramStat({ label, value, isPrimary, isHighlight }: { label: string; value: string; isPrimary?: boolean; isHighlight?: boolean }) {
  return (
    <div className="space-y-1">
      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={cn(
        "text-xs font-black tracking-tight",
        isPrimary ? "text-primary text-sm" : isHighlight ? "text-emerald-500" : "text-slate-900"
      )}>
        {value}
      </p>
    </div>
  );
}

function IntakeChip({ label }: { label: string }) {
  return (
    <Badge variant="secondary" className="bg-slate-50 text-slate-600 hover:bg-slate-100 border-none rounded-lg px-2 py-1 text-[10px] font-bold">
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



