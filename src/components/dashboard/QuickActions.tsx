import { Link } from "@tanstack/react-router";
import { FileText, UserPlus, Calendar, MessageSquare, Upload, ClipboardList } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import type { AppRole } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Action = { title: string; url: string; icon: React.ComponentType<{ className?: string }>; roles?: AppRole[]; color: string };

const ACTIONS: Action[] = [
  { title: "New Application", url: "/applications", icon: FileText, color: "bg-primary/10 text-primary", roles: ["admin", "counselor", "application_team", "student"] },
  { title: "Add Student", url: "/students", icon: UserPlus, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", roles: ["admin", "counselor"] },
  { title: "Schedule Meeting", url: "/tasks", icon: Calendar, color: "bg-sky-500/10 text-sky-600 dark:text-sky-400", roles: ["admin", "counselor"] },
  { title: "Send Message", url: "/tasks", icon: MessageSquare, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { title: "Upload Documents", url: "/applications", icon: Upload, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { title: "New Task", url: "/tasks", icon: ClipboardList, color: "bg-rose-500/10 text-rose-600 dark:text-rose-400", roles: ["admin", "counselor", "application_team"] },
];

export function QuickActions() {
  const { hasAnyRole, roles } = useAuth();
  const visible = ACTIONS.filter((a) => !a.roles || hasAnyRole(a.roles) || roles.includes("admin"));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {visible.map((a) => (
            <Link
              key={a.title}
              to={a.url}
              className="group flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-all hover:border-primary/50 hover:bg-accent"
            >
              <div className={cn("grid h-10 w-10 place-items-center rounded-lg transition-transform group-hover:scale-105", a.color)}>
                <a.icon className="h-5 w-5" />
              </div>
              <span className="text-xs font-medium leading-tight">{a.title}</span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
