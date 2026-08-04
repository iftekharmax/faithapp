import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import DOMPurify from "dompurify";
import { useEffect, useState } from "react";
import {
  ArrowLeft, Save, Loader2, DollarSign, Award, BookOpen, Clock, School,
  Calendar, AlertCircle, Sparkles, Building2, RefreshCcw
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { cn } from "@/lib/utils";
import {
  getUniversity, listCampuses, updateProgram, getProgram,
  type University, type Campus, type UniversityProgram, UNI_STATUSES, type UniStatus,
  DuplicateError,
} from "@/lib/universities";
import { RoleGuard } from "@/components/layout/RoleGuard";

export const Route = createFileRoute("/_authenticated/universities/$universityId/programs/$programId/edit")({
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team"]}>
      <EditProgramPage />
    </RoleGuard>
  ),
});

const feeField = z
  .union([z.literal(""), z.null(), z.undefined(), z.string(), z.number()])
  .transform((v) => (v === "" || v == null ? null : Number(v)))
  .refine((v) => v == null || (Number.isFinite(v) && v >= 0), "Must be a positive number");

const programSchema = z.object({
  name: z.string().trim().min(2, "Program name must be at least 2 characters").max(200, "Name is too long"),
  degree: z.string().trim().max(100).optional().nullable(),
  duration: z.string().trim().max(60).optional().nullable(),
  intake: z.string().trim().max(120).optional().nullable(),
  currency: z.string().trim().min(1, "Currency is required").max(10, "Use a short currency code"),
  application_deadline: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || !Number.isNaN(new Date(v).getTime()), "Enter a valid date"),
  tuition_fee: feeField,
  application_fee: feeField,
  registration_fee: feeField,
  emgs_fee: feeField,
  others_fee: feeField,
});

type Errors = Partial<Record<string, string>>;

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
      <AlertCircle className="h-3.5 w-3.5" /> {msg}
    </p>
  );
}

const labelCls = "text-[11px] font-bold uppercase tracking-widest text-muted-foreground";
const inputCls = "h-11 rounded-xl border-muted-foreground/20 shadow-sm";

