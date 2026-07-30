import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: string; positive?: boolean };
  description?: string;
  accent?: "primary" | "success" | "warning" | "info" | "violet" | "rose";
}

const ACCENTS: Record<NonNullable<StatCardProps["accent"]>, { chip: string; ring: string; glow: string; bar: string }> = {
  primary: {
    chip: "bg-primary/10 text-primary",
    ring: "ring-primary/20",
    glow: "from-primary/10 via-primary/5",
    bar: "bg-primary",
  },
  success: {
    chip: "bg-success-subtle text-success-foreground",
    ring: "ring-success/25",
    glow: "from-success-subtle/70 via-success-subtle/25",
    bar: "bg-success",
  },
  warning: {
    chip: "bg-warning-subtle text-warning-foreground",
    ring: "ring-warning/25",
    glow: "from-warning-subtle/70 via-warning-subtle/25",
    bar: "bg-warning",
  },
  info: {
    chip: "bg-info-subtle text-info-foreground",
    ring: "ring-info/25",
    glow: "from-info-subtle/70 via-info-subtle/25",
    bar: "bg-info",
  },
  violet: {
    chip: "bg-violet-subtle text-violet-foreground",
    ring: "ring-violet/25",
    glow: "from-violet-subtle/70 via-violet-subtle/25",
    bar: "bg-violet",
  },
  rose: {
    chip: "bg-danger-subtle text-destructive",
    ring: "ring-destructive/25",
    glow: "from-danger-subtle/70 via-danger-subtle/25",
    bar: "bg-destructive",
  },
};

export function StatCard({ title, value, icon: Icon, trend, description, accent = "primary" }: StatCardProps) {
  const a = ACCENTS[accent];
  return (
    <Card className={cn("group relative overflow-hidden border-border/80 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-1", a.ring)}>
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent opacity-70", a.glow)}
      />
      <div aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 opacity-70", a.bar)} />
      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="mt-2 truncate text-3xl font-bold tracking-tight tabular-nums">{value}</p>
            {description && <p className="mt-1 truncate text-xs text-muted-foreground">{description}</p>}
          </div>
          <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl shadow-sm", a.chip)}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {trend && (
          <div className="mt-4 flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold",
                trend.positive
                  ? "bg-success-subtle text-success-foreground"
                  : "bg-danger-subtle text-destructive",
              )}
            >
              {trend.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {trend.value}
            </span>
            <span className="text-muted-foreground">vs last month</span>
          </div>
        )}
      </div>
    </Card>
  );
}
