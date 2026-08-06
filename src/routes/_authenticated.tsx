import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Loader2, MailCheck, ShieldAlert } from "lucide-react";
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
  const { session, loading, rolesLoading, rolesLoadError, reloadUserData, sessionTimedOut, emailVerified, signOut } = useAuth();
  const navigate = useNavigate();
  const hadSessionRef = useRef(false);

  useEffect(() => {
    if (session) { hadSessionRef.current = true; return; }
    if (loading || sessionTimedOut) return;
    // Debounce transient session drops (token rotation races). Only redirect
    // if the session is still missing after a short grace period AND we can
    // confirm with Supabase directly that there is no user.
    const t = setTimeout(async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) navigate({ to: "/auth/login", replace: true });
    }, 2500);
    return () => clearTimeout(t);
  }, [session, loading, sessionTimedOut, navigate]);

  if (sessionTimedOut && !session) {
    return <SessionTimeoutFallback />;
  }

  if (loading || (!session && !hadSessionRef.current)) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (rolesLoadError && session) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-4">
        <div className="max-w-md w-full rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-foreground">Failed to load permissions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {rolesLoadError}. This might be a temporary connection issue.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => reloadUserData()} className="h-11">
              Retry loading
            </Button>
            <Button variant="outline" onClick={() => signOut()} className="h-11">
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }


  if (!session) {
    // Had a session before, waiting for the debounced confirm above.
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
