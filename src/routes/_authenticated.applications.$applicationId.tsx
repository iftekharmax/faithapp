import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Loader2, Save, Trash2, Plus, GraduationCap, Building2,
  FileText, ClipboardCheck, Award, History, User, Mail, Calendar,
  DollarSign, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  APPLICATION_STATUS_LABELS,
  getApplication, updateApplication, deleteApplication,
  listApplicationTimeline, addTimelineNote,
  validateApplicationInput, allowedNextStatuses,
  type Application, type ApplicationTimelineEvent,
  type ApplicationInput, type ApplicationStatus,
  listStaff, type StaffOption
} from "@/lib/applications";
import { useAuth } from "@/lib/auth-context";
import { StatusStepper } from "@/components/applications/StatusStepper";
import { cn } from "@/lib/utils";

import { ReviewWorkflow } from "@/components/applications/ReviewWorkflow";
import { OfferPanel } from "@/components/applications/OfferPanel";
import { DocumentRequestsPanel } from "@/components/applications/DocumentRequestsPanel";
import { TimelineEventItem } from "@/components/applications/TimelineEventItem";
import { StatusLegend } from "@/components/applications/StatusLegend";
import { NextActions } from "@/components/applications/NextActions";
import { listDocumentRequests, type DocumentRequest } from "@/lib/document-requests";
import { getUndoDurationMs } from "@/lib/undo-prefs";
import { showUndoToast } from "@/components/ui/undo-toast";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/_authenticated/applications/$applicationId")({
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team", "student"]}>
      <ApplicationDetailPage />
    </RoleGuard>
  ),
});

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  draft: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
  submitted: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  under_review: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  offer_received: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20",
  conditional_offer: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
  unconditional_offer: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  deposit_paid: "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20",
  cas_issued: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20",
  visa_applied: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
  visa_granted: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  visa_refused: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
  enrolled: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
  withdrawn: "bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20",
  rejected: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
};


