import { supabase } from "./supabase";

// Checklists module removed.

// ---------- Reviews ----------
export type ReviewStage = "processor" | "senior_processor" | "manager" | "submit";
export type ReviewDecision = "pending" | "approved" | "rejected" | "changes_requested";

export const REVIEW_STAGES: ReviewStage[] = ["processor", "senior_processor", "manager", "submit"];
export const REVIEW_STAGE_LABELS: Record<ReviewStage, string> = {
  processor: "Processor",
  senior_processor: "Senior Processor",
  manager: "Manager Approval",
  submit: "Submit to University",
};

export interface Review {
  id: string;
  application_id: string;
  stage: ReviewStage;
  decision: ReviewDecision;
  comments: string | null;
  reviewer_id: string | null;
  reviewer_email: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listReviews(applicationId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from("application_reviews")
    .select("*")
    .eq("application_id", applicationId);
  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function upsertReview(input: {
  application_id: string;
  stage: ReviewStage;
  decision: ReviewDecision;
  comments?: string;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("application_reviews").upsert(
    {
      application_id: input.application_id,
      stage: input.stage,
      decision: input.decision,
      comments: input.comments ?? null,
      reviewer_id: auth.user?.id ?? null,
      reviewer_email: auth.user?.email ?? null,
    },
    { onConflict: "application_id,stage" },
  );
  if (error) throw error;
}

// ---------- Offers ----------
export type OfferType = "conditional" | "unconditional" | "reject";
export type OfferAcceptance = "pending" | "accepted" | "declined" | "expired";

export interface Offer {
  id: string;
  application_id: string;
  offer_type: OfferType;
  offer_date: string;
  expiry_date: string | null;
  deposit_amount: number | null;
  currency: string | null;
  acceptance: OfferAcceptance;
  accepted_at: string | null;
  offer_file_url: string | null;
  offer_file_path: string | null;
  acceptance_file_url: string | null;
  acceptance_file_path: string | null;
  notes: string | null;
  created_at: string;
}

export const OFFER_TYPE_LABELS: Record<OfferType, string> = {
  conditional: "Conditional Offer",
  unconditional: "Unconditional Offer",
  reject: "Rejection",
};

export async function listOffers(applicationId: string): Promise<Offer[]> {
  const { data, error } = await supabase
    .from("application_offers")
    .select("*")
    .eq("application_id", applicationId)
    .order("offer_date", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Offer[];
}

export async function createOffer(input: {
  application_id: string;
  offer_type: OfferType;
  offer_date: string;
  expiry_date?: string | null;
  deposit_amount?: number | null;
  currency?: string;
  notes?: string;
  offer_file?: File | null;
}): Promise<Offer> {
  const { data: auth } = await supabase.auth.getUser();
  let offer_file_url: string | null = null;
  let offer_file_path: string | null = null;
  if (input.offer_file) {
    if (input.offer_file.size > 20 * 1024 * 1024) throw new Error("Max file size is 20MB");
    const path = `${input.application_id}/offer-${Date.now()}-${input.offer_file.name.replace(/[^\w.\-]/g, "_")}`;
    const up = await supabase.storage.from("application-documents").upload(path, input.offer_file);
    if (up.error) throw up.error;
    const { data: signed } = await supabase.storage
      .from("application-documents")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    offer_file_url = signed?.signedUrl ?? null;
    offer_file_path = path;
  }
  const { data, error } = await supabase
    .from("application_offers")
    .insert({
      application_id: input.application_id,
      offer_type: input.offer_type,
      offer_date: input.offer_date,
      expiry_date: input.expiry_date ?? null,
      deposit_amount: input.deposit_amount ?? null,
      currency: input.currency ?? "USD",
      notes: input.notes ?? null,
      offer_file_url,
      offer_file_path,
      created_by: auth.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Offer;
}

export async function setOfferAcceptance(id: string, acceptance: OfferAcceptance, acceptanceFile?: File | null) {
  let patch: Record<string, unknown> = {
    acceptance,
    accepted_at: acceptance === "accepted" ? new Date().toISOString() : null,
  };
  if (acceptanceFile) {
    const { data: offer } = await supabase.from("application_offers").select("application_id").eq("id", id).single();
    const appId = (offer as any)?.application_id ?? "unknown";
    const path = `${appId}/acceptance-${Date.now()}-${acceptanceFile.name.replace(/[^\w.\-]/g, "_")}`;
    const up = await supabase.storage.from("application-documents").upload(path, acceptanceFile);
    if (up.error) throw up.error;
    const { data: signed } = await supabase.storage
      .from("application-documents")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    patch.acceptance_file_url = signed?.signedUrl ?? null;
    patch.acceptance_file_path = path;
  }
  const { error } = await supabase.from("application_offers").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteOffer(id: string) {
  const { error } = await supabase.from("application_offers").delete().eq("id", id);
  if (error) throw error;
}
