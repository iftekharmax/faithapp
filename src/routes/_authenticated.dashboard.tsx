import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  FileText, Users, GraduationCap, CheckCircle2, Clock, TrendingUp, Award,
  Sparkles, Globe2, CalendarClock,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer,
  XAxis, YAxis, Tooltip, Legend, CartesianGrid,
} from "recharts";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { StatusPipeline } from "@/components/dashboard/StatusPipeline";
import { RecentApplications, type RecentApp } from "@/components/dashboard/RecentApplications";
import { ConversionFunnel } from "@/components/dashboard/ConversionFunnel";
import { DashboardSettings, useWidgetConfig, type WidgetKey } from "@/components/dashboard/DashboardSettings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth, ROLE_LABELS } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import type { ApplicationStatus } from "@/lib/applications";

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  color: "var(--card-foreground)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 12px 32px -14px color-mix(in oklab, var(--foreground) 35%, transparent)",
};

const TOOLTIP_LABEL_STYLE = { color: "var(--popover-foreground)", fontWeight: 600 };
const TOOLTIP_ITEM_STYLE = { color: "var(--muted-foreground)" };
const AXIS_TICK = { fontSize: 10, fill: "var(--muted-foreground)" };

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard | Faith AMS" },
      { name: "description", content: "Monitor applications, offers, visas, enrollments, and consultancy activity in Faith AMS." },
      { property: "og:title", content: "Dashboard | Faith AMS" },
      { property: "og:description", content: "Monitor applications, offers, visas, enrollments, and consultancy activity in Faith AMS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardPage,
});

interface DashboardData {
  total: number;
  pending: number;
  offers: number;
  enrolled: number;
  visaGranted: number;
  submittedLast7d: number;
  submittedPrev7d: number;
  byCountry: { name: string; value: number }[];
  byIntake: { name: string; value: number }[];
  byUniversity: { name: string; value: number }[];
  statusCounts: Record<string, number>;
  trend: { date: string; created: number; enrolled: number }[];
  recent: RecentApp[];
  studentsTotal: number;
  universitiesTotal: number;
}

const COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
  "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)",
];

function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [appsRes, studentsRes, unisRes] = await Promise.all([
        supabase.from("applications").select("id, application_code, university, program, status, country, intake, created_at, updated_at").order("updated_at", { ascending: false }),
        supabase.from("students").select("id", { count: "exact", head: true }),
        supabase.from("universities").select("id", { count: "exact", head: true }),
      ]);
      if (cancelled) return;
      const rows = (appsRes.data ?? []) as any[];

      const total = rows.length;
      const statusCounts: Record<string, number> = {};
      for (const r of rows) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;

      const pending = ["draft", "submitted", "under_review"].reduce((s, k) => s + (statusCounts[k] ?? 0), 0);
      const offers = ["offer_received", "conditional_offer", "unconditional_offer", "deposit_paid"].reduce((s, k) => s + (statusCounts[k] ?? 0), 0);
      const enrolled = statusCounts["enrolled"] ?? 0;
      const visaGranted = statusCounts["visa_granted"] ?? 0;

      const now = Date.now();
      const d7 = 7 * 86400_000;
      const submittedLast7d = rows.filter((r) => now - new Date(r.created_at).getTime() <= d7).length;
      const submittedPrev7d = rows.filter((r) => {
        const t = new Date(r.created_at).getTime();
        return now - t > d7 && now - t <= d7 * 2;
      }).length;

      const group = (key: string) => {
        const m = new Map<string, number>();
        rows.forEach((r) => {
          const v = (r[key] as string | null) || "Unspecified";
          m.set(v, (m.get(v) ?? 0) + 1);
        });
        return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
      };

      // 30-day trend
      const days: { date: string; created: number; enrolled: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now - i * 86400_000);
        const key = d.toISOString().slice(0, 10);
        days.push({ date: key, created: 0, enrolled: 0 });
      }
      const dayIndex = new Map(days.map((d, i) => [d.date, i]));
      for (const r of rows) {
        const created = new Date(r.created_at).toISOString().slice(0, 10);
        const ci = dayIndex.get(created);
        if (ci !== undefined) days[ci].created += 1;
        if (r.status === "enrolled") {
          const upd = new Date(r.updated_at).toISOString().slice(0, 10);
          const ei = dayIndex.get(upd);
          if (ei !== undefined) days[ei].enrolled += 1;
        }
      }

      const recent: RecentApp[] = rows.slice(0, 6).map((r) => ({
        id: r.id,
        application_code: r.application_code,
        university: r.university,
        program: r.program,
        status: r.status as ApplicationStatus,
        updated_at: r.updated_at,
      }));

      setData({
        total, pending, offers, enrolled, visaGranted,
        submittedLast7d, submittedPrev7d,
        byCountry: group("country"),
        byIntake: group("intake"),
        byUniversity: group("university"),
        statusCounts,
        trend: days,
        recent,
        studentsTotal: studentsRes.count ?? 0,
        universitiesTotal: unisRes.count ?? 0,
      });
    })();
    return () => { cancelled = true; };
  }, []);
  return data;
}

