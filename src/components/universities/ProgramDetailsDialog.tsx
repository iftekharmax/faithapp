import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { type UniversityProgram } from "@/lib/universities";
import { GraduationCap, MapPin, Clock, Calendar, DollarSign, Award, BookOpen, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import DOMPurify from "dompurify";

interface ProgramDetailsDialogProps {
  program: UniversityProgram | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProgramDetailsDialog({ program, open, onOpenChange }: ProgramDetailsDialogProps) {
  if (!program) return null;

  const sanitizeHtml = (html: string | null) => {
    if (!html) return null;
    return DOMPurify.sanitize(html);
  };

  const fees = [
    { label: "Application Fee", value: program.application_fee },
    { label: "Registration Fee", value: program.registration_fee },
    { label: "EMGS Fee", value: program.emgs_fee },
    { label: "Others Fee", value: program.others_fee },
  ].filter(f => f.value != null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden border-none bg-background sm:rounded-3xl shadow-2xl">
        <div className="relative overflow-hidden bg-primary px-6 py-8 text-primary-foreground">
          <div className="absolute right-0 top-0 -mr-8 -mt-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <Badge className="mb-3 bg-white/20 text-white hover:bg-white/30 backdrop-blur-md border-none">
              {program.degree || "Program"}
            </Badge>
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-bold tracking-tight text-white sm:text-4xl">
                {program.name}
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/80 text-lg">
                Full details and requirements for this program
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-8 scrollbar-thin scrollbar-thumb-muted-foreground/20">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <InfoItem icon={Clock} label="Duration" value={program.duration || "N/A"} />
            <InfoItem icon={MapPin} label="Campus" value={program.campus?.name || "N/A"} />
            <InfoItem icon={Calendar} label="Next Intake" value={program.intake || "N/A"} />
            <InfoItem icon={CheckCircle2} label="Deadline" value={program.application_deadline || "No deadline"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {program.description && (
                <section>
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                    <Info className="h-5 w-5 text-primary" />
                    Description
                  </h3>
                  <div 
                    className="prose prose-sm max-w-none text-muted-foreground"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(program.description) || "" }}
                  />
                </section>
              )}

              {program.requirements && (
                <section>
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Entry Requirements
                  </h3>
                  <div 
                    className="prose prose-sm max-w-none text-muted-foreground bg-muted/30 p-4 rounded-2xl"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(program.requirements) || "" }}
                  />
                </section>
              )}

              {program.scholarship && (
                <section>
                  <h3 className="text-lg font-bold flex items-center gap-2 mb-3">
                    <Award className="h-5 w-5 text-primary" />
                    Scholarship Information
                  </h3>
                  <div 
                    className="prose prose-sm max-w-none text-muted-foreground border border-primary/20 bg-primary/5 p-4 rounded-2xl"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(program.scholarship) || "" }}
                  />
                </section>
              )}
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border bg-card p-6 shadow-sm">
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Fees Structure
                </h3>
                
                <div className="space-y-4">
                  {program.tuition_fee != null && (
                    <div className="pb-4 border-bottom">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Tuition Fee</p>
                      <p className="text-2xl font-bold text-primary">
                        {program.currency} {program.tuition_fee.toLocaleString()}
                      </p>
                    </div>
                  )}

                  {fees.length > 0 && (
                    <div className="space-y-3 pt-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Other Fees</p>
                      {fees.map((f, i) => (
                        <div key={i} className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">{f.label}</span>
                          <span className="font-semibold">{program.currency} {Number(f.value).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(program as any).additional_others_fee && (
                    <div className="space-y-2 pt-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Additional Others Fee</p>
                      <div
                        className="prose prose-sm max-w-none text-muted-foreground"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml((program as any).additional_others_fee) || "" }}
                      />
                    </div>
                  )}
                </div>

              </div>

              <div className="rounded-3xl bg-muted/30 p-6">
                <h4 className="font-bold text-sm mb-2">Need help?</h4>
                <p className="text-xs text-muted-foreground">
                  Contact our admissions team for more information about this program and scholarship eligibility.
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="flex flex-col gap-1 p-4 rounded-2xl bg-muted/40 border border-muted-foreground/10">
      <div className="flex items-center gap-2 text-primary/70">
        <Icon className="h-4 w-4" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <span className="font-bold text-sm truncate">{value}</span>
    </div>
  );
}
