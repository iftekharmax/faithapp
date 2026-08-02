import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Save, Loader2, GraduationCap, Calendar, DollarSign, Award, BookOpen, Clock, Building, School } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getUniversity, listCampuses, listFaculties, createProgram,
  type University, type Campus, type Faculty, type UniversityProgram, UNI_STATUSES, type UniStatus,
  DuplicateError,
} from "@/lib/universities";
import { RoleGuard } from "@/components/layout/RoleGuard";

export const Route = createFileRoute("/_authenticated/universities/$universityId/programs/new")({
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team"]}>
      <NewProgramPage />
    </RoleGuard>
  ),
});

function NewProgramPage() {
  const { universityId } = Route.useParams();
  const navigate = useNavigate();
  const [uni, setUni] = useState<University | null>(null);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState<Partial<UniversityProgram>>({ 
    status: "active", 
    currency: "USD",
    university_id: universityId 
  });

  useEffect(() => {
    async function load() {
      try {
        const [u, c, f] = await Promise.all([
          getUniversity(universityId),
          listCampuses(universityId),
          listFaculties(universityId),
        ]);
        setUni(u);
        setCampuses(c);
        setFaculties(f);
      } catch (e: any) {
        toast.error(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [universityId]);

  async function handleSave() {
    if (!form.name?.trim()) {
      toast.error("Program name is required");
      return;
    }
    
    setSaving(true);
    try {
      const payload: any = { ...form, university_id: universityId };
      // Convert numeric fields
      ['tuition_fee', 'application_fee', 'registration_fee', 'emgs_fee', 'others_fee'].forEach(field => {
        if (payload[field] === "" || payload[field] == null) {
          payload[field] = null;
        } else {
          payload[field] = Number(payload[field]);
        }
      });

      await createProgram(payload);
      toast.success("Program created successfully");
      navigate({ to: "/universities/$universityId", params: { universityId } });
    } catch (e: any) {
      if (e instanceof DuplicateError) {
        toast.error("A program with this name already exists for the selected campus.");
      } else {
        toast.error(e.message);
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-24">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/universities/$universityId" params={{ universityId }}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Add New Program</h1>
            <p className="text-muted-foreground mt-1 flex items-center gap-2">
              <School className="h-4 w-4" /> {uni?.name}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* General Information */}
          <Card className="overflow-hidden border-none shadow-md ring-1 ring-border">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BookOpen className="h-5 w-5 text-primary" />
                General Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-6 grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">Program Name *</Label>
                <Input 
                  id="name"
                  className="h-12 text-lg rounded-xl border-muted-foreground/20 focus-visible:ring-primary shadow-sm"
                  placeholder="e.g. Bachelor of Computer Science"
                  value={form.name ?? ""} 
                  onChange={(e) => setForm({ ...form, name: e.target.value })} 
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">Degree Level</Label>
                  <Input 
                    className="h-11 rounded-xl border-muted-foreground/20 shadow-sm"
                    placeholder="e.g. Bachelor, Master" 
                    value={form.degree ?? ""} 
                    onChange={(e) => setForm({ ...form, degree: e.target.value })} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">Duration</Label>
                  <div className="relative">
                    <Input 
                      className="h-11 rounded-xl border-muted-foreground/20 pl-10 shadow-sm"
                      placeholder="e.g. 3 Years" 
                      value={form.duration ?? ""} 
                      onChange={(e) => setForm({ ...form, duration: e.target.value })} 
                    />
                    <Clock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">Campus</Label>
                  <Select value={form.campus_id ?? "none"} onValueChange={(v) => setForm({ ...form, campus_id: v === "none" ? null : v })}>
                    <SelectTrigger className="h-11 rounded-xl border-muted-foreground/20 shadow-sm">
                      <SelectValue placeholder="Select campus" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {campuses.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">Faculty</Label>
                  <Select value={form.faculty_id ?? "none"} onValueChange={(v) => setForm({ ...form, faculty_id: v === "none" ? null : v })}>
                    <SelectTrigger className="h-11 rounded-xl border-muted-foreground/20 shadow-sm">
                      <SelectValue placeholder="Select faculty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {faculties.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Intake & Requirements */}
          <Card className="overflow-hidden border-none shadow-md ring-1 ring-border">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                Admission & Requirements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-6 grid gap-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">Intake(s)</Label>
                  <Input 
                    className="h-11 rounded-xl border-muted-foreground/20 shadow-sm"
                    placeholder="e.g. Jan, Sep" 
                    value={form.intake ?? ""} 
                    onChange={(e) => setForm({ ...form, intake: e.target.value })} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">Application Deadline</Label>
                  <Input 
                    type="date" 
                    className="h-11 rounded-xl border-muted-foreground/20 shadow-sm"
                    value={form.application_deadline ?? ""} 
                    onChange={(e) => setForm({ ...form, application_deadline: e.target.value })} 
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground/80">Entry Requirements</Label>
                <Textarea 
                  className="min-h-[120px] rounded-xl border-muted-foreground/20 focus-visible:ring-primary shadow-sm"
                  placeholder="Describe academic and English proficiency requirements..."
                  value={form.requirements ?? ""} 
                  onChange={(e) => setForm({ ...form, requirements: e.target.value })} 
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          {/* Fees & Financials */}
          <Card className="overflow-hidden border-none shadow-md ring-1 ring-border">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-primary" />
                Financial Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-6 space-y-5">
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tuition Fee</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    className="h-11 rounded-xl border-muted-foreground/20 pl-10 shadow-sm"
                    value={form.tuition_fee ?? ""} 
                    onChange={(e) => setForm({ ...form, tuition_fee: e.target.value as any })} 
                  />
                  <DollarSign className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Currency</Label>
                <Input 
                  className="h-11 rounded-xl border-muted-foreground/20 shadow-sm"
                  value={form.currency ?? "USD"} 
                  onChange={(e) => setForm({ ...form, currency: e.target.value })} 
                />
              </div>

              <div className="h-px bg-border my-2" />

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">App Fee</Label>
                  <Input 
                    type="number" 
                    className="h-10 rounded-lg border-muted-foreground/20 shadow-sm"
                    value={form.application_fee ?? ""} 
                    onChange={(e) => setForm({ ...form, application_fee: e.target.value as any })} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reg Fee</Label>
                  <Input 
                    type="number" 
                    className="h-10 rounded-lg border-muted-foreground/20 shadow-sm"
                    value={form.registration_fee ?? ""} 
                    onChange={(e) => setForm({ ...form, registration_fee: e.target.value as any })} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">EMGS Fee</Label>
                  <Input 
                    type="number" 
                    className="h-10 rounded-lg border-muted-foreground/20 shadow-sm"
                    value={form.emgs_fee ?? ""} 
                    onChange={(e) => setForm({ ...form, emgs_fee: e.target.value as any })} 
                  />
                </div>
                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Other Fees</Label>
                  <Input 
                    type="number" 
                    className="h-10 rounded-lg border-muted-foreground/20 shadow-sm"
                    value={form.others_fee ?? ""} 
                    onChange={(e) => setForm({ ...form, others_fee: e.target.value as any })} 
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status & Scholarship */}
          <Card className="overflow-hidden border-none shadow-md ring-1 ring-border">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Award className="h-5 w-5 text-primary" />
                Other Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 pt-6 space-y-6">
              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scholarship</Label>
                <Input 
                  className="h-11 rounded-xl border-muted-foreground/20 shadow-sm"
                  placeholder="Available scholarship details"
                  value={form.scholarship ?? ""} 
                  onChange={(e) => setForm({ ...form, scholarship: e.target.value })} 
                />
              </div>

              <div className="grid gap-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
                <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v as UniStatus })}>
                  <SelectTrigger className="h-11 rounded-xl border-muted-foreground/20 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNI_STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="overflow-hidden border-none shadow-md ring-1 ring-border">
          <CardHeader className="bg-muted/30 pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5 text-primary" />
              Description
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-6">
            <Textarea 
              className="min-h-[150px] rounded-xl border-muted-foreground/20 focus-visible:ring-primary shadow-sm"
              placeholder="Provide a detailed overview of the program..."
              value={form.description ?? ""} 
              onChange={(e) => setForm({ ...form, description: e.target.value })} 
            />
          </CardContent>
        </Card>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 p-4 backdrop-blur-md shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-end gap-3">
          <Button 
            variant="ghost" 
            className="rounded-xl px-6 font-semibold text-muted-foreground hover:bg-muted"
            asChild
          >
            <Link to="/universities/$universityId" params={{ universityId }}>Cancel</Link>
          </Button>
          <Button 
            className="min-w-[160px] h-12 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Save className="mr-2 h-5 w-5" />
                Create Program
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
