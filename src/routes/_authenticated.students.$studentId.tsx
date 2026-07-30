import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Loader2, Save, Upload, Trash2, Plus, FileText, Clock,
  Download, MessageSquare, User, GraduationCap, ShieldCheck, Pencil, RefreshCw, Eye, Search,
  Mail, Phone, Globe, Calendar, BadgeCheck, AlertTriangle, Sparkles, Undo2, XCircle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth-context";
import {
  getStudent, updateStudent, uploadStudentPhoto, validateStudentPhoto,
  listStudentDocuments, uploadStudentDocument, deleteStudentDocument, getSignedDocumentUrl,
  replaceStudentDocument, validateStudentDocument, DOC_MAX_BYTES,
  listStudentTimeline, addTimelineEvent, updateTimelineEvent, deleteTimelineEvent,
  writeStudentAudit, listStudentAudit, diffStudent, validateStudentInput,
  STUDENT_STATUSES, STUDENT_STATUS_LABELS, STUDENT_GENDERS, GENDER_LABELS,
  type Student, type StudentGender, type StudentStatus, type StudentDocument,
  type StudentTimelineEvent, type StudentAuditEntry, type AcademicEntry,
  type StudentValidationError,
} from "@/lib/students";
import { exportSingleStudentPDF } from "@/lib/student-export";



export const Route = createFileRoute("/_authenticated/students/$studentId")({
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team"]}>
      <StudentDetailPage />
    </RoleGuard>
  ),
});

