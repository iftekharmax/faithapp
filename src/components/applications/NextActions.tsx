import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Send, ClipboardList, FileCheck2, Sparkles, Coins, ScrollText,
  Plane, PlaneLanding, GraduationCap, Ban, XCircle, FileEdit,
  ClipboardCheck, ArrowRight, Lightbulb,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

// Recommended "primary" progression by current phase
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
    ).slice(0, 4),
    [currentStatus, isAdmin, recommended],
  );

  const isTerminal = TERMINAL.includes(currentStatus);
  const RecIcon = recommended ? NEXT_ICON[recommended] ?? ArrowRight : ArrowRight;

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="border-b bg-gradient-to-br from-primary/10 via-card to-card py-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-fuchsia-500 text-white shadow-sm">
            <Lightbulb className="h-3.5 w-3.5" />
          </div>
          Next actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <p className="text-sm text-muted-foreground">{GUIDANCE[currentStatus]}</p>

        {canProgress && !isTerminal && recommended && (
          <div className="rounded-xl border bg-primary/5 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                Recommended
              </Badge>
              <span className="text-xs text-muted-foreground">Move status to</span>
            </div>
            <Button
              onClick={() => onQuickStatus(recommended)}
              className={cn("w-full justify-start gap-2 shadow-sm")}
              aria-label={`Advance status to ${APPLICATION_STATUS_LABELS[recommended]}`}
            >
              <RecIcon className="h-4 w-4" />
              {APPLICATION_STATUS_LABELS[recommended]}
              <ArrowRight className="ml-auto h-4 w-4" />
            </Button>
          </div>
        )}

        {canProgress && alternatives.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Other transitions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {alternatives.map((s) => {
                const Icon = NEXT_ICON[s] ?? ArrowRight;
                return (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    onClick={() => onQuickStatus(s)}
                    className="h-8"
                    aria-label={`Move status to ${APPLICATION_STATUS_LABELS[s]}`}
                  >
                    <Icon className="mr-1.5 h-3.5 w-3.5" />
                    {APPLICATION_STATUS_LABELS[s]}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-2 pt-1 sm:grid-cols-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRequestDocuments}
            className="justify-start"
            aria-label="Request a document from the counselor"
          >
            <ClipboardCheck className="mr-2 h-4 w-4 text-primary" />
            {hasOpenDocRequest ? "Manage document requests" : "Request document"}
          </Button>
          <Button asChild variant="outline" size="sm" className="justify-start">
            <Link
              to="/applications/$applicationId"
              params={{ applicationId }}
              hash="offers"
              aria-label="Open offer letters panel"
            >
              <FileCheck2 className="mr-2 h-4 w-4 text-primary" /> Manage offers
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
