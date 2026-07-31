import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Send, ClipboardList, FileCheck2, Sparkles, Coins, ScrollText,
  Plane, PlaneLanding, GraduationCap, Ban, XCircle, FileEdit,
  ClipboardCheck, ArrowRight, Lightbulb, ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
  allowedNextStatuses,
} from "@/lib/applications";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const NEXT_ICON: Partial<Record<ApplicationStatus, typeof Send>> = {
  draft: FileEdit, submitted: Send, under_review: ClipboardList,
  offer_received: FileCheck2, conditional_offer: FileCheck2, unconditional_offer: Sparkles,
  deposit_paid: Coins, cas_issued: ScrollText,
  visa_applied: Plane, visa_granted: PlaneLanding,
  enrolled: GraduationCap, withdrawn: Ban, rejected: XCircle, visa_refused: XCircle,
};

const RECOMMENDED: Record<ApplicationStatus, ApplicationStatus | null> = {
  draft: "submitted",
  submitted: "under_review",
  under_review: "offer_received",
  offer_received: "conditional_offer",
  conditional_offer: "unconditional_offer",
  unconditional_offer: "deposit_paid",
  deposit_paid: "cas_issued",
  cas_issued: "visa_applied",
  visa_applied: "visa_granted",
  visa_granted: "enrolled",
  visa_refused: null,
  enrolled: null,
  withdrawn: null,
  rejected: null,
};

const GUIDANCE: Record<ApplicationStatus, string> = {
  draft: "Complete required fields and submit the application.",
  submitted: "Application received — move to review when triaged.",
  under_review: "Awaiting institution decision. Request any missing documents.",
  offer_received: "Offer arrived. Confirm conditional or unconditional.",
  conditional_offer: "Fulfill conditions, then progress to an unconditional offer.",
  unconditional_offer: "Collect the deposit to secure the seat.",
  deposit_paid: "Deposit secured — issue or await CAS/I-20.",
  cas_issued: "CAS ready — student can apply for visa.",
  visa_applied: "Visa submitted. Update once a decision arrives.",
  visa_granted: "Visa granted — prepare for enrollment.",
  visa_refused: "Visa refused. Consider a re-appeal or a new application.",
  enrolled: "Student is enrolled 🎉",
  withdrawn: "Application withdrawn — no further steps.",
  rejected: "Application rejected — no further steps.",
};

const TERMINAL: ApplicationStatus[] = ["enrolled", "withdrawn", "rejected"];

export interface NextActionsProps {
  applicationId: string;
  currentStatus: ApplicationStatus;
  onQuickStatus: (next: ApplicationStatus) => Promise<void> | void;
  onRequestDocuments: () => void;
  hasOpenDocRequest: boolean;
}

export function NextActions({
  applicationId, currentStatus, onQuickStatus, onRequestDocuments, hasOpenDocRequest,
}: NextActionsProps) {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const canProgress = hasRole("admin") || hasRole("application_team") || hasRole("counselor");

  const recommended = RECOMMENDED[currentStatus];
  const alternatives = useMemo(
    () => allowedNextStatuses(currentStatus, isAdmin).filter(
      (s) => s !== currentStatus && s !== recommended,
    ),
    [currentStatus, isAdmin, recommended],
  );

  const isTerminal = TERMINAL.includes(currentStatus);
  const RecIcon = recommended ? NEXT_ICON[recommended] ?? ArrowRight : ArrowRight;

  return (
    <Card className="overflow-hidden border border-primary/15 bg-gradient-to-b from-card via-card to-muted/20 shadow-sm">
      <CardHeader className="border-b border-border/60 bg-muted/30 px-5 py-4">
        <CardTitle className="flex items-center gap-3 text-base font-semibold tracking-tight">
          <div className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-md shadow-primary/20">
            <Lightbulb className="h-4 w-4" />
          </div>
          <span className="flex-1">Next actions</span>
          <Badge variant="secondary" className="hidden text-[11px] font-normal uppercase tracking-wide sm:inline-flex">
            {APPLICATION_STATUS_LABELS[currentStatus]}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5 p-5">
        <div className="rounded-xl border border-primary/10 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent p-4">
          <p className="text-sm font-medium leading-relaxed text-foreground">{GUIDANCE[currentStatus]}</p>
        </div>

        {canProgress && !isTerminal && recommended && (
          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-card p-1 shadow-sm">
            <div className="rounded-xl bg-card/80 p-4 backdrop-blur-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary">Recommended</span>
                </div>
                <span className="text-xs text-muted-foreground">Move status to</span>
              </div>

              <Button
                onClick={() => onQuickStatus(recommended)}
                className={cn(
                  "group h-11 w-full justify-between gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/90",
                  "px-4 text-left font-semibold shadow-md shadow-primary/20 transition-all hover:shadow-lg hover:brightness-105",
                )}
                aria-label={`Advance status to ${APPLICATION_STATUS_LABELS[recommended]}`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary-foreground/15">
                    <RecIcon className="h-4 w-4" />
                  </span>
                  {APPLICATION_STATUS_LABELS[recommended]}
                </span>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </div>
          </div>
        )}

        {canProgress && alternatives.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Separator className="flex-1" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Other transitions
              </span>
              <Separator className="flex-1" />
            </div>

            <div className="flex flex-wrap gap-2">
              {alternatives.map((s) => {
                const Icon = NEXT_ICON[s] ?? ArrowRight;
                return (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    onClick={() => onQuickStatus(s)}
                    className={cn(
                      "h-9 gap-2 rounded-full border-border/70 bg-card pl-3 pr-4 text-xs font-medium",
                      "transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-sm",
                    )}
                    aria-label={`Move status to ${APPLICATION_STATUS_LABELS[s]}`}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                    {APPLICATION_STATUS_LABELS[s]}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-3 pt-1 sm:grid-cols-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRequestDocuments}
            className="h-11 justify-start gap-3 rounded-xl border-border/70 bg-card px-4 text-sm font-medium transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-sm"
            aria-label="Request a document from the counselor"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <ClipboardCheck className="h-4 w-4" />
            </span>
            {hasOpenDocRequest ? "Manage document requests" : "Request document"}
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="h-11 justify-start gap-3 rounded-xl border-border/70 bg-card px-4 text-sm font-medium transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary hover:shadow-sm"
          >
            <Link
              to="/applications/$applicationId"
              params={{ applicationId }}
              hash="offers"
              aria-label="Open offer letters panel"
            >
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <FileCheck2 className="h-4 w-4" />
              </span>
              Manage offers
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