function StudentDetailPage() {
  const { studentId } = Route.useParams();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const photoRef = useRef<HTMLInputElement>(null);

  const originalRef = useRef<Student | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const s = await getStudent(studentId);
      if (!s) { toast.error("Student not found"); navigate({ to: "/students" }); return; }
      setStudent(s);
      originalRef.current = s;
      setErrors({});
    } catch (e: any) {
      const msg = e?.message ?? "Failed to load";
      setLoadError(msg);
      toast.error(msg);
    }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [studentId]);

  const setField = <K extends keyof Student>(k: K, v: Student[K]) => {
    setStudent((s) => (s ? { ...s, [k]: v } : s));
    setErrors((prev) => (prev[k as string] ? { ...prev, [k as string]: "" } : prev));
  };

  const save = async () => {
    if (!student || !originalRef.current) return;
    const changes = diffStudent(originalRef.current, student);
    if (Object.keys(changes).length === 0) { toast.info("No changes to save"); return; }

    const { id, student_code, created_at, updated_at, created_by, ...patch } = student;
    const vErrs = validateStudentInput(patch as any);
    if (Object.keys(vErrs).length > 0) {
      setErrors(vErrs);
      toast.error("Please fix the highlighted fields");
      return;
    }

    setSaving(true);
    try {
      await updateStudent(id, patch as any);
      const changedFields = Object.keys(changes);
      const isDeactivation = changes.status && (changes.status.to === "inactive" || changes.status.to === "archived");
      const action = isDeactivation ? "student.deactivated" : "student.updated";
      await writeStudentAudit(id, action, { fields: changedFields, changes });
      await addTimelineEvent(id, {
        event_type: "profile_update",
        title: isDeactivation ? "Student deactivated" : "Profile updated",
        description: changedFields.join(", "),
      });
      originalRef.current = student;
      setErrors({});
      toast.success("Saved");
    } catch (e: any) {
      const err = e as StudentValidationError;
      if (err?.field) {
        setErrors((prev) => ({ ...prev, [err.field!]: err.message }));
      }
      toast.error(err?.message ?? "Save failed");
    }
    finally { setSaving(false); }
  };



  const onPhoto = async (file?: File | null) => {
    if (!file || !student) return;
    setPhotoError(null);
    const err = validateStudentPhoto(file);
    if (err) { setPhotoError(err); return; }
    setPhotoUploading(true);
    try {
      const url = await uploadStudentPhoto(student.id, file);
      setField("photo_url", url);
      await updateStudent(student.id, { photo_url: url });
      toast.success("Photo updated");
    } catch (e: any) {
      const m = e?.message ?? "Upload failed"; setPhotoError(m); toast.error(m);
    } finally {
      setPhotoUploading(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  };

  if (loading) {
    return <StudentDetailSkeleton />;
  }

  if (loadError && !student) {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
        <h2 className="mt-3 text-lg font-semibold">Couldn't load this student</h2>
        <p className="mt-1 text-sm text-muted-foreground">{loadError}</p>
        <div className="mt-4 flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/students" })}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          <Button onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!student) return null;

  const initials = student.full_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("") || "ST";

  const statusTone: Record<StudentStatus, string> = {
    prospect: "bg-sky-500/15 text-sky-700 dark:text-sky-300 ring-sky-500/30",
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/30",
    enrolled: "bg-primary/15 text-primary ring-primary/30",
    inactive: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/30",
    archived: "bg-slate-500/15 text-slate-700 dark:text-slate-300 ring-slate-500/30",
  };

  const passportDaysLeft = student.passport_expiry
    ? Math.ceil((new Date(student.passport_expiry).getTime() - Date.now()) / 86400000)
    : null;
  const passportTone =
    passportDaysLeft == null
      ? "text-muted-foreground"
      : passportDaysLeft < 0
      ? "text-destructive"
      : passportDaysLeft < 180
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

  const ageYears = student.date_of_birth
    ? Math.floor((Date.now() - new Date(student.date_of_birth).getTime()) / (365.25 * 86400000))
    : null;

  // Dirty tracking: compare current student to snapshot for enabling Save/Cancel
  const isDirty = originalRef.current
    ? Object.keys(diffStudent(originalRef.current, student)).length > 0
    : false;

  const cancelChanges = () => {
    if (!originalRef.current) return;
    setStudent(originalRef.current);
    setErrors({});
    toast.info("Changes discarded");
  };

  const digitsOnly = (v?: string | null) => (v ?? "").replace(/[^\d+]/g, "");
  const phoneHref = student.phone ? `tel:${digitsOnly(student.phone)}` : null;
  const emailHref = student.email ? `mailto:${student.email}` : null;
  const smsHref = student.phone ? `sms:${digitsOnly(student.phone)}` : null;

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 focus-visible:ring-2 focus-visible:ring-primary">
          <Link to="/students" aria-label="Back to students list">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to students
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Student actions">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const report = exportSingleStudentPDF(student);
                    if (report.missing.length === 0) {
                      toast.success("PDF downloaded", {
                        description: `${report.filename} — all fields present.`,
                      });
                    } else {
                      const preview = report.missing
                        .slice(0, 4)
                        .map((m) => `• ${m.field} → ${m.fallback}`)
                        .join("\n");
                      const extra =
                        report.missing.length > 4
                          ? `\n…and ${report.missing.length - 4} more`
                          : "";
                      toast.warning(
                        `PDF downloaded with ${report.missing.length} blank field${
                          report.missing.length === 1 ? "" : "s"
                        }`,
                        {
                          description: `${preview}${extra}`,
                          duration: 10000,
                        },
                      );
                      // Blank JSONB-array fields often signal that the columns
                      // are missing from the DB / PostgREST cache. Auto-run the
                      // reload+recheck cycle; on success, refetch the student
                      // so a subsequent export includes the recovered data.
                      const schemaSensitive = report.missing.some((m) =>
                        /preferred universities|language proficiency|bachelor/i.test(m.field),
                      );
                      if (schemaSensitive) {
                        const { retrySchemaReload } = await import("@/lib/schema-check");
                        const ok = await retrySchemaReload();
                        if (ok) {
                          await load();
                        }
                      }
                    }
                  } catch (e: any) {
                    const msg = e?.message ?? "PDF export failed";
                    toast.error(msg, {
                      description:
                        "Attempting to reload the PostgREST schema and re-check the students table…",
                      duration: 12000,
                    });
                    if (/column|schema/i.test(msg)) {
                      const { retrySchemaReload } = await import("@/lib/schema-check");
                      const ok = await retrySchemaReload();
                      if (ok) {
                        await load();
                      }
                    }
                  }
                }}

                aria-label="Download student profile as PDF"
                className="focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export full profile summary as PDF</TooltipContent>
          </Tooltip>
          {isDirty && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelChanges}
                  disabled={saving}
                  aria-label="Discard unsaved changes"
                  className="focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Undo2 className="mr-2 h-4 w-4" /> Cancel
                </Button>
              </TooltipTrigger>
              <TooltipContent>Revert to last saved values</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={save}
                disabled={saving || !isDirty}
                className="shadow-sm focus-visible:ring-2 focus-visible:ring-primary"
                aria-label={isDirty ? "Save changes to student profile" : "No changes to save"}
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save changes
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDirty ? "Save your edits" : "Make a change first"}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-sm">
        {/* decorative blobs */}
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -left-12 bottom-0 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" aria-hidden />

        <div className="relative grid gap-6 p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:p-6">
          {/* Avatar column */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <div className="rounded-full bg-gradient-to-br from-primary/40 to-sky-400/40 p-[3px] shadow-lg shadow-primary/10">
                <Avatar className="h-24 w-24 ring-2 ring-background md:h-28 md:w-28">
                  <AvatarImage src={student.photo_url ?? undefined} alt={student.full_name} />
                  <AvatarFallback className="bg-background text-xl font-bold tracking-wide">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <span
                className={`absolute -bottom-1 right-1 inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[10px] font-semibold ring-2 ring-background ${statusTone[student.status]}`}
                aria-label={`Status ${STUDENT_STATUS_LABELS[student.status]}`}
              >
                <BadgeCheck className="h-3 w-3" />
                {STUDENT_STATUS_LABELS[student.status]}
              </span>
            </div>
            <label className="cursor-pointer">
              <div className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-2.5 py-1 text-xs backdrop-blur hover:bg-background">
                {photoUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                Change photo
              </div>
              <input
                ref={photoRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onPhoto(e.target.files?.[0])}
              />
            </label>
            {photoError && <p className="text-[11px] font-medium text-destructive">{photoError}</p>}
          </div>

          {/* Identity + meta chips */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{student.full_name}</h1>
              <Badge variant="secondary" className="font-mono text-[11px]">{student.student_code}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {student.email ? (
                <ContactChip icon={<Mail className="h-3 w-3 text-primary" />} label={student.email} truncate />
              ) : (
                <EmptyChip icon={<Mail className="h-3 w-3" />} label="No email on file" />
              )}
              {student.phone ? (
                <ContactChip icon={<Phone className="h-3 w-3 text-primary" />} label={student.phone} />
              ) : (
                <EmptyChip icon={<Phone className="h-3 w-3" />} label="No phone on file" />
              )}
              {student.nationality && (
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-2.5 py-1 text-xs backdrop-blur">
                  <Globe className="h-3 w-3 text-primary" />
                  {student.nationality}
                </span>
              )}
              {ageYears != null && (
                <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-2.5 py-1 text-xs backdrop-blur">
                  <Calendar className="h-3 w-3 text-primary" />
                  {ageYears} yrs
                </span>
              )}
            </div>

            {/* Contact action buttons */}
            <div
              className="mt-3 flex flex-wrap gap-2"
              role="group"
              aria-label="Contact actions"
            >
              <ContactActionButton
                href={phoneHref}
                icon={<Phone className="h-4 w-4" />}
                label="Call"
                tooltip={phoneHref ? `Call ${student.phone}` : "No phone number available"}
                disabledMessage="Add a phone number to enable calling"
              />
              <ContactActionButton
                href={emailHref}
                icon={<Mail className="h-4 w-4" />}
                label="Email"
                tooltip={emailHref ? `Email ${student.email}` : "No email available"}
                disabledMessage="Add an email address to enable email"
              />
              <ContactActionButton
                href={smsHref}
                icon={<MessageSquare className="h-4 w-4" />}
                label="Message"
                tooltip={smsHref ? `Text ${student.phone}` : "No phone number available"}
                disabledMessage="Add a phone number to enable messaging"
              />
            </div>


            {/* Quick stat tiles */}
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatTile
                icon={<User className="h-3.5 w-3.5" />}
                label="Gender"
                value={student.gender ? GENDER_LABELS[student.gender] : "—"}
              />
              <StatTile
                icon={<Calendar className="h-3.5 w-3.5" />}
                label="Date of birth"
                value={student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString() : "—"}
              />
              <StatTile
                icon={<FileText className="h-3.5 w-3.5" />}
                label="Passport"
                value={student.passport_no ?? "—"}
                mono
              />
              <StatTile
                icon={
                  passportDaysLeft != null && passportDaysLeft < 180 ? (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  ) : (
                    <Calendar className="h-3.5 w-3.5" />
                  )
                }
                label="Passport expiry"
                value={
                  student.passport_expiry
                    ? `${new Date(student.passport_expiry).toLocaleDateString()}${
                        passportDaysLeft != null ? ` · ${passportDaysLeft < 0 ? "expired" : `${passportDaysLeft}d left`}` : ""
                      }`
                    : "—"
                }
                valueClassName={passportTone}
              />
            </div>
          </div>

          {/* Status control */}
          <div className="w-full md:w-52">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</Label>
            <Select value={student.status} onValueChange={(v) => setField("status", v as StudentStatus)}>
              <SelectTrigger className="mt-1 bg-background/70 backdrop-blur">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STUDENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{STUDENT_STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="flex w-full flex-wrap justify-start gap-1 rounded-xl bg-muted/60 p-1 backdrop-blur">
          <TabsTrigger value="profile" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
            <User className="h-3.5 w-3.5" />Profile
          </TabsTrigger>
          <TabsTrigger value="academic" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
            <GraduationCap className="h-3.5 w-3.5" />Academic
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
            <FileText className="h-3.5 w-3.5" />Documents
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
            <Clock className="h-3.5 w-3.5" />Timeline
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 rounded-lg data-[state=active]:shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <ProfileSection student={student} setField={setField} errors={errors} />
        </TabsContent>

        <TabsContent value="academic" className="mt-4 space-y-4">
          <AcademicSection student={student} setField={setField} errors={errors} />
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <DocumentsSection studentId={student.id} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineSection studentId={student.id} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditSection studentId={student.id} />
        </TabsContent>
      </Tabs>
    </div>
    </TooltipProvider>
  );
}
function ContactChip({ icon, label, truncate }: { icon: React.ReactNode; label: string; truncate?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-2.5 py-1 text-xs backdrop-blur">
      {icon}
      <span className={truncate ? "truncate max-w-[180px]" : ""} title={label}>{label}</span>
    </span>
  );
}

function EmptyChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-dashed bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground"
      aria-label={label}
    >
      <span className="opacity-60">{icon}</span>
      {label}
    </span>
  );
}

