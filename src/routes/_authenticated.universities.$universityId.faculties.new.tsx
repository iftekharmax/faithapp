import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createFaculty, type Faculty, UNI_STATUSES, type UniStatus } from "@/lib/universities";
import { RoleGuard } from "@/components/layout/RoleGuard";

export const Route = createFileRoute("/_authenticated/universities/$universityId/faculties/new")({
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team"]}>
      <NewFacultyPage />
    </RoleGuard>
  ),
});

function NewFacultyPage() {
  const { universityId } = Route.useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Faculty>>({ status: "active" });

  async function handleSave() {
    if (!form.name?.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      await createFaculty({ ...form, university_id: universityId } as any);
      toast.success("Faculty created");
      navigate({ to: "/universities/$universityId", params: { universityId } });
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-2xl pb-12 pt-8">
      <Button variant="ghost" className="mb-6" onClick={() => history.back()}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
      <Card>
        <CardHeader><CardTitle>Add New Faculty</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div><Label>Name *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Status</Label>
            <Select value={form.status ?? "active"} onValueChange={(v) => setForm({ ...form, status: v as UniStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNI_STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleSave} disabled={saving} className="mt-4">{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save</Button>
        </CardContent>
      </Card>
    </div>
  );
}
