import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Mail, Phone, Building2, ShieldCheck, Loader2, Lock, Unlock, Clock,
  CheckCircle2, XCircle, User as UserIcon, MessageSquare, PauseCircle,
} from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listUsers, lockUser, setStatus, writeAudit, type AdminUser, type UserStatus,
} from "@/lib/user-management";
import { useChat } from "@/components/chat/ChatProvider";

export const Route = createFileRoute("/_authenticated/counselors/$counselorId")({
  component: () => (
    <RoleGuard roles={["admin"]}>
      <CounselorDetailPage />
    </RoleGuard>
  ),
});

function initials(name: string | null, email: string) {
  const src = (name || email || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : src.slice(0, 2);
  return chars.toUpperCase();
}

function fmtDate(v: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString();
  } catch {
    return v;
  }
}

function CounselorDetailPage() {
  const { counselorId } = Route.useParams();
  const navigate = useNavigate();
  const { toggle: toggleChat } = useChat();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [pending, setPending] = useState<null | "activate" | "deactivate" | "lock" | "unlock">(null);
  const [working, setWorking] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const all = await listUsers();
      const found = all.find((u) => u.id === counselorId) ?? null;
      setUser(found);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load counselor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [counselorId]);

  const applyChange = async () => {
    if (!pending || !user) return;
    setWorking(true);
    try {
      if (pending === "activate" || pending === "deactivate") {
        const next: UserStatus = pending === "activate" ? "active" : "inactive";
        await setStatus(user.id, next);
        if (pending === "activate" && user.is_locked) await lockUser(user.id, false);
        await writeAudit({ action: `user.status.${pending}`, target_user_id: user.id, metadata: { via: "counselors.detail" } });
        toast.success(`${user.full_name ?? user.email} marked ${next}`);
      } else {
        const locked = pending === "lock";
        await lockUser(user.id, locked);
        await writeAudit({ action: `user.${pending}`, target_user_id: user.id, metadata: { via: "counselors.detail" } });
        toast.success(`${user.full_name ?? user.email} ${locked ? "locked" : "unlocked"}`);
      }
      setPending(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update status");
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="p-10 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !user.roles.includes("counselor")) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/counselors" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to counselors
        </Button>
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={UserIcon}
              title="Counselor not found"
              description="This user no longer exists or does not have the Counselor role."
              className="border-0 bg-transparent"
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const locked = user.is_locked;
  const inactive = user.status !== "active";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/counselors" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <Button size="sm" asChild>
          <Link to="/users">
            <ShieldCheck className="mr-2 h-4 w-4" /> Manage in Users
          </Link>
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="-mt-12 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <Avatar className="h-24 w-24 border-4 border-background shadow-md">
              {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.full_name ?? user.email} />}
              <AvatarFallback className="text-lg">{initials(user.full_name, user.email)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {user.full_name || user.email.split("@")[0]}
                </h1>
                {locked ? (
                  <Badge variant="outline" className="text-destructive border-destructive/40">
                    <Lock className="mr-1 h-3 w-3" /> Locked
                  </Badge>
                ) : inactive ? (
                  <Badge variant="outline">Inactive</Badge>
                ) : (
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Active
                  </Badge>
                )}
                {user.email_verified ? (
                  <Badge variant="secondary" className="text-[10px]">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Email verified
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    <XCircle className="mr-1 h-3 w-3" /> Not verified
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.roles.map((r) => (
                  <Badge key={r} variant="secondary" className="text-[10px] font-normal">
                    {r === "application_team" ? "Application Team" : r.charAt(0).toUpperCase() + r.slice(1)}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={`mailto:${user.email}`}>
                  <Mail className="mr-2 h-4 w-4" /> Email
                </a>
              </Button>
              {user.phone && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`tel:${user.phone}`}>
                    <Phone className="mr-2 h-4 w-4" /> Call
                  </a>
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => toggleChat()}>
                <MessageSquare className="mr-2 h-4 w-4" /> Message
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="text-sm font-semibold text-muted-foreground">Contact information</h2>
            <DetailRow icon={Mail} label="Email" value={user.email} href={`mailto:${user.email}`} />
            <DetailRow icon={Phone} label="Phone" value={user.phone ?? "—"} href={user.phone ? `tel:${user.phone}` : undefined} />
            <DetailRow icon={Building2} label="Department" value={user.department ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground">Account status</h2>
            </div>
            <DetailRow
              icon={CheckCircle2}
              label="Status"
              value={locked ? "Locked" : inactive ? "Inactive" : "Active"}
            />
            <DetailRow icon={Clock} label="Last login" value={fmtDate(user.last_login_at)} />
            <DetailRow icon={Clock} label="Account created" value={fmtDate(user.created_at)} />
            {user.email_confirmed_at && (
              <DetailRow icon={CheckCircle2} label="Verified at" value={fmtDate(user.email_confirmed_at)} />
            )}
            <div className="flex flex-wrap gap-2 border-t pt-3">
              {inactive || locked ? (
                <Button size="sm" variant="outline" onClick={() => setPending("activate")}>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" /> Activate
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setPending("deactivate")}>
                  <PauseCircle className="mr-1.5 h-4 w-4" /> Deactivate
                </Button>
              )}
              {locked ? (
                <Button size="sm" variant="outline" onClick={() => setPending("unlock")}>
                  <Unlock className="mr-1.5 h-4 w-4" /> Unlock
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setPending("lock")}>
                  <Lock className="mr-1.5 h-4 w-4" /> Lock
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending === "activate" && `Activate ${user.full_name ?? user.email}?`}
              {pending === "deactivate" && `Deactivate ${user.full_name ?? user.email}?`}
              {pending === "lock" && `Lock ${user.full_name ?? user.email}?`}
              {pending === "unlock" && `Unlock ${user.full_name ?? user.email}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending === "deactivate" && "The counselor will not be able to sign in until reactivated. An audit entry will be recorded."}
              {pending === "activate" && "The counselor will regain access. If they were locked, the lock will also be cleared."}
              {pending === "lock" && "The counselor's account will be locked. They cannot sign in until unlocked."}
              {pending === "unlock" && "The lock will be removed and the counselor can sign in again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); applyChange(); }} disabled={working}>
              {working ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  href?: string;
}) {
  const content = (
    <span className="truncate text-sm font-medium">{value}</span>
  );
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-8 w-8 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
        {href ? (
          <a href={href} className="block truncate text-sm font-medium hover:text-primary">{value}</a>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
