import { supabase } from "./supabase";

export type StudentStatus = "prospect" | "active" | "inactive" | "archived" | "enrolled";
export type StudentGender = "male" | "female" | "other" | "prefer_not_to_say";

export const STUDENT_STATUSES: StudentStatus[] = [
  "prospect", "active", "enrolled", "inactive", "archived",
];

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  prospect: "Prospect",
  active: "Active",
  enrolled: "Enrolled",
  inactive: "Inactive",
  archived: "Archived",
};

export const STUDENT_GENDERS: StudentGender[] = ["male", "female", "other", "prefer_not_to_say"];
export const GENDER_LABELS: Record<StudentGender, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
  prefer_not_to_say: "Prefer not to say",
};

export interface AcademicEntry {
  // Optional. When present, marks which section this row belongs to on the
  // registration form (SSC/HSC, Bachelor's, Master's, etc.). Existing rows
  // without a level continue to render in the generic academic list.
  level?: string;
  institution: string;
  board?: string;   // Board / group for SSC/HSC rows
  qualification: string;
  program?: string; // Program / subject for Bachelor's & Master's rows
  year?: string;
  grade?: string;
}

export interface PreferredUniversity {
  country: string;
  university: string;
  course: string;
}

export interface TestScore {
  test: string;   // e.g. IELTS, UKVI, PTE, DUOLINGO, SAT, ACT
  score: string;
}

export interface Student {
  id: string;
  student_code: string;
  full_name: string;
  passport_no: string | null;
  passport_expiry: string | null;
  date_of_birth: string | null;
  gender: StudentGender | null;
  nationality: string | null;
  phone: string | null;
  email: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  guardian_relation: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  current_address: string | null;
  permanent_address: string | null;
  academic_history: AcademicEntry[];
  preferred_universities: PreferredUniversity[];
  test_scores: TestScore[];
  photo_url: string | null;
  status: StudentStatus;
  notes: string | null;
  assigned_counselor_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}


export interface StudentDocument {
  id: string;
  student_id: string;
  name: string;
  category: string | null;
  file_url: string;
  file_path: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface StudentTimelineEvent {
  id: string;
  student_id: string;
  event_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  actor_id: string | null;
  actor_email: string | null;
  created_at: string;
}

export interface StudentFilter {
  q?: string;
  status?: StudentStatus | "all";
  nationality?: string | "all";
  gender?: StudentGender | "all";
  passportExpiring?: boolean; // within 6 months
}

export type StudentInput = Partial<Omit<Student, "id" | "student_code" | "created_at" | "updated_at" | "created_by">> & {
  full_name: string;
};

function normalizeStudent(r: any): Student {
  return {
    ...r,
    academic_history: Array.isArray(r?.academic_history) ? r.academic_history : [],
    preferred_universities: Array.isArray(r?.preferred_universities) ? r.preferred_universities : [],
    test_scores: Array.isArray(r?.test_scores) ? r.test_scores : [],
  } as Student;
}

export async function listStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeStudent);
}

export async function getStudent(id: string): Promise<Student | null> {
  const { data, error } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return normalizeStudent(data);
}


export async function createStudent(input: StudentInput): Promise<Student> {
  const { data: sess } = await supabase.auth.getUser();
  const payload: any = { ...input, created_by: sess.user?.id ?? null };
  if (payload.academic_history === undefined) payload.academic_history = [];
  if (payload.preferred_universities === undefined) payload.preferred_universities = [];
  if (payload.test_scores === undefined) payload.test_scores = [];
  const { data, error } = await supabase.from("students").insert(payload).select("*").single();
  if (error) throw mapStudentDbError(error);
  return normalizeStudent(data);
}


// Look up a student by passport number (exact match, case-sensitive)
export async function findStudentByPassport(passportNo: string): Promise<Student | null> {
  const p = passportNo.trim();
  if (!p) return null;
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("passport_no", p)
    .maybeSingle();
  if (error) throw error;
  return (data as Student | null) ?? null;
}

