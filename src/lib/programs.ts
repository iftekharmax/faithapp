import { supabase } from "./supabase";

export interface ProgramRow {
  id: string;
  name: string;
  degree: string | null;
  duration: string | null;
  intake: string | null;
  application_deadline: string | null;
  tuition_fee: number | null;
  currency: string | null;
  scholarship: string | null;
  requirements: string | null;
  description: string | null;
  status: string;
  university: { id: string; name: string; country_id: string | null; city: string | null } | null;
  campus: { id: string; name: string } | null;
  created_at?: string;
}

export interface ProgramFilters {
  q?: string;
  country_id?: string;
  university_id?: string;
  campus_id?: string;
  intake?: string[];
  min_fee?: number;
  max_fee?: number;
  scholarship_only?: boolean;
  duration?: string;
  degree?: string[];
}

export async function listPrograms(f: ProgramFilters = {}): Promise<ProgramRow[]> {
  let q = supabase
    .from("university_programs")
    .select("id, name, degree, duration, intake, application_deadline, tuition_fee, currency, scholarship, requirements, description, status, created_at, university:universities(id, name, country_id, city), campus:campuses(id, name)")
    .eq("status", "active")
    .order("name");
  if (f.q) q = q.ilike("name", `%${f.q}%`);
  if (f.university_id) q = q.eq("university_id", f.university_id);
  if (f.campus_id) q = q.eq("campus_id", f.campus_id);
  if (f.intake && f.intake.length > 0) q = q.in("intake", f.intake);
  if (typeof f.min_fee === "number") q = q.gte("tuition_fee", f.min_fee);
  if (typeof f.max_fee === "number") q = q.lte("tuition_fee", f.max_fee);
  if (f.scholarship_only) q = q.not("scholarship", "is", null);
  if (f.duration) q = q.ilike("duration", `%${f.duration}%`);
  if (f.degree && f.degree.length > 0) q = q.in("degree", f.degree);
  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as unknown as ProgramRow[];
  if (f.country_id) rows = rows.filter((r) => r.university?.country_id === f.country_id);
  return rows;
}

export async function listCountriesLite() {
  // Retry without flag_url if the column is missing from the schema cache,
  // so the UI keeps working before the flag_url migration is applied.
  let { data, error } = await supabase.from("countries").select("id, name, flag_url").order("name");
  if (error && /flag_url/i.test(String(error.message ?? ""))) {
    const fallback = await supabase.from("countries").select("id, name").order("name");
    if (fallback.error) throw fallback.error;
    return (fallback.data ?? []).map((c: any) => ({ ...c, flag_url: null }));
  }
  if (error) throw error;
  return data ?? [];
}


export async function listUniversitiesLite() {
  const { data, error } = await supabase.from("universities").select("id, name, country_id").order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listIntakes() {
  const { data, error } = await supabase.from("intakes").select("id, name, year").order("sort_order");
  if (error) return [];
  return data ?? [];
}