function EditProgramPage() {
  const { universityId, programId } = Route.useParams();
  const navigate = useNavigate();
  const [uni, setUni] = useState<University | null>(null);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<UniversityProgram>>({
    status: "active",
    currency: "USD",
    university_id: universityId,
    tuition_fee: 0,
    application_fee: 0,
    registration_fee: 0,
    emgs_fee: 0,
    others_fee: 0,
  } as any);

  // We keep a ref to the form data to preserve it across retry attempts
  // but since we are using React state and not refreshing the page, 
  // simply NOT resetting the state on error is enough.
  // The current handleSave implementation already keeps form state intact on error.

  function set<K extends keyof UniversityProgram>(key: K, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key as string] ? { ...e, [key as string]: undefined } : e));
    if (submitError) setSubmitError(null);
  }

  const getCurrencySymbol = (currency: string) => {
    try {
      return (0).toLocaleString("en-US", {
        style: "currency",
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).replace(/\d/g, "").trim();
    } catch {
      return currency;
    }
  };

  const totalFees = [
    form.tuition_fee,
    (form as any).application_fee,
    (form as any).registration_fee,
    (form as any).emgs_fee,
    (form as any).others_fee,
  ].reduce((acc, val) => acc + (val ? Number(val) : 0), 0);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: form.currency || "USD",
      minimumFractionDigits: 2,
    }).format(val);
  };

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [u, c, p] = await Promise.all([
          getUniversity(universityId),
          listCampuses(universityId),
          getProgram(programId)
        ]);
        if (!alive) return;
        setUni(u);
        setCampuses(c);
        
        setForm(p);
      } catch (e: any) {
        if (!alive) return;
        setLoadError(e?.message ?? "Failed to load university or program data");
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [universityId, programId]);

  async function handleSave() {
    setSubmitError(null);
    const parsed = programSchema.safeParse({
      name: form.name ?? "",
      degree: form.degree ?? "",
      duration: form.duration ?? "",
      intake: form.intake ?? "",
      currency: form.currency ?? "",
      application_deadline: form.application_deadline || null,
      tuition_fee: form.tuition_fee ?? "",
      application_fee: (form as any).application_fee ?? "",
      registration_fee: (form as any).registration_fee ?? "",
      emgs_fee: (form as any).emgs_fee ?? "",
      others_fee: (form as any).others_fee ?? "",
    });

    if (!parsed.success) {
      const next: Errors = {};
      const errorFields: string[] = [];
      
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]);
        if (!next[key]) next[key] = issue.message;
        
        // Map keys to user friendly names for the toast
        const fieldName = key === "name" ? "Program Name" :
                        key === "degree" ? "Degree Level" :
                        key === "duration" ? "Duration" :
                        key === "intake" ? "Intake(s)" :
                        key === "application_deadline" ? "Application Deadline" : key;
        
        if (!errorFields.includes(fieldName)) {
          errorFields.push(fieldName);
        }
      }
      
      setErrors(next);
      toast.error("Form Validation Error", {
        description: `Invalid or missing: ${errorFields.join(", ")}. Please check highlighted fields.`
      });
      return;
    }

    setSaving(true);
    try {
      // Sanitize rich text fields
      const sanitizedForm = {
        ...form,
        requirements: form.requirements ? DOMPurify.sanitize(form.requirements) : form.requirements,
        scholarship: form.scholarship ? DOMPurify.sanitize(form.scholarship) : form.scholarship,
        description: form.description ? DOMPurify.sanitize(form.description) : form.description,
      };
      
      await updateProgram(programId, { ...sanitizedForm, ...parsed.data } as any);
      toast.success("Program updated", { 
        description: `${parsed.data.name} has been updated.` 
      });
      // Navigate back to university details which will refresh the list via its loader
      navigate({ 
        to: "/universities/$universityId", 
        params: { universityId },
        // Ensure we force a refresh of the route data
        search: (old: any) => ({ ...old, _refresh: Date.now() })
      });
    } catch (e: any) {
      if (e instanceof DuplicateError) {
        setErrors((prev) => ({ ...prev, name: "A program with this name already exists for the selected campus." }));
        toast.error("Duplicate program", { description: "Change the program name or pick another campus." });
      } else {
        setSubmitError(e?.message ?? "A network error occurred while updating the program.");
        toast.error("Could not update program", { description: e?.message ?? "Unexpected error" });
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-8">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <Skeleton className="h-72 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
          <div className="space-y-8">
            <Skeleton className="h-80 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !uni || !form.id) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-dashed p-12 text-center">
        <div className="rounded-full bg-destructive/10 p-4">
          <AlertCircle className="h-8 w-8 text-destructive" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">University or Program not available</h2>
          <p className="mt-1 text-sm text-muted-foreground">{loadError ?? "We couldn't find the requested data."}</p>
        </div>
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/universities">Back to universities</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      {/* Hero header */}
      <header className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 shadow-sm sm:p-8">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <Button variant="outline" size="icon" className="mt-1 rounded-xl" asChild>
              <Link to="/universities/$universityId" params={{ universityId }} aria-label="Back">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
                <Sparkles className="h-3 w-3" /> Edit program
              </span>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Edit Program</h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <School className="h-4 w-4" /> {uni.name}
              </p>
            </div>
          </div>
        </div>
      </header>

      {submitError && (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-destructive/10 p-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-destructive">Submission failed</h3>
              <p className="mt-1 text-sm text-destructive/80">{submitError}</p>
              <div className="mt-4 flex gap-3">
                <Button 
                  size="sm" 
                  variant="destructive" 
                  className="rounded-lg px-4"
                  onClick={handleSave}
                  disabled={saving}
                >
                  <RefreshCcw className={cn("mr-2 h-4 w-4", saving && "animate-spin")} />
                  Retry Submission
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="rounded-lg bg-background"
                  onClick={() => setSubmitError(null)}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="space-y-8 lg:col-span-2">
          <Card className="overflow-hidden rounded-2xl border-none shadow-md ring-1 ring-border">
            <CardHeader className="border-b bg-muted/30 pb-4 sticky top-0 z-10 backdrop-blur-sm">
              <CardTitle className="flex items-center gap-2 text-base">
                <BookOpen className="h-4 w-4 text-primary" /> General Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 p-6">
              <div className="grid gap-2">
                <Label htmlFor="name" className={labelCls}>Program name *</Label>
                <Input
                  id="name"
                  className={cn("h-12 rounded-xl border-muted-foreground/20 text-base shadow-sm", errors.name && "border-destructive")}
                  placeholder="e.g. Bachelor of Computer Science"
                  value={form.name ?? ""}
                  onChange={(e) => set("name", e.target.value)}
                />
                <FieldError msg={errors.name} />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className={labelCls}>Degree level</Label>
                  <Input
                    className={inputCls}
                    placeholder="e.g. Bachelor, Master"
                    value={form.degree ?? ""}
                    onChange={(e) => set("degree", e.target.value)}
                  />
                  <FieldError msg={errors.degree} />
                </div>
                <div className="grid gap-2">
                  <Label className={labelCls}>Duration</Label>
                  <div className="relative">
                    <Input
                      className={cn(inputCls, "pl-10")}
                      placeholder="e.g. 3 Years"
                      value={form.duration ?? ""}
                      onChange={(e) => set("duration", e.target.value)}
                    />
                    <Clock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <FieldError msg={errors.duration} />
                </div>
              </div>

              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label className={labelCls}>Campus</Label>
                  <Select value={form.campus_id ?? "none"} onValueChange={(v) => set("campus_id", v === "none" ? null : v)}>
                    <SelectTrigger className={inputCls}>
                      <SelectValue placeholder="Select campus" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {campuses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-none shadow-md ring-1 ring-border">
            <CardHeader className="border-b bg-muted/30 pb-4 sticky top-0 z-10 backdrop-blur-sm">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-4 w-4 text-primary" /> Admission & Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6 p-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className={labelCls}>Intake(s)</Label>
                  <Input
                    className={inputCls}
                    placeholder="e.g. Jan, Sep"
                    value={form.intake ?? ""}
                    onChange={(e) => set("intake", e.target.value)}
                  />
                  <FieldError msg={errors.intake} />
                </div>
                <div className="grid gap-2">
                  <Label className={labelCls}>Application deadline</Label>
                  <Input
                    type="date"
                    className={cn(inputCls, errors.application_deadline && "border-destructive")}
                    value={form.application_deadline ?? ""}
                    onChange={(e) => set("application_deadline", e.target.value)}
                  />
                  <FieldError msg={errors.application_deadline} />
                </div>
              </div>

              <div className="grid gap-2">
                <Label className={labelCls}>Entry requirements</Label>
                <RichTextEditor
                  value={form.requirements ?? ""}
                  onChange={(html) => set("requirements", html)}
                  placeholder="Describe academic and English proficiency requirements..."
                />
              </div>

              <div className="grid gap-2">
                <Label className={labelCls}>Scholarship</Label>
                <RichTextEditor
                  value={form.scholarship ?? ""}
                  onChange={(html) => set("scholarship", html)}
                  placeholder="Describe available scholarships and funding opportunities..."
                />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-none shadow-md ring-1 ring-border">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" /> Description
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <RichTextEditor
                value={form.description ?? ""}
                onChange={(html) => set("description", html)}
                placeholder="Provide a detailed overview of the program..."
                className="min-h-[180px]"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="overflow-hidden rounded-2xl border-none shadow-md ring-1 ring-border">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4 text-primary" /> Financial Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5 p-6">
              <div className="grid gap-2">
                <Label className={labelCls}>Tuition fee</Label>
                <div className="relative">
                  <Input
                    type="number" min="0" step="0.01"
                    className={cn(inputCls, "pl-10", errors.tuition_fee && "border-destructive")}
                    placeholder="0.00"
                    value={(form.tuition_fee as any) ?? ""}
                    onChange={(e) => set("tuition_fee", e.target.value)}
                  />
                  <div className="absolute left-3.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-xs font-bold text-muted-foreground">
                    {getCurrencySymbol(form.currency || "USD")}
                  </div>
                </div>
                <FieldError msg={errors.tuition_fee} />
              </div>

              <div className="grid gap-2">
                <Label className={labelCls}>Currency *</Label>
                <Select value={form.currency || "USD"} onValueChange={(v) => set("currency", v)}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD - US Dollar</SelectItem>
                    <SelectItem value="BDT">BDT - Bangladeshi Taka</SelectItem>
                    <SelectItem value="GBP">GBP - British Pound</SelectItem>
                    <SelectItem value="EUR">EUR - Euro</SelectItem>
                    <SelectItem value="MYR">MYR - Malaysian Ringgit</SelectItem>
                    <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                    <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                  </SelectContent>
                </Select>
                <FieldError msg={errors.currency} />
              </div>

              <div className="h-px bg-border" />

              <div className="grid grid-cols-2 gap-4">
                {([
                  ["application_fee", "Application fee"],
                  ["registration_fee", "Registration fee"],
                  ["emgs_fee", "EMGS fee"],
                  ["others_fee", "Others fee"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="grid gap-2">
                    <Label className={labelCls}>{label}</Label>
                    <div className="relative">
                      <Input
                        type="number" min="0" step="0.01"
                        className={cn("h-10 pl-8 rounded-lg border-muted-foreground/20 shadow-sm", errors[key] && "border-destructive")}
                        placeholder="0.00"
                        value={((form as any)[key]) ?? ""}
                        onChange={(e) => set(key as any, e.target.value)}
                      />
                      <div className="absolute left-2.5 top-1/2 flex h-4 w-4 -translate-y-1/2 items-center justify-center text-[10px] font-bold text-muted-foreground">
                        {getCurrencySymbol(form.currency || "USD")}
                      </div>
                    </div>
                    <FieldError msg={errors[key]} />
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-primary/5 p-4 ring-1 ring-primary/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary/70">Total Fees</span>
                  <span className="text-lg font-bold text-primary">{formatCurrency(totalFees)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl border-none shadow-md ring-1 ring-border">
            <CardHeader className="border-b bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-4 w-4 text-primary" /> Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6">
              <div className="grid gap-2">
                <Label className={labelCls}>Status</Label>
                <Select value={form.status ?? "active"} onValueChange={(v) => set("status", v as UniStatus)}>
                  <SelectTrigger className={inputCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNI_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-4 flex flex-col gap-3">
                <Button 
                  className={cn(
                    "h-12 w-full rounded-xl text-base font-semibold shadow-lg transition-all active:scale-[0.98]",
                    saving 
                      ? "bg-primary/70 cursor-not-allowed opacity-80" 
                      : "shadow-primary/20 hover:shadow-xl hover:translate-y-[-1px]"
                  )}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Updating Program...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-5 w-5" />
                      Update Program
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  className={cn(
                    "h-12 w-full rounded-xl text-base font-semibold transition-colors hover:bg-muted",
                    saving && "opacity-50 cursor-not-allowed pointer-events-none"
                  )}
                  asChild
                  disabled={saving}
                >
                  <Link to="/universities/$universityId" params={{ universityId }}>
                    Cancel
                  </Link>
                </Button>
              </div>

              {Object.keys(errors).length > 0 && (
                <div className="mt-2 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center">
                  <p className="flex items-center justify-center gap-2 text-sm font-medium text-destructive">
                    <AlertCircle className="h-4 w-4" /> Please fix errors to save
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default EditProgramPage;