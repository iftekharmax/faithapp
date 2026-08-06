import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  APPLICATION_STATUSES, APPLICATION_STATUS_LABELS,
  createApplication, listStudentsLite,
  validateApplicationInput, type ApplicationInput,
} from "@/lib/applications";
import {
  listCountries, listUniversities, listCampuses, listPrograms,
  type Country, type University, type Campus, type UniversityProgram,
} from "@/lib/universities";

export const Route = createFileRoute("/_authenticated/applications/new")({
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team"]}>
      <NewApplicationPage />
    </RoleGuard>
  ),
});

const NONE = "__none__";

function NewApplicationPage() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState<Array<{id:string;full_name:string;student_code:string}>>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [programs, setPrograms] = useState<UniversityProgram[]>([]);
  const [loadingUnis, setLoadingUnis] = useState(false);
  const [loadingCampuses, setLoadingCampuses] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(false);

  // Selected IDs drive the cascade; text values in `form` are what gets saved.
  const [countryId, setCountryId] = useState<string>("");
  const [universityId, setUniversityId] = useState<string>("");
  const [campusId, setCampusId] = useState<string>("");
  const [programId, setProgramId] = useState<string>("");

  const [errors, setErrors] = useState<Record<string,string>>({});
  const [form, setForm] = useState<ApplicationInput>({
    student_id: undefined,
    country: "",
    university: "",
    campus: "",
    program: "",
    degree: "",
    intake: "",
    scholarship: "",
    application_fee: undefined,
    registration_fee: undefined,
    emgs_fee: undefined,
    others_fee: undefined,
    status: "draft",
    notes: "",
  });

  // Initial load: students + countries.
  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([listStudentsLite(), listCountries()]);
        setStudents(s);
        setCountries(c.filter((x) => x.status === "active"));
      } catch (e: any) { toast.error(e.message ?? "Failed to load form data"); }
    })();
  }, []);

  // Country change → load universities in that country.
  useEffect(() => {
    setUniversityId(""); setCampusId(""); setProgramId("");
    setUniversities([]); setCampuses([]); setPrograms([]);
    setForm((f) => ({ ...f, university: "", campus: "", program: "", degree: "", intake: "", scholarship: "" }));
    if (!countryId) return;
    const country = countries.find((c) => c.id === countryId);
    setForm((f) => ({ ...f, country: country?.name ?? "" }));
    setLoadingUnis(true);
    listUniversities({ countryId, status: "active" })
      .then((rows) => setUniversities(rows))
      .catch((e) => toast.error(e.message ?? "Failed to load universities"))
      .finally(() => setLoadingUnis(false));
  }, [countryId, countries]);

  // University change → load campuses + programs.
  useEffect(() => {
    setCampusId(""); setProgramId("");
    setCampuses([]); setPrograms([]);
    setForm((f) => ({ ...f, campus: "", program: "", degree: "", intake: "", scholarship: "" }));
    if (!universityId) { setForm((f) => ({ ...f, university: "" })); return; }
    const uni = universities.find((u) => u.id === universityId);
    setForm((f) => ({ ...f, university: uni?.name ?? "" }));
    setLoadingCampuses(true); setLoadingPrograms(true);
    listCampuses(universityId)
      .then((rows) => setCampuses(rows.filter((c) => c.status === "active")))
      .catch((e) => toast.error(e.message ?? "Failed to load campuses"))
      .finally(() => setLoadingCampuses(false));
    listPrograms({ universityId, status: "active" })
      .then((rows) => setPrograms(rows))
      .catch((e) => toast.error(e.message ?? "Failed to load programs"))
      .finally(() => setLoadingPrograms(false));
  }, [universityId, universities]);

  // Campus change → set text; filter programs.
  useEffect(() => {
    if (!campusId || campusId === NONE) {
      setForm((f) => ({ ...f, campus: "" }));
    } else {
      const c = campuses.find((x) => x.id === campusId);
      setForm((f) => ({ ...f, campus: c?.name ?? "" }));
    }
    // Reset program if it doesn't fit the new campus filter.
    if (programId) {
      const p = programs.find((x) => x.id === programId);
      if (p && campusId && campusId !== NONE && p.campus_id && p.campus_id !== campusId) {
        setProgramId("");
      }
    }
  }, [campusId, campuses]); // eslint-disable-line react-hooks/exhaustive-deps

  // Program change → set text + auto-fill degree/intake/scholarship.
  useEffect(() => {
    if (!programId) { setForm((f) => ({ ...f, program: "" })); return; }
    const p = programs.find((x) => x.id === programId);
    if (!p) return;
    setForm((f) => ({
      ...f,
      program: p.name,
      degree: p.degree ?? f.degree ?? "",
      intake: p.intake ?? f.intake ?? "",
      scholarship: p.scholarship ?? f.scholarship ?? "",
      application_fee: p.application_fee ?? f.application_fee ?? undefined,
      registration_fee: p.registration_fee ?? f.registration_fee ?? undefined,
      emgs_fee: p.emgs_fee ?? f.emgs_fee ?? undefined,
      others_fee: p.others_fee ?? f.others_fee ?? undefined,
    }));
  }, [programId, programs]);

  const filteredPrograms = useMemo(() => {
    if (!campusId || campusId === NONE) return programs;
    return programs.filter((p) => !p.campus_id || p.campus_id === campusId);
  }, [programs, campusId]);

  const set = <K extends keyof ApplicationInput>(k: K, v: ApplicationInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const liveErrors = useMemo(() => validateApplicationInput(form), [form]);
  const canSubmit = Object.keys(liveErrors).length === 0 && !saving;

  const submit = async () => {
    const errs = validateApplicationInput(form);
    setErrors(errs);
    if (Object.keys(errs).length) { toast.error("Fix validation errors"); return; }
    setSaving(true);
    try {
      const created = await createApplication({
        ...form,
        application_fee: form.application_fee ? Number(form.application_fee) : null,
        registration_fee: form.registration_fee ? Number(form.registration_fee) : null,
        emgs_fee: form.emgs_fee ? Number(form.emgs_fee) : null,
        others_fee: form.others_fee ? Number(form.others_fee) : null,
        country: form.country || null,
        campus: form.campus || null,
        degree: form.degree || null,
        intake: form.intake || null,
        scholarship: form.scholarship || null,
        notes: form.notes || null,
      });
      toast.success("Application created", {
        action: { label: "View", onClick: () => navigate({ to: "/applications/$applicationId", params: { applicationId: created.id } }) },
      });
      navigate({ to: "/applications" });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create application");
    } finally { setSaving(false); }
  };

  const err = (k: string) => errors[k] ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <header className="mb-8">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-3 text-muted-foreground hover:text-foreground">
          <Link to="/applications"><ArrowLeft className="mr-2 h-4 w-4" /> Back to applications</Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Create new application</h1>
        <p className="mt-1 text-muted-foreground">Capture student application details and fee information.</p>
      </header>

      <div className="grid gap-6">
        <Card className="shadow-none border-border/50">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">1</span>
              Student & Academic Program
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 p-6 md:grid-cols-2">
            <Field label="Student" error={err("student_id")}>
              <Select value={form.student_id ?? ""} onValueChange={(v) => set("student_id", v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.student_code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Country" error={err("country")}>
              <Select value={countryId} onValueChange={setCountryId} disabled={!countries.length}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={countries.length ? "Select country" : "No countries available"} />
                </SelectTrigger>
                <SelectContent>
                  {countries.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="inline-flex items-center gap-2">
                        {c.flag_url && <img src={c.flag_url} alt="" className="h-3 w-4 rounded-sm object-cover" />}
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="University" error={err("university")}>
              <Select value={universityId} onValueChange={setUniversityId} disabled={!countryId || loadingUnis}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={
                    !countryId ? "Select a country first" :
                    loadingUnis ? "Loading…" :
                    universities.length ? "Select university" : "No universities in this country"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {universities.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Campus" error={err("campus")}>
              <Select value={campusId} onValueChange={setCampusId} disabled={!universityId || loadingCampuses}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={
                    !universityId ? "Select a university first" :
                    loadingCampuses ? "Loading…" :
                    campuses.length ? "Select campus" : "No campuses listed"
                  } />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— No specific campus —</SelectItem>
                  {campuses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{c.is_main ? " (Main)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Program" error={err("program")}>
              <Select value={programId} onValueChange={setProgramId} disabled={!universityId || loadingPrograms}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder={
                    !universityId ? "Select a university first" :
                    loadingPrograms ? "Loading…" :
                    filteredPrograms.length ? "Select program" : "No programs available"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {filteredPrograms.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}{p.degree ? ` — ${p.degree}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Degree" error={err("degree")}>
              <Select
                value={form.degree || NONE}
                onValueChange={(v) => set("degree", v === NONE ? "" : v)}
              >
                <SelectTrigger className="h-10"><SelectValue placeholder="Select degree" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>— None —</SelectItem>
                  {["Foundation","Diploma","Bachelor","Master","MBA","PhD","Certificate"].map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        <Card className="shadow-none border-border/50">
          <CardHeader className="bg-muted/30 border-b border-border/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">2</span>
              Financial & Workflow Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Intake" error={err("intake")}>
                <Input className="h-10" placeholder="e.g. Fall 2026" value={form.intake ?? ""} onChange={(e) => set("intake", e.target.value)} />
              </Field>
              <Field label="Scholarship" error={err("scholarship")}>
                <Input className="h-10" value={form.scholarship ?? ""} onChange={(e) => set("scholarship", e.target.value)} />
              </Field>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
              <Label className="text-sm font-semibold text-foreground">Fees Breakdown</Label>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Application fee" error={err("application_fee")}>
                  <Input type="number" className="h-10" value={form.application_fee ?? ""} onChange={(e) => set("application_fee", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
                <Field label="Registration fee" error={err("registration_fee")}>
                  <Input type="number" className="h-10" value={form.registration_fee ?? ""} onChange={(e) => set("registration_fee", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
                <Field label="EMGS fee" error={err("emgs_fee")}>
                  <Input type="number" className="h-10" value={form.emgs_fee ?? ""} onChange={(e) => set("emgs_fee", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
                <Field label="Others fee" error={err("others_fee")}>
                  <Input type="number" className="h-10" value={form.others_fee ?? ""} onChange={(e) => set("others_fee", e.target.value === "" ? null : Number(e.target.value))} />
                </Field>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Status">
                <Select value={form.status ?? "draft"} onValueChange={(v) => set("status", v as any)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {APPLICATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            
            <Field label="Internal Notes" error={err("notes")}>
              <Textarea className="min-h-[120px]" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-3 pt-6 border-t mt-8">
        <Button variant="outline" size="lg" onClick={() => navigate({ to: "/applications" })} disabled={saving}>Cancel</Button>
        <Button size="lg" onClick={submit} disabled={!canSubmit} className="min-w-[160px]">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save application
        </Button>
      </div>
    </div>

  );
}

function Field({ label, error, children }: { label: string; error?: string | null; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
