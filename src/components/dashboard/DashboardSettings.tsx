import { useEffect, useState } from "react";
import { Settings2, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

export type WidgetKey =
  | "kpis" | "trend" | "pipeline" | "funnel" | "country" | "intake"
  | "recent" | "universities" | "quick" | "activity";

export interface WidgetConfig {
  key: WidgetKey;
  label: string;
  enabled: boolean;
}

export const DEFAULT_WIDGETS: WidgetConfig[] = [
  { key: "kpis", label: "KPI cards", enabled: true },
  { key: "trend", label: "30-day activity chart", enabled: true },
  { key: "pipeline", label: "Status pipeline", enabled: true },
  { key: "funnel", label: "Conversion funnel", enabled: true },
  { key: "country", label: "Applications by country", enabled: true },
  { key: "intake", label: "Applications by intake", enabled: true },
  { key: "recent", label: "Recent applications", enabled: true },
  { key: "universities", label: "Top universities", enabled: true },
  { key: "quick", label: "Quick actions", enabled: true },
  { key: "activity", label: "Activity feed", enabled: true },
];

const STORAGE_KEY = "faith.dashboard.widgets.v1";

export function loadWidgetConfig(): WidgetConfig[] {
  if (typeof window === "undefined") return DEFAULT_WIDGETS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const saved = JSON.parse(raw) as WidgetConfig[];
    // merge with defaults so new widgets appear
    const map = new Map(saved.map((w) => [w.key, w]));
    const merged: WidgetConfig[] = [];
    for (const w of saved) {
      const def = DEFAULT_WIDGETS.find((d) => d.key === w.key);
      if (def) merged.push({ ...def, enabled: w.enabled });
    }
    for (const d of DEFAULT_WIDGETS) if (!map.has(d.key)) merged.push(d);
    return merged;
  } catch {
    return DEFAULT_WIDGETS;
  }
}

export function useWidgetConfig() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  useEffect(() => { setWidgets(loadWidgetConfig()); }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
  }, [widgets]);
  return { widgets, setWidgets };
}

interface Props {
  widgets: WidgetConfig[];
  onChange: (next: WidgetConfig[]) => void;
}

export function DashboardSettings({ widgets, onChange }: Props) {
  const toggle = (key: WidgetKey) =>
    onChange(widgets.map((w) => (w.key === key ? { ...w, enabled: !w.enabled } : w)));

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...widgets];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          <Settings2 className="mr-1 h-3.5 w-3.5" />
          <span className="hidden sm:inline">Customize</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Customize dashboard</SheetTitle>
          <SheetDescription>
            Show, hide, or reorder widgets. Changes save automatically.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {widgets.map((w, i) => (
            <div
              key={w.key}
              className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">
                  {i + 1}
                </span>
                <span className="truncate text-sm">{w.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  disabled={i === 0} onClick={() => move(i, -1)}
                  aria-label="Move up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  disabled={i === widgets.length - 1} onClick={() => move(i, 1)}
                  aria-label="Move down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Switch checked={w.enabled} onCheckedChange={() => toggle(w.key)} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Button
            variant="ghost" size="sm" className="w-full"
            onClick={() => onChange(DEFAULT_WIDGETS)}
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" /> Reset to default
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
