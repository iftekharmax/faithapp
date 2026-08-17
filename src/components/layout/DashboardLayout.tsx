import { useState, type ReactNode } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "./NotificationBell";
import { HeaderChatButton } from "@/components/chat/HeaderChatButton";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { Separator } from "@/components/ui/separator";
import { Breadcrumbs } from "./Breadcrumbs";

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [isHovered, setIsHovered] = useState(false);
  const [open, setOpen] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
  };

  const effectiveOpen = open || isHovered;

  return (
    <SidebarProvider open={effectiveOpen} onOpenChange={handleOpenChange}>
      <div className="relative flex min-h-screen w-full bg-background">
        {/* Ambient background */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 opacity-[0.35] dark:opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 0%, oklch(0.85 0.09 260 / 0.35), transparent 40%), radial-gradient(circle at 85% 100%, oklch(0.82 0.10 200 / 0.28), transparent 45%)",
          }}
        />

        {/* Sidebar wrapper for hover and accessibility */}
        <div
          className="relative z-40"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onFocus={() => setIsHovered(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsHovered(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setIsHovered(false);
              (document.activeElement as HTMLElement)?.blur();
            }
          }}
        >
          <AppSidebar />
        </div>

        <SidebarInset className="flex min-w-0 flex-1 flex-col bg-transparent">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 sm:px-6">
            <SidebarTrigger className="h-9 w-9 rounded-lg hover:bg-accent focus-visible:ring-2 focus-visible:ring-primary" />
            <Separator orientation="vertical" className="mx-1 h-6" />
            <div className="min-w-0 flex-1">
              <Breadcrumbs />
            </div>

            <div className="flex items-center gap-0.5 sm:gap-1">
              <div className="hidden sm:flex items-center gap-0.5 rounded-xl border border-border/60 bg-card/50 p-1 shadow-sm backdrop-blur">
                <ThemeToggle />
                <HeaderChatButton />
                <NotificationBell />
              </div>
              <div className="flex sm:hidden items-center">
                <ThemeToggle />
                <HeaderChatButton />
                <NotificationBell />
              </div>
              <Separator orientation="vertical" className="mx-1 h-6" />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}