import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Download, FileUp, Loader2, PauseCircle, Plus, Search, Trash2, XCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  createDocumentRequest, deleteDocumentRequest, fulfillDocumentRequest,
  listDocumentRequests, setDocumentRequestStatus,
  DOC_REQUEST_STATUS_LABELS, DOC_REQUEST_STATUS_OPTIONS,
  DOC_REQUEST_ALLOWED_NEXT, isDocRequestTransitionAllowed,
  type DocRequestStatus, type DocumentRequest,
} from "@/lib/document-requests";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

// Badge styles — tuned for WCAG AA on both light and dark themes.
export const DOC_REQUEST_STATUS_STYLE: Record<DocRequestStatus, string> = {
  required: "bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-600/40",
  pending: "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-600/40",
  under_review: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-600/40",
  hold: "bg-slate-500/15 text-slate-800 dark:text-slate-200 border-slate-500/40",
  rejected: "bg-red-500/15 text-red-800 dark:text-red-300 border-red-600/40",
  approved: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-600/40",
  uploaded: "bg-blue-500/15 text-blue-800 dark:text-blue-300 border-blue-600/40",
};

// Solid dot colors — deeper shades meet 3:1 non-text contrast against light and dark backgrounds.
export const DOC_REQUEST_DOT_STYLE: Record<DocRequestStatus, string> = {
  required: "bg-purple-600 dark:bg-purple-400",
  pending: "bg-amber-600 dark:bg-amber-400",
  under_review: "bg-blue-600 dark:bg-blue-400",
  hold: "bg-slate-600 dark:bg-slate-300",
  rejected: "bg-red-600 dark:bg-red-400",
  approved: "bg-emerald-600 dark:bg-emerald-400",
  uploaded: "bg-blue-600 dark:bg-blue-400",
};

const STATUS_STYLE = DOC_REQUEST_STATUS_STYLE;

const STATUS_ICON: Record<DocRequestStatus, React.ReactNode> = {
  required: <AlertCircle className="h-3.5 w-3.5" />,
  pending: <Clock className="h-3.5 w-3.5" />,
  under_review: <Search className="h-3.5 w-3.5" />,
  hold: <PauseCircle className="h-3.5 w-3.5" />,
  rejected: <XCircle className="h-3.5 w-3.5" />,
  approved: <CheckCircle2 className="h-3.5 w-3.5" />,
  uploaded: <FileUp className="h-3.5 w-3.5" />,
};

