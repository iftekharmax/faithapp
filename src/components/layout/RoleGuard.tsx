import type { ReactNode } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import type { AppRole } from "@/lib/supabase";

export function RoleGuard({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { hasAnyRole, authReady, rolesReady, permissionsReady, loading } = useAuth();

  const isAuthReady = authReady && rolesReady && permissionsReady;

  // Persistent state safety: If we already had data but it's re-validating, don't show spinner
  if (loading || (!isAuthReady && !hasAnyRole(roles))) {
    return (
      <div className="flex h-[200px] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Checking permissions...</span>
        </div>
      </div>
    );
  }

  if (!hasAnyRole(roles)) {
    return (
      <div className="mx-auto max-w-md pt-10">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-destructive/10 text-destructive">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold">Access denied</h2>
            <p className="text-sm text-muted-foreground">
              You don't have permission to view this page. Contact an administrator if you think this is a mistake.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          This module is scaffolded and ready for feature work.
        </CardContent>
      </Card>
    </div>
  );
}