function ContactActionButton({
  href, icon, label, tooltip, disabledMessage,
}: {
  href: string | null;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  disabledMessage: string;
}) {
  const disabled = !href;
  const btn = disabled ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled
      aria-label={`${label} (unavailable): ${disabledMessage}`}
      className="focus-visible:ring-2 focus-visible:ring-primary"
      onClick={() => toast.info(disabledMessage)}
    >
      {icon}<span className="ml-1.5">{label}</span>
    </Button>
  ) : (
    <Button
      asChild
      variant="outline"
      size="sm"
      className="focus-visible:ring-2 focus-visible:ring-primary hover:border-primary/40"
    >
      <a href={href!} aria-label={tooltip}>
        {icon}<span className="ml-1.5">{label}</span>
      </a>
    </Button>
  );
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={disabled ? "cursor-not-allowed" : ""} tabIndex={-1}>{btn}</span>
      </TooltipTrigger>
      <TooltipContent>{disabled ? disabledMessage : tooltip}</TooltipContent>
    </Tooltip>
  );
}

function StudentDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <div className="rounded-2xl border p-6">
        <div className="flex flex-wrap gap-6">
          <Skeleton className="h-28 w-28 rounded-full" />
          <div className="flex-1 space-y-3 min-w-[220px]">
            <Skeleton className="h-7 w-64" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-6 w-28 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <span className="sr-only">Loading student profile…</span>
    </div>
  );
}

