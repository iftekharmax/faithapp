import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { SessionExpiredDialog } from "@/components/auth/SessionExpiredDialog";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Faith AMS — Application Management System" },
      { name: "description", content: "Faith AMS is an enterprise application management platform for education consultancies. Manage students, applications, counselors and workflows in one place." },
      { name: "author", content: "Faith AMS" },
      { property: "og:title", content: "Faith AMS — Application Management System" },
      { property: "og:description", content: "Faith AMS is an enterprise application management platform for education consultancies. Manage students, applications, counselors and workflows in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Faith AMS — Application Management System" },
      { name: "twitter:description", content: "Faith AMS is an enterprise application management platform for education consultancies. Manage students, applications, counselors and workflows in one place." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4762841a-0817-4678-91c2-5af5916f7532/id-preview-858af8d1--b3a95749-5360-4090-91dd-9f6eb945373a.lovable.app-1784334520300.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4762841a-0817-4678-91c2-5af5916f7532/id-preview-858af8d1--b3a95749-5360-4090-91dd-9f6eb945373a.lovable.app-1784334520300.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      // Warm up the Supabase connection early so the first auth/data call
      // doesn't pay DNS + TLS cost.
      { rel: "preconnect", href: "https://qdveirhlzuzrxaqjevxr.supabase.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://qdveirhlzuzrxaqjevxr.supabase.co" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    // Verify the students table has the columns from the latest migration.
    // Deferred to idle time so it never competes with first paint or the
    // initial auth/session round-trip.
    const run = () => {
      void import("../lib/schema-check").then((m) => m.verifyStudentSchema());
    };
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const id = ric ? ric(run, { timeout: 4000 }) : window.setTimeout(run, 2500);
    return () => {
      const cic = (window as any).cancelIdleCallback as ((h: number) => void) | undefined;
      if (ric && cic) cic(id);
      else window.clearTimeout(id);
    };
  }, []);


  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <SessionExpiredDialog />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
