import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  profile: "Profile",
  settings: "Settings",
  "change-password": "Change Password",
  applications: "Applications",
  students: "Students",
  counselors: "Counselors",
  users: "Users",
  tasks: "Tasks",
  programs: "Programs",
};

export function Breadcrumbs() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
      <Link
        to="/dashboard"
        className="grid h-7 w-7 place-items-center rounded-md border border-border/60 bg-card/50 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
      >
        <Home className="h-3.5 w-3.5" />
      </Link>
      {parts.map((seg, i) => {
        const to = "/" + parts.slice(0, i + 1).join("/");
        const isLast = i === parts.length - 1;
        const label = LABELS[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        return (
          <Fragment key={to}>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
            {isLast ? (
              <span className="truncate rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                {label}
              </span>
            ) : (
              <Link to={to} className="truncate rounded-md px-1.5 py-0.5 font-medium transition-colors hover:bg-accent hover:text-foreground">
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
