import { createFileRoute, useNavigate, useBlocker } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft, Loader2, Plus, Trash2, UserPlus, AlertTriangle,
  User, BookOpen, Home, Phone, GraduationCap, StickyNote, IdCard, ShieldAlert,
} from "lucide-react";

import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  createStudent, findStudentByPassport, writeStudentAudit,
  STUDENT_STATUSES, STUDENT_STATUS_LABELS, STUDENT_GENDERS, GENDER_LABELS,
  type Student, type StudentStatus, type StudentGender, type StudentValidationError,
} from "@/lib/students";

export const Route = createFileRoute("/_authenticated/students/new")({
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team"]}>
      <NewStudentPage />
    </RoleGuard>
  ),
});

interface AcadRow { level?: string; institution: string; board?: string; qualification: string; program?: string; year: string; grade: string; }
interface PrefRow { country: string; university: string; course: string; }
interface TestRow { test: string; score: string; }

const NATIONALITIES = [
  "Bangladeshi","Indian","Pakistani","Sri Lankan","Nepali","Bhutanese","Maldivian",
  "Afghan","Chinese","Japanese","Korean","Malaysian","Indonesian","Filipino","Thai",
  "Vietnamese","Singaporean","Saudi","Emirati","Qatari","Turkish","British","American",
  "Canadian","Australian","German","French","Italian","Spanish","Nigerian","Egyptian",
  "South African","Other",
];
const GUARDIAN_RELATIONS = ["Father","Mother","Brother","Sister","Uncle","Aunt","Grandparent","Guardian","Spouse","Other"];

const SECONDARY_LEVELS = ["O LEVEL/SSC/DAKHIL", "A2 LEVEL/HSC/ALIM"] as const;
const PROFICIENCY_TESTS = ["IELTS", "UKVI", "PTE", "DUOLINGO", "SAT", "ACT"] as const;

const emptySecondary = (): AcadRow[] =>
  SECONDARY_LEVELS.map((level) => ({ level, institution: "", board: "", qualification: level, year: "", grade: "" }));
const emptyTests = (): TestRow[] => PROFICIENCY_TESTS.map((test) => ({ test, score: "" }));

const emptyForm = {
  full_name: "", email: "", phone: "", passport_no: "", passport_expiry: "",
  date_of_birth: "", gender: "" as StudentGender | "", nationality: "",
  status: "prospect" as StudentStatus, notes: "",
  guardian_name: "", guardian_phone: "", guardian_relation: "",
  emergency_contact_name: "", emergency_contact_phone: "",
  current_address: "", permanent_address: "",
};

function Section({
  icon: Icon, title, description, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <div className="flex items-start gap-3 border-b bg-muted/30 px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <CardContent className="space-y-4 p-5">{children}</CardContent>
    </Card>
  );
}

