import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { updateFaculty, getFaculty, type Faculty, UNI_STATUSES, type UniStatus } from "@/lib/universities";
import { RoleGuard } from "@/components/layout/RoleGuard";

export const Route = createFileRoute("/_authenticated/universities/$universityId/faculties/$facultyId/edit")({
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team"]}>
      <EditFacultyPage />
    </RoleGuard>
  ),
});

function EditFacultyPage() {
  const { universityId, facultyId } = Route.useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Faculty>>({ status: "active" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getFaculty(facultyId);
        setForm(data);
      } catch (e: any) {
        toast.error("Failed to load faculty");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [facultyId]);

  async function handleSave() {
    if (!form.name?.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      await updateFaculty(facultyId, form as any);
      toast.success("Faculty updated");
      navigate({ 
        to: "/universities/$universityId", 
        params: { universityId },
        search: (old: any) => ({ ...old, _refresh: Date.now() }) 
      });
    } catch (e: any) { 
      toast.error(e.message ?? "Failed to update faculty"); 
    }
    finally { setSaving(false); }
  }

  return (
    <div className="mx-auto max-w-2xl pb-12 pt-8">
      {loading ? (
        <Card className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></Card>
      ) : (
        <>
          <Button variant="ghost" className="mb-6" onClick={() => history.back()}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button>
          <Card>
            <CardHeader><CardTitle>Edit Faculty</CardTitle></CardHeader>
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
        </>
      )}
    </div>
  );
}
