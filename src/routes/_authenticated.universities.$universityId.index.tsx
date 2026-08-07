import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { 
  ArrowLeft, Building2, ExternalLink, Plus, MapPin, 
  GraduationCap, Calendar, DollarSign, Award, Loader2, AlertCircle, 
  SearchX, Share2, Download, FileText, Clock, CheckCircle2, 
  Search, List as ListIcon, LayoutGrid, Zap, Star, Activity, UserCheck, ShieldCheck, Pencil, Trash2, Heart, MoreHorizontal, Landmark, Languages, Check, ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator 
} from "@/components/ui/dropdown-menu";
import {
  getUniversity, listCampuses, listPrograms, createProgram, updateProgram, deleteProgram,
  DuplicateError,
  type University, type Campus, type UniversityProgram, UNI_STATUSES, type UniStatus,
} from "@/lib/universities";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
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

  if (loading) return <div className="p-8 text-center">Loading university details...</div>;
  if (loadError || !uni) return <div className="p-8 text-center text-red-500">{loadError ?? "Not found"}</div>;

  return (
    <div className="mx-auto max-w-[1600px] space-y-8 animate-in fade-in duration-500 px-4 py-8">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="sm" className="rounded-xl font-bold text-slate-500" onClick={() => navigate({ to: "/universities" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>

      <Card className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm overflow-hidden">
        <div className="flex flex-col md:flex-row gap-8 items-start md:items-center">
          <div className="flex h-24 w-48 shrink-0 items-center justify-center rounded-2xl border border-slate-100 p-2">
            {uni.logo_url ? <img src={uni.logo_url} alt={uni.name} className="h-full w-full object-contain" /> : <Building2 className="h-12 w-12 text-slate-200" />}
          </div>
          <div className="flex-1 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">{uni.name}</h1>
              <Badge className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {uni.status === "active" ? "Active" : uni.status}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-bold text-slate-500">
              <div className="flex items-center gap-2"><span>🇲🇾</span><span>Malaysia</span></div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-slate-400" /><span>{uni.city || "Negeri Sembilan"}</span></div>
              {uni.website && <a href={uni.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline"><span>Website</span><ExternalLink className="h-3 w-3" /></a>}
            </div>
            <p className="text-sm leading-relaxed text-slate-500 max-w-4xl">{uni.description}</p>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col items-center justify-center px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 min-w-[100px]">
              <span className="text-2xl font-black text-slate-900">{campuses.length}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Campuses</span>
            </div>
            <div className="flex flex-col items-center justify-center px-6 py-4 rounded-2xl bg-slate-50 border border-slate-100 min-w-[100px]">
              <span className="text-2xl font-black text-slate-900">{programs.length}</span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Programs</span>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-col gap-6">
        <Tabs defaultValue="programs" className="space-y-6">
          <TabsList className="bg-transparent border-b border-slate-200 w-full justify-start rounded-none h-auto p-0 gap-10">
            <TabsTrigger value="programs" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 pb-4 text-sm font-semibold text-slate-500 transition-all hover:text-slate-700">
              Programs <span className="ml-1.5 text-slate-400">({programs.length})</span>
            </TabsTrigger>
            <TabsTrigger value="campuses" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 pb-4 text-sm font-semibold text-slate-500 transition-all hover:text-slate-700">
              Campuses <span className="ml-1.5 text-slate-400">({campuses.length})</span>
            </TabsTrigger>
            <TabsTrigger value="applications" className="rounded-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 px-0 pb-4 text-sm font-semibold text-slate-500 transition-all hover:text-slate-700">
              Applications <span className="ml-1.5 text-slate-400">({applications.length.toLocaleString()})</span>
            </TabsTrigger>
          </TabsList>

          <hr className="border-slate-200" />

          <div className="flex flex-wrap items-center gap-3">
            <Button className="h-10 rounded-lg bg-[#2563EB] font-semibold text-white hover:bg-blue-700 shadow-sm px-6" onClick={() => navigate({ to: "/applications/new", search: { universityId } })}>
              <Plus className="mr-2 h-4 w-4" /> Create Application
            </Button>
            <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white font-semibold text-blue-600 hover:bg-slate-50 px-6" onClick={() => navigate({ to: "/universities/$universityId/programs/new", params: { universityId } })}>
              <Plus className="mr-2 h-4 w-4" /> Add Program
            </Button>
            <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white font-semibold text-slate-600 hover:bg-slate-50 px-5">
              <Download className="mr-2 h-4 w-4" /> Export Programs
            </Button>
            <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white font-semibold text-slate-600 hover:bg-slate-50 px-5">
              <Plus className="mr-2 h-4 w-4" /> Import Programs
            </Button>
            <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white font-semibold text-slate-600 hover:bg-slate-50 px-5">
              <FileText className="mr-2 h-4 w-4" /> Template
            </Button>
            <Button variant="outline" className="h-10 rounded-lg border-slate-200 bg-white font-semibold text-slate-600 hover:bg-slate-50 px-5">
              <Share2 className="mr-2 h-4 w-4" /> Share University
            </Button>
          </div>

          <TabsContent value="programs" className="mt-0 outline-none">
            <ProgramsTab universityId={universityId} programs={programs} campuses={campuses} canEdit={canEdit} onChange={reload} uni={uni} />
          </TabsContent>
          
          <TabsContent value="campuses" className="mt-0 outline-none">
            {/* CampusesTab implementation here */}
          </TabsContent>

          <TabsContent value="applications" className="mt-0 outline-none">
            <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <CardHeader className="border-b border-slate-50 p-6">
                <CardTitle className="text-lg font-black text-slate-900">Recent Applications</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
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
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProgramsTab({ universityId, programs, uni, openNew, openEdit, setDeleteId, campuses }: any) {
    const navigate = useNavigate();
    return (
        <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-1 flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[320px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input placeholder="Search programs..." className="pl-9 h-10 rounded-lg border-slate-200 bg-white text-sm font-medium placeholder:text-slate-400" />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button className="h-10 rounded-lg bg-[#2563EB] font-semibold text-white px-5" onClick={openNew}>
                  <Plus className="mr-2 h-4 w-4" /> Add program
                </Button>
              </div>
            </div>
            {/* Card Grid */}
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {programs.map((p: any) => (
                <div key={p.id} className="group relative flex flex-col overflow-hidden rounded-3xl bg-white border border-slate-100 shadow-sm p-6">
                    <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                    <div className="mt-4 flex gap-3">
                        <Button className="flex-1 rounded-xl bg-blue-600 font-bold text-white" onClick={() => navigate({ to: "/applications/new", search: { universityId, programId: p.id } })}>Apply</Button>
                        <Button variant="outline" onClick={() => openEdit(p)}>Edit</Button>
                    </div>
                </div>
              ))}
            </div>
        </div>
    )
}

