import { supabase } from "./supabase";

export type DocRequestStatus = "required" | "pending" | "under_review" | "hold" | "rejected" | "approved" | "uploaded";

export const DOC_REQUEST_STATUS_LABELS: Record<DocRequestStatus, string> = {
  required: "Required",
  pending: "Pending",
  under_review: "Under Review",
  hold: "Hold",
  rejected: "Reject",
  approved: "Approved",
  // Legacy value kept for backward compatibility; displayed as "Under Review".
  uploaded: "Under Review",
};

// Statuses selectable by the application team.
export const DOC_REQUEST_STATUS_OPTIONS: DocRequestStatus[] = [
  "required",
  "pending",
  "under_review",
  "hold",
  "rejected",
  "approved",
];
// Allowed next statuses for the application team. Mirrors the DB
// is_valid_docreq_transition() matrix so we can validate before writing.
export const DOC_REQUEST_ALLOWED_NEXT: Record<DocRequestStatus, DocRequestStatus[]> = {
  required:     ["required", "pending", "hold", "rejected"],
  pending:      ["pending", "required", "under_review", "hold", "rejected", "approved"],
  under_review: ["under_review", "pending", "hold", "rejected", "approved"],
  hold:         ["hold", "required", "pending", "under_review", "rejected", "approved"],
  rejected:     ["rejected", "required", "pending", "under_review"],
  approved:     ["approved"],
  // Legacy alias, treat like pending.
  uploaded:     ["uploaded", "pending", "under_review", "hold", "rejected", "approved"],
};

export function isDocRequestTransitionAllowed(from: DocRequestStatus, to: DocRequestStatus) {
  return DOC_REQUEST_ALLOWED_NEXT[from]?.includes(to) ?? false;
}

