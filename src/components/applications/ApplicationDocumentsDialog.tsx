import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, FileUp, Loader2, Paperclip, Plus, Trash2, XCircle, Download,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  listDocumentRequests,
  createDocumentRequest,
  fulfillDocumentRequest,
  setDocumentRequestStatus,
  deleteDocumentRequest,
  getDocumentDownloadUrl,
  approveAllDocuments,
  rejectAllDocuments,
  canApproveDocuments,
  validateDocFile,
  DOC_REQUEST_STATUS_LABELS,
  type DocumentRequest,
  type DocRequestStatus,
} from "@/lib/document-requests";
import type { Application } from "@/lib/applications";

const statusStyle: Record<DocRequestStatus, string> = {
  required: "bg-amber-500/12 text-amber-600 ring-1 ring-amber-500/20",
  pending: "bg-blue-500/12 text-blue-600 ring-1 ring-blue-500/20",
  under_review: "bg-blue-500/12 text-blue-600 ring-1 ring-blue-500/20",
  uploaded: "bg-blue-500/12 text-blue-600 ring-1 ring-blue-500/20",
  hold: "bg-muted text-muted-foreground ring-1 ring-border",
  approved: "bg-emerald-500/12 text-emerald-600 ring-1 ring-emerald-500/20",
  rejected: "bg-red-500/12 text-red-600 ring-1 ring-red-500/20",
};

