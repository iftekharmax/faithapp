import { supabase } from "./supabase";

export type ApplicationStatus =
  | "draft" | "submitted" | "under_review" | "offer_received"
  | "conditional_offer" | "unconditional_offer" | "deposit_paid"
  | "cas_issued" | "visa_applied" | "visa_granted" | "visa_refused"
  | "enrolled" | "withdrawn" | "rejected";



export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "draft","submitted","under_review","offer_received","conditional_offer",
  "unconditional_offer","deposit_paid","cas_issued","visa_applied",
  "visa_granted","visa_refused","enrolled","withdrawn","rejected",
];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  offer_received: "Offer Received",
  conditional_offer: "Conditional Offer",
  unconditional_offer: "Unconditional Offer",
  deposit_paid: "Deposit Paid",
  cas_issued: "CAS Issued",
  visa_applied: "Visa Applied",
  visa_granted: "Visa Granted",
  visa_refused: "Visa Refused",
  enrolled: "Enrolled",
  withdrawn: "Withdrawn",
  rejected: "Rejected",
};


// Allowed status transitions (mirror of DB is_valid_application_transition).
export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["under_review", "withdrawn", "rejected"],
  under_review: ["offer_received", "conditional_offer", "unconditional_offer", "rejected", "withdrawn"],
  offer_received: ["conditional_offer", "unconditional_offer", "rejected", "withdrawn"],
  conditional_offer: ["unconditional_offer", "deposit_paid", "rejected", "withdrawn"],
  unconditional_offer: ["deposit_paid", "rejected", "withdrawn"],
  deposit_paid: ["cas_issued", "withdrawn"],
  cas_issued: ["visa_applied", "withdrawn"],
  visa_applied: ["visa_granted", "visa_refused", "withdrawn"],
  visa_refused: ["visa_applied", "withdrawn"],
  visa_granted: ["enrolled", "withdrawn"],
  enrolled: [],
  withdrawn: [],
  rejected: [],
};

export function allowedNextStatuses(current: ApplicationStatus, isAdmin = false): ApplicationStatus[] {
  if (isAdmin) return APPLICATION_STATUSES;
  return [current, ...APPLICATION_TRANSITIONS[current]];
}

export function mapApplicationDbError(err: unknown): string {
  const raw = (err as { message?: string })?.message ?? String(err);
  const msg = raw.trim();

  // Legacy assignee validation (pre-migration 20260739). Surface as a clear
  // remediation instead of a raw "assigned_counselor_id" field name.
  if (/assigned[_ ]?(counselor|officer)/i.test(msg) ||
      /Assigned (Counselor|Officer) is required/i.test(msg)) {
    return "This workspace still has an old database rule requiring an Assigned Counselor/Officer. Please apply the latest database migration (drop_application_assignees) and try again.";
  }

  if (/Invalid status transition/i.test(msg)) {
    const m = msg.match(/Invalid status transition:\s*([\w-]+)\s*->\s*([\w-]+)/i);
    if (m) return `You can't move an application from "${m[1]}" to "${m[2]}".`;
    return "That status change isn't allowed from the current stage.";
  }
  if (/Notes are required/i.test(msg)) return "Please add a note explaining this status change.";
  if (/University is required/i.test(msg)) return "University is required.";
  if (/Program is required/i.test(msg)) return "Program is required.";

  // Generic Postgres shapes — hide column/constraint names.
  if (/null value in column/i.test(msg)) return "A required field is missing. Please fill in all required fields.";
  if (/violates not-null constraint/i.test(msg)) return "A required field is missing. Please fill in all required fields.";
  if (/duplicate key value/i.test(msg)) return "This record already exists.";
  if (/violates foreign key constraint/i.test(msg)) return "Related record not found. Please refresh and try again.";
  if (/permission denied|row-level security/i.test(msg)) return "You don't have permission to perform this action.";
  if (/check constraint/i.test(msg)) return "One of the values isn't valid for this field.";

  // Strip common technical prefixes / column identifiers before showing.
  return msg.replace(/^(new row for relation|error:|pgrst\w*:?)\s*/i, "").replace(/"[a-z_]+"/g, "").trim() || "Something went wrong. Please try again.";
}

export interface Application {
  id: string;
  application_code: string;
  student_id: string;
  country: string | null;
  university: string;
  campus: string | null;
  program: string;
  degree: string | null;
  intake: string | null;
  scholarship: string | null;
  application_fee: number | null;
  registration_fee: number | null;
  emgs_fee: number | null;
  others_fee: number | null;
  assigned_team_id: string | null;
  
