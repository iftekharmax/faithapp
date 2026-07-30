import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPasswordPage,
});

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address")
    .max(255, "Email is too long"),
});

const RESEND_COOLDOWN_SECONDS = 45;

type SendStatus = "idle" | "sending" | "sent" | "error";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const sendReset = async (targetEmail: string) => {
    setFormError(undefined);
    setStatus("sending");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    if (resetError) {
      setStatus("error");
      setFormError(resetError.message);
      toast.error(resetError.message);
      return false;
    }
    setStatus("sent");
    setSentAt(new Date());
    setAttempts((a) => a + 1);
    startCooldown();
    toast.success("Reset link sent — check your inbox");
    return true;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse({ email });
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message);
      return;
    }
    setFieldError(undefined);
    await sendReset(email.trim());
  };

  const onResend = async () => {
    if (cooldown > 0 || status === "sending") return;
    await sendReset(email.trim());
  };

  const resetPanel = () => {
    setStatus("idle");
    setFormError(undefined);
    setSentAt(null);
    setAttempts(0);
    setCooldown(0);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Link
        to="/auth/login"
        className="mb-6 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
      </Link>

      <div className="space-y-2">
        <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
          Reset password
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Send a password reset link
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter the email tied to your Faith AMS account. We'll email a secure link so you can set a new password.
        </p>
      </div>

      {status === "sent" ? (
        <div className="mt-8 space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                Reset link sent successfully
              </p>
              <p className="text-muted-foreground">
                If an account exists for{" "}
                <span className="font-medium text-foreground">{email}</span>, a
                password reset link is on its way. The link expires in{" "}
                <span className="font-medium text-foreground">60 minutes</span>.
              </p>
              {sentAt && (
                <p className="flex items-center gap-1 pt-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Sent at {sentAt.toLocaleTimeString()} · attempt {attempts}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">Didn't get the email?</p>
            <ul className="list-disc space-y-1 pl-4">
              <li>Check your spam or promotions folder.</li>
              <li>Make sure <span className="font-mono">{email}</span> is spelled correctly.</li>
              <li>Wait a minute — email delivery can be slightly delayed.</li>
              <li>Confirm the account exists; unregistered emails receive nothing.</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={onResend}
              disabled={cooldown > 0 || (status as SendStatus) === "sending"}
              className="h-11 flex-1"
            >
              {(status as SendStatus) === "sending" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resending...
                </>

              ) : cooldown > 0 ? (
                <>
                  <Clock className="mr-2 h-4 w-4" /> Resend in {cooldown}s
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" /> Resend reset link
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetPanel}
              className="h-11 flex-1"
            >
              Use a different email
            </Button>
          </div>

          <Button asChild variant="ghost" className="w-full">
            <Link to="/auth/login">Return to sign in</Link>
          </Button>
        </div>
      ) : (
        <>
          {formError && (
            <div
              role="alert"
              className="mt-6 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">We couldn't send the reset email</p>
                <p className="text-xs">{formError}</p>
                <p className="text-xs text-destructive/80">
                  Please verify the address and try again. If this keeps happening, contact your administrator.
                </p>
              </div>
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
                    if (fieldError) setFieldError(undefined);
                  }}
                  aria-invalid={Boolean(fieldError)}
                  className={`h-11 pl-9 ${fieldError ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                />
              </div>
              {fieldError && (
                <p className="flex items-center gap-1 text-xs font-medium text-destructive">
                  <AlertCircle className="h-3 w-3" /> {fieldError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={status === "sending"}
              className="h-11 w-full bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-lg shadow-primary/25 transition hover:shadow-xl hover:shadow-primary/30 hover:brightness-110"
            >
              {status === "sending" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {status === "sending"
                ? "Sending link..."
                : status === "error"
                  ? "Retry sending link"
                  : "Send reset link"}
            </Button>

            {status === "error" && (
              <p className="text-center text-[11px] text-muted-foreground">
                Tip: reset emails may be rate-limited. Wait a few seconds before retrying.
              </p>
            )}
          </form>
        </>
      )}
    </div>
  );
}
