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
      className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md hover:-translate-y-1"
    >
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${color} bg-opacity-10`}>
        <Icon className={`h-6 w-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-1 text-[16px] font-bold text-slate-900">{value || "—"}</p>
      </div>
    </motion.div>
  );
}

function FeeItem({ label, currency, value, isTotal = false }: { label: string; currency: string; value: number | null; isTotal?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-3.5 ${isTotal ? 'mt-4 border-t border-slate-100 pt-5' : 'border-b border-slate-50 last:border-0'}`}>
      <span className={`text-[14px] ${isTotal ? 'font-bold text-slate-900' : 'font-medium text-slate-500'}`}>{label}</span>
      <span className={`text-[15px] ${isTotal ? 'text-[18px] font-bold text-blue-600' : 'font-bold text-slate-900'}`}>
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
      className={`rounded-[32px] border border-slate-100 bg-white p-8 shadow-sm sm:p-10 ${className}`}
    >
      <div className="mb-8 flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner">
          <Icon className="h-6 w-6" />
        </div>
        <h2 className="text-[20px] font-bold tracking-tight text-slate-900">{title}</h2>
      </div>
      <div className="pl-0 sm:pl-2">
        {children}
      </div>
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
      .catch((e) => active && setError(e?.message || "No se pudo cargar el programa"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [programId, universityId]);

  async function onDelete() {
    setDeleting(true);
    try {
      await deleteProgram(programId);
      toast.success("Programa eliminado");
      navigate({ to: "/universities/$universityId", params: { universityId } });
    } catch (e: any) {
      toast.error(e?.message || "No se pudo eliminar el programa");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl space-y-10 p-6 md:p-10">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-32 rounded-xl" />
          <div className="flex gap-3">
            <Skeleton className="h-10 w-28 rounded-xl" />
            <Skeleton className="h-10 w-28 rounded-xl" />
          </div>
        </div>
        <Skeleton className="h-72 w-full rounded-[40px]" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-3xl" />)}
        </div>
        <div className="grid gap-10 lg:grid-cols-3">
          <Skeleton className="h-[500px] rounded-[32px] lg:col-span-2" />
          <Skeleton className="h-[400px] rounded-[32px]" />
        </div>
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-50 text-red-600 shadow-xl shadow-red-100/50">
          <AlertCircle className="h-12 w-12" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900">{error || "Programa no encontrado"}</h2>
          <p className="max-w-md mx-auto text-slate-500">Lo sentimos, no pudimos encontrar el programa que estás buscando. Es posible que haya sido eliminado o movido.</p>
        </div>
        <Button asChild variant="outline" className="mt-4 h-12 rounded-2xl px-6 font-semibold border-slate-200">
          <Link to="/universities/$universityId" params={{ universityId }}>
            <ArrowLeft className="mr-2 h-5 w-5" /> Volver a la Universidad
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
    <div className="mx-auto w-full max-w-6xl space-y-10 p-6 pb-24 md:p-10">
      {/* Top Header Actions */}
      <div className="flex flex-wrap items-center justify-between gap-6">
        <Button asChild variant="ghost" className="h-11 rounded-2xl px-5 text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-sm border border-transparent hover:border-slate-100 transition-all">
          <Link to="/universities/$universityId" params={{ universityId }}>
            <ArrowLeft className="mr-2.5 h-5 w-5" /> Volver a Universidad
          </Link>
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="hidden sm:flex h-11 rounded-2xl border-slate-200 text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-md transition-all">
            <Share2 className="mr-2.5 h-4.5 w-4.5" /> Compartir
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-2xl border-slate-200 text-slate-600 hover:bg-white hover:text-blue-600 hover:shadow-md transition-all">
            <Link to="/universities/$universityId/programs/$programId/edit" params={{ universityId, programId }}>
              <Pencil className="mr-2.5 h-4.5 w-4.5" /> Editar
            </Link>
          </Button>
          <Button variant="outline" className="h-11 rounded-2xl border-red-100 text-red-600 hover:bg-red-50 hover:text-red-700 hover:shadow-md transition-all" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2.5 h-4.5 w-4.5" /> Eliminar
          </Button>
        </div>
      </div>

      {/* Modern Hero Section */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-[40px] border border-slate-100 bg-white p-10 shadow-lg shadow-slate-200/40 sm:p-14 lg:p-20"
      >
        <div className="absolute top-0 right-0 -z-10 h-80 w-80 translate-x-1/4 -translate-y-1/4 rounded-full bg-blue-50/60 blur-[100px]" />
        <div className="absolute bottom-0 left-0 -z-10 h-80 w-80 -translate-x-1/4 translate-y-1/4 rounded-full bg-indigo-50/60 blur-[100px]" />
        
        <div className="relative z-10 flex flex-col items-start gap-10 lg:flex-row lg:items-center">
          {uni?.logo_url ? (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-slate-100 bg-white p-5 shadow-xl shadow-slate-200/30 lg:h-32 lg:w-32">
              <img src={uni.logo_url} alt={uni.name} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-slate-100 bg-slate-50 lg:h-32 lg:w-32">
              <Building2 className="h-10 w-10 text-slate-300" />
            </div>
          )}
          <div className="flex-1 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-full bg-blue-600 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-white shadow-lg shadow-blue-200">
                {program.degree || "Título"}
              </Badge>
              <Badge variant="secondary" className="rounded-full bg-emerald-50 px-4 py-1.5 text-[11px] font-extrabold uppercase tracking-widest text-emerald-600 border border-emerald-100">
                {program.status || "Activo"}
              </Badge>
            </div>
            <h1 className="text-4xl font-[900] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl leading-[1.1]">{program.name}</h1>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[16px] font-semibold text-slate-500">
              <span className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-blue-500" /> {uni?.name}
              </span>
              <span className="flex items-center gap-2.5">
                <MapPin className="h-5 w-5 text-blue-500" /> {program.campus?.name || "Campus Principal"}
              </span>
            </div>
          </div>
          <div className="mt-4 shrink-0 lg:mt-0 lg:ml-6">
            <Button className="h-16 rounded-2xl bg-blue-600 px-10 text-[18px] font-[800] shadow-2xl shadow-blue-200 transition-all hover:scale-[1.03] hover:bg-blue-700 active:scale-[0.97] group">
              Aplicar Ahora <Send className="ml-3 h-6 w-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Visual Quick Facts Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={GraduationCap} label="Nivel Académico" value={program.degree || "N/A"} color="bg-blue-600" />
        <StatCard icon={Clock} label="Duración Estimada" value={program.duration || "N/A"} color="bg-indigo-600" />
        <StatCard icon={Calendar} label="Fecha Límite" value={program.application_deadline || "N/A"} color="bg-rose-600" />
        <StatCard icon={CheckCircle2} label="Disponibilidad" value={program.status || "Activo"} color="bg-emerald-600" />
      </div>

      <div className="grid gap-10 lg:grid-cols-3">
        {/* Detail Sections */}
        <div className="space-y-10 lg:col-span-2">
          {intakes.length > 0 && (
            <SectionWrapper title="Próximas Convocatorias" icon={Calendar}>
              <div className="flex flex-wrap gap-4">
                {intakes.map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-3 transition-all hover:border-blue-200 hover:bg-blue-50 hover:shadow-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[15px] font-bold text-slate-700">{i}</span>
                  </div>
                ))}
              </div>
            </SectionWrapper>
          )}

          <SectionWrapper title="Requisitos de Ingreso" icon={BookOpen}>
            {program.requirements ? (
              <div
                className="prose prose-slate max-w-none text-[16px] leading-[1.7] text-slate-600 prose-headings:text-slate-900 prose-strong:text-slate-900 prose-p:mb-4"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(program.requirements) }}
              />
            ) : (
              <div className="flex items-center gap-3 text-slate-400 italic bg-slate-50/50 p-6 rounded-2xl border border-dashed border-slate-200">
                <Info className="h-5 w-5" /> No se han especificado requisitos de ingreso detallados.
              </div>
            )}
          </SectionWrapper>

          <SectionWrapper title="Descripción del Programa" icon={FileText}>
            {program.description ? (
              <div
                className="prose prose-slate max-w-none text-[16px] leading-[1.7] text-slate-600 prose-headings:text-slate-900 prose-strong:text-slate-900 prose-p:mb-4"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(program.description) }}
              />
            ) : (
              <div className="flex items-center gap-3 text-slate-400 italic bg-slate-50/50 p-6 rounded-2xl border border-dashed border-slate-200">
                <Info className="h-5 w-5" /> No hay una descripción disponible para este programa en este momento.
              </div>
            )}
          </SectionWrapper>

          {program.scholarship && (
            <SectionWrapper title="Becas y Ayudas" icon={Award} className="border-amber-100 bg-gradient-to-br from-white to-amber-50/30">
              <div
                className="prose prose-slate max-w-none text-[16px] leading-[1.7] text-slate-700 prose-strong:text-amber-900"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(program.scholarship) }}
              />
            </SectionWrapper>
          )}
        </div>

        {/* Sidebar Sticky Panel */}
        <div className="space-y-10">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="sticky top-28 rounded-[32px] border border-slate-100 bg-white p-10 shadow-xl shadow-slate-200/30"
          >
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-inner">
                  <Calculator className="h-6 w-6" />
                </div>
                <h2 className="text-[20px] font-bold text-slate-900 tracking-tight">Costos</h2>
              </div>
              <Badge variant="outline" className="rounded-xl border-blue-100 bg-blue-50 px-3 py-1 text-[13px] font-bold text-blue-600">
                {currency}
              </Badge>
            </div>

            <div className="space-y-1">
              {fees.map((fee, idx) => (
                <FeeItem key={idx} label={fee.label} currency={currency} value={fee.value} />
              ))}
              <FeeItem label="Total Estimado" currency={currency} value={total} isTotal />
            </div>

            {program.additional_others_fee && (
              <div className="mt-8 rounded-2xl bg-slate-50/80 p-5 border border-slate-100">
                <p className="flex items-center gap-2.5 text-[12px] font-[800] uppercase tracking-wider text-slate-400">
                  <Info className="h-4 w-4" /> Notas adicionales
                </p>
                <div 
                  className="mt-3 text-[14px] leading-relaxed text-slate-600 italic"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(program.additional_others_fee) }}
                />
              </div>
            )}

            <Button className="mt-10 w-full h-14 rounded-2xl bg-blue-600 text-[16px] font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all hover:shadow-blue-200">
              Iniciar Aplicación
            </Button>
            <p className="mt-5 text-center text-[13px] font-medium text-slate-400">
              * Los precios están sujetos a cambios por parte de la universidad.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Refined Alert Dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="max-w-[420px] rounded-[32px] p-8">
          <AlertDialogHeader className="space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600 mx-auto">
              <Trash2 className="h-8 w-8" />
            </div>
            <AlertDialogTitle className="text-2xl font-bold text-center">¿Eliminar este programa?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-center text-[15px] leading-relaxed">
              Esta acción no se puede deshacer. Se eliminarán permanentemente todos los datos asociados a este programa de nuestros registros.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8 gap-3 sm:flex-row">
            <AlertDialogCancel className="flex-1 h-12 rounded-2xl border-slate-200 font-semibold">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); onDelete(); }} className="flex-1 h-12 rounded-2xl bg-red-600 font-bold hover:bg-red-700 shadow-lg shadow-red-100 transition-all">
              {deleting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Sí, Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}