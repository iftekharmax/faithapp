import { Link } from "@tanstack/react-router";
import { ArrowRight, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/applications";
import { formatDistanceToNow } from "date-fns";

export interface RecentApp {
  id: string;
  application_code: string | null;
  university: string;
  program: string;
  status: ApplicationStatus;
  updated_at: string;
}

const STATUS_TONE: Partial<Record<ApplicationStatus, string>> = {
  draft: "border-border bg-muted text-muted-foreground",
  submitted: "border-info/25 bg-info-subtle text-info-foreground",
  under_review: "border-primary/25 bg-primary/10 text-primary",
  offer_received: "border-violet/25 bg-violet-subtle text-violet-foreground",
  conditional_offer: "border-violet/25 bg-violet-subtle text-violet-foreground",
  unconditional_offer: "border-violet/25 bg-violet-subtle text-violet-foreground",
  deposit_paid: "border-warning/25 bg-warning-subtle text-warning-foreground",
  cas_issued: "border-warning/25 bg-warning-subtle text-warning-foreground",
  visa_applied: "border-info/25 bg-info-subtle text-info-foreground",
  visa_granted: "border-success/25 bg-success-subtle text-success-foreground",
  visa_refused: "border-destructive/25 bg-danger-subtle text-destructive",
  enrolled: "border-success/25 bg-success-subtle text-success-foreground",
  withdrawn: "border-border bg-muted text-muted-foreground",
  rejected: "border-destructive/25 bg-danger-subtle text-destructive",
};

export function RecentApplications({ items }: { items: RecentApp[] }) {
  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Recent applications</CardTitle>
        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
          <Link to="/applications">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8 opacity-40" />
            No applications yet.
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((a) => (
              <li key={a.id}>
                <Link
                  to="/applications/$applicationId"
                  params={{ applicationId: a.id }}
                  className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-accent/50"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{a.university}</p>
                      <span className="hidden text-[10px] font-mono text-muted-foreground sm:inline">
                        {a.application_code}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.program} · {formatDistanceToNow(new Date(a.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge className={STATUS_TONE[a.status] ?? "border-border bg-muted text-foreground"} variant="outline">
                    {APPLICATION_STATUS_LABELS[a.status]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