function StatTile({
  icon, label, value, mono, valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border bg-background/70 p-2.5 backdrop-blur transition hover:border-primary/40 hover:shadow-sm">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div
        className={`mt-1 truncate text-sm font-semibold ${mono ? "font-mono" : ""} ${valueClassName ?? ""}`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function ProfileSection({
  student, setField, errors,
}: {
  student: Student;
  setField: <K extends keyof Student>(k: K, v: Student[K]) => void;
  errors: Record<string, string>;
}) {
  const err = (k: string) =>
    errors[k] ? <p className="mt-1 text-xs text-destructive">{errors[k]}</p> : null;
  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Personal</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Full name">
            <Input
              value={student.full_name}
              maxLength={150}
              aria-invalid={!!errors.full_name}
              onChange={(e) => setField("full_name", e.target.value)}
            />
            {err("full_name")}
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={student.email ?? ""}
              aria-invalid={!!errors.email}
              onChange={(e) => setField("email", e.target.value || null)}
            />
            {err("email")}
          </Field>
          <Field label="Phone">
            <Input value={student.phone ?? ""} aria-invalid={!!errors.phone}
              onChange={(e) => setField("phone", e.target.value || null)} />
            {err("phone")}
          </Field>
          <Field label="Date of birth">
            <Input type="date" value={student.date_of_birth ?? ""} aria-invalid={!!errors.date_of_birth}
              onChange={(e) => setField("date_of_birth", e.target.value || null)} />
            {err("date_of_birth")}
          </Field>
          <Field label="Gender">
            <Select value={student.gender ?? ""} onValueChange={(v) => setField("gender", (v || null) as StudentGender | null)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                {STUDENT_GENDERS.map((g) => <SelectItem key={g} value={g}>{GENDER_LABELS[g]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nationality">
            <Input value={student.nationality ?? ""} aria-invalid={!!errors.nationality}
              onChange={(e) => setField("nationality", e.target.value || null)} />
            {err("nationality")}
          </Field>
          <Field label="Passport no.">
            <Input value={student.passport_no ?? ""} aria-invalid={!!errors.passport_no}
              onChange={(e) => setField("passport_no", e.target.value || null)} />
            {err("passport_no")}
          </Field>
          <Field label="Passport expiry">
            <Input
              type="date"
              value={student.passport_expiry ?? ""}
              aria-invalid={!!errors.passport_expiry}
              onChange={(e) => setField("passport_expiry", e.target.value || null)}
            />
            {err("passport_expiry")}
          </Field>
        </CardContent>
      </Card>


      <Card>
        <CardHeader><CardTitle className="text-base">Guardian & emergency contact</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Guardian name">
            <Input value={student.guardian_name ?? ""} aria-invalid={!!errors.guardian_name}
              onChange={(e) => setField("guardian_name", e.target.value || null)} />
            {err("guardian_name")}
          </Field>
          <Field label="Guardian phone">
            <Input value={student.guardian_phone ?? ""} aria-invalid={!!errors.guardian_phone}
              onChange={(e) => setField("guardian_phone", e.target.value || null)} />
            {err("guardian_phone")}
          </Field>
          <Field label="Guardian relation">
            <Input value={student.guardian_relation ?? ""} aria-invalid={!!errors.guardian_relation}
              onChange={(e) => setField("guardian_relation", e.target.value || null)} />
            {err("guardian_relation")}
          </Field>
          <div />
          <Field label="Emergency contact name">
            <Input value={student.emergency_contact_name ?? ""} aria-invalid={!!errors.emergency_contact_name}
              onChange={(e) => setField("emergency_contact_name", e.target.value || null)} />
            {err("emergency_contact_name")}
          </Field>
          <Field label="Emergency contact phone">
            <Input value={student.emergency_contact_phone ?? ""} aria-invalid={!!errors.emergency_contact_phone}
              onChange={(e) => setField("emergency_contact_phone", e.target.value || null)} />
            {err("emergency_contact_phone")}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Addresses</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Current address">
            <Textarea rows={3} value={student.current_address ?? ""} aria-invalid={!!errors.current_address}
              onChange={(e) => setField("current_address", e.target.value || null)} />
            {err("current_address")}
          </Field>
          <Field label="Permanent address">
            <Textarea rows={3} value={student.permanent_address ?? ""} aria-invalid={!!errors.permanent_address}
              onChange={(e) => setField("permanent_address", e.target.value || null)} />
            {err("permanent_address")}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Notes</CardTitle></CardHeader>
        <CardContent>
          <Textarea rows={4} value={student.notes ?? ""} aria-invalid={!!errors.notes}
            onChange={(e) => setField("notes", e.target.value || null)} placeholder="Internal notes about this student…" />
          {err("notes")}
        </CardContent>
      </Card>
    </>
  );
}


function AcademicSection({ student, setField, errors }: { student: Student; setField: <K extends keyof Student>(k: K, v: Student[K]) => void; errors: Record<string, string> }) {
  const err = (k: string) =>
    errors[k] ? <p className="mt-1 text-xs text-destructive">{errors[k]}</p> : null;
  const entries = student.academic_history ?? [];
  const update = (i: number, patch: Partial<AcademicEntry>) => {
    const next = entries.map((e, idx) => idx === i ? { ...e, ...patch } : e);
    setField("academic_history", next);
  };
  const add = () => setField("academic_history", [...entries, { institution: "", qualification: "", year: "", grade: "" }]);
  const remove = (i: number) => setField("academic_history", entries.filter((_, idx) => idx !== i));

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Academic history</CardTitle>
          <Button size="sm" variant="outline" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Add entry</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {entries.length === 0 && <p className="text-sm text-muted-foreground">No academic entries yet.</p>}
          {entries.map((entry, i) => (
            <div key={i} className="grid gap-2 rounded-md border p-3 md:grid-cols-[1.5fr_1.5fr_100px_100px_40px]">
              <Input placeholder="Institution" value={entry.institution} onChange={(e) => update(i, { institution: e.target.value })} />
              <Input placeholder="Qualification" value={entry.qualification} onChange={(e) => update(i, { qualification: e.target.value })} />
              <Input placeholder="Year" value={entry.year ?? ""} onChange={(e) => update(i, { year: e.target.value })} />
              <Input placeholder="Grade" value={entry.grade ?? ""} onChange={(e) => update(i, { grade: e.target.value })} />
              <Button size="icon" variant="ghost" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Preferred universities</CardTitle>
          <Button size="sm" variant="outline" onClick={() =>
            setField("preferred_universities", [...(student.preferred_universities ?? []), { country: "", university: "", course: "" }])
          }><Plus className="mr-1 h-3.5 w-3.5" />Add</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(student.preferred_universities ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">No preferred universities recorded.</p>
          )}
          {(student.preferred_universities ?? []).map((row, i) => {
            const list = student.preferred_universities ?? [];
            const updateRow = (patch: Partial<typeof row>) =>
              setField("preferred_universities", list.map((r, idx) => idx === i ? { ...r, ...patch } : r));
            const removeRow = () => setField("preferred_universities", list.filter((_, idx) => idx !== i));
            return (
              <div key={i} className="grid gap-2 rounded-md border p-3 md:grid-cols-[1fr_1.4fr_1.4fr_40px]">
                <Input placeholder="Country" value={row.country} onChange={(e) => updateRow({ country: e.target.value })} />
                <Input placeholder="University" value={row.university} onChange={(e) => updateRow({ university: e.target.value })} />
                <Input placeholder="Course / Subject" value={row.course} onChange={(e) => updateRow({ course: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={removeRow}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Language & proficiency scores</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-2">
            {["IELTS","UKVI","PTE","DUOLINGO","SAT","ACT"].map((testName) => {
              const list = student.test_scores ?? [];
              const existing = list.find((t) => t.test === testName);
              const score = existing?.score ?? "";
              const setScore = (v: string) => {
                const others = list.filter((t) => t.test !== testName);
                const next = v.trim() ? [...others, { test: testName, score: v }] : others;
                setField("test_scores", next);
              };
              return (
                <div key={testName} className="grid grid-cols-[110px_1fr] items-center gap-2 rounded-md border p-2">
                  <div className="rounded-md bg-destructive/10 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-destructive">
                    {testName}
                  </div>
                  <Input placeholder="Score" value={score} onChange={(e) => setScore(e.target.value)} />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

    </>
  );
}

const DOC_CATEGORIES = ["Passport", "Transcript", "Certificate", "CV", "Photo", "Financial", "Offer letter", "Visa", "Other"];
const TIMELINE_CATEGORIES = ["note", "profile_update", "status_change", "document", "contact", "created", "custom"];

function isPreviewable(doc: StudentDocument): "image" | "pdf" | null {
  const mime = (doc.mime_type || "").toLowerCase();
  const ext = (doc.name.split(".").pop() || "").toLowerCase();
  if (mime.startsWith("image/") || ["jpg","jpeg","png","webp","gif"].includes(ext)) return "image";
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  return null;
}

function DocumentsSection({ studentId }: { studentId: string }) {
  const [docs, setDocs] = useState<StudentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [replaceTarget, setReplaceTarget] = useState<StudentDocument | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentDocument | null>(null);
  const [preview, setPreview] = useState<{ doc: StudentDocument; url: string; kind: "image" | "pdf" } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try { setDocs(await listStudentDocuments(studentId)); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [studentId]);

  const onFile = async (f?: File | null) => {
    if (!f) return;
    setUploadError(null);
    const verr = validateStudentDocument(f);
    if (verr) { setUploadError(verr); if (fileRef.current) fileRef.current.value = ""; return; }
    setUploading(true);
    try {
      await uploadStudentDocument(studentId, f, { name: f.name, category: category || undefined });
      await writeStudentAudit(studentId, "student.document.uploaded", { name: f.name, category: category || null, size: f.size });
      toast.success("Document uploaded");
      await load();
    } catch (e: any) { const m = e?.message ?? "Upload failed"; setUploadError(m); toast.error(m); }
    finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onReplace = async (f?: File | null) => {
    if (!f || !replaceTarget) return;
    setReplaceError(null);
    const verr = validateStudentDocument(f);
    if (verr) { setReplaceError(verr); return; }
    setReplacing(true);
    try {
      await replaceStudentDocument(replaceTarget, f);
      await writeStudentAudit(studentId, "student.document.replaced", { from: replaceTarget.name, to: f.name });
      toast.success("Document replaced");
      setReplaceTarget(null);
      await load();
    } catch (e: any) { const m = e?.message ?? "Replace failed"; setReplaceError(m); toast.error(m); }
    finally {
      setReplacing(false);
      if (replaceFileRef.current) replaceFileRef.current.value = "";
    }
  };

  const resolveUrl = async (doc: StudentDocument) =>
    doc.file_path ? await getSignedDocumentUrl(doc.file_path) : doc.file_url;

  const openPreview = async (doc: StudentDocument) => {
    const kind = isPreviewable(doc);
    if (!kind) { await download(doc); return; }
    setPreviewLoading(true);
    try {
      const url = await resolveUrl(doc);
      setPreview({ doc, url, kind });
    } catch (e: any) { toast.error(e.message ?? "Cannot open"); }
    finally { setPreviewLoading(false); }
  };

  const download = async (doc: StudentDocument) => {
    try {
      const url = await resolveUrl(doc);
      const a = document.createElement("a");
      a.href = url; a.download = doc.name; a.rel = "noopener"; a.target = "_blank";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) { toast.error(e.message ?? "Cannot download"); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteStudentDocument(deleteTarget);
      await writeStudentAudit(studentId, "student.document.deleted", { name: deleteTarget.name });
      toast.success("Deleted");
      setDeleteTarget(null);
      await load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label className="text-[11px] uppercase text-muted-foreground">Category (optional)</Label>
            <Select value={category || "__none"} onValueChange={(v) => setCategory(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">— None —</SelectItem>
                {DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="inline-flex">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <span className={`inline-flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent ${uploadError ? "border-destructive text-destructive" : ""}`}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload document
            </span>
          </label>
        </div>
        {uploadError && <p className="text-xs font-medium text-destructive">{uploadError}</p>}
        <p className="text-[11px] text-muted-foreground">
          Max {DOC_MAX_BYTES / 1024 / 1024} MB. Allowed: PDF, JPG, PNG, WEBP, GIF, DOC(X), XLS(X), TXT, CSV. Documents are private.
        </p>

        <Separator />

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : docs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{d.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {d.category ? `${d.category} · ` : ""}
                      {d.size_bytes ? `${(d.size_bytes / 1024 / 1024).toFixed(2)} MB · ` : ""}
                      {new Date(d.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-1">
                  {isPreviewable(d) && (
                    <Button size="icon" variant="ghost" title="Preview" onClick={() => openPreview(d)} disabled={previewLoading}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" title="Download" onClick={() => download(d)}><Download className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" title="Replace" onClick={() => { setReplaceError(null); setReplaceTarget(d); }}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Delete" onClick={() => setDeleteTarget(d)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <Dialog open={!!replaceTarget} onOpenChange={(o) => !o && setReplaceTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace document</DialogTitle>
            <DialogDescription>
              Uploads a new file and removes the previous version of <b>{replaceTarget?.name}</b>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <input
              ref={replaceFileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={(e) => onReplace(e.target.files?.[0])}
              className="block w-full text-sm"
            />
            {replaceError && <p className="text-xs font-medium text-destructive">{replaceError}</p>}
            <p className="text-[11px] text-muted-foreground">Max {DOC_MAX_BYTES / 1024 / 1024} MB.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceTarget(null)} disabled={replacing}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete document?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <b>{deleteTarget?.name}</b> and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate">{preview?.doc.name}</DialogTitle>
            <DialogDescription>
              {preview?.doc.category ? `${preview.doc.category} · ` : ""}
              {preview?.doc.size_bytes ? `${(preview.doc.size_bytes / 1024 / 1024).toFixed(2)} MB` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto rounded-md border bg-muted/30">
            {preview?.kind === "image" && (
              <img src={preview.url} alt={preview.doc.name} className="mx-auto max-h-[70vh] object-contain" />
            )}
            {preview?.kind === "pdf" && (
              <iframe src={preview.url} title={preview.doc.name} className="h-[70vh] w-full" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => preview && download(preview.doc)}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
            <Button onClick={() => setPreview(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

interface TimelineFormState {
  id?: string;
  event_type: string;
  title: string;
  description: string;
}

function TimelineSection({ studentId }: { studentId: string }) {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [events, setEvents] = useState<StudentTimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<TimelineFormState>({ event_type: "note", title: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<StudentTimelineEvent | null>(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try { setEvents(await listStudentTimeline(studentId)); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [studentId]);

  const filtered = useMemo(() => {
    return events.filter((ev) => {
      if (filterCategory !== "all" && ev.event_type !== filterCategory) return false;
      const t = new Date(ev.created_at).getTime();
      if (fromDate && t < new Date(fromDate).getTime()) return false;
      if (toDate && t > new Date(toDate).getTime() + 24 * 3600_000) return false;
      return true;
    });
  }, [events, filterCategory, fromDate, toDate]);

  const openNew = () => { setForm({ event_type: "note", title: "", description: "" }); setFormOpen(true); };
  const openEdit = (ev: StudentTimelineEvent) => {
    setForm({ id: ev.id, event_type: ev.event_type, title: ev.title, description: ev.description ?? "" });
    setFormOpen(true);
  };

  const canModify = (ev: StudentTimelineEvent) => isAdmin || (user && ev.actor_id === user.id);

  const submit = async () => {
    if (!form.title.trim()) return toast.error("Title is required");
    setSaving(true);
    try {
      if (form.id) {
        await updateTimelineEvent(form.id, {
          event_type: form.event_type,
          title: form.title.trim(),
          description: form.description.trim() || null,
        });
        toast.success("Entry updated");
      } else {
        await addTimelineEvent(studentId, {
          event_type: form.event_type,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
        });
        toast.success("Entry added");
      }
      setFormOpen(false);
      await load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTimelineEvent(deleteTarget.id);
      toast.success("Entry deleted");
      setDeleteTarget(null);
      await load();
    } catch (e: any) { toast.error(e.message ?? "Failed"); }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Timeline</CardTitle>
        <Button size="sm" onClick={openNew}><Plus className="mr-1 h-3.5 w-3.5" />Add entry</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground">Category</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {TIMELINE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground">To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={() => { setFilterCategory("all"); setFromDate(""); setToDate(""); }}>
              Reset
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No entries match the current filters.</p>
        ) : (
          <ol className="relative space-y-4 border-l pl-6">
            {filtered.map((ev) => (
              <li key={ev.id} className="relative">
                <span className="absolute -left-[27px] top-1 grid h-4 w-4 place-items-center rounded-full border bg-background">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{ev.title}</span>
                  <Badge variant="outline" className="text-[10px]">{ev.event_type}</Badge>
                  <span className="text-[11px] text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</span>
                  {canModify(ev) && (
                    <span className="ml-auto flex gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(ev)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setDeleteTarget(ev)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </span>
                  )}
                </div>
                {ev.description && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{ev.description}</p>}
                {ev.actor_email && <p className="mt-0.5 text-[11px] text-muted-foreground">by {ev.actor_email}</p>}
              </li>
            ))}
          </ol>
        )}
      </CardContent>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit timeline entry" : "New timeline entry"}</DialogTitle>
            <DialogDescription>Visible to staff working on this student.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[11px] uppercase text-muted-foreground">Category</Label>
              <Select value={form.event_type} onValueChange={(v) => setForm((f) => ({ ...f, event_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMELINE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] uppercase text-muted-foreground">Title</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} maxLength={140} />
            </div>
            <div>
              <Label className="text-[11px] uppercase text-muted-foreground">Description</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} maxLength={2000} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={submit} disabled={saving || !form.title.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.id ? "Save changes" : "Add entry"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete timeline entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <b>{deleteTarget?.title}</b> from the timeline.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function AuditSection({ studentId }: { studentId: string }) {
  const [rows, setRows] = useState<StudentAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [action, setAction] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const load = async () => {
    setLoading(true);
    try { setRows(await listStudentAudit(studentId)); }
    catch (e: any) { toast.error(e.message ?? "Failed"); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [studentId]);

  const actions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(r.action));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const fromT = fromDate ? new Date(fromDate).getTime() : null;
    const toT = toDate ? new Date(toDate).getTime() + 24 * 3600_000 : null;
    return rows.filter((r) => {
      if (action !== "all" && r.action !== action) return false;
      const t = new Date(r.created_at).getTime();
      if (fromT !== null && t < fromT) return false;
      if (toT !== null && t > toT) return false;
      if (term) {
        const hay = [
          r.action, r.actor_email ?? "", r.entity ?? "",
          r.metadata ? JSON.stringify(r.metadata) : "",
        ].join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, q, action, fromDate, toDate]);

  const exportCsv = () => {
    if (filtered.length === 0) { toast.info("Nothing to export"); return; }
    const header = ["When", "Actor", "Action", "Entity", "Entity ID", "Fields", "Metadata"];
    const lines = [header.map(csvEscape).join(",")];
    for (const r of filtered) {
      const fields = (r.metadata as any)?.fields;
      const fieldList = Array.isArray(fields) ? fields.join(" ") : "";
      lines.push([
        new Date(r.created_at).toISOString(),
        r.actor_email ?? "",
        r.action,
        r.entity ?? "",
        r.entity_id ?? "",
        fieldList,
        r.metadata ?? "",
      ].map(csvEscape).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `student-${studentId}-audit-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} entries`);
  };

  const renderChanges = (metadata: Record<string, unknown> | null) => {
    if (!metadata) return null;
    const fields = (metadata.fields as string[] | undefined) ?? Object.keys((metadata.changes as object | undefined) ?? {});
    if (!fields?.length) {
      return metadata.name ? <span className="text-xs text-muted-foreground">{String(metadata.name)}</span> : null;
    }
    return (
      <div className="mt-1 flex flex-wrap gap-1">
        {fields.map((f) => <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>)}
      </div>
    );
  };

  const resetFilters = () => { setQ(""); setAction("all"); setFromDate(""); setToDate(""); };
  const activeCount = [q.trim() !== "", action !== "all", fromDate !== "", toDate !== ""].filter(Boolean).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Audit log</CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="mr-1 h-3.5 w-3.5" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1 h-3.5 w-3.5" />Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 rounded-md border bg-muted/30 p-3 sm:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" placeholder="action, actor, field…" />
            </div>
          </div>
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground">Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground">To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="ghost" size="sm" onClick={resetFilters} disabled={activeCount === 0}>Reset</Button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Showing {filtered.length} of {rows.length} entries
        </p>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No audit entries match your filters.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {filtered.map((r) => (
              <li key={r.id} className="p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{r.action}</Badge>
                  <span className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                  {r.actor_email && <span className="text-[11px] text-muted-foreground">· by {r.actor_email}</span>}
                </div>
                {renderChanges(r.metadata)}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] uppercase text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
