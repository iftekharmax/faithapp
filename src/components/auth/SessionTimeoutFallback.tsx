import { AlertTriangle, RotateCw, LogIn } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";

export function SessionTimeoutFallback() {
  const { retrySession } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-foreground">
          Taking longer than usual
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't verify your session in time. This is usually a slow or
          interrupted connection. Try again, or head back to sign in.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={() => retrySession()} className="h-11">
            <RotateCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/auth/login", replace: true })}
            className="h-11"
          >
            <LogIn className="mr-2 h-4 w-4" />
            Go to sign in
          </Button>
        </div>
      </div>
    </div>
  );
}