  status: ApplicationStatus;
  notes: string | null;
  submitted_at: string | null;
  decision_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  student?: { id: string; full_name: string; student_code: string; email: string | null } | null;
  assigned_team?: { id: string; full_name: string | null; email: string } | null;
}

export interface ApplicationTimelineEvent {
  id: string;
  application_id: string;
  event_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  actor_id: string | null;
  actor_email: string | null;
  created_at: string;
}


export interface StaffOption {
  id: string;
  full_name: string | null;
  email: string;
}

export async function listApplications(): Promise<Application[]> {
  const { data, error } = await supabase
    .from("applications")
    .select("*, student:students(id, full_name, student_code, email), assigned_team:profiles!applications_assigned_team_id_fkey(id, full_name, email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Application[];
}

export async function getApplication(id: string): Promise<Application | null> {
  const { data, error } = await supabase
    .from("applications")
    .select("*, student:students(id, full_name, student_code, email), assigned_team:profiles!applications_assigned_team_id_fkey(id, full_name, email)")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Application) ?? null;
}

export type ApplicationInput = Omit<Partial<Application>,
  "id"|"application_code"|"created_at"|"updated_at"|"student"|"created_by"|"submitted_at"|"decision_at">;

export function validateApplicationInput(input: ApplicationInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.student_id) errors.student_id = "Student is required";
  if (!input.university || !input.university.trim()) errors.university = "University is required";
  else if (input.university.length > 200) errors.university = "Too long (max 200)";
  if (!input.program || !input.program.trim()) errors.program = "Program is required";
  else if (input.program.length > 200) errors.program = "Too long (max 200)";
  const feeFields: Array<keyof ApplicationInput> = ["application_fee", "registration_fee", "emgs_fee", "others_fee"];
  feeFields.forEach(field => {
    const val = input[field];
    if (val != null && (isNaN(Number(val)) || Number(val) < 0)) {
      errors[field] = "Must be a positive number";
    }
  });
  if (input.notes && input.notes.length > 5000) errors.notes = "Too long (max 5000)";
  return errors;
}

export async function createApplication(input: ApplicationInput): Promise<Application> {
  const { data: auth } = await supabase.auth.getUser();
  const payload = { ...input, created_by: auth.user?.id ?? null };
  const { data, error } = await supabase.from("applications").insert(payload).select("*").single();
  if (error) throw new Error(mapApplicationDbError(error));
  return data as Application;
}

export async function updateApplication(id: string, patch: ApplicationInput): Promise<Application> {
  const { data, error } = await supabase.from("applications").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error(mapApplicationDbError(error));
  return data as Application;
}

export async function deleteApplication(id: string): Promise<void> {
  const { error } = await supabase.from("applications").delete().eq("id", id);
  if (error) throw error;
}

export async function listApplicationTimeline(applicationId: string): Promise<ApplicationTimelineEvent[]> {
  const { data, error } = await supabase
    .from("application_timeline")
    .select("*").eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ApplicationTimelineEvent[];
}

export async function addTimelineNote(applicationId: string, title: string, description?: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("application_timeline").insert({
    application_id: applicationId,
    event_type: "note",
    title,
    description: description ?? null,
    actor_id: auth.user?.id ?? null,
    actor_email: auth.user?.email ?? null,
  });
  if (error) throw error;
}


export async function listStaff(role: "counselor" | "application_team" | "admin"): Promise<StaffOption[]> {
  // Try admin view first (works for admins)
  const view = await supabase.from("admin_users_view").select("id, full_name, email, roles");
  if (!view.error && view.data) {
    return (view.data as any[])
      .filter((u) => Array.isArray(u.roles) && u.roles.includes(role))
      .map((u) => ({ id: u.id, full_name: u.full_name, email: u.email }));
  }
  // Fallback: user_roles + profiles
  const { data, error } = await supabase
    .from("user_roles")
    .select("user_id, profiles:profiles!user_roles_user_id_fkey(id, full_name, email)")
    .eq("role", role);
  if (error) return [];
  return (data ?? [])
    .map((r: any) => r.profiles)
    .filter(Boolean)
    .map((p: any) => ({ id: p.id, full_name: p.full_name, email: p.email }));
}

export async function listStudentsLite(): Promise<Array<{ id: string; full_name: string; student_code: string; email: string | null }>> {
  const { data, error } = await supabase
    .from("students")
    .select("id, full_name, student_code, email")
    .order("full_name");
  if (error) throw error;
  return (data ?? []) as any;
}
