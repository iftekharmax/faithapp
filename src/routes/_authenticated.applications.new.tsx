import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Save, User, GraduationCap, DollarSign, FileText, Layout, X } from "lucide-react";
import { toast } from "sonner";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUSES, APPLICATION_STATUS_LABELS,
  createApplication, listStudentsLite,
  validateApplicationInput, type ApplicationInput,
} from "@/lib/applications";
import {
  listCountries, listUniversities, listCampuses, listPrograms,
  type Country, type University, type Campus, type UniversityProgram,
} from "@/lib/universities";
import { supabase } from "@/lib/supabase";


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

  // Target IDs for pre-selection from URL
  const [targetUniId, setTargetUniId] = useState<string | null>(null);
  const [targetProgId, setTargetProgId] = useState<string | null>(null);

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

  // Initial load: students + countries + pre-select from URL
  useEffect(() => {
    (async () => {
      try {
        const [s, c] = await Promise.all([listStudentsLite(), listCountries()]);
        setStudents(s);
        const activeCountries = c.filter((x) => x.status === "active");
        setCountries(activeCountries);

        // Check search params for pre-selection
        const searchParams = new URLSearchParams(window.location.search);
        const urlUniId = searchParams.get("universityId");
        const urlProgId = searchParams.get("programId");

        if (urlUniId) {
          setTargetUniId(urlUniId);
          if (urlProgId) setTargetProgId(urlProgId);

          // Find country for this university first to start the cascade
          const { data: uniData } = await supabase
            .from("universities")
            .select("country_id")
            .eq("id", urlUniId)
            .maybeSingle();

          if (uniData?.country_id) {
            setCountryId(uniData.country_id);
          }
        }
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
      .then((rows) => {
        setUniversities(rows);
        if (targetUniId && rows.some(r => r.id === targetUniId)) {
          setUniversityId(targetUniId);
        }
      })
      .catch((e) => toast.error(e.message ?? "Failed to load universities"))
      .finally(() => setLoadingUnis(false));
  }, [countryId, countries]);

  // University change → load campuses + programs.
  useEffect(() => {
    const loadUniData = async () => {
      setCampusId(""); setProgramId("");
      setCampuses([]); setPrograms([]);
      setForm((f) => ({ ...f, campus: "", program: "", degree: "", intake: "", scholarship: "" }));
      
      if (!universityId) { setForm((f) => ({ ...f, university: "" })); return; }
      
      const uni = universities.find((u) => u.id === universityId);
      setForm((f) => ({ ...f, university: uni?.name ?? "" }));
      
      setLoadingCampuses(true); setLoadingPrograms(true);
      try {
        const [campusRows, programRows] = await Promise.all([
          listCampuses(universityId),
          listPrograms({ universityId, status: "active" })
        ]);
        
        const activeCampuses = campusRows.filter((c) => c.status === "active");
        setCampuses(activeCampuses);
        setPrograms(programRows);

        if (targetProgId) {
          const p = programRows.find(r => r.id === targetProgId);
          if (p) {
            setProgramId(targetProgId);
            if (p.campus_id && activeCampuses.some(c => c.id === p.campus_id)) {
              setCampusId(p.campus_id);
            }
            // Clear targets once applied
            setTargetUniId(null);
            setTargetProgId(null);
          }
        }
      } catch (e: any) {
        toast.error(e.message ?? "Failed to load institution data");
      } finally {
        setLoadingCampuses(false);
        setLoadingPrograms(false);
      }
    };
    
    loadUniData();
  }, [universityId, universities]); // targetProgId/targetUniId are stable enough or can be omitted if they are one-shot


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

  const totalFee = useMemo(() => {
    return (Number(form.application_fee) || 0) +
           (Number(form.registration_fee) || 0) +
           (Number(form.emgs_fee) || 0) +
           (Number(form.others_fee) || 0);
  }, [form.application_fee, form.registration_fee, form.emgs_fee, form.others_fee]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 animate-in fade-in duration-500">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col gap-6">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/applications">Applications</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Create New Application</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create New Application</h1>
              <p className="text-sm text-slate-500 mt-1">Create and manage a student admission application.</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => navigate({ to: "/applications" })} disabled={saving}>
                Cancel
              </Button>
              <Button size="sm" onClick={submit} disabled={!canSubmit}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Application
              </Button>
            </div>
          </div>

          <div className="grid gap-8">
            {/* Section 1: Student & Academic Program */}
            <Card className="rounded-[16px] border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900">Student & Academic Program</CardTitle>
                    <CardDescription className="text-xs text-slate-500">Enter student details and choose the destination university and program.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <Separator className="bg-slate-100" />
              <CardContent className="p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <ModernField label="Student" error={err("student_id")} required icon={<User className="h-4 w-4" />}>
                    <Select value={form.student_id ?? ""} onValueChange={(v) => set("student_id", v)}>
                      <SelectTrigger className="h-11 rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500/20">
                        <SelectValue placeholder="Select student" />
                      </SelectTrigger>
                      <SelectContent>
                        {students.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.student_code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ModernField>

                  <ModernField label="Country" error={err("country")} icon={<Layout className="h-4 w-4" />}>
                    <Select value={countryId} onValueChange={setCountryId} disabled={!countries.length}>
                      <SelectTrigger className="h-11 rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500/20">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {countries.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            <span className="inline-flex items-center gap-2">
                              {c.flag_url && <img src={c.flag_url} alt="" className="h-4 w-6 rounded-sm object-cover" />}
                              {c.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ModernField>

                  <ModernField label="University" error={err("university")} required icon={<GraduationCap className="h-4 w-4" />}>
                    <Select value={universityId} onValueChange={setUniversityId} disabled={!countryId || loadingUnis}>
                      <SelectTrigger className="h-11 rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500/20">
                        <SelectValue placeholder={!countryId ? "Select a country first" : "Select university"} />
                      </SelectTrigger>
                      <SelectContent>
                        {universities.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ModernField>

                  <ModernField label="Campus" error={err("campus")} icon={<Layout className="h-4 w-4" />}>
                    <Select value={campusId} onValueChange={setCampusId} disabled={!universityId || loadingCampuses}>
                      <SelectTrigger className="h-11 rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500/20">
                        <SelectValue placeholder="Select campus" />
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
                  </ModernField>

                  <ModernField label="Program" error={err("program")} required icon={<FileText className="h-4 w-4" />}>
                    <Select value={programId} onValueChange={setProgramId} disabled={!universityId || loadingPrograms}>
                      <SelectTrigger className="h-11 rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500/20">
                        <SelectValue placeholder="Select program" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredPrograms.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ModernField>

                  <ModernField label="Degree" error={err("degree")} icon={<GraduationCap className="h-4 w-4" />}>
                    <Select value={form.degree || NONE} onValueChange={(v) => set("degree", v === NONE ? "" : v)}>
                      <SelectTrigger className="h-11 rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500/20">
                        <SelectValue placeholder="Select degree" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— None —</SelectItem>
                        {["Foundation","Diploma","Bachelor","Master","MBA","PhD","Certificate"].map((d) => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ModernField>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Financial & Workflow */}
            <Card className="rounded-[16px] border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-semibold text-slate-900">Financial & Workflow</CardTitle>
                    <CardDescription className="text-xs text-slate-500">Configure financial breakdown and track the application status.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <Separator className="bg-slate-100" />
              <CardContent className="p-6 space-y-8">
                <div className="grid gap-6 md:grid-cols-2">
                  <ModernField label="Intake" error={err("intake")} icon={<FileText className="h-4 w-4" />}>
                    <Input className="h-11 rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500/20" value={form.intake ?? ""} onChange={(e) => set("intake", e.target.value)} placeholder="e.g. September 2026" />
                  </ModernField>
                  <ModernField label="Scholarship" error={err("scholarship")} icon={<DollarSign className="h-4 w-4" />}>
                    <Input className="h-11 rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500/20" value={form.scholarship ?? ""} onChange={(e) => set("scholarship", e.target.value)} placeholder="e.g. 50% Merit Scholarship" />
                  </ModernField>
                </div>

                <div className="space-y-4">
                  <Label className="text-sm font-semibold text-slate-900">Financial Breakdown</Label>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <FeeCard label="App Fee" value={form.application_fee} onChange={(v) => set("application_fee", v)} error={err("application_fee")} />
                    <FeeCard label="Registration Fee" value={form.registration_fee} onChange={(v) => set("registration_fee", v)} error={err("registration_fee")} />
                    <FeeCard label="EMGS Fee" value={form.emgs_fee} onChange={(v) => set("emgs_fee", v)} error={err("emgs_fee")} />
                    <FeeCard label="Others Fee" value={form.others_fee} onChange={(v) => set("others_fee", v)} error={err("others_fee")} />
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
                    <span className="text-sm font-medium text-slate-700">Total Estimated Fee</span>
                    <span className="text-lg font-bold text-indigo-700">
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(totalFee)}
                    </span>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <ModernField label="Application Status" icon={<Layout className="h-4 w-4" />}>
                    <Select value={form.status ?? "draft"} onValueChange={(v) => set("status", v as any)}>
                      <SelectTrigger className="h-11 rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500/20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APPLICATION_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ModernField>
                </div>
                
                <ModernField label="Internal Notes" error={err("notes")} icon={<FileText className="h-4 w-4" />}>
                  <Textarea className="min-h-[120px] rounded-lg border-slate-200 bg-slate-50/50 focus:bg-white focus:ring-indigo-500/20" value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Add any internal remarks or special requirements..." />
                </ModernField>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-slate-200 bg-white/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto max-w-7xl flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={() => navigate({ to: "/applications" })} disabled={saving} className="text-slate-600 hover:text-slate-900">
            Cancel
          </Button>
          <Button size="lg" onClick={submit} disabled={!canSubmit} className="min-w-[180px] rounded-xl shadow-lg shadow-indigo-200 transition-all hover:-translate-y-0.5 active:translate-y-0">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Application
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModernField({ label, error, required, icon, children }: { label: string; error?: string | null; required?: boolean; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2 group">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition-colors group-focus-within:text-indigo-600">
          {icon && <span className="text-slate-400 group-focus-within:text-indigo-500 transition-colors">{icon}</span>}
          {label}
          {required && <span className="text-red-500">*</span>}
        </Label>
        {error && <span className="text-[10px] font-medium text-red-500 animate-in fade-in slide-in-from-right-1">{error}</span>}
      </div>
      {children}
    </div>
  );
}

function FeeCard({ label, value, onChange, error }: { label: string; value: number | undefined | null; onChange: (v: number | null) => void; error?: string | null }) {
  return (
    <div className={cn(
      "relative rounded-xl border border-slate-200 bg-white p-3 transition-all hover:border-indigo-200 hover:shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/10",
      error && "border-red-200 bg-red-50/30"
    )}>
      <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</Label>
      <div className="mt-1 flex items-center gap-1">
        <span className="text-slate-400 font-medium">$</span>
        <input 
          type="number" 
          className="w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-300"
          value={value ?? ""} 
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder="0.00"
        />
      </div>
      {error && <div className="mt-1 text-[10px] text-red-500">{error}</div>}
    </div>
  );
}
