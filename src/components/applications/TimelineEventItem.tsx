import { useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Download, FileCheck2, FileUp, Info, Loader2, Trash2, X, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ApplicationTimelineEvent } from "@/lib/applications";
import {
  DOC_REQUEST_STATUS_LABELS,
  fulfillDocumentRequest,
  validateDocFile,
  ALLOWED_DOC_EXTENSIONS,
  getDocumentDownloadUrl,
  clearDocumentRequestFile,
  mapDocRequestError,
  type DocRequestStatus,
  type DocumentRequest,
} from "@/lib/document-requests";
import { DOC_REQUEST_STATUS_STYLE, DOC_REQUEST_DOT_STYLE } from "./DocumentRequestsPanel";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const MODULE_LABELS: Record<string, string> = {
  requirement_checklist: "Requirement Checklist",
  document_requests: "Document Requests",
  application_checklists: "application_checklists table",
};

function label(key: string | undefined | null): string {
  if (!key) return "";
  return MODULE_LABELS[key] ?? key.replace(/_/g, " ");
}

const DOC_STATUS_KEYS: DocRequestStatus[] = [
  "required", "pending", "under_review", "hold", "rejected", "approved", "uploaded",
];

export function getDocRequestTitle(documentName: string, status: DocRequestStatus): string {
  switch (status) {
    case "required":
      return `Document requested: ${documentName}`;
    case "pending":
    case "uploaded":
      return `Document uploaded: ${documentName}`;
    case "under_review":
      return `Document under review: ${documentName}`;
    case "approved":
      return `Document approved: ${documentName}`;
    case "rejected":
      return `Document rejected: ${documentName}`;
    case "hold":
      return `Document on hold: ${documentName}`;
    default:
      return `Document ${status}: ${documentName}`;
  }
}