function ApplicationDetailPage() {
  const { applicationId } = Route.useParams();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timeline, setTimeline] = useState<ApplicationTimelineEvent[]>([]);
  const [docRequests, setDocRequests] = useState<DocumentRequest[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDesc, setNoteDesc] = useState("");
  const [activeTab, setActiveTab] = useState<string>("timeline");
  const [appTeam, setAppTeam] = useState<StaffOption[]>([]);

  const reloadTimeline = async () => {
    try {
      const [t, d] = await Promise.all([
        listApplicationTimeline(applicationId),
        listDocumentRequests(applicationId).catch(() => [] as DocumentRequest[]),
      ]);
      setTimeline(t);
      setDocRequests(d);
    } catch (e: any) { toast.error(e.message ?? "Failed to refresh timeline"); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [a, t, d, team] = await Promise.all([
        getApplication(applicationId),
        listApplicationTimeline(applicationId),
        listDocumentRequests(applicationId).catch(() => [] as DocumentRequest[]),
        listStaff("application_team"),
      ]);
      setApp(a); setTimeline(t); setDocRequests(d); setAppTeam(team);
    } catch (e: any) { toast.error(e.message ?? "Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`application-detail-${applicationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "application_timeline",
          filter: `application_id=eq.${applicationId}`,
        },
        () => {
          reloadTimeline();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "application_document_requests",
          filter: `application_id=eq.${applicationId}`,
        },
        () => {
          reloadTimeline();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "applications",
          filter: `id=eq.${applicationId}`,
        },
        async () => {
          try {
            const updated = await getApplication(applicationId);
            setApp(updated);
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [applicationId]);

  const displayedTimeline = useMemo(() => {
    const seenRequestIds = new Set<string>();
    return timeline.filter((e) => {
      const meta = (e.metadata ?? {}) as Record<string, unknown>;
      const requestId = typeof meta.request_id === "string" ? meta.request_id : null;
      if (!requestId) return true;
      if (seenRequestIds.has(requestId)) return false;
      seenRequestIds.add(requestId);
      return true;
    });
  }, [timeline]);

  const patch: ApplicationInput | null = useMemo(() => app ? {
    student_id: app.student_id, country: app.country, university: app.university,
    campus: app.campus, program: app.program, degree: app.degree, intake: app.intake,
    scholarship: app.scholarship, application_fee: app.application_fee,
    status: app.status,
    notes: app.notes,
    assigned_team_id: app.assigned_team_id,
    assigned_team: app.assigned_team,
  } : null, [app]);

  const set = <K extends keyof Application>(k: K, v: Application[K]) =>
    setApp((a) => a ? { ...a, [k]: v } : a);

  const save = async () => {
    if (!app || !patch) return;
    const errs = validateApplicationInput(patch);
    setErrors(errs);
    if (Object.keys(errs).length) { toast.error("Fix validation errors"); return; }
    
    const isAssignmentChange = patch.assigned_team_id !== app.assigned_team_id;
    setSaving(true);
    try {
      await updateApplication(app.id, patch);
      
      // If assignment changed manually and triggers aren't reliable/instant, we could call an RPC or rely on the trigger
      // The trigger we added (on_application_assignment_change) handles timeline and internal notifications.
      
      toast.success(isAssignmentChange ? "Application reassigned" : "Saved");
      await load();
    } catch (e: any) { toast.error(e.message ?? "Failed to save"); }
    finally { setSaving(false); }
  };

  const quickStatus = async (next: ApplicationStatus, opts?: { silent?: boolean }) => {
    if (!app) return;
    const prev = app.status;
    try {
      await updateApplication(app.id, { status: next });
      await load();
      if (opts?.silent) {
        toast.success(`Reverted to ${APPLICATION_STATUS_LABELS[next]}`);
      } else {
        const canUndo = allowedNextStatuses(next, isAdmin).includes(prev);
        const appLabel = app.application_code ?? "application";
        if (canUndo) {
          showUndoToast({
            title: `${appLabel}: ${APPLICATION_STATUS_LABELS[next]}`,
            description: `Was ${APPLICATION_STATUS_LABELS[prev]}`,
            undoLabel: `Revert to ${APPLICATION_STATUS_LABELS[prev]}`,
            onUndo: () => quickStatus(prev, { silent: true }),
            link: {
              label: "Open application",
              to: "/applications/$applicationId",
              params: { applicationId: app.id },
            },
          });
        } else {
          toast.success(`${appLabel}: ${APPLICATION_STATUS_LABELS[next]}`, {
            description: `Previous status was ${APPLICATION_STATUS_LABELS[prev]}.`,
            duration: getUndoDurationMs(),
          });
        }
      }
    } catch (e: any) { toast.error(e.message ?? "Failed to update status"); }
  };



  const remove = async () => {
    if (!app) return;
    try {
      await deleteApplication(app.id);
      toast.success("Application deleted");
      navigate({ to: "/applications" });
    } catch (e: any) { toast.error(e.message ?? "Failed to delete"); }
  };

  const submitNote = async () => {
    if (!noteTitle.trim()) { toast.error("Title required"); return; }
    try {
      await addTimelineNote(applicationId, noteTitle.trim(), noteDesc.trim() || undefined);
      setNoteTitle(""); setNoteDesc("");
      const t = await listApplicationTimeline(applicationId);
      setTimeline(t);
      toast.success("Note added");
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  const err = (k: string) => errors[k] ?? null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading application…</p>
      </div>
    );
  }
  if (!app) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="text-sm text-muted-foreground">Application not found.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to="/applications"><ArrowLeft className="mr-2 h-4 w-4" /> Back to applications</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Breadcrumbs & Back */}
      <nav className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/applications" className="hover:text-primary transition-colors">Applications</Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="font-medium text-foreground">{app.application_code}</span>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-8 rounded-lg gap-2 text-muted-foreground hover:text-foreground">
          <Link to="/applications"><ArrowLeft className="h-3.5 w-3.5" /> Back to list</Link>
        </Button>
      </nav>

      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 shadow-sm sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />

        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="hidden h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md sm:grid">
              <GraduationCap className="h-6 w-6" />
            </div>

            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
                  {app.application_code}
                </h1>
                <Badge variant="outline" className={cn("border font-medium", STATUS_STYLES[app.status])}>
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  {APPLICATION_STATUS_LABELS[app.status]}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {app.student && (
                  <span className="inline-flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span className="truncate">{app.student.full_name}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" />
                  <span className="truncate">{app.university}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5" />
                  <span className="truncate">{app.program}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-1">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="bg-background/70 backdrop-blur">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete application?</AlertDialogTitle>
                  <AlertDialogDescription>This will remove the application and all its history.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button size="sm" onClick={save} disabled={saving} className="shadow-sm">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </div>

        {/* Quick facts strip */}
        <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <QuickFact icon={<Calendar className="h-3.5 w-3.5" />} label="Submitted"
            value={app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "—"} />
          <QuickFact icon={<Sparkles className="h-3.5 w-3.5" />} label="Decision"
            value={app.decision_at ? new Date(app.decision_at).toLocaleDateString() : "—"} />
          <QuickFact icon={<DollarSign className="h-3.5 w-3.5" />} label="App fee"
            value={app.application_fee != null ? `$${Number(app.application_fee).toLocaleString()}` : "—"} />
          <QuickFact icon={<Calendar className="h-3.5 w-3.5" />} label="Intake"
            value={app.intake || "—"} />
        </div>
      </div>

      <StatusStepper current={app.status} />

      <NextActions
        applicationId={app.id}
        currentStatus={app.status}
        onQuickStatus={quickStatus}
        onRequestDocuments={() => setActiveTab("requests")}
        hasOpenDocRequest={docRequests.some((r) => r.status !== "approved" && r.status !== "rejected")}
      />

      <Tabs
        value={activeTab}
        onValueChange={(tab) => {
          setActiveTab(tab);
          if (tab === "timeline" || tab === "requests") {
            void reloadTimeline();
          }
        }}
      >
        <div className="overflow-x-auto">
          <TabsList className="inline-flex h-auto flex-nowrap gap-1 rounded-xl bg-muted/60 p-1">
            <TabsTrigger value="timeline" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
              <History className="h-3.5 w-3.5" /> Timeline
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
              <ClipboardCheck className="h-3.5 w-3.5" /> Documents
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
              <ClipboardCheck className="h-3.5 w-3.5" /> Review
            </TabsTrigger>
            <TabsTrigger value="offers" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
              <Award className="h-3.5 w-3.5" /> Offers
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
              <FileText className="h-3.5 w-3.5" /> Details
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="requests" className="mt-5">
          <DocumentRequestsPanel
            applicationId={app.id}
            onFulfilled={async () => {
              await reloadTimeline();
            }}
          />
        </TabsContent>

        <TabsContent value="review" className="mt-5"><ReviewWorkflow applicationId={app.id} /></TabsContent>
        <TabsContent value="offers" className="mt-5"><OfferPanel applicationId={app.id} /></TabsContent>

        <TabsContent value="details" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Main column */}
            <div className="space-y-5 lg:col-span-2">
              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="h-4 w-4 text-primary" /> Program details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                  <Field label="Country"><Input value={app.country ?? ""} onChange={(e) => set("country", e.target.value)} /></Field>
                  <Field label="University" required error={err("university")}><Input value={app.university} onChange={(e) => set("university", e.target.value)} /></Field>
                  <Field label="Campus"><Input value={app.campus ?? ""} onChange={(e) => set("campus", e.target.value)} /></Field>
                  <Field label="Program" required error={err("program")}><Input value={app.program} onChange={(e) => set("program", e.target.value)} /></Field>
                  <Field label="Degree"><Input value={app.degree ?? ""} onChange={(e) => set("degree", e.target.value)} /></Field>
                  <Field label="Intake"><Input value={app.intake ?? ""} onChange={(e) => set("intake", e.target.value)} /></Field>
                  <Field label="Scholarship"><Input value={app.scholarship ?? ""} onChange={(e) => set("scholarship", e.target.value)} /></Field>
                  <Field label="Application fee" error={err("application_fee")}>
                    <Input type="number" min="0" step="0.01"
                      value={app.application_fee ?? ""}
                      onChange={(e) => set("application_fee", e.target.value === "" ? null : Number(e.target.value))} />
                  </Field>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4 text-primary" /> Notes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-5">
                  <Field label="Internal notes" error={err("notes")}>
                    <Textarea rows={6} placeholder="Add context, requirements, or reminders…"
                      value={app.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
                  </Field>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-base">Workflow</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-5">
                  <Field label="Status">
                    <Select value={app.status} onValueChange={(v) => set("status", v as ApplicationStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allowedNextStatuses(app.status, isAdmin).map((s) => (
                          <SelectItem key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Assigned">
                    <Select value={app.assigned_team_id || "__none__"} onValueChange={(v) => set("assigned_team_id", v === "__none__" ? null : v)}>
                      <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Unassigned —</SelectItem>
                        {appTeam.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.full_name || u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                </CardContent>
              </Card>

              {app.student && (
                <Card className="overflow-hidden">
                  <CardHeader className="border-b bg-muted/30">
                    <CardTitle className="text-base">Student</CardTitle>
                  </CardHeader>
                  <CardContent className="p-5">
                    <Link
                      to="/students/$studentId"
                      params={{ studentId: app.student.id }}
                      className="group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-accent"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary font-semibold">
                        {app.student.full_name?.[0]?.toUpperCase() ?? "S"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium group-hover:text-primary">{app.student.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{app.student.student_code}</p>
                        {app.student.email && (
                          <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" /> {app.student.email}
                          </p>
                        )}
                      </div>
                    </Link>
                  </CardContent>
                </Card>
              )}

              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="text-base">Timestamps</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-5 text-sm">
                  <TimeRow label="Created" value={new Date(app.created_at).toLocaleString()} />
                  <Separator />
                  <TimeRow label="Updated" value={new Date(app.updated_at).toLocaleString()} />
                  <Separator />
                  <TimeRow label="Submitted" value={app.submitted_at ? new Date(app.submitted_at).toLocaleString() : "—"} />
                  <Separator />
                  <TimeRow label="Decision" value={app.decision_at ? new Date(app.decision_at).toLocaleString() : "—"} />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-5">
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <Card className="overflow-hidden lg:sticky lg:top-4">
                <CardHeader className="border-b bg-muted/30">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Plus className="h-4 w-4 text-primary" /> Add note
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-5">
                  <Input placeholder="Title" value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} />
                  <Textarea rows={4} placeholder="Details (optional)" value={noteDesc} onChange={(e) => setNoteDesc(e.target.value)} />
                  <Button size="sm" className="w-full" onClick={submitNote}>
                    <Plus className="mr-2 h-4 w-4" /> Add note
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/30">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <History className="h-4 w-4 text-primary" /> Activity history
                    </CardTitle>
                    <StatusLegend />
                  </div>
                </CardHeader>
                <CardContent className="p-5">
                  {displayedTimeline.length === 0 ? (
                    <div className="py-12 text-center">
                      <History className="mx-auto h-8 w-8 text-muted-foreground/40" />
                      <p className="mt-3 text-sm text-muted-foreground">No events yet.</p>
                    </div>
                  ) : (
                    <ol className="relative space-y-4 border-l-2 border-dashed border-border pl-6">
                      {displayedTimeline.map((e, i) => (
                        <TimelineEventItem
                          key={e.id}
                          event={e}
                          isLatest={i === 0}
                          docRequestsById={Object.fromEntries(docRequests.map((r) => [r.id, r]))}
                          onChanged={reloadTimeline}
                        />
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QuickFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-background/70 p-3 backdrop-blur">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function TimeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="truncate text-right text-xs text-foreground">{value}</span>
    </div>
  );
}

function Field({ label, error, required, children }: { label: string; error?: string | null; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
