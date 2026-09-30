import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/applications";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";

const STAGES: { key: ApplicationStatus; color: string }[] = [
  { key: "draft", color: "bg-muted-foreground" },
  { key: "submitted", color: "bg-info" },
  { key: "under_review", color: "bg-primary" },
  { key: "offer_received", color: "bg-violet" },
  { key: "conditional_offer", color: "bg-violet" },
  { key: "unconditional_offer", color: "bg-violet" },
  { key: "deposit_paid", color: "bg-warning" },
  { key: "cas_issued", color: "bg-warning" },
  { key: "visa_applied", color: "bg-info" },
  { key: "visa_granted", color: "bg-success" },
  { key: "visa_refused", color: "bg-destructive" },
  { key: "enrolled", color: "bg-success" },
  { key: "withdrawn", color: "bg-muted-foreground" },
  { key: "rejected", color: "bg-destructive" },
];

export function StatusPipeline({ counts }: { counts: Record<string, number> }) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Pipeline breakdown</CardTitle>
          <span className="text-xs text-muted-foreground">All 14 stages</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {STAGES.map((s) => {
          const n = counts[s.key] ?? 0;
          const pct = (n / total) * 100;
          return (
            <Link
              key={s.key}
              to="/applications"
              className="group flex items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-accent/50"
            >
              <span className="w-36 shrink-0 truncate text-xs font-medium">
                {APPLICATION_STATUS_LABELS[s.key]}
              </span>
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", s.color)}
                  style={{ width: `${Math.max(pct, n > 0 ? 3 : 0)}%` }}
                />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums">{n}</span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
