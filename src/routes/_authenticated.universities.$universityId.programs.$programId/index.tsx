import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Pencil, Trash2, GraduationCap, Clock, Calendar, MapPin,
  DollarSign, Award, BookOpen, Building2, Loader2, AlertCircle,
  Share2, FileText, Send, ChevronRight, Calculator, Info, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getProgram, getUniversity, deleteProgram, type UniversityProgram, type University } from "@/lib/universities";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/universities/$universityId/programs/$programId/")({
  head: () => ({
    meta: [
      { title: "Program Details — FaithAMS" },
      { name: "description", content: "View full program details including fees, intakes, requirements and scholarships." },
      { property: "og:title", content: "Program Details — FaithAMS" },
      { property: "og:description", content: "View full program details including fees, intakes, requirements and scholarships." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team"]}>
      <ProgramDetailsPage />
    </RoleGuard>
  ),
});

function Money({ currency, value }: { currency: string; value: number | null }) {
  return <span>{value != null ? `${currency} ${Number(value).toLocaleString()}` : "—"}</span>;
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:shadow-md"
    >
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="mt-0.5 text-[15px] font-bold text-slate-900">{value || "—"}</p>
      </div>
    </motion.div>
  );
}

function FeeItem({ label, currency, value, isTotal = false }: { label: string; currency: string; value: number | null; isTotal?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3 ${isTotal ? 'mt-2 border-t border-slate-100 pt-4' : ''}`}>
      <span className={`text-[13px] ${isTotal ? 'font-bold text-slate-900' : 'font-medium text-slate-500'}`}>{label}</span>
      <span className={`text-[14px] ${isTotal ? 'text-[16px] font-bold text-blue-600' : 'font-semibold text-slate-900'}`}>
        <Money currency={currency} value={value} />
      </span>
    </div>
  );
}

function SectionWrapper({ title, icon: Icon, children, className = "" }: { title: string; icon: any; children: React.ReactNode; className?: string }) {
  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={`rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8 ${className}`}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="text-[18px] font-bold text-slate-900">{title}</h2>
      </div>
      {children}
    </motion.section>
  );
}

function ProgramDetailsPage() {
  const { universityId, programId } = Route.useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState<UniversityProgram | null>(null);
  const [uni, setUni] = useState<University | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getProgram(programId), getUniversity(universityId)])
      .then(([p, u]) => {
        if (!active) return;
        setProgram(p);
        setUni(u);
        setError(null);
      })
      .catch((e) => active && setError(e?.message || "Could not load program"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [programId, universityId]);

  async function onDelete() {
    setDeleting(true);
    try {
      await deleteProgram(programId);
      toast.success("Program deleted");
      navigate({ to: "/universities/$universityId", params: { universityId } });
    } catch (e: any) {
      toast.error(e?.message || "Could not delete program");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-8 p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-xl" />
            <Skeleton className="h-10 w-24 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-[32px]" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-3xl lg:col-span-2" />
          <Skeleton className="h-96 rounded-3xl" />
        </div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertCircle className="h-10 w-10" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">{error || "Program not found"}</h2>
        <p className="max-w-xs text-slate-500">We couldn't find the program you're looking for. It might have been deleted or moved.</p>
        <Button asChild variant="outline" className="mt-2 rounded-xl">
          <Link to="/universities/$universityId" params={{ universityId }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to University
          </Link>
        </Button>
      </div>
    );
  }

  const currency = program.currency || "MYR";
  const intakes = (program.intake || "").split(",").map((s) => s.trim()).filter(Boolean);
  const fees = [
    { label: "Tuition Fee", value: program.tuition_fee },
    { label: "Application Fee", value: program.application_fee },
    { label: "Registration Fee", value: program.registration_fee },
    { label: "EMGS Fee", value: program.emgs_fee },
    { label: "Others Fee", value: program.others_fee },
  ];
  const total = fees.reduce<number>((a, v) => a + (Number(v.value) || 0), 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-6 pb-20">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button asChild variant="ghost" className="h-10 rounded-xl px-4 text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm">
          <Link to="/universities/$universityId" params={{ universityId }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to University
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 rounded-xl border-slate-200 text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm">
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button asChild variant="outline" className="h-10 rounded-xl border-slate-200 text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm">
            <Link to="/universities/$universityId/programs/$programId/edit" params={{ universityId, programId }}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button variant="outline" className="h-10 rounded-xl border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm sm:p-12 lg:p-16"
      >
        <div className="absolute top-0 right-0 -z-10 h-64 w-64 translate-x-1/4 -translate-y-1/4 rounded-full bg-blue-50/50 blur-3xl" />
        <div className="absolute bottom-0 left-0 -z-10 h-64 w-64 -translate-x-1/4 translate-y-1/4 rounded-full bg-indigo-50/50 blur-3xl" />
        
        <div className="relative z-10 flex flex-col items-start gap-6 lg:flex-row lg:items-center">
          {uni?.logo_url && (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-slate-100 bg-white p-3 shadow-sm lg:h-24 lg:w-24">
              <img src={uni.logo_url} alt={uni.name} className="max-h-full max-w-full object-contain" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                {program.degree || "Degree"}
              </Badge>
              <Badge variant="secondary" className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                {program.status}
              </Badge>
            </div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">{program.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px] font-medium text-slate-500">
              <span className="flex items-center gap-2">
                <Building2 className="h-4.5 w-4.5 text-blue-500" /> {uni?.name}
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="h-4.5 w-4.5 text-blue-500" /> {program.campus?.name || "Main Campus"}
              </span>
            </div>
          </div>
          <div className="mt-6 shrink-0 lg:mt-0">
            <Button className="h-14 rounded-2xl bg-blue-600 px-8 text-[16px] font-bold shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] hover:bg-blue-700 active:scale-[0.98]">
              Apply Now <Send className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="Degree Level" value={program.degree || "N/A"} color="bg-blue-600" />
        <StatCard icon={Clock} label="Duration" value={program.duration || "N/A"} color="bg-indigo-600" />
        <StatCard icon={Calendar} label="Deadline" value={program.application_deadline || "N/A"} color="bg-rose-600" />
        <StatCard icon={CheckCircle2} label="Status" value={program.status || "Active"} color="bg-emerald-600" />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content Area */}
        <div className="space-y-8 lg:col-span-2">
          {intakes.length > 0 && (
            <SectionWrapper title="Available Intakes" icon={Calendar}>
              <div className="flex flex-wrap gap-3">
                {intakes.map((i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 transition-colors hover:border-blue-200 hover:bg-blue-50">
                    <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    <span className="text-[14px] font-bold text-slate-700">{i}</span>
                  </div>
                ))}
              </div>
            </SectionWrapper>
          )}

          <SectionWrapper title="Entry Requirements" icon={BookOpen}>
            {program.requirements ? (
              <div
                className="prose prose-slate max-w-none text-[15px] leading-relaxed text-slate-600 prose-headings:text-slate-900 prose-strong:text-slate-900"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(program.requirements) }}
              />
            ) : (
              <div className="flex items-center gap-2 text-slate-400 italic">
                <Info className="h-4 w-4" /> No specific entry requirements provided.
              </div>
            )}
          </SectionWrapper>

          <SectionWrapper title="Description" icon={FileText}>
            {program.description ? (
              <div
                className="prose prose-slate max-w-none text-[15px] leading-relaxed text-slate-600 prose-headings:text-slate-900 prose-strong:text-slate-900"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(program.description) }}
              />
            ) : (
              <div className="flex items-center gap-2 text-slate-400 italic">
                <Info className="h-4 w-4" /> No description available for this program.
              </div>
            )}
          </SectionWrapper>

          {program.scholarship && (
            <SectionWrapper title="Scholarships" icon={Award} className="border-amber-100 bg-amber-50/20">
              <div
                className="prose prose-slate max-w-none text-[15px] leading-relaxed text-slate-700"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(program.scholarship) }}
              />
            </SectionWrapper>
          )}
        </div>

        {/* Sidebar Area */}
        <div className="space-y-8">
          {/* Fee Breakdown Card */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="sticky top-24 rounded-3xl border border-slate-100 bg-white p-8 shadow-sm"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Calculator className="h-5 w-5" />
                </div>
                <h2 className="text-[18px] font-bold text-slate-900">Fee Summary</h2>
              </div>
              <Badge variant="outline" className="rounded-lg border-blue-100 bg-blue-50 text-blue-600">
                {currency}
              </Badge>
            </div>

            <div className="space-y-1">
              {fees.map((fee, idx) => (
                <FeeItem key={idx} label={fee.label} currency={currency} value={fee.value} />
              ))}
              <FeeItem label="Estimated Total" currency={currency} value={total} isTotal />
            </div>

            {program.additional_others_fee && (
              <div className="mt-6 rounded-2xl bg-slate-50 p-4">
                <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <Info className="h-3 w-3" /> Additional Info
                </p>
                <div 
                  className="mt-2 text-[13px] leading-relaxed text-slate-600"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(program.additional_others_fee) }}
                />
              </div>
            )}

            <Button className="mt-8 w-full h-12 rounded-xl bg-blue-600 font-bold shadow-md shadow-blue-100 hover:bg-blue-700">
              Start Application
            </Button>
            <p className="mt-4 text-center text-[12px] text-slate-400">
              Prices are subject to change by the university.
            </p>
          </motion.div>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="max-w-[400px] rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Delete this program?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500">
              This action cannot be undone. All data associated with this program will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel className="flex-1 rounded-xl border-slate-200">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); onDelete(); }} className="flex-1 rounded-xl bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Delete Program"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}