export interface DocumentRequest {
  id: string;
  application_id: string;
  document_name: string;
  description: string | null;
  deadline: string | null;
  is_mandatory: boolean;
  status: DocRequestStatus;
  requested_by: string | null;
  requested_by_email: string | null;
  file_path: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  fulfilled_by: string | null;
  fulfilled_at: string | null;
  review_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listDocumentRequests(applicationId: string): Promise<DocumentRequest[]> {
  const { data, error } = await supabase
    .from("application_document_requests")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as DocumentRequest[];
}

export async function createDocumentRequest(input: {
  application_id: string;
  document_name: string;
  description?: string;
  deadline?: string | null;
  is_mandatory?: boolean;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("application_document_requests").insert({
    application_id: input.application_id,
    document_name: input.document_name,
    description: input.description ?? null,
    deadline: input.deadline ?? null,
    is_mandatory: input.is_mandatory ?? true,
    status: "required",
    requested_by: auth.user?.id ?? null,
    requested_by_email: auth.user?.email ?? null,
  });
  if (error) throw error;
}

export const MAX_DOC_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB
export const ALLOWED_DOC_EXTENSIONS = [
  "pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "rtf",
  "png", "jpg", "jpeg", "webp", "gif", "heic",
  "zip",
];
export const ALLOWED_DOC_MIME = new Set<string>([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "text/plain", "application/rtf", "text/rtf",
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/heic",
  "application/zip", "application/x-zip-compressed",
]);

export function validateDocFile(file: File): string | null {
  if (file.size === 0) return "File is empty.";
  if (file.size > MAX_DOC_UPLOAD_BYTES) return "File exceeds the 20MB limit.";
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const extOk = ALLOWED_DOC_EXTENSIONS.includes(ext);
  const mimeOk = file.type ? ALLOWED_DOC_MIME.has(file.type) : false;
  if (!extOk && !mimeOk) {
    return `File type not allowed. Accepted: ${ALLOWED_DOC_EXTENSIONS.join(", ")}.`;
  }
  return null;
}

const SUPABASE_URL = "https://qdveirhlzuzrxaqjevxr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BKdIW3Wk9DQ5-oBiNPHGmw_2lpXrA0Z";

function uploadWithProgress(opts: {
  path: string;
  file: File;
  token: string;
  signal?: AbortSignal;
  onProgress?: (pct: number) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${SUPABASE_URL}/storage/v1/object/application-documents/${opts.path}`;
    xhr.open("POST", url, true);
    xhr.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("Authorization", `Bearer ${opts.token}`);
    xhr.setRequestHeader("x-upsert", "true");
    if (opts.file.type) xhr.setRequestHeader("Content-Type", opts.file.type);
    xhr.setRequestHeader("cache-control", "3600");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed (${xhr.status}): ${xhr.responseText || xhr.statusText}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    opts.signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(opts.file);
  });
}

// Short-lived signed URL for downloads (default 5 minutes).
export async function getDocumentDownloadUrl(
  filePath: string,
  expiresInSeconds = 300,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("application-documents")
    .createSignedUrl(filePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not generate a download link.");
  }
  return data.signedUrl;
}

// Maps Supabase/Postgres errors from doc-request writes into user-friendly text.
export function mapDocRequestError(err: unknown): string {
  const raw = (err as { message?: string })?.message ?? String(err);
  const msg = raw.trim();
  if (/docreq_file_size_chk/i.test(msg)) return "File exceeds the 20MB server limit.";
  if (/docreq_mime_allowed_chk/i.test(msg)) return "This file type isn't accepted by the server.";
  if (/Invalid status transition/i.test(msg)) {
    const m = msg.match(/Invalid status transition:\s*([\w-]+)\s*→\s*([\w-]+)/i);
    if (m) return `Cannot change document status from "${m[1]}" to "${m[2]}".`;
    return "That document status change isn't allowed from the current state.";
  }
  if (/reason note is required/i.test(msg)) return "A reason note is required to Hold or Reject.";
  if (/Counselor upload can only move status/i.test(msg))
    return "Uploads are only permitted while the request is in 'Required' state.";
  if (/permission denied|row-level security/i.test(msg))
    return "You don't have permission to perform this action.";
  if (/network|Failed to fetch/i.test(msg)) return "Network error. Check your connection and retry.";
  const httpM = msg.match(/Upload failed \((\d+)\):?\s*(.*)$/i);
  if (httpM) {
    const code = httpM[1];
    const body = (httpM[2] ?? "").replace(/["{}]/g, "").slice(0, 160);
    if (code === "413") return "File is too large for the server (413).";
    if (code === "401" || code === "403") return "You aren't allowed to upload here (auth/permission).";
    return `Server rejected the upload (HTTP ${code}). ${body}`.trim();
  }
  return msg || "Something went wrong. Please try again.";
}

export async function fulfillDocumentRequest(
  request: DocumentRequest,
  file: File,
  options?: { onProgress?: (pct: number) => void; signal?: AbortSignal },
) {
  const err = validateDocFile(file);
  if (err) throw new Error(err);
  if (request.status === "approved") {
    throw new Error("This request is already approved and cannot be re-uploaded.");
  }
  const { data: auth } = await supabase.auth.getUser();
  const { data: sess } = await supabase.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) throw new Error("You must be signed in to upload.");
  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${request.application_id}/requests/${request.id}/${Date.now()}-${safe}`;

  try {
    await uploadWithProgress({ path, file, token, signal: options?.signal, onProgress: options?.onProgress });
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
    throw new Error(mapDocRequestError(e));
  }

  const { error } = await supabase
    .from("application_document_requests")
    .update({
      status: request.status === "required" ? "pending" : request.status,
      file_path: path,
      // Signed URLs are generated on demand with short expirations; do not
      // persist a long-lived link on the row.
      file_url: null,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      fulfilled_by: auth.user?.id ?? null,
      fulfilled_at: new Date().toISOString(),
    })
    .eq("id", request.id);
  if (error) {
    await supabase.storage.from("application-documents").remove([path]).catch(() => {});
    throw new Error(mapDocRequestError(error));
  }

  if (request.file_path && request.file_path !== path) {
    await supabase.storage.from("application-documents").remove([request.file_path]).catch(() => {});
  }
}

export async function setDocumentRequestStatus(
  id: string,
  status: DocRequestStatus,
  notes?: string,
) {
  const { data: auth } = await supabase.auth.getUser();
  const patch: Record<string, unknown> = {
    status,
    reviewed_by: auth.user?.id ?? null,
    reviewed_at: new Date().toISOString(),
  };
  if (notes !== undefined) patch.review_notes = notes || null;
  const { error } = await supabase
    .from("application_document_requests")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(mapDocRequestError(error));
}

export async function reviewDocumentRequest(
  id: string,
  decision: "approved" | "rejected",
  notes?: string,
) {
  return setDocumentRequestStatus(id, decision, notes);
}

// Upload history for a single document request (newest first).
export interface DocumentRequestUpload {
  id: string;
  request_id: string;
  application_id: string;
  file_path: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  uploaded_by_email: string | null;
  uploaded_at: string;
}

export async function listDocumentRequestUploads(
  requestId: string,
): Promise<DocumentRequestUpload[]> {
  const { data, error } = await supabase
    .from("application_document_request_uploads")
    .select("*")
    .eq("request_id", requestId)
    .order("uploaded_at", { ascending: false });
  if (error) throw new Error(mapDocRequestError(error));
  return (data ?? []) as DocumentRequestUpload[];
}

// Clear only the attached file on a request (keeps the request row itself).
// Used by the timeline "delete attachment" action.
export async function clearDocumentRequestFile(request: DocumentRequest) {
  if (!request.file_path) return;
  const patch: Record<string, unknown> = {
    file_path: null,
    file_url: null,
    file_name: null,
    file_size: null,
    mime_type: null,
    fulfilled_by: null,
    fulfilled_at: null,
  };
  if (request.status !== "required") patch.status = "pending";
  const { error } = await supabase
    .from("application_document_requests")
    .update(patch)
    .eq("id", request.id);
  if (error) throw new Error(mapDocRequestError(error));
  await supabase.storage.from("application-documents").remove([request.file_path]).catch(() => {});
}

export async function deleteDocumentRequest(id: string) {
  const { data: row } = await supabase
    .from("application_document_requests")
    .select("file_path")
    .eq("id", id)
    .maybeSingle();
  if (row?.file_path) {
    await supabase.storage.from("application-documents").remove([row.file_path as string]);
  }
  const { error } = await supabase.from("application_document_requests").delete().eq("id", id);
  if (error) throw new Error(mapDocRequestError(error));
}