const fmtSize = (n: number | null) =>
  n == null ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export function ApplicationDocumentsDialog({
  application,
  open,
  onOpenChange,
  onChanged,
}: {
  application: Application | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [mandatory, setMandatory] = useState(true);
  const [creating, setCreating] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    if (!application) return;
    setLoading(true);
    try {
      setRequests(await listDocumentRequests(application.id));
    } catch (e: any) {
      toast.error(e.message ?? "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [application]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const refresh = async () => { await load(); onChanged?.(); };

  const addRequest = async () => {
    if (!application) return;
    if (!name.trim()) { toast.error("Document name is required"); return; }
    setCreating(true);
    try {
      await createDocumentRequest({
        application_id: application.id,
        document_name: name.trim(),
        description: description.trim() || undefined,
        deadline: deadline || null,
        is_mandatory: mandatory,
      });
      setName(""); setDescription(""); setDeadline(""); setMandatory(true);
      toast.success("Document requested");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to request document");
    } finally {
      setCreating(false);
    }
  };

  const upload = async (req: DocumentRequest, file: File) => {
    const err = validateDocFile(file);
    if (err) { toast.error(err); return; }
    setBusyId(req.id);
    try {
      await fulfillDocumentRequest(req, file);
      toast.success("Uploaded — status set to Pending");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setBusyId(null);
    }
  };

  const decide = async (req: DocumentRequest, decision: "approved" | "rejected") => {
    if (decision === "approved" && !req.file_path) {
      toast.error("Upload the document before approving it.");
      return;
    }
    let notes: string | undefined;
    if (decision === "rejected") {
      const input = window.prompt("Reason for rejection");
      if (input === null) return;
      if (!input.trim()) { toast.error("A reason is required to reject."); return; }
      notes = input.trim();
    }
    setBusyId(req.id);
    try {
      await setDocumentRequestStatus(req.id, decision, notes);
      toast.success(decision === "approved" ? "Document approved" : "Document rejected");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Could not update document");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (req: DocumentRequest) => {
    setBusyId(req.id);
    try {
      await deleteDocumentRequest(req.id);
      toast.success("Document request removed");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Could not delete request");
    } finally {
      setBusyId(null);
    }
  };

  const download = async (req: DocumentRequest) => {
    if (!req.file_path) return;
    try {
      window.open(await getDocumentDownloadUrl(req.file_path), "_blank", "noopener");
    } catch (e: any) {
      toast.error(e.message ?? "Could not open the file");
    }
  };

  const approveAll = async () => {
    setBulkBusy(true);
    try {
      await approveAllDocuments(requests);
      toast.success("All documents approved");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Could not approve documents");
    } finally {
      setBulkBusy(false);
    }
  };

  const rejectAll = async () => {
    setBulkBusy(true);
    try {
      await rejectAllDocuments(requests, rejectNote);
      setRejectNote("");
      toast.success("All documents rejected");
      await refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Could not reject documents");
    } finally {
      setBulkBusy(false);
    }
  };

  const approveCheck = canApproveDocuments(requests);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl">
        <DialogHeader className="border-b bg-muted/40 px-5 py-4 text-left sm:px-6">
          <DialogTitle className="text-base font-semibold sm:text-lg">Documents</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {application?.application_code} · {application?.student?.full_name ?? "—"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          {/* Request a document */}
          <section className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Request a document</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="doc-name" className="text-xs">Document name *</Label>
                <Input
                  id="doc-name" value={name} placeholder="e.g. Passport copy"
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="doc-desc" className="text-xs">Description</Label>
                <Textarea
                  id="doc-desc" rows={2} value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Any instructions for the student…"
                />
              </div>
              <div>
                <Label htmlFor="doc-deadline" className="text-xs">Deadline</Label>
                <Input id="doc-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Checkbox
                  id="doc-mandatory" checked={mandatory}
                  onCheckedChange={(v) => setMandatory(v === true)}
                />
                <Label htmlFor="doc-mandatory" className="text-xs font-normal">Required document</Label>
              </div>
            </div>
            <Button size="sm" className="mt-3" onClick={addRequest} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Request document
            </Button>
          </section>

          {/* Requested documents */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Requested documents</h3>
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : requests.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No documents requested yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {requests.map((r) => (
                  <li key={r.id} className="rounded-xl border bg-card p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{r.document_name}</span>
                          {r.is_mandatory && (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Required
                            </span>
                          )}
                          <Badge variant="secondary" className={`rounded-full ${statusStyle[r.status]}`}>
                            {DOC_REQUEST_STATUS_LABELS[r.status]}
                          </Badge>
                        </div>
                        {r.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                        )}
                        {r.file_name ? (
                          <button
                            type="button"
                            onClick={() => download(r)}
                            className="mt-2 inline-flex max-w-full items-center gap-1.5 text-xs text-primary hover:underline"
                          >
                            <Paperclip className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{r.file_name}</span>
                            <span className="text-muted-foreground">{fmtSize(r.file_size)}</span>
                            <Download className="h-3.5 w-3.5 shrink-0" />
                          </button>
                        ) : (
                          <p className="mt-2 text-xs text-muted-foreground">No file uploaded yet.</p>
                        )}
                        {r.review_notes && (
                          <p className="mt-1 text-xs text-muted-foreground">Note: {r.review_notes}</p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        <input
                          ref={(el) => { fileInputs.current[r.id] = el; }}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            if (f) upload(r, f);
                          }}
                        />
                        <Button
                          size="sm" variant="outline"
                          disabled={busyId === r.id || r.status === "approved"}
                          onClick={() => fileInputs.current[r.id]?.click()}
                        >
                          {busyId === r.id
                            ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            : <FileUp className="mr-1.5 h-3.5 w-3.5" />}
                          Upload
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="text-emerald-600 hover:text-emerald-600"
                          disabled={busyId === r.id || r.status === "approved"}
                          onClick={() => decide(r, "approved")}
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm" variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={busyId === r.id || r.status === "rejected"}
                          onClick={() => decide(r, "rejected")}
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
                        </Button>
                        <Button
                          size="icon" variant="ghost"
                          aria-label="Delete request"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={busyId === r.id}
                          onClick={() => remove(r)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {requests.length > 0 && (
            <section className="rounded-xl border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold">Decide all documents</h3>
              {!approveCheck.ok && (
                <p className="mt-1 text-xs text-amber-600">{approveCheck.reason}</p>
              )}
              <Textarea
                className="mt-3 bg-background"
                rows={2}
                placeholder="Reason (required to reject all)"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={approveAll} disabled={bulkBusy || !approveCheck.ok}>
                  {bulkBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Approve all
                </Button>
                <Button
                  size="sm" variant="destructive"
                  onClick={rejectAll}
                  disabled={bulkBusy || !rejectNote.trim()}
                >
                  <XCircle className="mr-2 h-4 w-4" /> Reject all
                </Button>
              </div>
            </section>
          )}
        </div>

        <DialogFooter className="border-t bg-muted/40 px-5 py-3 sm:px-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