export function DocumentRequestsPanel({
  applicationId, onFulfilled,
}: { applicationId: string; onFulfilled?: () => void }) {
  const { hasRole } = useAuth();
  const canRequest = hasRole("admin") || hasRole("application_team");
  const canReview = hasRole("admin") || hasRole("application_team");
  const canUpload = hasRole("admin") || hasRole("counselor");

  const [items, setItems] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [reasonState, setReasonState] = useState<
    { id: string; next: DocRequestStatus; current: DocRequestStatus } | null
  >(null);
  const [reasonText, setReasonText] = useState("");
  const [reasonSaving, setReasonSaving] = useState(false);

  const load = async () => {
    try { setItems(await listDocumentRequests(applicationId)); }
    catch (e: any) { toast.error(e.message); }
  };

  useEffect(() => {
    (async () => { setLoading(true); await load(); setLoading(false); })();
    const ch = supabase.channel(`docreq-${applicationId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "application_document_requests", filter: `application_id=eq.${applicationId}` },
        async () => {
          await load();
          await onFulfilled?.();
        })
      .on("broadcast", { event: "docreq_changed" }, async () => {
        await load();
        await onFulfilled?.();
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  const onFile = async (req: DocumentRequest, file: File | null) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Max 20MB"); return; }
    setUploadingId(req.id);
    try {
      await fulfillDocumentRequest(req, file);
      toast.success("Uploaded");
      await load();
      await onFulfilled?.();
      void supabase.channel(`docreq-${applicationId}`).send({
        type: "broadcast",
        event: "docreq_changed",
        payload: { id: req.id, status: "pending" },
      });
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setUploadingId(null); }
  };

  const applyStatus = async (id: string, next: DocRequestStatus, notes?: string) => {
    // Optimistic local update for instant UI feedback
    setItems((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: next,
              review_notes: notes !== undefined ? notes : next === "approved" ? null : r.review_notes,
            }
          : r
      )
    );
    try {
      await setDocumentRequestStatus(id, next, notes);
      toast.success(`Status: ${DOC_REQUEST_STATUS_LABELS[next]}`);
      await load();
      await onFulfilled?.();
      void supabase.channel(`docreq-${applicationId}`).send({
        type: "broadcast",
        event: "docreq_changed",
        payload: { id, next },
      });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update status");
      await load();
      await onFulfilled?.();
    }
  };

  const changeStatus = async (id: string, next: DocRequestStatus, current: DocRequestStatus) => {
    if (next === current) return;
    // Preflight: block invalid transitions before hitting the DB.
    if (!isDocRequestTransitionAllowed(current, next)) {
      const allowed = DOC_REQUEST_ALLOWED_NEXT[current]
        .filter((s) => s !== current)
        .map((s) => DOC_REQUEST_STATUS_LABELS[s])
        .join(", ") || "none";
      toast.error(
        `Cannot move from "${DOC_REQUEST_STATUS_LABELS[current]}" to "${DOC_REQUEST_STATUS_LABELS[next]}". Allowed next: ${allowed}.`,
      );
      return;
    }
    // Hold / Reject → require a note via dialog.
    if (next === "rejected" || next === "hold") {
      setReasonText("");
      setReasonState({ id, next, current });
      return;
    }
    await applyStatus(id, next);
  };

  const submitReason = async () => {
    if (!reasonState) return;
    const trimmed = reasonText.trim();
    if (!trimmed) {
      toast.error(
        `A reason is required to move this request to ${DOC_REQUEST_STATUS_LABELS[reasonState.next]}.`,
      );
      return;
    }
    setReasonSaving(true);
    await applyStatus(reasonState.id, reasonState.next, trimmed);
    setReasonSaving(false);
    setReasonState(null);
    setReasonText("");
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this request?")) return;
    try {
      await deleteDocumentRequest(id);
      toast.success("Deleted");
      await load();
      await onFulfilled?.();
      void supabase.channel(`docreq-${applicationId}`).send({
        type: "broadcast",
        event: "docreq_changed",
        payload: { id },
      });
    } catch (e: any) { toast.error(e.message); }
  };

  const counts = items.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; },
    {} as Record<DocRequestStatus, number>);
  const total = items.length;
  const done = (counts.approved ?? 0);
  const pct = total ? Math.round((done / total) * 100) : 0;

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Document requests</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {total} total · {counts.pending ?? 0} pending · {counts.uploaded ?? 0} in review · {counts.approved ?? 0} approved · {counts.rejected ?? 0} rejected · {pct}% complete
            </p>
          </div>
          {canRequest && (
            <NewRequestDialog
              open={open}
              onOpenChange={setOpen}
              applicationId={applicationId}
              onCreated={async () => {
                await load();
                await onFulfilled?.();
                void supabase.channel(`docreq-${applicationId}`).send({
                  type: "broadcast",
                  event: "docreq_changed",
                  payload: {},
                });
              }}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileUp className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No document requests yet</p>
                <p className="mx-auto max-w-md text-xs text-muted-foreground">
                  This is where the application team asks the counselor for specific documents
                  (passport, transcripts, English test, etc.) and the counselor uploads them for review.
                </p>
              </div>
              <div className="mt-1 grid w-full max-w-md gap-2 text-left text-xs text-muted-foreground sm:grid-cols-2">
                {canRequest && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="mb-1 font-medium text-foreground">App team / Admin</p>
                    Click <span className="font-medium">Request document</span> to add a required document,
                    optional deadline and notes.
                  </div>
                )}
                {canUpload && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <p className="mb-1 font-medium text-foreground">Counselor</p>
                    Once a request appears here, use <span className="font-medium">Upload</span> to attach the
                    file. Status will move to <em>In review</em> automatically.
                  </div>
                )}
                {!canRequest && !canUpload && (
                  <div className="rounded-md border bg-muted/30 p-3 sm:col-span-2">
                    You'll see any document the application team requests from your counselor here.
                  </div>
                )}
              </div>
              {canRequest && (
                <Button size="sm" className="mt-2" onClick={() => setOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Request document
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((r) => {
                const overdue = r.deadline && r.status !== "approved" && new Date(r.deadline) < new Date();
                return (
                  <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{r.document_name}</span>
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="outline" className={cn("gap-1 cursor-help", STATUS_STYLE[r.status])}>
                                {STATUS_ICON[r.status]} {DOC_REQUEST_STATUS_LABELS[r.status]}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              <div className="font-medium">
                                Status: {DOC_REQUEST_STATUS_LABELS[r.status]}
                              </div>
                              {r.review_notes ? (
                                <div className="mt-1 whitespace-pre-wrap text-muted-foreground">
                                  Note: {r.review_notes}
                                </div>
                              ) : (
                                <div className="mt-1 text-muted-foreground">No review note.</div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {r.is_mandatory && <Badge variant="secondary" className="text-[10px]">Required</Badge>}
                        {overdue && (
                          <Badge variant="destructive" className="gap-1 text-[10px]">
                            <AlertCircle className="h-3 w-3" /> Overdue
                          </Badge>
                        )}
                      </div>
                      {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {r.deadline && <span>Due {new Date(r.deadline).toLocaleDateString()}</span>}
                        <span>Requested {new Date(r.created_at).toLocaleDateString()}
                          {r.requested_by_email ? ` by ${r.requested_by_email}` : ""}</span>
                        {r.fulfilled_at && <span>Uploaded {new Date(r.fulfilled_at).toLocaleDateString()}</span>}
                        {r.file_name && (
                          <span className="font-medium text-foreground">
                            {r.file_name}{r.file_size ? ` · ${(r.file_size / 1024).toFixed(1)} KB` : ""}
                          </span>
                        )}
                      </div>
                      {r.review_notes && (
                        <p className="rounded bg-muted p-2 text-xs">
                          <strong>Review:</strong> {r.review_notes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {r.file_url && (
                        <Button asChild size="sm" variant="outline">
                          <a href={r.file_url} target="_blank" rel="noreferrer">
                            <Download className="mr-2 h-4 w-4" /> Download
                          </a>
                        </Button>
                      )}
                      {canUpload && r.status !== "approved" && (
                        <label>
                          <input type="file" className="hidden"
                            disabled={uploadingId === r.id}
                            onChange={(e) => { const f = e.target.files?.[0] ?? null; e.target.value = ""; onFile(r, f); }} />
                          <Button asChild size="sm" variant={r.file_path ? "outline" : "default"} disabled={uploadingId === r.id}>
                            <span>
                              {uploadingId === r.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileUp className="mr-2 h-4 w-4" />}
                              {r.file_path ? "Replace" : "Upload"}
                            </span>
                          </Button>
                        </label>
                      )}
                      {canReview && (
                        <Select value={r.status} onValueChange={(v) => changeStatus(r.id, v as DocRequestStatus, r.status)}>
                          <SelectTrigger className={cn("h-9 w-[150px]", STATUS_STYLE[r.status])}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DOC_REQUEST_STATUS_OPTIONS.map((s) => (
                              <SelectItem key={s} value={s}>
                                <span className="flex items-center gap-2">
                                  {STATUS_ICON[s]} {DOC_REQUEST_STATUS_LABELS[s]}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {canRequest && (
                        <Button size="icon" variant="ghost" onClick={() => remove(r.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reasonState} onOpenChange={(v) => { if (!v && !reasonSaving) { setReasonState(null); setReasonText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonState?.next === "rejected" ? "Reason for rejection" : "Reason for hold"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">
              This note will appear in the Activity history and on the status badge tooltip.
            </Label>
            <Textarea
              id="reason"
              rows={4}
              autoFocus
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder={
                reasonState?.next === "rejected"
                  ? "Explain what needs to be fixed or why this document is being rejected…"
                  : "Explain why this document is on hold and what the counselor should do…"
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setReasonState(null); setReasonText(""); }} disabled={reasonSaving}>
              Cancel
            </Button>
            <Button onClick={submitReason} disabled={reasonSaving || !reasonText.trim()}>
              {reasonSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & update status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NewRequestDialog({
  open, onOpenChange, applicationId, onCreated,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  applicationId: string; onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [deadline, setDeadline] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Document name required"); return; }
    setSaving(true);
    try {
      await createDocumentRequest({
        application_id: applicationId,
        document_name: name.trim(),
        description: desc.trim() || undefined,
        deadline: deadline || null,
        is_mandatory: mandatory,
      });
      toast.success("Request sent to counselor");
      setName(""); setDesc(""); setDeadline(""); setMandatory(true);
      onOpenChange(false);
      onCreated();
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-2 h-4 w-4" /> Request document</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a document</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Document name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Passport bio page" />
          </div>
          <div>
            <Label>Instructions</Label>
            <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="What exactly do you need?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox id="mand" checked={mandatory} onCheckedChange={(v) => setMandatory(Boolean(v))} />
              <Label htmlFor="mand" className="cursor-pointer">Mandatory</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
