import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";
import { SessionTimeoutFallback } from "@/components/auth/SessionTimeoutFallback";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading, sessionTimedOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || sessionTimedOut) return;
    navigate({ to: session ? "/dashboard" : "/auth/login", replace: true });
  }, [session, loading, sessionTimedOut, navigate]);

  if (sessionTimedOut && !session) {
    return <SessionTimeoutFallback />;
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
