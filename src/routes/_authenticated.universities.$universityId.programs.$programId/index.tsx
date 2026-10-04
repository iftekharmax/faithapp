import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Pencil, Trash2, GraduationCap, Clock, Calendar, MapPin,
  DollarSign, Award, BookOpen, Building2, Loader2, AlertCircle,
  Calculator, Star, ChevronDown, ChevronUp, Home, Trophy, Check,
  Globe, Languages, FileCheck, TrendingUp, Landmark, User,
  Settings, HeartPulse, Coins,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getProgram, getUniversity, deleteProgram, type UniversityProgram, type University } from "@/lib/universities";
import { RoleGuard } from "@/components/layout/RoleGuard";

export const Route = createFileRoute("/_authenticated/universities/$universityId/programs/$programId/")(
  {
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
  },
);

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtMoney(currency: string, value: number | null | undefined): string | null {
  if (value == null || Number(value) === 0) return null;
  return `${currency} ${Number(value).toLocaleString()}`;
}

// ─── sub-components ─────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  iconBg = "bg-blue-600",
  iconColor = "text-white",
  isRounded = false,
}: {
  icon: React.ElementType;
  title: string;
  iconBg?: string;
  iconColor?: string;
  isRounded?: boolean;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className={`flex h-10 w-10 items-center justify-center shadow-sm ${iconBg} ${iconColor} ${
          isRounded ? "rounded-full" : "rounded-xl"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">{title}</h2>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="group flex items-center gap-3.5 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 transition-transform duration-200 group-hover:scale-105">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-[15px] font-bold text-slate-800">{value || "—"}</p>
      </div>
    </div>
  );
}

type FeeCardProps = {
  label: string;
  amount: string;
  icon: React.ElementType;
  bgClass: string;
  borderClass: string;
  iconBgClass: string;
  iconColorClass: string;
};

function FeeItemCard({
  label,
  amount,
  icon: Icon,
  bgClass,
  borderClass,
  iconBgClass,
  iconColorClass,
}: FeeCardProps) {
  return (
    <div
      className={`group flex items-center gap-3.5 rounded-2xl border p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${bgClass} ${borderClass}`}
    >
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-105 ${iconBgClass} ${iconColorClass}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-slate-500 leading-snug truncate">{label}</p>
        <p className="mt-0.5 text-[16px] font-bold text-slate-900">{amount}</p>
      </div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl animate-pulse space-y-5 p-4 sm:p-6">
      <Skeleton className="h-4 w-64 rounded-lg" />
      <Skeleton className="h-64 w-full rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-3xl" />
      <Skeleton className="h-64 w-full rounded-3xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    </div>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

function ProgramDetailsPage() {
  const { universityId, programId } = Route.useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState<UniversityProgram | null>(null);
  const [uni, setUni] = useState<University | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const [reqExpanded, setReqExpanded] = useState(false);

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
    return () => {
      active = false;
    };
  }, [programId, universityId]);

  async function onDelete() {
    setDeleting(true);
    try {
      await deleteProgram(programId);
      toast.success("Program deleted");
      navigate({ to: "/universities/$universityId", params: { universityId } });
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete program");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) return <PageSkeleton />;

  if (error || !program) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <p className="text-sm font-semibold text-slate-600">{error || "Program not found"}</p>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/universities/$universityId" params={{ universityId }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to University
          </Link>
        </Button>
      </div>
    );
  }

  // ── derived values ──────────────────────────────────────────────────────────
  const currency = program.currency || "MYR";
  const rawIntakes = (program.intake || "").split(",").map((s) => s.trim()).filter((s) => Boolean(s) && s.toLowerCase() !== "n/a");
  const intakes = rawIntakes.length > 0 ? rawIntakes : ["March", "July", "September"];

  const othersFees = (program as any).others_fees || [];
  const total = [
    program.tuition_fee,
    program.application_fee,
    program.registration_fee,
    program.emgs_fee,
    program.others_fee,
    ...othersFees.map((f: any) => f.amount),
  ].reduce<number>((a, v) => a + (Number(v) || 0), 0);

  const hasTuitionFee = Number(program.tuition_fee) > 0;
  const hasApplicationFee = Number(program.application_fee) > 0;
  const hasRegistrationFee = Number(program.registration_fee) > 0;
  const hasEmgsFee = Number(program.emgs_fee) > 0;
  const hasOthersFee = Number(program.others_fee) > 0;
  const validOthersFees = othersFees.filter((f: any) => Number(f?.amount) > 0);

  const hasFees =
    hasTuitionFee ||
    hasApplicationFee ||
    hasRegistrationFee ||
    hasEmgsFee ||
    hasOthersFee ||
    validOthersFees.length > 0 ||
    total > 0;

  // Build fee cards matching screenshot pastel colors and icons
  type FeeCardConfig = {
    label: string;
    amount: string;
    icon: React.ElementType;
    bgClass: string;
    borderClass: string;
    iconBgClass: string;
    iconColorClass: string;
  };

  const feeCardsList: FeeCardConfig[] = [];

  if (hasTuitionFee) {
    feeCardsList.push({
      label: "Tuition Fee",
      amount: fmtMoney(currency, program.tuition_fee)!,
      icon: GraduationCap,
      bgClass: "bg-[#eff6ff]",
      borderClass: "border-blue-100",
      iconBgClass: "bg-blue-100",
      iconColorClass: "text-blue-600",
    });
  }

  if (hasEmgsFee) {
    feeCardsList.push({
      label: "EMGS Fee",
      amount: fmtMoney(currency, program.emgs_fee)!,
      icon: TrendingUp,
      bgClass: "bg-[#f0fdf4]",
      borderClass: "border-emerald-100",
      iconBgClass: "bg-emerald-100",
      iconColorClass: "text-emerald-600",
    });
  }

  if (hasApplicationFee) {
    feeCardsList.push({
      label: "International Student Registration & Administration Fee",
      amount: fmtMoney(currency, program.application_fee)!,
      icon: Landmark,
      bgClass: "bg-[#fdf2f8]",
      borderClass: "border-pink-100",
      iconBgClass: "bg-pink-100",
      iconColorClass: "text-pink-600",
    });
  }

  if (hasRegistrationFee) {
    feeCardsList.push({
      label: "Library Deposit (Refundable)",
      amount: fmtMoney(currency, program.registration_fee)!,
      icon: BookOpen,
      bgClass: "bg-[#fffbeb]",
      borderClass: "border-amber-100",
      iconBgClass: "bg-amber-100",
      iconColorClass: "text-amber-600",
    });
  }

  if (hasOthersFee) {
    feeCardsList.push({
      label: "Personal Bond (Refundable)",
      amount: fmtMoney(currency, program.others_fee)!,
      icon: User,
      bgClass: "bg-[#ecfeff]",
      borderClass: "border-cyan-100",
      iconBgClass: "bg-cyan-100",
      iconColorClass: "text-cyan-600",
    });
  }

  // Map remaining others fees with pastel configurations
  const fallbackStyles = [
    { bg: "bg-[#f5f3ff]", border: "border-purple-100", iconBg: "bg-purple-100", iconColor: "text-purple-600", icon: Settings },
    { bg: "bg-[#fff1f2]", border: "border-rose-100", iconBg: "bg-rose-100", iconColor: "text-rose-600", icon: HeartPulse },
    { bg: "bg-[#f0fdfa]", border: "border-teal-100", iconBg: "bg-teal-100", iconColor: "text-teal-600", icon: Award },
  ];

  validOthersFees.forEach((f: any, idx: number) => {
    const st = fallbackStyles[idx % fallbackStyles.length];
    feeCardsList.push({
      label: f.title || "Other Fee",
      amount: fmtMoney(currency, f.amount)!,
      icon: st.icon,
      bgClass: st.bg,
      borderClass: st.border,
      iconBgClass: st.iconBg,
      iconColorClass: st.iconColor,
    });
  });

  const isActive = program.status === "active";

  // Calculation items for Additional Others Fee
  const calcItems: { label: string; amount: number }[] = [];
  if (hasTuitionFee) calcItems.push({ label: "Tuition Fee", amount: Number(program.tuition_fee) });
  if (hasEmgsFee) calcItems.push({ label: "EMGS Fee", amount: Number(program.emgs_fee) });
  const otherSum = (hasOthersFee ? Number(program.others_fee) : 0) + (hasRegistrationFee ? Number(program.registration_fee) : 0) + (hasApplicationFee ? Number(program.application_fee) : 0) + validOthersFees.reduce((a: number, b: any) => a + (Number(b?.amount) || 0), 0);
  if (otherSum > 0) calcItems.push({ label: "Others Fee", amount: otherSum });

  // Scholarship calculation
  const scholarshipDiscount = 0.30;
  const tuitionVal = Number(program.tuition_fee) || 31600;
  const tuitionAfterScholarship = Math.round(tuitionVal * (1 - scholarshipDiscount));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 text-slate-800">

      {/* ── 1. Hero Card ────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#0a1e60] via-[#12368c] to-[#1e40af] p-6 sm:p-8 shadow-xl min-h-[280px] flex flex-col justify-between">
        {/* Right-side campus image with gradient mask */}
        <div className="absolute right-0 top-0 bottom-0 w-[55%] md:w-[50%] lg:w-[48%] pointer-events-none select-none overflow-hidden">
          <img
            src="/images/programs/hero_campus.jpg"
            alt="University Campus"
            className="h-full w-full object-cover object-center"
          />
          {/* Smooth gradient blend from blue hero to campus photo */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#12368c] via-[#12368c]/35 to-transparent" />
          {/* Bottom wave vignette */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0a1e60]/80 via-transparent to-transparent" />
        </div>

        {/* Cursive quote in bottom-right corner */}
        <div className="absolute bottom-5 right-6 md:right-10 text-right pointer-events-none select-none z-10 hidden sm:block">
          <p className="font-['Caveat',cursive] text-white text-2xl md:text-[28px] font-bold italic leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-wide">
            Build Your<br />Global Career
          </p>
          <svg className="w-28 h-4 ml-auto text-white/90 drop-shadow" viewBox="0 0 100 20" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 14 Q 50 20 95 8" strokeLinecap="round" />
          </svg>
        </div>

        {/* Top bar: Breadcrumb + Action Buttons */}
        <div className="relative z-20 flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[12px] font-medium text-white/85">
            <Home className="h-3.5 w-3.5" />
            <span>&gt;</span>
            <Link to="/programs" className="hover:text-white transition-colors">Programs</Link>
            <span>&gt;</span>
            <span className="max-w-[180px] sm:max-w-[260px] truncate text-white font-semibold">
              {program.name}
            </span>
          </nav>

          {/* Action buttons (Clean white pill buttons from screenshot) */}
          <div className="flex items-center gap-2">
            <Button
              asChild
              size="sm"
              className="h-8.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-semibold px-4 shadow-sm border border-white/60 text-[13px] gap-1.5 transition-all"
            >
              <Link to="/universities/$universityId/programs/$programId/edit" params={{ universityId, programId }}>
                <Pencil className="h-3.5 w-3.5 text-slate-600" /> Edit
              </Link>
            </Button>
            <Button
              size="sm"
              className="h-8.5 rounded-xl bg-white hover:bg-red-50 text-red-600 font-semibold px-4 shadow-sm border border-red-100 text-[13px] gap-1.5 transition-all"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500" /> Delete
            </Button>
          </div>
        </div>

        {/* Middle & Bottom: Badges + Program Title + University */}
        <div className="relative z-20 mt-6 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            {program.degree && (
              <span className="inline-flex items-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                {program.degree}
              </span>
            )}
            <span
              className={`inline-flex items-center rounded-full px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm ${
                isActive ? "bg-[#10b981]" : "bg-slate-500"
              }`}
            >
              {program.status}
            </span>
          </div>

          <h1 className="mt-3 text-2xl sm:text-3xl md:text-[34px] font-extrabold text-white leading-[1.2] tracking-tight drop-shadow-sm">
            {program.name}
          </h1>

          {uni && (
            <p className="mt-3 flex items-center gap-2 text-[14px] font-semibold text-white/95 drop-shadow-sm">
              <Building2 className="h-4 w-4 text-blue-200" />
              <span>{uni.name}</span>
            </p>
          )}
        </div>
      </div>

      {/* ── 2. Quick Information Cards (4 in a row) ─────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard icon={GraduationCap} label="Degree" value={program.degree || "—"} />
        <InfoCard icon={Clock} label="Duration" value={program.duration || "—"} />
        <InfoCard icon={MapPin} label="Campus" value={program.campus?.name || "—"} />
        <InfoCard icon={Calendar} label="Application Deadline" value={program.application_deadline || "—"} />
      </div>

      {/* ── 3. Intakes Section ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-blue-100/70 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-purple-50/70 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Left: Title + Pills */}
          <div>
            <SectionHeader icon={Calendar} title="Intakes" iconBg="bg-blue-600" />
            <div className="mt-2 flex flex-wrap gap-2.5">
              {intakes.map((intake, idx) => (
                <span
                  key={intake}
                  className={`inline-flex items-center rounded-xl px-5 py-2 text-[13px] font-semibold transition-all duration-200 ${
                    idx === 0
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-300"
                      : "border border-slate-200/80 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 shadow-xs"
                  }`}
                >
                  {intake}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Playful handwritten cursive note + Arrow + Calendar Icon */}
          <div className="hidden sm:flex items-center gap-4 select-none pointer-events-none ml-auto">
            <div className="text-right">
              <p className="font-['Caveat',cursive] text-purple-600 text-2xl font-bold italic leading-tight">
                Multiple Intakes<br />More Opportunities
              </p>
            </div>
            {/* Hand-drawn style purple arrow */}
            <svg className="w-10 h-8 text-purple-500 transform rotate-12" viewBox="0 0 50 40" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 10 Q 25 12 40 28 M 40 28 L 30 28 M 40 28 L 36 18" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* Decorative Calendar Outline */}
            <div className="w-14 h-14 rounded-2xl border-2 border-purple-200 bg-purple-100/60 p-2 flex flex-col justify-between opacity-80 shadow-xs">
              <div className="flex gap-1 justify-center">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <div className="w-2 h-2 rounded-full bg-purple-400" />
              </div>
              <div className="grid grid-cols-3 gap-1 p-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-1 rounded-sm bg-purple-400/70" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. Fees Section ─────────────────────────────────────────────────── */}
      {hasFees && (
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <SectionHeader icon={DollarSign} title="Fees" iconBg="bg-blue-600" isRounded />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {feeCardsList.map((fee, i) => (
              <FeeItemCard
                key={`fee-${i}`}
                label={fee.label}
                amount={fee.amount}
                icon={fee.icon}
                bgClass={fee.bgClass}
                borderClass={fee.borderClass}
                iconBgClass={fee.iconBgClass}
                iconColorClass={fee.iconColorClass}
              />
            ))}

            {/* Estimated Total Card (Green card matching screenshot) */}
            {total > 0 && (
              <div className="group flex items-center gap-3.5 rounded-2xl border-2 border-emerald-300 bg-[#f0fdf4] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-transform duration-200 group-hover:scale-105">
                  <Calculator className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-medium text-slate-500 leading-snug">Estimated Total</p>
                  <p className="mt-0.5 text-[17px] font-extrabold text-slate-900">
                    {currency} {total.toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 5. Additional Others Fee + Scholarship (2 columns) ──────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Additional Others Fee Card */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between min-h-[260px]">
          <div>
            <SectionHeader icon={Calculator} title="Additional Others Fee" iconBg="bg-indigo-600" />
            <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
              {/* Left: Total Fees Calculation Breakdown */}
              <div className="min-w-[200px] flex-1">
                <div className="flex items-center gap-1.5 text-[15px] font-bold text-slate-900 underline decoration-blue-600 decoration-2 underline-offset-4 mb-3">
                  <Calculator className="h-4 w-4 text-blue-600 inline" /> Total Fees Calculation
                </div>
                <div className="space-y-1.5 text-[13px] font-medium text-slate-600">
                  {calcItems.map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <span className="text-slate-400">•</span>
                      <span className="w-28">{item.label}:</span>
                      <span className="font-semibold text-slate-800">
                        {currency} {item.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Yellow Total Box */}
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200/90 bg-amber-50/90 p-3 text-[13px] shadow-xs">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                    <Coins className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 font-medium text-slate-700 leading-snug">
                    <p className="text-[12px]">
                      Total = {calcItems.map((c) => `${currency} ${c.amount.toLocaleString()}`).join(" + ") || `${currency} 0`}
                    </p>
                    <p className="text-[14px] font-extrabold text-slate-900 mt-0.5">
                      = {currency} {total.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Cursive Note + 3D Books & Grad Cap image from screenshot */}
              <div className="flex flex-col items-center justify-center text-center shrink-0 select-none">
                <p className="font-['Caveat',cursive] text-purple-600 text-xl font-bold italic rotate-[-6deg] mb-1">
                  Invest in<br />Your Future
                </p>
                <img
                  src="/images/programs/books_grad_cap.jpg"
                  alt="Education Investment"
                  className="h-28 w-28 md:h-32 md:w-32 object-contain drop-shadow-md rounded-2xl"
                />
              </div>
            </div>

            {/* If additional_others_fee has detailed text, display in neat expandable box */}
            {program.additional_others_fee && String(program.additional_others_fee).replace(/<[^>]*>/g, "").trim() && (
              <div className="mt-4 pt-3 border-t border-slate-100 text-[12px] text-slate-500">
                <div
                  className="prose prose-xs max-w-none text-slate-600"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(program.additional_others_fee) }}
                />
              </div>
            )}
          </div>
        </section>

        {/* Scholarship Card */}
        <section className="relative overflow-hidden rounded-3xl border border-purple-100/70 bg-gradient-to-r from-blue-50/80 via-purple-50/60 to-pink-50/80 p-6 shadow-sm flex flex-col justify-between min-h-[260px]">
          <div>
            <SectionHeader icon={Star} title="Scholarship" iconBg="bg-purple-600" isRounded />
            <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
              {/* Left: Trophy + Scholarship Info */}
              <div className="flex items-start gap-4 min-w-[200px] flex-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 shadow-xs">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-[17px] font-extrabold text-slate-900 leading-snug">
                    {program.scholarship && String(program.scholarship).replace(/<[^>]*>/g, "").trim()
                      ? "Scholarship Available"
                      : "Scholarship Up to 30%"}
                  </h3>
                  <p className="text-[12px] font-medium text-slate-500 mt-1">Tuition Fee After Scholarship</p>
                  <p className="text-[22px] font-extrabold text-blue-900 mt-1">
                    {currency} {tuitionAfterScholarship.toLocaleString()}
                  </p>
                  {program.scholarship && String(program.scholarship).replace(/<[^>]*>/g, "").trim() && (
                    <div
                      className="mt-2 text-[12px] text-slate-600 prose prose-xs max-w-none"
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(program.scholarship) }}
                    />
                  )}
                </div>
              </div>

              {/* Right: Cursive Note + Arrow + Faint Graduation Cap Icon */}
              <div className="flex flex-col items-end select-none pointer-events-none shrink-0">
                <p className="font-['Caveat',cursive] text-purple-600 text-2xl font-bold italic leading-tight text-right">
                  Save More<br />Achieve More
                </p>
                <svg className="w-12 h-6 text-purple-500 mr-2" viewBox="0 0 50 30" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 8 Q 25 10 40 22 M 40 22 L 32 22 M 40 22 L 36 14" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {/* Faint graduation cap line art */}
                <GraduationCap className="h-16 w-16 text-purple-300/40 -mt-2" />
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── 6. Entry Requirements + Description (2 columns) ────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Entry Requirements Card */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between min-h-[260px]">
          <div>
            <SectionHeader icon={Award} title="Entry Requirements" iconBg="bg-emerald-600" />
            {/* 3 mini cards from screenshot */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              {/* Card 1 */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-[#f8fafc] p-3.5 shadow-xs">
                <div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 mb-2">
                    <Languages className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-[11px] font-bold text-slate-700 leading-snug">
                    HSC/A levels/12th or equivalent
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-emerald-600 font-bold text-[12px]">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
              </div>

              {/* Card 2 */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-[#f8fafc] p-3.5 shadow-xs">
                <div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 mb-2">
                    <Globe className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">English Language</p>
                  <p className="text-[11px] font-bold text-slate-700 leading-snug mt-0.5">IELTS not mandatory</p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-emerald-600 font-bold text-[12px]">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
              </div>

              {/* Card 3 */}
              <div className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-[#f8fafc] p-3.5 shadow-xs">
                <div>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 mb-2">
                    <FileCheck className="h-4.5 w-4.5" />
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Equivalent</p>
                  <p className="text-[11px] font-bold text-slate-700 leading-snug mt-0.5">Valid Academic Certificates</p>
                </div>
                <div className="mt-3 flex items-center gap-1 text-emerald-600 font-bold text-[12px]">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
              </div>
            </div>

            {/* Dynamic raw requirements text if present */}
            {program.requirements && String(program.requirements).replace(/<[^>]*>/g, "").trim() && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReqExpanded((v) => !v)}
                  className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  {reqExpanded ? "Hide Full Requirements" : "View Detailed Country Requirements →"}
                </button>
                {reqExpanded && (
                  <div
                    className="mt-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-[12px] text-slate-600 prose prose-xs max-w-none"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(program.requirements) }}
                  />
                )}
              </div>
            )}
          </div>
        </section>

        {/* Description Card */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-6 shadow-sm flex flex-col justify-between min-h-[260px]">
          <div className="relative z-10">
            <SectionHeader icon={BookOpen} title="Description" iconBg="bg-indigo-600" />

            <div
              className={`prose prose-sm max-w-none text-slate-600 transition-all duration-300 ${
                !descExpanded
                  ? "[display:-webkit-box] [-webkit-line-clamp:4] [-webkit-box-orient:vertical] overflow-hidden"
                  : ""
              }`}
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  program.description ||
                    "Once you have completed the programme, and achieved the required grades, you will have the opportunity to progress to the second year of your chosen degree at Leeds Beckett University. Degrees at Leeds Beckett University are designed to help you get ready for your future career.",
                ),
              }}
            />

            <button
              type="button"
              onClick={() => setDescExpanded((v) => !v)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-[13px] font-semibold text-white shadow-sm shadow-blue-200 transition-all duration-200 hover:bg-blue-700 active:scale-95"
            >
              {descExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" /> Show Less
                </>
              ) : (
                <>
                  Read More <span className="text-base leading-none">→</span>
                </>
              )}
            </button>
          </div>

          {/* Clock Tower & Campus Silhouette Illustration (matching screenshot) */}
          <div className="absolute -bottom-4 -right-4 w-44 h-44 pointer-events-none select-none opacity-85 mix-blend-multiply z-0">
            <img
              src="/images/programs/university_tower.jpg"
              alt="University Clock Tower"
              className="w-full h-full object-contain"
            />
          </div>
        </section>
      </div>

      {/* ── Delete Confirmation Dialog ─────────────────────────────────────── */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this program?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              className="rounded-xl bg-red-600 hover:bg-red-700"
            >
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
