import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { APPLICATION_STATUS_LABELS, type Application } from "@/lib/applications";

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm">{value === null || value === undefined || value === "" ? "—" : value}</div>
    </div>
  );
}

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {application && (
          <>
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {application.application_code}
                <Badge variant="secondary">{APPLICATION_STATUS_LABELS[application.status]}</Badge>
              </DialogTitle>
              <DialogDescription>Full application details</DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <section className="grid gap-4 sm:grid-cols-2">
                <Row label="Student" value={application.student?.full_name} />
                <Row label="Student code" value={application.student?.student_code} />
                <Row label="Student email" value={application.student?.email} />
                <Row label="Intake" value={application.intake} />
              </section>

              <Separator />

              <section className="grid gap-4 sm:grid-cols-2">
                <Row label="University" value={application.university} />
                <Row label="Campus" value={application.campus} />
                <Row label="Program" value={application.program} />
                <Row label="Degree" value={application.degree} />
                <Row label="Country" value={application.country} />
                <Row label="Scholarship" value={application.scholarship} />
                <Row
                  label="Application fee"
                  value={application.application_fee != null ? String(application.application_fee) : null}
                />
              </section>

              <Separator />

              <section className="grid gap-4 sm:grid-cols-2">
                <Row label="Submitted at" value={fmtDate(application.submitted_at)} />
                <Row label="Decision at" value={fmtDate(application.decision_at)} />
                <Row label="Created at" value={fmtDate(application.created_at)} />
                <Row label="Updated at" value={fmtDate(application.updated_at)} />
              </section>

              <Separator />

              <Row
                label="Notes"
                value={
                  application.notes ? (
                    <p className="whitespace-pre-wrap text-sm">{application.notes}</p>
                  ) : null
                }
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
