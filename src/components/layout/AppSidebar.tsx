import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  FileText,
  GraduationCap,
  Settings,
  UserCircle,
  Briefcase,
  ClipboardList,
  BookOpen,
  ScrollText,
  Building2,
  Globe,
  Sparkles,
  ChevronRight,
  Building,
  ShieldCheck,
  Database,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth-context";
import type { AppRole } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: AppRole[];
  badge?: string;
};

type NavGroupItem = NavItem & { children: NavItem[] };

const mainNav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Applications", url: "/applications", icon: FileText, roles: ["admin", "counselor", "application_team", "student"] },
  { title: "Students", url: "/students", icon: GraduationCap, roles: ["admin", "counselor", "application_team"] },
  { title: "Universities", url: "/universities", icon: Building2, roles: ["admin", "counselor", "application_team", "student"] },
  { title: "Countries", url: "/countries", icon: Globe, roles: ["admin"] },
  { title: "Counselors", url: "/counselors", icon: Briefcase, roles: ["admin"] },
  { title: "Tasks", url: "/tasks", icon: ClipboardList, roles: ["admin", "counselor", "application_team"] },
  { title: "Programs", url: "/programs", icon: BookOpen, roles: ["admin", "counselor", "student"] },
];

const usersGroup: NavGroupItem = {
  title: "Users",
  url: "/users",
  icon: Users,
  roles: ["admin"],
  children: [
    { title: "All Users", url: "/users", icon: Users, roles: ["admin"] },
    { title: "Departments", url: "/departments", icon: Building, roles: ["admin"] },
    { title: "Roles", url: "/roles", icon: ShieldCheck, roles: ["admin"] },
  ],
};

const adminNav: NavItem[] = [
  { title: "Audit Log", url: "/audit-logs", icon: ScrollText, roles: ["admin"] },
  { title: "Schema status", url: "/admin/schema", icon: Database, roles: ["admin"] },
];


const accountNav: NavItem[] = [
  { title: "Profile", url: "/profile", icon: UserCircle },
  { title: "Settings", url: "/settings", icon: Settings },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { hasAnyRole, roles, profile } = useAuth();

  const canSee = (item: NavItem) =>
    !item.roles || item.roles.length === 0 || hasAnyRole(item.roles) || roles.includes("admin");

  const isActive = (url: string) => currentPath === url || currentPath.startsWith(url + "/");

  const primaryRole = roles[0] ?? "user";
  const initials = (profile?.full_name || profile?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const renderItem = (item: NavItem) => {
    const active = isActive(item.url);
    return (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.title}
          className={cn(
            "group/nav relative h-9 rounded-lg font-medium transition-all",
            "data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/15 data-[active=true]:to-primary/5",
            "data-[active=true]:text-primary data-[active=true]:shadow-sm",
            "hover:bg-accent/70",
          )}
        >
          <Link to={item.url} className="flex items-center gap-2.5">
            {active && !collapsed && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
            )}
            <item.icon
              className={cn(
                "h-4 w-4 shrink-0 transition-colors",
                active ? "text-primary" : "text-muted-foreground group-hover/nav:text-foreground",
              )}
            />
            <span className="truncate">{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (group: NavGroupItem) => {
    const anyActive = group.children.some((c) => isActive(c.url));
    return (
      <UsersCollapsible
        key={group.url}
        group={group}
        collapsed={collapsed}
        anyActive={anyActive}
        renderChild={(child) => {
          const active = isActive(child.url);
          return (
            <SidebarMenuSubItem key={child.url}>
              <SidebarMenuSubButton asChild isActive={active}>
                <Link to={child.url} className="flex items-center gap-2">
                  <child.icon className="h-3.5 w-3.5" />
                  <span className="truncate">{child.title}</span>
                </Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          );
        }}
      />
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      <SidebarHeader className="border-b border-sidebar-border/60 bg-gradient-to-br from-sidebar to-sidebar/60">
        <div className="flex items-center gap-2.5 px-2 py-2.5">
          <div className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-white/10">
            <GraduationCap className="h-5 w-5 relative z-10" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,white_0%,transparent_60%)] opacity-30" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-bold tracking-tight truncate">Faith AMS</span>
              <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground truncate">
                <Sparkles className="h-2.5 w-2.5" />
                Application Suite
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-1 px-1.5">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">{mainNav.filter(canSee).map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(canSee(usersGroup) || adminNav.some(canSee)) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
              Administration
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {canSee(usersGroup) && renderGroup(usersGroup)}
                {adminNav.filter(canSee).map(renderItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}


        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            Account
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">{accountNav.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60 p-2">
        {collapsed ? (
          <div className="grid h-9 w-9 mx-auto place-items-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-xs font-semibold text-primary ring-1 ring-primary/20">
            {initials}
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-sidebar-border/70 bg-gradient-to-br from-background to-sidebar-accent/50 p-2 shadow-sm">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-xs font-semibold text-primary-foreground shadow-sm">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs font-semibold">{profile?.full_name || profile?.email || "User"}</div>
              <div className="truncate text-[10px] capitalize text-muted-foreground">
                {primaryRole.replace("_", " ")}
              </div>
            </div>
            <span className="grid h-2 w-2 place-items-center rounded-full bg-emerald-500 shadow-[0_0_0_3px_hsl(var(--background))]" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

function UsersCollapsible({
  group,
  collapsed,
  anyActive,
  renderChild,
}: {
  group: NavGroupItem;
  collapsed: boolean;
  anyActive: boolean;
  renderChild: (child: NavItem) => React.ReactNode;
}) {
  const [open, setOpen] = useState(anyActive);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={group.title}
        isActive={anyActive}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group/nav relative h-9 rounded-lg font-medium transition-all",
          "data-[active=true]:bg-gradient-to-r data-[active=true]:from-primary/15 data-[active=true]:to-primary/5",
          "data-[active=true]:text-primary data-[active=true]:shadow-sm",
          "hover:bg-accent/70",
        )}
      >
        <group.icon className={cn("h-4 w-4 shrink-0", anyActive ? "text-primary" : "text-muted-foreground")} />
        <span className="truncate flex-1 text-left">{group.title}</span>
        {!collapsed && (
          <ChevronRight
            className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")}
          />
        )}
      </SidebarMenuButton>
      {open && !collapsed && (
        <SidebarMenuSub>{group.children.map(renderChild)}</SidebarMenuSub>
      )}
    </SidebarMenuItem>
  );
}

