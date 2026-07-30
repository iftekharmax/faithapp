import { useMemo } from "react";
import {
  Check, FileEdit, Send, ClipboardList, Mail, FileCheck2, Coins,
  ScrollText, Plane, PlaneTakeoff, PlaneLanding, GraduationCap,
  Ban, XCircle, Sparkles,
} from "lucide-react";
import {
  APPLICATION_STATUS_LABELS, APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/applications";
import { cn } from "@/lib/utils";

type PhaseKey = "application" | "offer" | "enrollment" | "visa" | "final";

const PHASES: { key: PhaseKey; label: string; statuses: ApplicationStatus[]; from: string; to: string }[] = [
  { key: "application", label: "Application", statuses: ["draft", "submitted", "under_review"], from: "from-blue-500", to: "to-indigo-500" },
  { key: "offer", label: "Offer", statuses: ["offer_received", "conditional_offer", "unconditional_offer"], from: "from-violet-500", to: "to-fuchsia-500" },
  { key: "enrollment", label: "Enrollment", statuses: ["deposit_paid", "cas_issued"], from: "from-teal-500", to: "to-cyan-500" },
  { key: "visa", label: "Visa", statuses: ["visa_applied", "visa_granted", "visa_refused"], from: "from-sky-500", to: "to-emerald-500" },
  { key: "final", label: "Outcome", statuses: ["enrolled", "withdrawn", "rejected"], from: "from-emerald-500", to: "to-green-500" },
];

const ICONS: Record<ApplicationStatus, typeof Check> = {
  draft: FileEdit, submitted: Send, under_review: ClipboardList,
  offer_received: Mail, conditional_offer: FileCheck2, unconditional_offer: Sparkles,
  deposit_paid: Coins, cas_issued: ScrollText,
  visa_applied: Plane, visa_granted: PlaneLanding, visa_refused: PlaneTakeoff,
  enrolled: GraduationCap, withdrawn: Ban, rejected: XCircle,
};

const TERMINAL_NEGATIVE: ApplicationStatus[] = ["withdrawn", "rejected", "visa_refused"];

export function StatusStepper({ current }: { current: ApplicationStatus }) {
  const currentIdx = useMemo(() => APPLICATION_STATUSES.indexOf(current), [current]);
  const total = APPLICATION_STATUSES.length;
  const isNegative = TERMINAL_NEGATIVE.includes(current);
  const progress = total > 1 ? Math.round(((currentIdx) / (total - 1)) * 100) : 0;
  const activePhase = PHASES.find((p) => p.statuses.includes(current)) ?? PHASES[0];

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-card/60 shadow-lg">
      {/* Decorative glow */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl opacity-30 bg-gradient-to-br",
          activePhase.from, activePhase.to,
        )}
      />

      {/* Header */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b bg-background/40 px-4 py-3 backdrop-blur sm:px-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md",
            activePhase.from, activePhase.to,
          )}>
            {(() => { const Icon = ICONS[current]; return <Icon className="h-5 w-5" />; })()}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {activePhase.label} phase
            </p>
            <p className="truncate text-base font-bold text-foreground">
              {APPLICATION_STATUS_LABELS[current]}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Progress</span>
            <span className={cn(
              "text-lg font-bold bg-gradient-to-r bg-clip-text text-transparent",
              isNegative ? "from-rose-500 to-red-500" : `${activePhase.from} ${activePhase.to}`,
            )}>
              {progress}%
            </span>
          </div>
          <div className="rounded-full border bg-background/80 px-3 py-1 text-xs font-semibold text-foreground">
            Step {Math.max(1, currentIdx + 1)}/{total}
          </div>
        </div>
      </div>

      {/* Phase ribbon */}
      <div className="relative grid grid-cols-5 gap-1 border-b bg-background/30 px-2 py-2">
        {PHASES.map((p) => {
          const phaseCurrentIdx = p.statuses.findIndex((s) => APPLICATION_STATUSES.indexOf(s) === currentIdx);
          const anyPast = p.statuses.some((s) => APPLICATION_STATUSES.indexOf(s) < currentIdx);
          const isActive = phaseCurrentIdx >= 0;
          const isDone = !isActive && anyPast && p.statuses.every((s) => APPLICATION_STATUSES.indexOf(s) < currentIdx);
          return (
            <div key={p.key} className="flex flex-col items-center gap-1">
              <div className={cn(
                "h-1.5 w-full rounded-full transition-all",
                isActive
                  ? cn("bg-gradient-to-r shadow-sm", p.from, p.to)
                  : isDone
                    ? "bg-primary/60"
                    : "bg-muted",
              )} />
              <span className={cn(
                "text-[9px] font-semibold uppercase tracking-wider transition-colors",
                isActive ? "text-foreground" : "text-muted-foreground",
              )}>
                {p.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Stepper */}
      <div className="relative overflow-x-auto">
        <div className="min-w-max px-4 py-5 sm:px-5">
          {/* rail */}
          <div className="relative">
            <div className="absolute left-5 right-5 top-6 h-[3px] rounded-full bg-muted" />
            <div
              className={cn(
                "absolute left-5 top-6 h-[3px] rounded-full bg-gradient-to-r transition-all duration-700 ease-out shadow-[0_0_12px_rgba(59,130,246,0.4)]",
                isNegative ? "from-rose-400 to-red-500" : "from-primary to-primary/60",
              )}
              style={{ width: `calc((100% - 2.5rem) * ${progress / 100})` }}
            />
            <ol className="relative flex items-start gap-4 sm:gap-5">
              {APPLICATION_STATUSES.map((s, i) => {
                const done = i < currentIdx;
                const active = i === currentIdx;
                const Icon = ICONS[s];
                const isNeg = TERMINAL_NEGATIVE.includes(s);
                return (
                  <li key={s} className="flex w-[68px] flex-col items-center gap-1.5 sm:w-[76px]">
                    <div
                      className={cn(
                        "relative z-10 flex h-11 w-11 items-center justify-center rounded-xl border-2 text-[11px] font-bold shadow-sm transition-all duration-300",
                        done && !isNeg && "border-transparent bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md",
                        done && isNeg && "border-transparent bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-md",
                        active && !isNeg && "border-primary bg-background text-primary ring-4 ring-primary/25 scale-110",
                        active && isNeg && "border-rose-500 bg-background text-rose-500 ring-4 ring-rose-500/25 scale-110",
                        !done && !active && "border-border bg-background/60 text-muted-foreground",
                      )}
                    >
                      {done ? <Check className="h-5 w-5" /> : <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />}
                      {active && (
                        <span className={cn(
                          "motion-safe:animate-ping absolute inset-0 rounded-xl opacity-60",
                          isNeg ? "bg-rose-400/30" : "bg-primary/20",
                        )} />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-center text-[10px] font-semibold leading-tight tracking-tight sm:text-[11px]",
                        active ? "text-foreground" : done ? "text-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      {APPLICATION_STATUS_LABELS[s]}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
