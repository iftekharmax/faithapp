import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { GraduationCap, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  component: AuthLayout,
});

function AuthLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [session, loading, navigate]);

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-[radial-gradient(circle_at_top_left,theme(colors.blue.500),theme(colors.blue.700)_45%,theme(colors.slate.900))] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-blue-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full bg-cyan-400/20 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />

        <div className="relative z-10 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/15 shadow-lg shadow-blue-950/30 backdrop-blur-md ring-1 ring-white/20">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-semibold tracking-tight">Faith AMS</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">
              Application Management
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" />
            Trusted by modern consultancies
          </div>
          <h2 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight">
            Every student journey,{" "}
            <span className="bg-gradient-to-r from-white to-cyan-200 bg-clip-text text-transparent">
              orchestrated beautifully.
            </span>
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/80">
            Manage applications, counselors, tasks and documents in one enterprise-grade
            workspace designed for the teams shaping global education.
          </p>

          <ul className="mt-8 space-y-3 text-sm text-white/85">
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <ShieldCheck className="h-4 w-4" />
              </span>
              Enterprise-grade role-based access & audit
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <Users className="h-4 w-4" />
              </span>
              Counselor, student and admin workspaces
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                <Sparkles className="h-4 w-4" />
              </span>
              Realtime pipeline from inquiry to enrollment
            </li>
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-white/60">
          <span>© {new Date().getFullYear()} Faith AMS</span>
          <span>Secure sign-in · SSL encrypted</span>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center bg-background p-6 sm:p-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-60 lg:hidden"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 0%, oklch(0.9 0.05 260 / 0.35), transparent 50%)",
          }}
        />
        <div className="relative w-full max-w-md">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="text-base font-semibold">Faith AMS</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Application Management
              </div>
            </div>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