function Field({ label, required, htmlFor, children, error }: {
  label: string; required?: boolean; htmlFor?: string; children: React.ReactNode; error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}{required && <span className="ml-0.5 text-destructive">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  date_of_birth: "Date of birth",
  passport_no: "Passport number",
  passport_expiry: "Passport expiry",
  guardian_phone: "Guardian phone",
  emergency_contact_phone: "Emergency contact phone",
};

function NewStudentPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const submitLockRef = useRef(false);
  const [form, setForm] = useState(emptyForm);
  const [secondary, setSecondary] = useState<AcadRow[]>(emptySecondary());
  const [higher, setHigher] = useState<AcadRow[]>([]);
  const [preferred, setPreferred] = useState<PrefRow[]>([{ country: "", university: "", course: "" }]);
  const [tests, setTests] = useState<TestRow[]>(emptyTests());
  const [sameAddress, setSameAddress] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicate, setDuplicate] = useState<Student | null>(null);
  const [pendingPassport, setPendingPassport] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [natOther, setNatOther] = useState(false);
  const [relOther, setRelOther] = useState(false);

  const setField = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const markTouched = (k: string) => setTouched((t) => (t[k] ? t : { ...t, [k]: true }));

  const updSecondary = (i: number, k: keyof AcadRow, v: string) =>
    setSecondary((a) => a.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  const addHigher = () =>
    setHigher((a) => [...a, { level: "Bachelor", institution: "", qualification: "", program: "", year: "", grade: "" }]);
  const updHigher = (i: number, k: keyof AcadRow, v: string) =>
    setHigher((a) => a.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const rmHigher = (i: number) => setHigher((a) => a.filter((_, idx) => idx !== i));

  const addPref = () => setPreferred((p) => [...p, { country: "", university: "", course: "" }]);
  const updPref = (i: number, k: keyof PrefRow, v: string) =>
    setPreferred((p) => p.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const rmPref = (i: number) => setPreferred((p) => p.filter((_, idx) => idx !== i));

  const updTest = (i: number, v: string) =>
    setTests((t) => t.map((r, idx) => (idx === i ? { ...r, score: v } : r)));

  const isDirty = useMemo(() => {
    if (JSON.stringify(form) !== JSON.stringify(emptyForm)) return true;
    if (JSON.stringify(secondary) !== JSON.stringify(emptySecondary())) return true;
    if (higher.length > 0) return true;
    if (preferred.some((p) => p.country || p.university || p.course)) return true;
    if (tests.some((t) => t.score.trim())) return true;
    return false;
  }, [form, secondary, higher, preferred, tests]);

  useBlocker({
    shouldBlockFn: ({ next }) => {
      if (!isDirty || saving) return false;
      if (next.pathname === "/students/new") return false;
      const ok = window.confirm("You have unsaved changes. Leave without saving?");
      return !ok;
    },
    enableBeforeUnload: () => isDirty && !saving,
  });

  const phoneOk = (v: string) => /^[+\d][\d\s().-]{5,24}$/.test(v.trim());

  const validate = (patch = form): Record<string, string> => {
    const e: Record<string, string> = {};
    const name = patch.full_name.trim();
    if (!name) e.full_name = "Full name is required";
    else if (name.length > 150) e.full_name = "Max 150 characters";
    else if (!/^[\p{L}\p{M}\s.'\-]+$/u.test(name)) e.full_name = "Only letters, spaces, hyphens and apostrophes";

    if (patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email.trim()))
      e.email = "Enter a valid email like name@example.com";

    if (patch.phone && !phoneOk(patch.phone))
      e.phone = "Enter 6–25 digits, may start with + and contain spaces or hyphens";

    if (patch.guardian_phone && !phoneOk(patch.guardian_phone))
      e.guardian_phone = "Enter a valid phone number";

    if (patch.emergency_contact_phone && !phoneOk(patch.emergency_contact_phone))
      e.emergency_contact_phone = "Enter a valid phone number";

    if (patch.passport_no && !/^[A-Za-z0-9]{5,15}$/.test(patch.passport_no.trim()))
      e.passport_no = "5–15 letters or digits, no spaces";

    if (patch.passport_expiry) {
      if (patch.date_of_birth && patch.passport_expiry <= patch.date_of_birth)
        e.passport_expiry = "Expiry must be after date of birth";
      const y = Number(patch.passport_expiry.slice(0, 4));
      if (!y || y < 1900) e.passport_expiry = "Enter a valid expiry date";
    }

    if (patch.date_of_birth) {
      const y = Number(patch.date_of_birth.slice(0, 4));
      const now = new Date();
      if (!y || y < 1900) e.date_of_birth = "Enter a valid date of birth";
      else if (new Date(patch.date_of_birth) > now) e.date_of_birth = "Date of birth cannot be in the future";
    }

    return e;
  };

  const liveErrors = useMemo(() => validate(form), [form]);
  const canSubmit = Object.keys(liveErrors).length === 0 && form.full_name.trim().length > 0;

  const performCreate = async () => {
    if (saving || submitLockRef.current) return;
    submitLockRef.current = true;
    setSaving(true);
    try {
      const permanent = sameAddress ? form.current_address : form.permanent_address;

      const secondaryClean = secondary
        .filter((r) => (r.board ?? "").trim() || r.year.trim() || r.grade.trim())
        .map((r) => ({
          level: r.level,
          institution: (r.board ?? "").trim(),
          board: (r.board ?? "").trim() || undefined,
          qualification: r.qualification,
          year: r.year.trim() || undefined,
          grade: r.grade.trim() || undefined,
        }));
      const higherClean = higher
        .filter((r) => r.institution.trim() || r.qualification.trim() || (r.program ?? "").trim())
        .map((r) => ({
          level: r.level || "Bachelor",
          institution: r.institution.trim(),
          qualification: r.qualification.trim(),
          program: (r.program ?? "").trim() || undefined,
          year: r.year.trim() || undefined,
          grade: r.grade.trim() || undefined,
        }));

      const preferredClean = preferred
        .map((r) => ({ country: r.country.trim(), university: r.university.trim(), course: r.course.trim() }))
        .filter((r) => r.country || r.university || r.course);

      const testsClean = tests
        .map((t) => ({ test: t.test, score: t.score.trim() }))
        .filter((t) => t.score);

      const created = await createStudent({
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        passport_no: form.passport_no.trim() || null,
        passport_expiry: form.passport_expiry || null,
        date_of_birth: form.date_of_birth || null,
        gender: (form.gender || null) as StudentGender | null,
        nationality: form.nationality.trim() || null,
        status: form.status,
        notes: form.notes.trim() || null,
        guardian_name: form.guardian_name.trim() || null,
        guardian_phone: form.guardian_phone.trim() || null,
        guardian_relation: form.guardian_relation.trim() || null,
        emergency_contact_name: form.emergency_contact_name.trim() || null,
        emergency_contact_phone: form.emergency_contact_phone.trim() || null,
        current_address: form.current_address.trim() || null,
        permanent_address: permanent.trim() || null,
        academic_history: [...secondaryClean, ...higherClean],
        preferred_universities: preferredClean,
        test_scores: testsClean,
      });
      await writeStudentAudit(created.id, "student.created", {
        full_name: created.full_name, status: created.status,
      });
      toast.success(`${created.full_name} added`, {
        description: "Student created successfully.",
        action: { label: "View", onClick: () => navigate({ to: "/students/$studentId", params: { studentId: created.id } }) },
      });
      setForm(emptyForm);
      setSecondary(emptySecondary());
      setHigher([]);
      setPreferred([{ country: "", university: "", course: "" }]);
      setTests(emptyTests());
      navigate({ to: "/students" });
    } catch (err) {
      const e = err as StudentValidationError;
      if (e.field) {
        setErrors((prev) => ({ ...prev, [e.field!]: e.message }));
        if (e.field === "passport_no" && form.passport_no.trim()) {
          try {
            const existing = await findStudentByPassport(form.passport_no.trim());
            if (existing) { setDuplicate(existing); setPendingPassport(form.passport_no.trim()); }
          } catch { /* ignore */ }
        }
        toast.error(e.message);
      } else {
        toast.error(e.message ?? "Create failed");
      }
    } finally {
      setSaving(false);
      submitLockRef.current = false;
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || submitLockRef.current) return;
    const eMap = validate();
    setErrors(eMap);
    setTouched((t) => ({ ...t, ...Object.fromEntries(Object.keys(eMap).map((k) => [k, true])) }));
    if (Object.keys(eMap).length > 0) {
      const names = Object.keys(eMap).map((k) => FIELD_LABELS[k] ?? k).join(", ");
      toast.error(`Please fix: ${names}`);
      return;
    }
    const passport = form.passport_no.trim();
    if (passport) {
      try {
        const existing = await findStudentByPassport(passport);
        if (existing) {
          setDuplicate(existing);
          setPendingPassport(passport);
          return;
        }
      } catch (err: any) {
        toast.error(err.message ?? "Passport check failed");
        return;
      }
    }
    await performCreate();
  };

  const handleCancelClick = () => {
    if (isDirty) setConfirmCancel(true);
    else navigate({ to: "/students" });
  };

  const combinedErr = (k: string) => {
    const err = errors[k] || liveErrors[k];
    if (!err) return undefined;
    return touched[k] ? err : undefined;
  };

  const onBlurField = (k: string) => () => markTouched(k);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-32 sm:pb-24">
      <header className="sticky top-0 z-10 -mx-4 border-b bg-background/80 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" variant="ghost" size="icon" aria-label="Back to students" className="shrink-0" onClick={handleCancelClick}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
                <UserPlus className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">New student</h1>
                <p className="truncate text-xs text-muted-foreground sm:text-sm">
                  Fill in the details and click Create student.
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <form
        id="new-student-form"
        data-testid="new-student-form"
        onSubmit={submit}
        onKeyDown={(e) => {
          // Prevent accidental Enter-key submits from single-line inputs.
          if (
            e.key === "Enter" &&
            (e.target as HTMLElement).tagName === "INPUT"
          ) {
            e.preventDefault();
          }
        }}
        className="space-y-5"
      >
        <Section icon={User} title="Personal details" description="Basic identity and status.">
          <Field label="Full name" required htmlFor="full_name" error={combinedErr("full_name")}>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setField("full_name")(e.target.value)}
              onBlur={onBlurField("full_name")}
              placeholder="e.g. Aisha Rahman"
              maxLength={150}
              required
              autoComplete="name"
              aria-invalid={!!combinedErr("full_name")}
              className="h-10 scroll-mt-40"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Email" htmlFor="email" error={combinedErr("email")}>
              <Input id="email" type="email" placeholder="name@example.com"
                value={form.email} onChange={(e) => setField("email")(e.target.value)}
                onBlur={onBlurField("email")}
                inputMode="email" autoComplete="email"
                aria-invalid={!!combinedErr("email")} className="h-10 scroll-mt-40" />
            </Field>
            <Field label="Phone" htmlFor="phone" error={combinedErr("phone")}>
              <Input id="phone" placeholder="+880 1XXXXXXXXX"
                value={form.phone} onChange={(e) => setField("phone")(e.target.value)}
                onBlur={onBlurField("phone")}
                type="tel" inputMode="tel" autoComplete="tel"
                aria-invalid={!!combinedErr("phone")} className="h-10 scroll-mt-40" />
            </Field>

            <Field label="Nationality">
              {natOther ? (
                <div className="flex gap-2">
                  <Input placeholder="Enter nationality" value={form.nationality}
                    onChange={(e) => setField("nationality")(e.target.value)} className="h-10" autoFocus />
                  <Button type="button" variant="ghost" size="sm"
                    onClick={() => { setNatOther(false); setField("nationality")(""); }}>Reset</Button>
                </div>
              ) : (
                <Select
                  value={NATIONALITIES.includes(form.nationality) ? form.nationality : ""}
                  onValueChange={(v) => {
                    if (v === "Other") { setNatOther(true); setField("nationality")(""); }
                    else setField("nationality")(v);
                  }}
                >
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select nationality" /></SelectTrigger>
                  <SelectContent>
                    {NATIONALITIES.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </Field>
            <Field label="Date of birth" htmlFor="dob" error={combinedErr("date_of_birth")}>
              <Input id="dob" type="date"
                value={form.date_of_birth} onChange={(e) => setField("date_of_birth")(e.target.value)}
                onBlur={onBlurField("date_of_birth")}
                autoComplete="bday"
                aria-invalid={!!combinedErr("date_of_birth")} className="h-10 scroll-mt-40" />
            </Field>
            <Field label="Gender">
              <Select value={form.gender} onValueChange={(v) => setField("gender")(v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select gender" /></SelectTrigger>
                <SelectContent>
                  {STUDENT_GENDERS.map((g) => <SelectItem key={g} value={g}>{GENDER_LABELS[g]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setField("status")(v)}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STUDENT_STATUSES.map((s) => <SelectItem key={s} value={s}>{STUDENT_STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Section>

        <Section icon={IdCard} title="Passport" description="Travel document details.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Passport number" htmlFor="passport_no" error={combinedErr("passport_no") || errors.passport_no}>
              <Input
                id="passport_no"
                placeholder="A01234567"
                value={form.passport_no}
                onChange={(e) => { setField("passport_no")(e.target.value); setErrors((p) => ({ ...p, passport_no: "" })); }}
                onBlur={onBlurField("passport_no")}
                autoCapitalize="characters" autoComplete="off"
                aria-invalid={!!(combinedErr("passport_no") || errors.passport_no)}
                className="h-10 uppercase tracking-wider scroll-mt-40"
              />
            </Field>
            <Field label="Passport expiry" htmlFor="passport_expiry" error={combinedErr("passport_expiry")}>
              <Input id="passport_expiry" type="date"
                value={form.passport_expiry} onChange={(e) => setField("passport_expiry")(e.target.value)}
                onBlur={onBlurField("passport_expiry")}
                aria-invalid={!!combinedErr("passport_expiry")} className="h-10 scroll-mt-40" />
            </Field>
          </div>
        </Section>

        <Section icon={Phone} title="Guardian & emergency" description="Parent or emergency contact information.">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guardian</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Name"><Input value={form.guardian_name} onChange={(e) => setField("guardian_name")(e.target.value)} autoComplete="name" className="h-10 scroll-mt-40" /></Field>
              <Field label="Phone" error={combinedErr("guardian_phone")}>
                <Input value={form.guardian_phone} onChange={(e) => setField("guardian_phone")(e.target.value)}
                  onBlur={onBlurField("guardian_phone")}
                  type="tel" inputMode="tel" autoComplete="tel"
                  aria-invalid={!!combinedErr("guardian_phone")} className="h-10 scroll-mt-40" />
              </Field>
              <Field label="Relation">
                {relOther ? (
                  <div className="flex gap-2">
                    <Input placeholder="Enter relation" value={form.guardian_relation}
                      onChange={(e) => setField("guardian_relation")(e.target.value)} className="h-10" autoFocus />
                    <Button type="button" variant="ghost" size="sm"
                      onClick={() => { setRelOther(false); setField("guardian_relation")(""); }}>Reset</Button>
                  </div>
                ) : (
                  <Select
                    value={GUARDIAN_RELATIONS.includes(form.guardian_relation) ? form.guardian_relation : ""}
                    onValueChange={(v) => {
                      if (v === "Other") { setRelOther(true); setField("guardian_relation")(""); }
                      else setField("guardian_relation")(v);
                    }}
                  >
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select relation" /></SelectTrigger>
                    <SelectContent>
                      {GUARDIAN_RELATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </div>
          </div>
          <Separator />
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Emergency contact</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name"><Input value={form.emergency_contact_name} onChange={(e) => setField("emergency_contact_name")(e.target.value)} autoComplete="name" className="h-10 scroll-mt-40" /></Field>
              <Field label="Phone" error={combinedErr("emergency_contact_phone")}>
                <Input value={form.emergency_contact_phone} onChange={(e) => setField("emergency_contact_phone")(e.target.value)}
                  onBlur={onBlurField("emergency_contact_phone")}
                  type="tel" inputMode="tel" autoComplete="tel"
                  aria-invalid={!!combinedErr("emergency_contact_phone")} className="h-10 scroll-mt-40" />
              </Field>
            </div>
          </div>
        </Section>

        <Section icon={Home} title="Addresses" description="Current and permanent residence.">
          <Field label="Current address">
            <Textarea rows={2} value={form.current_address} onChange={(e) => setField("current_address")(e.target.value)}
              placeholder="Street, city, postal code, country" />
          </Field>
          <label className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm">
            <Checkbox checked={sameAddress} onCheckedChange={(v) => setSameAddress(Boolean(v))} />
            Permanent address is the same as current
          </label>
          {!sameAddress && (
            <Field label="Permanent address">
              <Textarea rows={2} value={form.permanent_address} onChange={(e) => setField("permanent_address")(e.target.value)} />
            </Field>
          )}
        </Section>

        <Section icon={GraduationCap} title="Secondary & Higher Secondary" description="O Level / SSC / Dakhil and A2 / HSC / Alim.">
          <div className="space-y-2">
            {secondary.map((r, i) => (
              <div key={i} className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[1.4fr_1.4fr_0.7fr_0.9fr]">
                <div className="flex flex-col justify-center rounded-md bg-primary/5 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  {r.level}
                </div>
                <Input placeholder="Board / Group" value={r.board ?? ""} onChange={(e) => updSecondary(i, "board", e.target.value)} className="h-9" />
                <Input placeholder="Year" value={r.year} onChange={(e) => updSecondary(i, "year", e.target.value)} className="h-9" />
                <Input placeholder="Grades / CGPA" value={r.grade} onChange={(e) => updSecondary(i, "grade", e.target.value)} className="h-9" />
              </div>
            ))}
          </div>
        </Section>

        <Section icon={BookOpen} title="Bachelor's & Master's" description="Add each tertiary qualification.">
          {higher.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
              <BookOpen className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">No tertiary entries yet.</p>
              <Button type="button" variant="outline" size="sm" onClick={addHigher} className="mt-3">
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add entry
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {higher.map((r, i) => (
                  <div key={i} className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[1.2fr_1fr_1.2fr_0.9fr_0.7fr_auto]">
                    <Input placeholder="University" value={r.institution} onChange={(e) => updHigher(i, "institution", e.target.value)} className="h-9" />
                    <Input placeholder="Degree" value={r.qualification} onChange={(e) => updHigher(i, "qualification", e.target.value)} className="h-9" />
                    <Input placeholder="Program / Subject" value={r.program ?? ""} onChange={(e) => updHigher(i, "program", e.target.value)} className="h-9" />
                    <Input placeholder="CGPA / Class" value={r.grade} onChange={(e) => updHigher(i, "grade", e.target.value)} className="h-9" />
                    <Input placeholder="Year" value={r.year} onChange={(e) => updHigher(i, "year", e.target.value)} className="h-9" />
                    <Button type="button" size="icon" variant="ghost" onClick={() => rmHigher(i)} title="Remove" className="shrink-0">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addHigher}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Add another
              </Button>
            </>
          )}
        </Section>

        <Section icon={BookOpen} title="Preferred universities" description="Desired countries, universities and courses.">
          <div className="space-y-2">
            {preferred.map((r, i) => (
              <div key={i} className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-[1fr_1.4fr_1.4fr_auto]">
                <Input placeholder="Country" value={r.country} onChange={(e) => updPref(i, "country", e.target.value)} className="h-9" />
                <Input placeholder="University" value={r.university} onChange={(e) => updPref(i, "university", e.target.value)} className="h-9" />
                <Input placeholder="Course / Subject" value={r.course} onChange={(e) => updPref(i, "course", e.target.value)} className="h-9" />
                <Button type="button" size="icon" variant="ghost" onClick={() => rmPref(i)} title="Remove" className="shrink-0" disabled={preferred.length === 1}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addPref}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add another
          </Button>
        </Section>

        <Section icon={BookOpen} title="Language & other proficiency scores" description="IELTS, UKVI, PTE, Duolingo, SAT, ACT.">
          <div className="grid gap-2 sm:grid-cols-2">
            {tests.map((t, i) => (
              <div key={t.test} className="grid grid-cols-[110px_1fr] items-center gap-2 rounded-lg border bg-background p-2">
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-destructive">
                  {t.test}
                </div>
                <Input placeholder="Score" value={t.score} onChange={(e) => updTest(i, e.target.value)} className="h-9" />
              </div>
            ))}
          </div>
        </Section>

        <Section icon={StickyNote} title="Notes" description="Anything worth recording.">
          <Textarea rows={3} value={form.notes} onChange={(e) => setField("notes")(e.target.value)}
            placeholder="Internal notes, preferences, follow-ups…" />
        </Section>
      </form>

      <div
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)] backdrop-blur-xl sm:px-6"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="hidden text-xs text-muted-foreground sm:block">
            {saving ? "Saving student…" : canSubmit ? "Ready to create." : "Fix highlighted fields to enable Create."}
          </p>
          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <Button type="button" variant="outline" onClick={handleCancelClick} disabled={saving} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="create-student"
              form="new-student-form"
              disabled={saving || !canSubmit}
              aria-busy={saving}
              className="flex-1 sm:flex-none"
              aria-live="polite"
            >
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating…</>
              ) : (
                <>Create student</>
              )}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={!!duplicate} onOpenChange={(o) => { if (!o) { setDuplicate(null); setPendingPassport(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Passport already registered
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>A student is already registered with passport <b>{pendingPassport}</b>:</p>
                {duplicate && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <div className="font-medium text-foreground">{duplicate.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {duplicate.student_code}{duplicate.email ? ` · ${duplicate.email}` : ""}
                    </div>
                  </div>
                )}
                <p className="text-xs">Open the existing record instead of creating a duplicate, or change the passport number and try again.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Change passport</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (duplicate) navigate({ to: "/students/$studentId", params: { studentId: duplicate.id } }); }}
            >
              View existing student
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Discard unsaved changes?
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes on this form. If you leave now, your entries will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setForm(emptyForm);
                setSecondary(emptySecondary());
                setHigher([]);
                setPreferred([{ country: "", university: "", course: "" }]);
                setTests(emptyTests());
                setConfirmCancel(false);
                navigate({ to: "/students" });
              }}
            >
              Discard & leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
