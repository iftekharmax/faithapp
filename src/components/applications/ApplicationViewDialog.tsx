import type { ReactNode } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, User2, CalendarClock, StickyNote } from "lucide-react";
import { APPLICATION_STATUS_LABELS, type Application } from "@/lib/applications";

function Field({ label, value }: { label: string; value?: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="min-w-0 rounded-lg border bg-card px-3 py-2">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 break-words text-sm ${empty ? "text-muted-foreground" : "font-medium"}`}>
        {empty ? "—" : value}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h3>
      {children}
    </section>
  );
}

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;

export function ApplicationViewDialog({
  application,
  open,
  onOpenChange,
}: {
  application: Application | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-2xl">
        {application && (
          <>
            <DialogHeader className="border-b bg-muted/40 px-5 py-4 text-left sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-base font-semibold sm:text-lg">
                  {application.application_code}
                </DialogTitle>
                <Badge variant="secondary" className="rounded-full">
                  {APPLICATION_STATUS_LABELS[application.status]}
                </Badge>
              </div>
              <DialogDescription className="text-xs sm:text-sm">
                {application.student?.full_name ?? "—"} · {application.university}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              <Section icon={User2} title="Student">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Name" value={application.student?.full_name} />
                  <Field label="Student code" value={application.student?.student_code} />
                  <Field label="Email" value={application.student?.email} />
                  <Field label="Intake" value={application.intake} />
                </div>
              </Section>

              <Section icon={GraduationCap} title="Course">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="University" value={application.university} />
                  <Field label="Campus" value={application.campus} />
                  <Field label="Program" value={application.program} />
                  <Field label="Degree" value={application.degree} />
                  <Field label="Country" value={application.country} />
                  <Field label="Scholarship" value={application.scholarship} />
                  <Field
                    label="Application fee"
                    value={application.application_fee != null ? String(application.application_fee) : null}
                  />
                </div>
              </Section>

              <Section icon={CalendarClock} title="Timeline">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field label="Submitted" value={fmtDate(application.submitted_at)} />
                  <Field label="Decision" value={fmtDate(application.decision_at)} />
                  <Field label="Created" value={fmtDate(application.created_at)} />
                  <Field label="Last updated" value={fmtDate(application.updated_at)} />
                </div>
              </Section>

              <Section icon={StickyNote} title="Notes">
                <div className="rounded-lg border bg-card px-3 py-2 text-sm">
                  {application.notes
                    ? <p className="whitespace-pre-wrap">{application.notes}</p>
                    : <span className="text-muted-foreground">No notes added.</span>}
                </div>
              </Section>
            </div>

            <DialogFooter className="border-t bg-muted/40 px-5 py-3 sm:px-6">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
