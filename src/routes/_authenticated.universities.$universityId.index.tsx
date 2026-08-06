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
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Sticky Header with Breadcrumb and Actions */}
      <header className="sticky top-0 z-30 w-full border-b bg-white/80 backdrop-blur-md">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-4 overflow-hidden">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-9 w-9 shrink-0 rounded-xl hover:bg-slate-100" 
                asChild
              >
                <Link to="/universities">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <nav className="flex items-center gap-2 overflow-hidden text-sm font-medium">
                <Link to="/" className="text-muted-foreground hover:text-primary whitespace-nowrap">Dashboard</Link>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                <Link to="/universities" className="text-muted-foreground hover:text-primary whitespace-nowrap">Universities</Link>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                <span className="truncate text-slate-900">{uni.name}</span>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="hidden rounded-xl font-semibold sm:flex hover:bg-slate-50">
                <Share2 className="mr-2 h-4 w-4" /> Share
              </Button>
              <Button variant="outline" size="sm" className="hidden rounded-xl font-semibold sm:flex hover:bg-slate-50">
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
              <Button 
                className="rounded-xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                onClick={() => navigate({ to: "/applications/new", search: { universityId } })}
              >
                <Plus className="mr-2 h-4 w-4" /> Create Application
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8">
          {/* Hero Section */}
          <section className="relative overflow-hidden rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
            <div className="absolute right-0 top-0 -mr-12 -mt-12 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
            <div className="relative grid gap-8 lg:grid-cols-[1fr,400px]">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                  <div className="flex h-[100px] w-[100px] shrink-0 items-center justify-center rounded-2xl bg-white shadow-xl ring-1 ring-slate-100">
                    {uni.logo_url ? (
                      <img src={uni.logo_url} alt={uni.name} className="h-full w-full rounded-2xl object-cover" />
                    ) : (
                      <Building2 className="h-12 w-12 text-slate-300" />
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{uni.name}</h1>
                      <Badge className={cn(
                        "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
                        uni.status === "active" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-slate-500 hover:bg-slate-600"
                      )}>
                        {uni.status}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        {uni.country?.name || 'N/A'}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-sm font-medium text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{uni.city || 'N/A'}, {uni.country?.name || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span>Partner Since 2024</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <ShieldCheck className="h-4 w-4" />
                        <span>Verified Institution</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="max-w-2xl text-lg leading-relaxed text-slate-600">
                  {uni.description || 'A leading educational institution committed to academic excellence and global student success.'}
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  {uni.website && (
                    <Button asChild variant="outline" className="rounded-xl border-slate-200 bg-slate-50 font-bold hover:bg-slate-100">
                      <a href={uni.website} target="_blank" rel="noreferrer">
                        <Globe className="mr-2 h-4 w-4 text-primary" /> Visit Website <ExternalLink className="ml-2 h-3.5 w-3.5" />
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" className="rounded-xl border-slate-200 bg-slate-50 font-bold hover:bg-slate-100">
                    <Download className="mr-2 h-4 w-4 text-primary" /> Brochure
                  </Button>
                  {canEdit && (
                    <Button asChild variant="ghost" className="rounded-xl font-bold hover:bg-slate-100">
                      <Link to="/universities/$universityId/edit" params={{ universityId }}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit Profile
                      </Link>
                    </Button>
                  )}
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-4">
                <HeroStatCard label="Programs" value={programs.length} icon={GradIcon} color="blue" growth="+12%" />
                <HeroStatCard label="Campuses" value={campuses.length} icon={School} color="emerald" growth="0%" />
                <HeroStatCard label="Applications" value={applications.length} icon={FileText} color="orange" growth="+8%" />
                <HeroStatCard label="Students" value="1.2k" icon={Users} color="purple" growth="+15%" />
                <HeroStatCard label="Offer Letters" value="450" icon={Award} color="pink" growth="+5%" />
                <HeroStatCard label="Visa Success" value="98%" icon={Plane} color="cyan" growth="+2%" />
              </div>
            </div>
          </section>

          <div className="grid gap-8 lg:grid-cols-[1fr,360px]">
            <main className="min-w-0 space-y-8">
              <Tabs defaultValue="programs" className="w-full">
                <div className="sticky top-[72px] z-20 -mx-4 px-4 py-2 sm:mx-0 sm:px-0">
                  <TabsList className="h-14 w-full justify-start gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 sm:w-auto">
                    <TabsTrigger value="programs" className="rounded-xl px-8 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
                      Programs
                    </TabsTrigger>
                    <TabsTrigger value="campuses" className="rounded-xl px-8 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
                      Campuses
                    </TabsTrigger>
                    <TabsTrigger value="applications" className="rounded-xl px-8 font-bold data-[state=active]:bg-primary data-[state=active]:text-white">
                      Applications
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="programs" className="mt-8 outline-none">
                  <ProgramsTab
                    universityId={universityId} programs={programs}
                    campuses={campuses} canEdit={canEdit} onChange={reload}
                  />
                </TabsContent>

                <TabsContent value="campuses" className="mt-8 outline-none">
                  <CampusesTab universityId={universityId} campuses={campuses} canEdit={canEdit} onChange={reload} />
                </TabsContent>

                <TabsContent value="applications" className="mt-8 outline-none">
                  <Card className="rounded-[24px] border-none bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
                    <CardHeader className="border-b bg-slate-50/50 p-6">
                      <CardTitle className="text-xl font-bold">Linked Applications</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {applications.length === 0 ? (
                        <div className="flex flex-col items-center py-20 text-center">
                          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 mb-6">
                            <FileText className="h-10 w-10 text-slate-300" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-900">No applications found</h3>
                          <p className="mt-2 text-slate-500">No students have applied to this university yet.</p>
                          <Button className="mt-8 rounded-xl font-bold" onClick={() => navigate({ to: "/applications/new", search: { universityId } })}>
                            Start First Application
                          </Button>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-slate-100 bg-slate-50/50 hover:bg-slate-50/50">
                                <TableHead className="py-4 font-bold uppercase tracking-wider text-slate-500">Application Code</TableHead>
                                <TableHead className="py-4 font-bold uppercase tracking-wider text-slate-500">Student Name</TableHead>
                                <TableHead className="py-4 font-bold uppercase tracking-wider text-slate-500">Program</TableHead>
                                <TableHead className="py-4 font-bold uppercase tracking-wider text-slate-500">Status</TableHead>
                                <TableHead className="py-4"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {applications.map((a) => (
                                <TableRow key={a.id} className="group border-slate-50 transition-colors hover:bg-slate-50/80">
                                  <TableCell className="py-4 font-mono text-sm font-bold text-primary">{a.application_code}</TableCell>
                                  <TableCell className="py-4">
                                    <div className="flex flex-col">
                                      <span className="font-bold text-slate-900">{a.student?.full_name ?? "—"}</span>
                                      <span className="text-xs text-slate-400">{a.student?.student_code}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-4 font-medium text-slate-600">{a.program}</TableCell>
                                  <TableCell className="py-4">
                                    <Badge variant="outline" className="rounded-full border-slate-200 bg-white px-3 py-1 font-bold text-slate-600 capitalize">
                                      {String(a.status).replace(/_/g, " ")}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-4 text-right">
                                    <Button size="sm" variant="ghost" className="rounded-xl font-bold hover:bg-primary hover:text-white" asChild>
                                      <Link to="/applications/$applicationId" params={{ applicationId: a.id }}>
                                        View <ArrowRight className="ml-2 h-4 w-4" />
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
            </main>

            <aside className="space-y-8">
              <div className="sticky top-[100px] flex flex-col gap-6">
                <Card className="overflow-hidden rounded-[24px] border-none bg-white shadow-sm ring-1 ring-slate-200">
                  <div className="bg-slate-50/50 p-6 border-b">
                    <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">University Summary</h3>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="flex flex-col items-center text-center pb-6 border-b border-slate-50">
                      <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-lg ring-1 ring-slate-100">
                        {uni.logo_url ? (
                          <img src={uni.logo_url} alt={uni.name} className="h-full w-full rounded-3xl object-cover" />
                        ) : (
                          <Building2 className="h-10 w-10 text-slate-300" />
                        )}
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 leading-tight">{uni.name}</h4>
                      <p className="mt-1 text-sm font-medium text-slate-400">{uni.city}, {uni.country?.name}</p>
                    </div>

                    <div className="space-y-5">
                      <AsideInfoItem icon={GraduationCap} label="University Type" value="Public Research" />
                      <AsideInfoItem icon={Globe} label="Global Ranking" value="#142 Worldwide" />
                      <AsideInfoItem icon={Users} label="Int'l Students" value="28%" />
                      <AsideInfoItem icon={Calendar} label="Next Intake" value="September 2026" />
                    </div>

                    <div className="pt-6 border-t border-slate-50">
                      <h4 className="mb-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Quick Actions</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <QuickActionButton icon={Download} label="Brochure" />
                        <QuickActionButton icon={Printer} label="Print Page" />
                        <QuickActionButton icon={Share2} label="Share" />
                        <QuickActionButton icon={Heart} label="Favorite" />
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="group relative overflow-hidden rounded-[24px] border-none bg-primary p-6 text-white shadow-xl shadow-primary/20 transition-all hover:scale-[1.02]">
                  <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                  <div className="relative z-10">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
                      <TrendingUp className="h-6 w-6" />
                    </div>
                    <h3 className="text-xl font-bold">Premium Partner</h3>
                    <p className="mt-2 text-sm text-white/80 leading-relaxed">
                      This institution is part of our Elite Partnership Program, ensuring prioritized processing.
                    </p>
                    <Button variant="secondary" className="mt-6 w-full rounded-xl font-black text-primary hover:bg-white transition-colors">
                      View Exclusive Benefits
                    </Button>
                  </div>
                </Card>
              </div>
            </aside>
          </div>
        </div>
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
    <div className="group relative flex flex-col items-center justify-center gap-1 rounded-2xl bg-slate-50 p-4 transition-all hover:bg-white hover:shadow-lg hover:shadow-slate-200/50 hover:ring-1 hover:ring-slate-100">
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


      <Card className="rounded-[24px] border-none bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex flex-1 flex-wrap items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input 
                placeholder="Search programs..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
                className="pl-11 h-12 rounded-xl border-slate-100 bg-slate-50 focus-visible:ring-primary shadow-inner" 
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400 ring-1 ring-slate-100">
                <GraduationCap className="h-5 w-5" />
              </div>
              <Select value={degreeFilter} onValueChange={setDegreeFilter}>
                <SelectTrigger className="w-[180px] h-12 rounded-xl border-slate-100 bg-slate-50 font-semibold shadow-inner">
                  <SelectValue placeholder="Degree Level" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-none shadow-2xl ring-1 ring-slate-100">
                  <SelectItem value="all" className="rounded-xl p-3 font-semibold">All Degree Levels</SelectItem>
                  {degrees.map((d) => <SelectItem key={d} value={d} className="rounded-xl p-3 font-semibold">{d}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <CsvToolbar label="programs"
              onExport={() => exportProgramsCsv(universityId)}
              onPreview={canEdit ? (text) => previewProgramsCsv(text, universityId) : undefined}
              onImportDone={onChange}
              templateHeaders={["name","degree","duration","campus","intake","application_deadline","tuition_fee","currency","scholarship","requirements","description","status"]}
              templateName="programs-template" canImport={canEdit} />
            {canEdit && (
              <Button onClick={openNew} className="rounded-xl h-12 px-8 font-extrabold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
                <Plus className="mr-2 h-5 w-5" /> Add Program
              </Button>
            )}
          </div>
        </div>
      </Card>

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






function ProgramInfoLine({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">{label}</span>
        <span className="text-xs font-bold text-slate-700 leading-none">{value}</span>
      </div>
    </div>
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
    </Card>
  );
}



