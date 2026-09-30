import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2, Users, CheckCircle2, AlertCircle, Clock, TrendingUp, Globe, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports · Faith AMS" },
      { name: "description", content: "Analytics and reporting for team productivity and application processing." },
    ],
  }),
  component: () => (
    <RoleGuard roles={["admin"]}>
      <ReportsPage />
    </RoleGuard>
  ),
});

function ReportsPage() {
  const [productivity, setProductivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("view_employee_productivity").select("*");
      if (data) setProductivity(data);
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    if (!productivity.length) return null;
    return {
      avgCompletion: (productivity.reduce((a, b) => a + (b.avg_completion_time_hours || 0), 0) / productivity.length).toFixed(1),
      totalCompleted: productivity.reduce((a, b) => a + (b.completed_tasks || 0), 0),
      totalOverdue: productivity.reduce((a, b) => a + (b.overdue_tasks || 0), 0),
    };
  }, [productivity]);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">System Reports</h1>
        <p className="text-muted-foreground">Monitor employee productivity and task performance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Tasks Done" value={stats?.totalCompleted || 0} icon={CheckCircle2} tone="emerald" />
        <StatCard title="Total Overdue" value={stats?.totalOverdue || 0} icon={AlertCircle} tone="rose" />
        <StatCard title="Avg. Time (Hours)" value={stats?.avgCompletion || 0} icon={Clock} tone="blue" />
        <StatCard title="Team Performance" value="Active" icon={TrendingUp} tone="primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Employee Productivity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {productivity.map((p) => (
                <div key={p.user_id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{p.full_name}</p>
                    <p className="text-xs text-muted-foreground">{p.completed_tasks} completed · {p.overdue_tasks} overdue</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={p.overdue_tasks > 3 ? "destructive" : "secondary"}>
                      {p.avg_completion_time_hours ? `${p.avg_completion_time_hours.toFixed(1)}h avg` : "N/A"}
                    </Badge>
                  </div>
                </div>
              ))}
              {productivity.length === 0 && <p className="text-sm text-center py-4 text-muted-foreground">No data available yet.</p>}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
           <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4" /> Country Performance (Draft)
              </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="space-y-2">
                 <div className="flex justify-between text-xs"><span>UK</span><span className="font-bold">12.4 days</span></div>
                 <div className="flex justify-between text-xs"><span>Australia</span><span className="font-bold">18.2 days</span></div>
                 <div className="flex justify-between text-xs"><span>USA</span><span className="font-bold">22.1 days</span></div>
               </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> Application Types
              </CardTitle>
            </CardHeader>
            <CardContent>
               <div className="space-y-2">
                 <div className="flex justify-between text-xs"><span>Bachelor</span><span className="font-bold">45%</span></div>
                 <div className="flex justify-between text-xs"><span>Masters</span><span className="font-bold">52%</span></div>
                 <div className="flex justify-between text-xs"><span>PhD</span><span className="font-bold">3%</span></div>
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, tone }: { title: string; value: string | number; icon: any; tone: string }) {
  const tones: any = {
    primary: "bg-primary/10 text-primary border-primary/20",
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    rose: "bg-rose-500/10 text-rose-600 border-rose-500/20",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };
  return (
    <Card className="overflow-hidden border-border/50">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="mt-1 text-2xl font-bold tracking-tight">{value}</h3>
          </div>
          <div className={cn("rounded-xl border p-2", tones[tone])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