// Map Postgres constraint errors to friendly, form-scoped messages.
export interface StudentValidationError extends Error {
  field?: "full_name" | "email" | "passport_no" | "passport_expiry";
  code?: string;
}
// Detects "unknown column" errors from PostgREST / Postgres so we can show a
// clear "apply migration" message instead of a raw column name.
const MISSING_COL_RE = /column\s+(?:"[^"]+"\.)?"?([a-z_][a-z0-9_]*)"?\s+(?:does not exist|of relation)/i;
const SCHEMA_CACHE_RE = /Could not find the '([a-z_][a-z0-9_]*)' column/i;
export function detectMissingColumn(err: any): string | null {
  const code = err?.code as string | undefined;
  const msg = String(err?.message ?? err?.details ?? "");
  if (code === "42703" || code === "PGRST204" || code === "PGRST205") {
    const m = msg.match(SCHEMA_CACHE_RE) || msg.match(MISSING_COL_RE);
    return m?.[1] ?? "unknown";
  }
  const m = msg.match(SCHEMA_CACHE_RE);
  return m?.[1] ?? null;
}

export function mapStudentDbError(err: any): StudentValidationError {
  const code = err?.code as string | undefined;
  const detail = String(err?.message ?? err?.details ?? "");
  const e: StudentValidationError = new Error(err?.message ?? "Save failed");
  e.code = code;
  const missing = detectMissingColumn(err);
  if (missing) {
    e.message =
      `Your database is missing the "${missing}" column. ` +
      `An administrator must apply the latest migrations in db/migrations/ (via scripts/db-push.sh) and reload the PostgREST schema cache, then try again.`;
    return e;
  }
  if (code === "23505" && detail.includes("students_passport_no_unique")) {
    e.field = "passport_no";
    e.message = "A student with this passport number already exists.";
  } else if (code === "23514") {
    if (detail.includes("students_email_format_chk")) { e.field = "email"; e.message = "Invalid email address."; }
    else if (detail.includes("students_full_name_length_chk")) { e.field = "full_name"; e.message = "Full name must be 1–150 characters."; }
    else if (detail.includes("students_passport_expiry_chk")) { e.field = "passport_expiry"; e.message = "Passport expiry must be after date of birth."; }
    else if (detail.includes("students_passport_expiry_year_chk")) { e.field = "passport_expiry"; e.message = "Passport expiry date is not valid."; }
  }
  return e;
}

export async function updateStudent(id: string, patch: Partial<StudentInput>): Promise<void> {
  const { error } = await supabase.from("students").update(patch as any).eq("id", id);
  if (error) throw mapStudentDbError(error);
}

// Shared client-side validation (mirrors DB CHECK constraints + extras)
const PHONE_RE = /^[+()\d\s\-.]{5,32}$/;
const NAME_RE = /^[\p{L}\p{M}\s.'\-]+$/u;

function isFutureDate(s: string): boolean {
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime())) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d > today;
}

export function validateStudentInput(input: Partial<StudentInput>): Record<string, string> {
  const errs: Record<string, string> = {};

  if (input.full_name !== undefined) {
    const name = (input.full_name ?? "").trim();
    if (!name) errs.full_name = "Full name is required";
    else if (name.length > 150) errs.full_name = "Max 150 characters";
    else if (!NAME_RE.test(name)) errs.full_name = "Only letters, spaces, hyphens and apostrophes";
  }

  if (input.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email).trim())) errs.email = "Invalid email";
    else if (String(input.email).length > 255) errs.email = "Max 255 characters";
  }

  for (const key of ["phone", "guardian_phone", "emergency_contact_phone"] as const) {
    const v = (input as any)[key];
    if (v && !PHONE_RE.test(String(v).trim())) {
      errs[key] = "Invalid phone (digits, spaces, +, - only)";
    }
  }

  for (const key of ["guardian_name", "emergency_contact_name", "nationality", "guardian_relation"] as const) {
    const v = (input as any)[key];
    if (v && String(v).length > 150) errs[key] = "Max 150 characters";
    if (v && (key === "guardian_name" || key === "emergency_contact_name") && !NAME_RE.test(String(v).trim())) {
      errs[key] = "Only letters, spaces, hyphens and apostrophes";
    }
  }

  if (input.passport_no && String(input.passport_no).length > 32) {
    errs.passport_no = "Max 32 characters";
  }

  if (input.date_of_birth) {
    const dob = String(input.date_of_birth);
    const y = Number(dob.slice(0, 4));
    if (!y || y < 1900) errs.date_of_birth = "Invalid date of birth";
    else if (isFutureDate(dob)) errs.date_of_birth = "Date of birth cannot be in the future";
  }

  if (input.passport_expiry) {
    const exp = String(input.passport_expiry);
    const dob = input.date_of_birth ? String(input.date_of_birth) : "";
    if (dob && exp <= dob) errs.passport_expiry = "Expiry must be after date of birth";
    const y = Number(exp.slice(0, 4));
    if (!y || y < 1900) errs.passport_expiry = "Invalid expiry date";
  }


  for (const key of ["current_address", "permanent_address", "notes"] as const) {
    const v = (input as any)[key];
    if (v && String(v).length > 2000) errs[key] = "Max 2000 characters";
  }

  return errs;
}


