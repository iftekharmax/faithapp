import { HelpCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DOC_REQUEST_STATUS_STYLE,
  DOC_REQUEST_DOT_STYLE,
} from "./DocumentRequestsPanel";
import {
  DOC_REQUEST_STATUS_LABELS,
  type DocRequestStatus,
} from "@/lib/document-requests";

const LEGEND_STATUSES: DocRequestStatus[] = [
  "required",
  "pending",
  "under_review",
  "hold",
  "rejected",
  "approved",
];

const DESCRIPTIONS: Record<DocRequestStatus, string> = {
  required: "Document requested — waiting for the counselor to upload.",
  pending: "File uploaded — awaiting review by the application team.",
  under_review: "Application team is actively reviewing the file.",
  hold: "Progress paused — reason recorded on the request.",
  rejected: "File rejected — a replacement upload is required.",
  approved: "File accepted — no further action needed.",
  uploaded: "File uploaded — awaiting review.",
};

export function StatusLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 text-xs"
          aria-label="Show status legend"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          Legend
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="mb-2 text-xs font-semibold text-foreground">
          Timeline status colors
        </div>
        <ul className="space-y-2">
          {LEGEND_STATUSES.map((s) => (
            <li key={s} className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-background",
                  DOC_REQUEST_DOT_STYLE[s],
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", DOC_REQUEST_STATUS_STYLE[s])}
                  >
                    {DOC_REQUEST_STATUS_LABELS[s]}
                  </Badge>
                </div>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {DESCRIPTIONS[s]}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-start gap-2.5 border-t pt-2">
          <span className="relative mt-1 h-3 w-3 shrink-0" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-primary ring-2 ring-background" />
            <span className="absolute inset-0 rounded-full bg-primary opacity-75 motion-safe:animate-ping motion-reduce:hidden" />
          </span>
          <p className="text-[11px] leading-snug text-muted-foreground">
            <span className="font-medium text-foreground">Latest</span> — the pulsing dot marks the most recent event.
          </p>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          The dot on each event mirrors its badge color for quick scanning.
        </p>
      </PopoverContent>
    </Popover>
  );
}
