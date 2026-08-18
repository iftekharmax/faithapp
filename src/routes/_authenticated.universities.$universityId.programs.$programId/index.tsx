import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Pencil, Trash2, GraduationCap, Clock, Calendar, MapPin,
  DollarSign, Award, BookOpen, Building2, Loader2, AlertCircle,
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

function FeeCard({ label, currency, value, tone }: { label: string; currency: string; value: number | null; tone: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-1.5 text-[15px] font-semibold text-slate-900">
        <Money currency={currency} value={value} />
      </p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <p className="truncate text-[13px] font-semibold text-slate-900">{value || "—"}</p>
      </div>
    </div>
  );
}

function RichSection({ title, icon: Icon, html }: { title: string; icon: any; html: string | null }) {
  if (!html || !String(html).replace(/<[^>]*>/g, "").trim()) return null;
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold text-slate-900">
        <Icon className="h-4.5 w-4.5 text-blue-600" /> {title}
      </h2>
      <div
        className="prose prose-sm max-w-none text-slate-600"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }}
      />
    </section>
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
      <div className="space-y-6 p-6">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm font-semibold text-slate-600">{error || "Program not found"}</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/universities/$universityId" params={{ universityId }}>Back to university</Link>
        </Button>
      </div>
    );
  }

  const currency = program.currency || "MYR";
  const intakes = (program.intake || "").split(",").map((s) => s.trim()).filter(Boolean);
  const total = [program.tuition_fee, program.application_fee, program.registration_fee, program.emgs_fee, program.others_fee]
    .reduce<number>((a, v) => a + (Number(v) || 0), 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" className="h-10 rounded-xl px-3 text-slate-600">
          <Link to="/universities/$universityId" params={{ universityId }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="h-10 rounded-xl">
            <Link to="/universities/$universityId/programs/$programId/edit" params={{ universityId, programId }}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
          <Button variant="outline" className="h-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      {/* Hero */}
      <div className="rounded-[28px] border border-slate-100 bg-gradient-to-br from-white to-slate-50 p-8 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {program.degree && (
            <Badge className="rounded-lg border-none bg-blue-600 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
              {program.degree}
            </Badge>
          )}
          <Badge variant="secondary" className="rounded-lg border-none bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
            {program.status}
          </Badge>
        </div>
        <h1 className="mt-4 text-[28px] font-bold leading-tight text-slate-900">{program.name}</h1>
        {uni && (
          <p className="mt-2 flex items-center gap-2 text-[14px] font-medium text-slate-500">
            <Building2 className="h-4 w-4 text-blue-500/70" /> {uni.name}
          </p>
        )}
      </div>

      {/* Key info */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoRow icon={GraduationCap} label="Degree" value={program.degree || ""} />
        <InfoRow icon={Clock} label="Duration" value={program.duration || ""} />
        <InfoRow icon={MapPin} label="Campus" value={program.campus?.name || ""} />
        <InfoRow icon={Calendar} label="Application Deadline" value={program.application_deadline || ""} />
      </div>

      {intakes.length > 0 && (
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold text-slate-900">
            <Calendar className="h-4.5 w-4.5 text-blue-600" /> Intakes
          </h2>
          <div className="flex flex-wrap gap-2">
            {intakes.map((i) => (
              <Badge key={i} variant="secondary" className="rounded-lg border-none bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                {i}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Fees */}
      <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold text-slate-900">
          <DollarSign className="h-4.5 w-4.5 text-blue-600" /> Fees
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FeeCard label="Tuition Fee" currency={currency} value={program.tuition_fee} tone="border-blue-100 bg-blue-50/60" />
          <FeeCard label="Application Fee" currency={currency} value={program.application_fee} tone="border-slate-100 bg-slate-50" />
          <FeeCard label="Registration Fee" currency={currency} value={program.registration_fee} tone="border-slate-100 bg-slate-50" />
          <FeeCard label="EMGS Fee" currency={currency} value={program.emgs_fee} tone="border-slate-100 bg-slate-50" />
          <FeeCard label="Others Fee" currency={currency} value={program.others_fee} tone="border-slate-100 bg-slate-50" />
          <FeeCard label="Estimated Total" currency={currency} value={total || null} tone="border-emerald-100 bg-emerald-50/60" />
        </div>
      </section>

      <RichSection title="Additional Others Fee" icon={DollarSign} html={program.additional_others_fee} />
      <RichSection title="Scholarship" icon={Award} html={program.scholarship} />
      <RichSection title="Entry Requirements" icon={BookOpen} html={program.requirements} />
      <RichSection title="Description" icon={BookOpen} html={program.description} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this program?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); onDelete(); }} className="rounded-xl bg-red-600 hover:bg-red-700">
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
