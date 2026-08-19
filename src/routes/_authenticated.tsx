import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ChatProvider } from "@/components/chat/ChatProvider";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { FloatingChatButton } from "@/components/chat/FloatingChatButton";
import { SessionTimeoutFallback } from "@/components/auth/SessionTimeoutFallback";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { session, loading, authReady, rolesReady, permissionsReady, sessionTimedOut, emailVerified, signOut } = useAuth();
  const navigate = useNavigate();
  const hadSessionRef = useRef(false);

  useEffect(() => {
    // Definitive redirect: Loading finished, we are ready, and there is no session.
    if (!loading && authReady && !session) {
      console.log("[AuthenticatedLayout] No session detected. Redirecting to login...");
      navigate({ to: "/auth/login", replace: true });
      return;
    }

    // Safety fallback for edge cases where session might be stale or authReady is delayed
    if (session || loading || !authReady || sessionTimedOut) return;
    
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        console.log("[AuthenticatedLayout] Safety check failed. Redirecting to login...");
        navigate({ to: "/auth/login", replace: true });
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [session, loading, authReady, sessionTimedOut, navigate]);

  if (sessionTimedOut && !session) {
    return <SessionTimeoutFallback />;
  }

  // Wait for all auth state to be ready
  const isAuthReady = authReady && rolesReady && permissionsReady;

  // Persistent state safety: If we have a session but data is just re-fetching in background,
  // do NOT show the loading overlay. Only show it on initial app load.
  if (loading || (!isAuthReady && !hadSessionRef.current)) {
    let loadingMessage = "Initializing session...";
    if (authReady && !rolesReady) loadingMessage = "Loading user roles...";
    if (authReady && rolesReady && !permissionsReady) loadingMessage = "Loading permissions...";

    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">
            {loadingMessage}
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }



  // Block role-based dashboards until email is verified.
  if (!emailVerified) {
    const email = session.user.email ?? "your inbox";
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
            <MailCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-foreground">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-medium text-foreground">{email}</span>. Please verify before
            accessing your workspace.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button
              onClick={async () => {
                if (!session.user.email) return;
                const { error } = await supabase.auth.resend({
                  type: "signup",
                  email: session.user.email,
                  options: { emailRedirectTo: `${window.location.origin}/auth/login` },
                });
                if (error) toast.error(error.message);
                else toast.success("Verification email re-sent");
              }}
              className="h-11"
            >
              Resend verification email
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                await signOut();
                navigate({ to: "/auth/login", replace: true });
              }}
              className="h-11"
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChatProvider>
      <DashboardLayout>
        <Outlet />
      </DashboardLayout>
      <FloatingChatButton />
      <ChatPanel />
    </ChatProvider>
  );
}