export async function deleteStudent(id: string): Promise<void> {
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
}

// Photo upload
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const PHOTO_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export function validateStudentPhoto(file: File): string | null {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const okType = PHOTO_ALLOWED_TYPES.includes(file.type) || ["jpg", "jpeg", "png", "webp"].includes(ext);
  if (!okType) return "Use a JPG, PNG or WEBP image.";
  if (file.size > PHOTO_MAX_BYTES) return `File too large (max ${PHOTO_MAX_BYTES / 1024 / 1024} MB).`;
  return null;
}

export async function uploadStudentPhoto(studentId: string, file: File): Promise<string> {
  const err = validateStudentPhoto(file);
  if (err) throw new Error(err);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${studentId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("student-photos").upload(path, file, {
    upsert: true,
    contentType: file.type || `image/${ext === "jpg" ? "jpeg" : ext}`,
  });
  if (error) throw error;
  return supabase.storage.from("student-photos").getPublicUrl(path).data.publicUrl;
}

// Documents
export const DOC_MAX_BYTES = 15 * 1024 * 1024;
export const DOC_ALLOWED_TYPES = [
  "application/pdf",
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain", "text/csv",
];
export const DOC_ALLOWED_EXTS = ["pdf","jpg","jpeg","png","webp","gif","doc","docx","xls","xlsx","txt","csv"];

export function validateStudentDocument(file: File): string | null {
  if (!file) return "No file selected";
  if (file.size <= 0) return "File is empty";
  if (file.size > DOC_MAX_BYTES) {
    return `File too large (${(file.size/1024/1024).toFixed(2)} MB). Max ${DOC_MAX_BYTES/1024/1024} MB.`;
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const okType = DOC_ALLOWED_TYPES.includes(file.type) || DOC_ALLOWED_EXTS.includes(ext);
  if (!okType) return "Unsupported file type. Allowed: PDF, images, Word, Excel, TXT, CSV.";
  return null;
}

export async function listStudentDocuments(studentId: string): Promise<StudentDocument[]> {
  const { data, error } = await supabase
    .from("student_documents")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as StudentDocument[]) ?? [];
}

export async function uploadStudentDocument(
  studentId: string,
  file: File,
  meta: { name?: string; category?: string } = {}
): Promise<StudentDocument> {
  const verr = validateStudentDocument(file);
  if (verr) throw new Error(verr);
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${studentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("student-documents")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (upErr) throw upErr;
  // Private bucket → sign later; store path + signed placeholder
  const { data: signed } = await supabase.storage.from("student-documents").createSignedUrl(path, 60 * 60);
  const { data: sess } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("student_documents")
    .insert({
      student_id: studentId,
      name: meta.name || file.name,
      category: meta.category ?? null,
      file_url: signed?.signedUrl ?? "",
      file_path: path,
      mime_type: file.type,
      size_bytes: file.size,
      uploaded_by: sess.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  await addTimelineEvent(studentId, {
    event_type: "document",
    title: "Document uploaded",
    description: meta.name || file.name,
  });
  return data as StudentDocument;
}

export async function getSignedDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("student-documents").createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteStudentDocument(doc: StudentDocument): Promise<void> {
  if (doc.file_path) {
    await supabase.storage.from("student-documents").remove([doc.file_path]);
  }
  const { error } = await supabase.from("student_documents").delete().eq("id", doc.id);
  if (error) throw error;
  await addTimelineEvent(doc.student_id, {
    event_type: "document",
    title: "Document removed",
    description: doc.name,
  });
}

// Timeline
export async function listStudentTimeline(studentId: string): Promise<StudentTimelineEvent[]> {
  const { data, error } = await supabase
    .from("student_timeline")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as StudentTimelineEvent[]) ?? [];
}

export async function addTimelineEvent(
  studentId: string,
  entry: { event_type: string; title: string; description?: string; metadata?: Record<string, unknown> }
): Promise<void> {
  const { data: sess } = await supabase.auth.getUser();
  const { error } = await supabase.from("student_timeline").insert({
    student_id: studentId,
    event_type: entry.event_type,
    title: entry.title,
    description: entry.description ?? null,
    metadata: entry.metadata ?? null,
    actor_id: sess.user?.id ?? null,
    actor_email: sess.user?.email ?? null,
  });
  if (error) throw error;
}

export async function updateTimelineEvent(
  id: string,
  patch: { event_type?: string; title?: string; description?: string | null; metadata?: Record<string, unknown> | null }
): Promise<void> {
  const { error } = await supabase.from("student_timeline").update(patch as any).eq("id", id);
  if (error) throw error;
}

export async function deleteTimelineEvent(id: string): Promise<void> {
  const { error } = await supabase.from("student_timeline").delete().eq("id", id);
  if (error) throw error;
}

// Replace an existing document with a new file (delete storage + row, upload new)
export async function replaceStudentDocument(
  doc: StudentDocument,
  file: File,
  meta: { name?: string; category?: string } = {}
): Promise<StudentDocument> {
  const verr = validateStudentDocument(file);
  if (verr) throw new Error(verr);
  if (doc.file_path) {
    await supabase.storage.from("student-documents").remove([doc.file_path]);
  }
  await supabase.from("student_documents").delete().eq("id", doc.id);
  const next = await uploadStudentDocument(doc.student_id, file, {
    name: meta.name || doc.name,
    category: meta.category ?? doc.category ?? undefined,
  });
  await addTimelineEvent(doc.student_id, {
    event_type: "document",
    title: "Document replaced",
    description: `${doc.name} → ${next.name}`,
  });
  return next;
}

// ================= Audit log helpers (student-scoped) =================
export interface StudentAuditEntry {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export async function writeStudentAudit(
  studentId: string,
  action: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const { data: sess } = await supabase.auth.getUser();
  const actor_id = sess.user?.id ?? null;
  if (!actor_id) return;
  await supabase.from("audit_logs").insert({
    actor_id,
    actor_email: sess.user?.email ?? null,
    action,
    entity: "student",
    entity_id: studentId,
    metadata: metadata ?? null,
  });
}

export async function listStudentAudit(studentId: string): Promise<StudentAuditEntry[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, actor_id, actor_email, action, entity, entity_id, metadata, created_at")
    .eq("entity", "student")
    .eq("entity_id", studentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as StudentAuditEntry[]) ?? [];
}

// Compute changed fields between two student objects (returns { field: {from,to} })
const AUDITABLE_FIELDS: (keyof Student)[] = [
  "full_name","email","phone","date_of_birth","gender","nationality","passport_no","passport_expiry",
  "guardian_name","guardian_phone","guardian_relation","emergency_contact_name","emergency_contact_phone",
  "current_address","permanent_address",
  "status","notes","photo_url","assigned_counselor_id","academic_history",
  "preferred_universities","test_scores",
];


export function diffStudent(prev: Student, next: Student): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of AUDITABLE_FIELDS) {
    const a = (prev as any)[k];
    const b = (next as any)[k];
    const aa = a === undefined ? null : a;
    const bb = b === undefined ? null : b;
    if (JSON.stringify(aa) !== JSON.stringify(bb)) {
      changes[k as string] = { from: aa, to: bb };
    }
  }
  return changes;
}
