import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  updateApplication, validateApplicationInput, allowedNextStatuses,
  APPLICATION_STATUS_LABELS,
  type Application, type ApplicationInput, type ApplicationStatus,
} from "@/lib/applications";

type FormState = {
  university: string;
  campus: string;
  program: string;
  degree: string;
  country: string;
  intake: string;
  scholarship: string;
  application_fee: string;
  status: ApplicationStatus;
  notes: string;
};

const toForm = (a: Application): FormState => ({
  university: a.university ?? "",
  campus: a.campus ?? "",
  program: a.program ?? "",
  degree: a.degree ?? "",
  country: a.country ?? "",
  intake: a.intake ?? "",
  scholarship: a.scholarship ?? "",
  application_fee: a.application_fee != null ? String(a.application_fee) : "",
  status: a.status,
  notes: a.notes ?? "",
});

export function ApplicationEditDialog({
  application,
  open,
  onOpenChange,
  onSaved,
}: {
  application: Application | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (application && open) {
      setForm(toForm(application));
      setErrors({});
    }
  }, [application, open]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const submit = async () => {
    if (!application || !form) return;
    const patch: ApplicationInput = {
      student_id: application.student_id,
      university: form.university.trim(),
      campus: form.campus.trim() || null,
      program: form.program.trim(),
      degree: form.degree.trim() || null,
      country: form.country.trim() || null,
      intake: form.intake.trim() || null,
      scholarship: form.scholarship.trim() || null,
      application_fee: form.application_fee === "" ? null : Number(form.application_fee),
      status: form.status,
      notes: form.notes.trim() || null,
    };
    const errs = validateApplicationInput(patch);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const { student_id: _ignored, ...rest } = patch;
      await updateApplication(application.id, rest);
      toast.success("Application updated");
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update application");
    } finally {
      setSaving(false);
    }
  };

  const statuses = application ? allowedNextStatuses(application.status, true) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        <DialogHeader className="border-b bg-muted/40 px-5 py-4 text-left sm:px-6">
          <DialogTitle className="text-base font-semibold sm:text-lg">Edit application</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {application?.application_code} · {application?.student?.full_name ?? "—"}
          </DialogDescription>
        </DialogHeader>

        {form && (
          <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-5 sm:grid-cols-2 sm:px-6">
            
            <div className="sm:col-span-2">
              <Label htmlFor="university">University *</Label>
              <Input id="university" value={form.university} onChange={(e) => set("university", e.target.value)} />
              {errors.university && <p className="mt-1 text-xs text-destructive">{errors.university}</p>}
            </div>
            <div>
              <Label htmlFor="campus">Campus</Label>
              <Input id="campus" value={form.campus} onChange={(e) => set("campus", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="country">Country</Label>
              <Input id="country" value={form.country} onChange={(e) => set("country", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="program">Program *</Label>
              <Input id="program" value={form.program} onChange={(e) => set("program", e.target.value)} />
              {errors.program && <p className="mt-1 text-xs text-destructive">{errors.program}</p>}
            </div>
            <div>
              <Label htmlFor="degree">Degree</Label>
              <Input id="degree" value={form.degree} onChange={(e) => set("degree", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="intake">Intake</Label>
              <Input id="intake" value={form.intake} onChange={(e) => set("intake", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="scholarship">Scholarship</Label>
              <Input id="scholarship" value={form.scholarship} onChange={(e) => set("scholarship", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="fee">Application fee</Label>
              <Input
                id="fee" type="number" min="0"
                value={form.application_fee}
                onChange={(e) => set("application_fee", e.target.value)}
              />
              {errors.application_fee && (
                <p className="mt-1 text-xs text-destructive">{errors.application_fee}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as ApplicationStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={4} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              {errors.notes && <p className="mt-1 text-xs text-destructive">{errors.notes}</p>}
            </div>
          </div>
        )}

        <DialogFooter className="border-t bg-muted/40 px-5 py-3 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
