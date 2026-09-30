import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, ArrowLeft, Check, Eye, EyeOff, Loader2, Lock, Mail, MailCheck, User } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/signup")({
  component: SignupPage,
});

const signupSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Please enter your full name")
    .max(100, "Name is too long"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(255, "Email is too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long"),
});

type FieldErrors = Partial<Record<"fullName" | "email" | "password" | "form", string>>;

function passwordStrength(pw: string): { label: string; score: number; tone: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: "Too short", tone: "bg-destructive" },
    { label: "Weak", tone: "bg-destructive" },
    { label: "Okay", tone: "bg-amber-500" },
    { label: "Good", tone: "bg-primary" },
    { label: "Strong", tone: "bg-emerald-500" },
  ];
  return { score, ...map[score] };
}

function SignupPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const strength = passwordStrength(password);

  const validate = (): boolean => {
    const result = signupSchema.safeParse({ fullName, email, password });
    if (result.success) {
      setErrors({});
      return true;
    }
    const fieldErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as "fullName" | "email" | "password" | undefined;
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    setErrors(fieldErrors);
    return false;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    const trimmedEmail = email.trim();
    const { data, error } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/login`,
        data: { full_name: fullName.trim(), role: "student" },
      },
    });
    setLoading(false);
    if (error) {
      const friendly = /already registered/i.test(error.message)
        ? "This email is already registered. Try signing in instead."
        : error.message;
      setErrors({ form: friendly });
      toast.error(friendly);
      return;
    }

    // If Supabase returned a session immediately (email confirmations disabled),
    // sign out so we still gate on the verification flow the user asked for.
    if (data.session) {
      await supabase.auth.signOut();
    }

    setPendingEmail(trimmedEmail);
    toast.success("Verification email sent — check your inbox");
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setResending(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/login` },
    });
    setResending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Verification email re-sent");
  };

  if (pendingEmail) {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/10 text-primary">
          <MailCheck className="h-7 w-7" />
        </div>
        <div className="mt-5 space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Verify your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a confirmation link to{" "}
            <span className="font-semibold text-foreground">{pendingEmail}</span>. Click the link
            to activate your account, then sign in.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <Button
            type="button"
            onClick={() => navigate({ to: "/auth/login" })}
            className="h-11 w-full bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-lg shadow-primary/25 transition hover:shadow-xl hover:shadow-primary/30 hover:brightness-110"
          >
            Go to sign in
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={resending}
            className="h-11 w-full"
          >
            {resending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {resending ? "Resending..." : "Resend verification email"}
          </Button>
          <button
            type="button"
            onClick={() => setPendingEmail(null)}
            className="mx-auto flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="space-y-2">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
          Create account
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Join Faith AMS
        </h1>
        <p className="text-sm text-muted-foreground">
          Register as a student to start your application journey.
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
          <Label htmlFor="fullName" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Full name
          </Label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="fullName"
              placeholder="Jane Doe"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                if (errors.fullName) setErrors((s) => ({ ...s, fullName: undefined }));
              }}
              aria-invalid={Boolean(errors.fullName)}
              className={`h-11 pl-9 ${errors.fullName ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
            />
          </div>
          {errors.fullName && <p className="text-xs font-medium text-destructive">{errors.fullName}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
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
              className={`h-11 pl-9 ${errors.email ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
            />
          </div>
          {errors.email && <p className="text-xs font-medium text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Password
          </Label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((s) => ({ ...s, password: undefined }));
              }}
              aria-invalid={Boolean(errors.password)}
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
          {password && (
            <div className="space-y-1 pt-1">
              <div className="flex gap-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition ${
                      i < strength.score ? strength.tone : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Password strength: <span className="font-medium text-foreground">{strength.label}</span>
              </p>
            </div>
          )}
          {errors.password && <p className="text-xs font-medium text-destructive">{errors.password}</p>}
        </div>

        <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          By creating an account you agree to Faith AMS's Terms of Service and Privacy Policy.
        </p>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-lg shadow-primary/25 transition hover:shadow-xl hover:shadow-primary/30 hover:brightness-110"
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/auth/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
