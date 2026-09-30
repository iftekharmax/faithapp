import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface FunnelStep {
  label: string;
  value: number;
  color: string;
}

export function ConversionFunnel({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Conversion funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((s, i) => {
          const pct = (s.value / max) * 100;
          const conv = i === 0 ? 100 : steps[0].value ? Math.round((s.value / steps[0].value) * 100) : 0;
          return (
            <div key={s.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{s.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{s.value}</span> · {conv}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-md bg-muted">
                <div
                  className={cn("h-full rounded-md bg-gradient-to-r transition-all", s.color)}
                  style={{ width: `${Math.max(pct, s.value > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