function DashboardSkeleton() {
  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      <div className="h-24 w-full rounded-xl bg-muted/20 animate-pulse" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-muted/20 animate-pulse" />
        ))}
      </div>
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="h-64 rounded-xl bg-muted/20 animate-pulse" />
        <div className="h-64 rounded-xl bg-muted/20 animate-pulse" />
      </div>
    </div>
  );
}

function DashboardPage() {
  const { profile, user, roles } = useAuth();
  const name = profile?.full_name || user?.email?.split("@")[0] || "there";
  const data = useDashboardData();
  const { widgets, setWidgets } = useWidgetConfig();

  const today = useMemo(() => new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  }), []);

  // We now render per-widget loaders below

  const trendPct = useMemo(() => {
    if (!data) return null;
    const cur = data.submittedLast7d;
    const prev = data.submittedPrev7d;
    if (prev === 0) return cur > 0 ? { value: "+100%", positive: true } : null;
    const pct = Math.round(((cur - prev) / prev) * 100);
    return { value: `${pct >= 0 ? "+" : ""}${pct}%`, positive: pct >= 0 };
  }, [data]);

  const successRate = data
    ? (data.total ? Math.round((data.enrolled / data.total) * 100) : 0)
    : 0;

  const isOn = (k: WidgetKey) => widgets.find((w) => w.key === k)?.enabled ?? false;
  const orderOf = (k: WidgetKey) => {
    const i = widgets.findIndex((w) => w.key === k);
    return i === -1 ? 999 : i;
  };

  const blocks: Record<WidgetKey, React.ReactNode | null> = {
    kpis: (
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        {data ? (
          <>
            <StatCard title="Total Applications" value={data.total} icon={FileText}
              accent="primary" trend={trendPct ?? undefined}
              description={`${data.submittedLast7d} new this week`} />
            <StatCard title="In Pipeline" value={data.pending} icon={Clock}
              accent="warning" description="Draft · Submitted · Review" />
            <StatCard title="Offers" value={data.offers} icon={Award}
              accent="violet" description="Received & confirmed" />
            <StatCard title="Enrolled" value={data.enrolled} icon={CheckCircle2}
              accent="success" description={`${successRate}% conversion`} />
          </>
        ) : (
          [...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted/10 animate-pulse border border-border/40" />
          ))
        )}
      </section>
    ),
    trend: (
      <Card className="border-border/60 min-w-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> 30-day activity
          </CardTitle>
          <span className="hidden text-xs text-muted-foreground sm:inline">Created vs enrolled</span>
        </CardHeader>
        <CardContent className="h-56 sm:h-64 px-2 sm:px-4">
          {!data ? (
            <div className="h-full w-full bg-muted/5 animate-pulse rounded-md" />
          ) : data.total === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 rounded-full bg-muted/20">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No activity data</p>
                <p className="text-xs text-muted-foreground">Activities will appear here once applications are submitted.</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trend} margin={{ left: -20, right: 8, top: 6, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.38} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gEnrolled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.34} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={AXIS_TICK} axisLine={false} tickLine={false}
                  tickFormatter={(v: string) => v.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                <Area type="monotone" dataKey="created" stroke="var(--chart-1)" strokeWidth={2} fill="url(#gCreated)" name="Created" />
                <Area type="monotone" dataKey="enrolled" stroke="var(--chart-2)" strokeWidth={2} fill="url(#gEnrolled)" name="Enrolled" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    ),
    pipeline: !data ? (
      <div className="h-64 bg-muted/5 animate-pulse rounded-xl border border-border/40" />
    ) : (
      <StatusPipeline counts={data.statusCounts} />
    ),
    funnel: !data ? (
      <div className="h-64 bg-muted/5 animate-pulse rounded-xl border border-border/40" />
    ) : (
      <ConversionFunnel
        steps={[
          { label: "Submitted", value: (data.statusCounts.submitted ?? 0) + (data.statusCounts.under_review ?? 0) + (data.pending ?? 0), color: "from-primary to-info" },
          { label: "Offers", value: data.offers, color: "from-violet to-primary" },
          { label: "Visa granted", value: data.visaGranted, color: "from-info to-success" },
          { label: "Enrolled", value: data.enrolled, color: "from-success to-chart-8" },
        ]}
      />
    ),
    country: (
      <Card className="border-border/60 min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Globe2 className="h-4 w-4 text-info" /> By country
          </CardTitle>
        </CardHeader>
        <CardContent className="h-56 px-2 sm:px-4">
          {!data ? (
            <div className="h-full w-full bg-muted/5 animate-pulse rounded-md" />
          ) : data.byCountry.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <p className="text-xs text-muted-foreground">No data available.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.byCountry} margin={{ left: -20, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={40} />
                <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} cursor={{ fill: "var(--muted)", opacity: 0.45 }} />
                <Bar dataKey="value" fill="var(--chart-6)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    ),
    intake: (
      <Card className="border-border/60 min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <CalendarClock className="h-4 w-4 text-violet" /> By intake
          </CardTitle>
        </CardHeader>
        <CardContent className="h-56 px-2 sm:px-4">
          {!data ? (
            <div className="h-full w-full bg-muted/5 animate-pulse rounded-md" />
          ) : data.byIntake.length === 0 ? (
            <div className="flex h-full items-center justify-center text-center">
              <p className="text-xs text-muted-foreground">No data available.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.byIntake} dataKey="value" nameKey="name"
                  innerRadius={36} outerRadius={72} paddingAngle={2}>
                  {data.byIntake.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="var(--background)" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL_STYLE} itemStyle={TOOLTIP_ITEM_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    ),
    recent: !data ? (
      <div className="h-64 bg-muted/5 animate-pulse rounded-xl border border-border/40" />
    ) : data.recent.length === 0 ? (
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Recent Applications</CardTitle>
        </CardHeader>
        <CardContent className="py-12 flex flex-col items-center justify-center space-y-4">
          <div className="p-4 rounded-full bg-muted/20">
            <FileText className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <div className="text-center max-w-[240px]">
            <p className="text-sm font-medium">No applications found</p>
            <p className="text-xs text-muted-foreground mt-1">Start by creating your first student application to track progress.</p>
          </div>
          <Button asChild size="sm" className="mt-2">
            <Link to="/applications/new">Create Application</Link>
          </Button>
        </CardContent>
      </Card>
    ) : (
      <RecentApplications items={data.recent} />
    ),
    universities: (
      <Card className="border-border/60 min-w-0">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <GraduationCap className="h-4 w-4 text-primary" /> Top universities
          </CardTitle>
          <span className="hidden text-xs text-muted-foreground sm:inline">By applications</span>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {(data?.byUniversity ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No data yet.</p>
          ) : (
            data!.byUniversity.map((u, i) => {
              const max = data!.byUniversity[0]?.value || 1;
              const pct = (u.value / max) * 100;
              return (
                <div key={u.name} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-xs font-bold text-muted-foreground">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">{u.name}</span>
                      <span className="shrink-0 text-xs font-semibold tabular-nums">{u.value}</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                     <div className="h-full rounded-full bg-gradient-to-r from-primary to-info"
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    ),
    quick: <QuickActions />,
    activity: <ActivityFeed />,
  };

  // Compose grids according to widget order & visibility
  const rows: React.ReactNode[] = [];
  const push = (key: string, el: React.ReactNode) => rows.push(<div key={key}>{el}</div>);

  // Row: trend + pipeline
  const trendOn = isOn("trend"); const pipeOn = isOn("pipeline");
  if (trendOn || pipeOn) {
    push("row-trend", (
      <section className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {trendOn && blocks.trend}
        {pipeOn && blocks.pipeline}
      </section>
    ));
  }

  // Row: funnel + country + intake
  const midKeys: WidgetKey[] = (["funnel", "country", "intake"] as WidgetKey[])
    .filter(isOn)
    .sort((a, b) => orderOf(a) - orderOf(b));
  if (midKeys.length) {
    push("row-mid", (
      <section className={`grid gap-3 sm:gap-4 ${midKeys.length === 1 ? "" : midKeys.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3"} min-w-0`}>
        {midKeys.map((k) => <div key={k} className="min-w-0">{blocks[k]}</div>)}
      </section>
    ));
  }

  // Row: recent + universities
  const recentOn = isOn("recent"); const uniOn = isOn("universities");
  if (recentOn || uniOn) {
    push("row-recent", (
      <section className="grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {recentOn && <div className="min-w-0">{blocks.recent}</div>}
        {uniOn && <div className="min-w-0">{blocks.universities}</div>}
      </section>
    ));
  }

  // Row: quick + activity
  const quickOn = isOn("quick"); const actOn = isOn("activity");
  if (quickOn || actOn) {
    push("row-quick", (
      <section className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        {quickOn && <div className="lg:col-span-1 min-w-0">{blocks.quick}</div>}
        {actOn && <div className="lg:col-span-2 min-w-0">{blocks.activity}</div>}
      </section>
    ));
  }

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      {/* Hero header — compact */}
      <section className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-r from-primary/10 via-background to-sky-500/5 px-4 py-3 shadow-sm sm:px-5 sm:py-4 dark:from-primary/15 dark:via-background dark:to-sky-500/10">
        <div aria-hidden className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
              <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">
                Welcome back, <span className="bg-gradient-to-r from-primary to-sky-500 bg-clip-text text-transparent">{name}</span>
              </h1>
              {roles.slice(0, 2).map((r) => (
                <Badge key={r} variant="outline" className="hidden border-primary/20 bg-primary/10 text-[10px] text-primary backdrop-blur sm:inline-flex">
                  {ROLE_LABELS[r]}
                </Badge>
              ))}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {today} · Applications, offers, and outcomes at a glance.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button asChild size="sm" className="h-8">
              <Link to="/applications/new">
                <FileText className="mr-1 h-3.5 w-3.5" /> New
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="hidden h-8 sm:inline-flex">
              <Link to="/students/new">
                <Users className="mr-1 h-3.5 w-3.5" /> Student
              </Link>
            </Button>
            <DashboardSettings widgets={widgets} onChange={setWidgets} />
          </div>
        </div>
      </section>

      {isOn("kpis") && blocks.kpis}
      {rows}
    </div>
  );
}
