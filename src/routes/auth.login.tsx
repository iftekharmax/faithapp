import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail, AlertCircle } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase, type AppRole } from "@/lib/supabase";
import { getRoleHome } from "@/lib/auth-context";

export const Route = createFileRoute("/auth/login")({
  head: () => ({
    meta: [
      { title: "Login - Faith Education Global Admissions" },
      { name: "description", content: "Sign in to Faith Education to manage your student applications and consultancy workflow." },
      { property: "og:title", content: "Login - Faith Education" },
      { property: "og:description", content: "Access your global admissions dashboard." },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(255, "Email is too long"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters")
    .max(72, "Password is too long"),
});

type FieldErrors = Partial<Record<"email" | "password" | "form", string>>;

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validate = (): boolean => {
    const result = loginSchema.safeParse({ email, password });
    if (result.success) {
      setErrors({});
      return true;
    }
    const fieldErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as "email" | "password" | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    setErrors(fieldErrors);
    return false;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error || !data.user) {
      setLoading(false);
      const msg = error?.message ?? "Unable to sign in";
      const friendly = /invalid login credentials/i.test(msg)
        ? "Incorrect email or password"
        : /email not confirmed/i.test(msg)
        ? "Please verify your email address before signing in. Check your inbox for the confirmation link."
        : msg;
      setErrors({ form: friendly });
      toast.error(friendly);
      return;
    }

    // Block role-based redirect until email is verified.
    const verified = Boolean(data.user.email_confirmed_at ?? data.user.confirmed_at);
    if (!verified) {
      await supabase.auth.signOut();
      setLoading(false);
      const msg = "Please verify your email address before signing in. Check your inbox for the confirmation link.";
      setErrors({ form: msg });
      toast.error(msg);
      return;
    }

    // Fetch profile to enforce lock/inactive gates.
    const { data: prof } = await supabase
      .from("profiles")
      .select("status,is_locked")
      .eq("id", data.user.id)
      .maybeSingle();
    const p = prof as { status?: string; is_locked?: boolean } | null;
    if (p?.is_locked) {
      await supabase.auth.signOut();
      setLoading(false);
      const msg = "Your account is locked. Contact an administrator.";
      setErrors({ form: msg });
      toast.error(msg);
      return;
    }
    if (p?.status && p.status !== "active") {
      await supabase.auth.signOut();
      setLoading(false);
      const msg = "Your account is inactive. Contact an administrator.";
      setErrors({ form: msg });
      toast.error(msg);
      return;
    }

    // Record last login (best effort)
    try { await supabase.rpc("record_login", { _user_id: data.user.id }); } catch {}

    // Role-based landing route
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = ((roleRows as { role: AppRole }[]) ?? []).map((r) => r.role);
    const home = getRoleHome(roles);

    setLoading(false);
    toast.success("Welcome back!");
    navigate({ to: home, replace: true });
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="space-y-2">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
          Sign in
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to continue managing your workspace.
        </p>
      </div>

      {errors.form && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errors.form}</span>
        </div>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <div className="space-y-1.5">
          <Label
            htmlFor="email"
            className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            Email address
          </Label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((s) => ({ ...s, email: undefined }));
              }}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              className={`h-11 pl-9 ${errors.email ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
            />
          </div>
          {errors.email && (
            <p id="email-error" className="text-xs font-medium text-destructive">
              {errors.email}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
            >
              Password
            </Label>
            <Link
              to="/auth/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((s) => ({ ...s, password: undefined }));
              }}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              className={`h-11 pl-9 pr-10 ${errors.password ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && (
            <p id="password-error" className="text-xs font-medium text-destructive">
              {errors.password}
            </p>
          )}
        </div>

        <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
          Keep me signed in on this device
        </label>

        <Button
          type="submit"
          disabled={loading}
          className="group h-11 w-full bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-lg shadow-primary/25 transition hover:shadow-xl hover:shadow-primary/30 hover:brightness-110"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? "Signing in..." : "Sign in to Faith AMS"}
        </Button>
      </form>

      <div className="mt-8 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>New here?</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Don't have an account?{" "}
        <Link to="/auth/signup" className="font-semibold text-primary hover:underline">
          Create a free account
        </Link>
      </p>
    </div>
  );
}
