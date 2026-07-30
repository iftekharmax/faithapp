import type { ReactNode } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  GraduationCap, User2, CalendarClock, StickyNote, Mail, Hash, MapPin,
  Building2, Award, BadgeDollarSign, CalendarDays,
} from "lucide-react";
import { APPLICATION_STATUS_LABELS, type Application } from "@/lib/applications";

function Field({ icon: Icon, label, value }: { icon?: any; label: string; value?: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="min-w-0 rounded-xl border bg-card/60 p-3 transition-colors hover:bg-accent/40">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className={`mt-1 break-words text-sm ${empty ? "text-muted-foreground" : "font-medium text-foreground"}`}>
        {empty ? "—" : value}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <Separator className="flex-1" />
      </div>
      {children}
    </section>
  );
}

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : null;

const initials = (name?: string | null) =>
  (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";

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
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl">
        {application && (
          <>
            <DialogHeader className="space-y-0 border-b bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-5 text-left sm:px-6">
              <div className="flex items-start gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-sm font-bold text-primary">
                  {initials(application.student?.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <DialogTitle className="text-base font-semibold sm:text-lg">
                      {application.application_code}
                    </DialogTitle>
                    <Badge variant="secondary" className="rounded-full">
                      {APPLICATION_STATUS_LABELS[application.status]}
                    </Badge>
                  </div>
                  <DialogDescription className="mt-1 truncate text-xs sm:text-sm">
                    {application.student?.full_name ?? "—"} · {application.university}
                  </DialogDescription>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {application.country && (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-background/70 px-2.5 py-1 text-[11px] font-medium">
                        <MapPin className="h-3 w-3" /> {application.country}
                      </span>
                    )}
                    {application.intake && (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-background/70 px-2.5 py-1 text-[11px] font-medium">
                        <CalendarDays className="h-3 w-3" /> {application.intake}
                      </span>
                    )}
                    {application.degree && (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-background/70 px-2.5 py-1 text-[11px] font-medium">
                        <GraduationCap className="h-3 w-3" /> {application.degree}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              <Section icon={User2} title="Student">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field icon={User2} label="Name" value={application.student?.full_name} />
                  <Field icon={Hash} label="Student code" value={application.student?.student_code} />
                  <Field icon={Mail} label="Email" value={application.student?.email} />
                  <Field icon={CalendarDays} label="Intake" value={application.intake} />
                </div>
              </Section>

              <Section icon={GraduationCap} title="Course">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Field icon={Building2} label="University" value={application.university} />
                  <Field icon={MapPin} label="Campus" value={application.campus} />
                  <Field icon={GraduationCap} label="Program" value={application.program} />
                  <Field icon={Award} label="Degree" value={application.degree} />
                  <Field icon={MapPin} label="Country" value={application.country} />
                  <Field icon={Award} label="Scholarship" value={application.scholarship} />
                  <Field
                    icon={BadgeDollarSign}
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
                <div className="rounded-xl border bg-card/60 p-3 text-sm">
                  {application.notes
                    ? <p className="whitespace-pre-wrap leading-relaxed">{application.notes}</p>
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
