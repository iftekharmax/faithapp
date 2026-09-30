import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, Loader2, Building2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { updateCampus, getCampus, type Campus, UNI_STATUSES, type UniStatus } from "@/lib/universities";
import { RoleGuard } from "@/components/layout/RoleGuard";

export const Route = createFileRoute("/_authenticated/universities/$universityId/campuses/$campusId/edit")({
  component: () => (
    <RoleGuard roles={["admin", "counselor", "application_team"]}>
      <EditCampusPage />
    </RoleGuard>
  ),
});

function EditCampusPage() {
  const { universityId, campusId } = Route.useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Campus>>({ status: "active", is_main: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getCampus(campusId);
        setForm(data);
      } catch (e: any) {
        toast.error("Failed to load campus");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [campusId]);

  async function handleSave() {
    if (!form.name?.trim()) { toast.error("Name required"); return; }
    setSaving(true);
    try {
      await updateCampus(campusId, form as any);
      toast.success("Campus updated");
      navigate({ 
        to: "/universities/$universityId", 
        params: { universityId },
        search: (old: any) => ({ ...old, _refresh: Date.now() }) 
      });
    } catch (e: any) { 
      toast.error(e.message ?? "Failed to update campus"); 
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
            <CardHeader><CardTitle>Edit Campus</CardTitle></CardHeader>
            <CardContent className="grid gap-4">
              <div><Label>Name *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>City</Label><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
              <div><Label>Address</Label><Textarea rows={2} value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="flex items-center gap-2"><Switch checked={form.is_main ?? false} onCheckedChange={(v) => setForm({ ...form, is_main: v })} /><Label>Main campus</Label></div>
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