export function TimelineEventItem({
  event,
  docRequestsById,
  onChanged,
  isLatest = false,
}: {
  event: ApplicationTimelineEvent;
  docRequestsById?: Record<string, DocumentRequest>;
  onChanged?: () => void | Promise<void>;
  isLatest?: boolean;
}) {
  const { hasRole } = useAuth();
  const canUpload = hasRole("admin") || hasRole("counselor");
  const canDownload = hasRole("admin") || hasRole("application_team") || hasRole("counselor");
  const [uploading, setUploading] = useState(false);

  const meta = (event.metadata ?? {}) as Record<string, unknown>;
  const removedModule = typeof meta.removed_module === "string" ? meta.removed_module : null;
  const replacement = typeof meta.replacement === "string" ? meta.replacement : null;
  const removedTable = typeof meta.removed_table === "string" ? meta.removed_table : null;

  const isModuleRemoval = event.event_type === "system" && !!removedModule;

  const requestId = typeof meta.request_id === "string" ? meta.request_id : null;
  const linkedRequest = requestId ? docRequestsById?.[requestId] ?? null : null;

  const toStatus = typeof meta.to === "string" && (DOC_STATUS_KEYS as string[]).includes(meta.to)
    ? (meta.to as DocRequestStatus)
    : null;
  const effectiveStatus: DocRequestStatus | null = linkedRequest ? linkedRequest.status : toStatus;
  const docBadgeClass = effectiveStatus ? DOC_REQUEST_STATUS_STYLE[effectiveStatus] : null;
  const docBadgeLabel = effectiveStatus ? DOC_REQUEST_STATUS_LABELS[effectiveStatus] : null;

  const displayTitle = linkedRequest
    ? getDocRequestTitle(linkedRequest.document_name, linkedRequest.status)
    : event.title;

  const displayDescription =
    (effectiveStatus === "rejected" || effectiveStatus === "hold") && linkedRequest?.review_notes
      ? linkedRequest.review_notes
      : linkedRequest?.description
        ? `${linkedRequest.description}${linkedRequest.deadline ? ` (due ${linkedRequest.deadline})` : ""}`
        : event.description;

  const isLegacyChecklist =
    !isModuleRemoval &&
    (event.event_type === "checklist" ||
      /checklist/i.test(event.title ?? "") ||
      /checklist/i.test(event.description ?? ""));

  const [progress, setProgress] = useState(0);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startUpload = async (file: File) => {
    if (!linkedRequest) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setUploading(true);
    setErrorMsg(null);
    setProgress(0);
    try {
      await fulfillDocumentRequest(linkedRequest, file, {
        signal: ctrl.signal,
        onProgress: (p) => setProgress(p),
      });
      toast.success(linkedRequest.file_path ? "File replaced" : "Uploaded");
      setDialogOpen(false);
      setPendingFile(null);
      await onChanged?.();
    } catch (e: any) {
      if (e?.name === "AbortError") setErrorMsg("Upload cancelled.");
      else setErrorMsg(mapDocRequestError(e));
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  };

  const onPick = (file: File | null) => {
    if (!file) return;
    const err = validateDocFile(file);
    if (err) { toast.error(err); return; }
    setPendingFile(file);
    setErrorMsg(null);
    setProgress(0);
    setDialogOpen(true);
    void startUpload(file);
  };

  const onCancel = () => {
    abortRef.current?.abort();
  };

  // Signed URL download (short-lived).
  const [downloading, setDownloading] = useState(false);
  const onDownload = async () => {
    if (!linkedRequest?.file_path) return;
    setDownloading(true);
    try {
      const url = await getDocumentDownloadUrl(linkedRequest.file_path, 300);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(mapDocRequestError(e));
    } finally {
      setDownloading(false);
    }
  };



  // Delete current attachment.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const onDelete = async () => {
    if (!linkedRequest) return;
    setDeleting(true);
    try {
      await clearDocumentRequestFile(linkedRequest);
      toast.success("Attachment removed");
      setConfirmDelete(false);
      await onChanged?.();
    } catch (e: any) {
      toast.error(mapDocRequestError(e));
    } finally {
      setDeleting(false);
    }
  };

  const hasFile = Boolean(linkedRequest?.file_path);

  // If no file uploaded yet and status is required/pending: allow uploading
  // If file exists and not approved: allow replacing
  const showUpload = canUpload && linkedRequest?.status !== "approved" && (
    !hasFile ? (effectiveStatus === "required" || effectiveStatus === "pending") : true
  );

  const showDownload = hasFile && canDownload;
  const showDelete = hasFile && canUpload && linkedRequest?.status !== "approved";

  const dotColor = isModuleRemoval
    ? "bg-amber-600 dark:bg-amber-400"
    : isLegacyChecklist
      ? "bg-muted-foreground/60"
      : effectiveStatus
        ? DOC_REQUEST_DOT_STYLE[effectiveStatus]
        : event.event_type === "assignment"
          ? "bg-blue-600"
          : "bg-primary";
  const dotLabel = docBadgeLabel ?? (isModuleRemoval ? "Workflow change" : event.event_type === "assignment" ? "Assignment" : event.event_type);

  return (
    <li className="group relative">
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              tabIndex={0}
              role="img"
              aria-label={`Status: ${dotLabel}${isLatest ? " (latest event)" : ""}`}
              className={cn(
                "absolute -left-[27px] top-1 h-3 w-3 cursor-help rounded-full ring-2 ring-background outline-none",
                "focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                isLatest &&
                  "motion-safe:animate-pulse group-hover:[animation-play-state:paused] focus-visible:[animation-play-state:paused] focus-visible:motion-safe:animate-[latest-focus_1.2s_ease-in-out_infinite]",
                dotColor,
              )}
            >
              {isLatest && (
                <>
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-0 rounded-full opacity-75 motion-safe:animate-ping motion-reduce:hidden",
                      "group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]",
                      dotColor,
                    )}
                  />
                  <span
                    aria-hidden
                    className={cn(
                      "absolute -inset-1 rounded-full opacity-40 blur-[2px] motion-reduce:opacity-25 motion-reduce:blur-0",
                      dotColor,
                    )}
                  />
                </>
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            {dotLabel}{isLatest ? " • Latest" : ""}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {isModuleRemoval && <AlertTriangle className="h-4 w-4 text-amber-500" />}
        <span className={isLegacyChecklist ? "text-muted-foreground line-through decoration-dotted" : ""}>
          {displayTitle}
        </span>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={cn("text-[10px] cursor-help", docBadgeClass)}>
                {docBadgeLabel ?? event.event_type}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              <div className="font-medium">{docBadgeLabel ?? event.event_type}</div>
              {displayDescription ? (
                <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {displayDescription}
                </div>
              ) : (
                <div className="mt-1 text-muted-foreground">No note recorded.</div>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        {isModuleRemoval && (
          <Badge variant="secondary" className="text-[10px]">
            Workflow change
          </Badge>
        )}
        {isLegacyChecklist && (
          <Badge variant="secondary" className="text-[10px]">
            Legacy · module removed
          </Badge>
        )}
      </div>

      {displayDescription && (
        <p className={`text-xs ${isLegacyChecklist ? "text-muted-foreground/80" : "text-muted-foreground"}`}>
          {displayDescription}
        </p>
      )}

      {(showUpload || showDownload || showDelete) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {showDownload && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onDownload} disabled={downloading}>
              {downloading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              Download{linkedRequest?.file_name ? ` · ${linkedRequest.file_name}` : ""}
            </Button>
          )}
          {showUpload && (
            <label>
              <input
                type="file"
                className="hidden"
                accept={ALLOWED_DOC_EXTENSIONS.map((x) => "." + x).join(",")}
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  e.target.value = "";
                  onPick(f);
                }}
              />
              <Button asChild size="sm" variant={linkedRequest?.file_path ? "outline" : "default"} disabled={uploading} className="h-7 text-xs">
                <span>
                  {uploading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileUp className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {linkedRequest?.file_path ? "Replace" : "Upload"}
                </span>
              </Button>
            </label>
          )}
          {showDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-red-600 hover:text-red-700"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete
            </Button>
          )}
        </div>
      )}

      {isLegacyChecklist && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          This event was created by the old <strong>Requirement Checklist</strong> module, which has been
          removed. Document tracking now happens under the{" "}
          <strong>Document Requests</strong> tab.
        </p>
      )}


      {isModuleRemoval && (
        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="flex flex-wrap items-center gap-2 text-amber-900 dark:text-amber-200">
            <span className="inline-flex items-center gap-1 rounded bg-white/70 px-2 py-0.5 font-medium dark:bg-amber-900/40">
              <Info className="h-3 w-3" />
              Removed: {label(removedModule)}
            </span>
            {replacement && (
              <>
                <ArrowRight className="h-3 w-3 opacity-60" />
                <span className="inline-flex items-center gap-1 rounded bg-white/70 px-2 py-0.5 font-medium dark:bg-amber-900/40">
                  <FileCheck2 className="h-3 w-3" />
                  Now use: {label(replacement)}
                </span>
              </>
            )}
          </div>
          {removedTable && (
            <p className="mt-2 text-[11px] text-amber-800/80 dark:text-amber-200/70">
              Backing table <code className="rounded bg-white/60 px-1 dark:bg-amber-900/40">{removedTable}</code>{" "}
              was dropped. Historical events above remain for reference.
            </p>
          )}
        </div>
      )}

      <p className="mt-1 text-[11px] text-muted-foreground">
        {new Date(event.created_at).toLocaleString()}
        {event.actor_profile ? ` · ${event.actor_profile.full_name || event.actor_profile.email}` : event.actor_email ? ` · ${event.actor_email}` : ""}
      </p>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!uploading) setDialogOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {linkedRequest?.file_path ? "Replacing file" : "Uploading file"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">
              <div className="truncate font-medium">{pendingFile?.name}</div>
              {pendingFile && (
                <div className="text-xs text-muted-foreground">
                  {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
                </div>
              )}
            </div>
            <Progress value={errorMsg ? 0 : progress} />
            <div className="text-xs text-muted-foreground">
              {errorMsg ? errorMsg : uploading ? `${progress}%` : progress === 100 ? "Finalizing…" : ""}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            {uploading ? (
              <Button variant="outline" size="sm" onClick={onCancel}>
                <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
              </Button>
            ) : errorMsg ? (
              <>
                <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>Close</Button>
                <Button size="sm" onClick={() => pendingFile && startUpload(pendingFile)}>
                  <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Retry
                </Button>
              </>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <Dialog open={confirmDelete} onOpenChange={(o) => { if (!deleting) setConfirmDelete(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove attachment?</DialogTitle>
            <DialogDescription>
              This deletes the current file{linkedRequest?.file_name ? ` (${linkedRequest.file_name})` : ""} from
              the request. The request itself is kept — you can upload again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={onDelete} disabled={deleting}>
              {deleting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </li>
  );
}
