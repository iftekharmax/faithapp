import { supabase } from "./supabase";

export type UniStatus = "active" | "inactive" | "archived";
export const UNI_STATUSES: UniStatus[] = ["active", "inactive", "archived"];

/** Thrown when creating an entity whose natural key already exists. */
export class DuplicateError extends Error {
  entity: "university" | "campus" | "faculty" | "program";
  existingId: string;
  entityName: string;
  constructor(entity: DuplicateError["entity"], name: string, existingId: string) {
    super(`A ${entity} named "${name}" already exists`);
    this.entity = entity;
    this.existingId = existingId;
    this.entityName = name;
    this.name = "DuplicateError";
  }
}

function isUniqueViolation(e: any): boolean {
  return e && (e.code === "23505" || /duplicate key|unique constraint/i.test(String(e.message ?? "")));
}

async function findDuplicateId(
  table: "universities" | "campuses" | "faculties" | "university_programs",
  name: string,
  scope: Record<string, string | null> = {},
): Promise<string | null> {
  let q = supabase.from(table).select("id, name").ilike("name", name.trim());
  for (const [k, v] of Object.entries(scope)) {
    q = v == null ? q.is(k, null) : q.eq(k, v);
  }
  const { data, error } = await q.limit(1);
  if (error) return null;
  const row = (data ?? [])[0];
  return row?.id ?? null;
}

export type Country = {
  id: string;
  name: string;
  flag_url: string | null;
  status: UniStatus;
  created_at: string;
  updated_at: string;
};

export type University = {
  id: string;
  country_id: string | null;
  name: string;
  short_name: string | null;
  website: string | null;
  logo_url: string | null;
  description: string | null;
  city: string | null;
  status: UniStatus;
  created_at: string;
  updated_at: string;
  country?: Country | null;
  program_count?: number;
  application_count?: number;
};

export type Campus = {
  id: string;
  university_id: string;
  name: string;
  city: string | null;
  address: string | null;
  is_main: boolean;
  status: UniStatus;
  created_at: string;
  updated_at: string;
};

export type Faculty = {
  id: string;
  university_id: string;
  name: string;
  status: UniStatus;
  created_at: string;
  updated_at: string;
};

export type UniversityProgram = {
  id: string;
  university_id: string;
  campus_id: string | null;
  faculty_id: string | null;
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
  status: UniStatus;
  created_at: string;
  updated_at: string;
  campus?: Campus | null;
  faculty?: Faculty | null;
};

// ============ COUNTRIES ============
function isMissingFlagUrl(err: any): boolean {
  const msg = String(err?.message ?? "");
  return /flag_url/i.test(msg) && /(column|schema cache|does not exist|could not find)/i.test(msg);
}

export async function listCountries(): Promise<Country[]> {
  const { data, error } = await supabase.from("countries").select("*").order("name");
  if (error) throw error;
  // Ensure flag_url is always present (null) so UI can rely on the field.
  return (data ?? []).map((c: any) => ({ flag_url: null, ...c })) as Country[];
}

export async function createCountry(input: Partial<Country>) {
  let { data, error } = await supabase.from("countries").insert(input).select().single();
  if (error && isMissingFlagUrl(error)) {
    const { flag_url: _drop, ...rest } = input as any;
    ({ data, error } = await supabase.from("countries").insert(rest).select().single());
  }
  if (error) throw error;
  return { flag_url: null, ...(data as any) } as Country;
}

export async function updateCountry(id: string, input: Partial<Country>) {
  let { data, error } = await supabase.from("countries").update(input).eq("id", id).select().single();
  if (error && isMissingFlagUrl(error)) {
    const { flag_url: _drop, ...rest } = input as any;
    ({ data, error } = await supabase.from("countries").update(rest).eq("id", id).select().single());
  }
  if (error) throw error;
  return { flag_url: null, ...(data as any) } as Country;
}


export async function deleteCountry(id: string) {
  const { error } = await supabase.from("countries").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadCountryFlag(countryKey: string, file: File): Promise<string> {
  // Client-side pre-checks (server enforces the same via bucket file_size_limit + allowed_mime_types).
  const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed.");
  if (allowed.length && !allowed.includes(file.type)) {
    throw new Error(`Unsupported image type "${file.type}". Use PNG, JPG, WebP, SVG, or GIF.`);
  }
  if (file.size > 2 * 1024 * 1024) throw new Error("Flag must be under 2MB");

  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const safe = countryKey.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || "flag";
  const path = `${safe}/flag-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("country-flags")
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) {
    const raw = String(error.message ?? "");
    if (/bucket not found/i.test(raw)) {
      throw new Error("Storage bucket 'country-flags' is missing. Ask an admin to run the latest migrations.");
    }
    if (/payload too large|exceeded the maximum|file size/i.test(raw)) {
      throw new Error("Server rejected the file: it exceeds the 2 MB limit.");
    }
    if (/mime type|not allowed|invalid_mime/i.test(raw)) {
      throw new Error("Server rejected the file type. Use PNG, JPG, WebP, SVG, or GIF.");
    }
    if (/row-level security|not authorized|permission/i.test(raw)) {
      throw new Error("You don't have permission to upload flags. Admin role required.");
    }
    throw new Error(raw || "Upload failed.");
  }
  const { data } = supabase.storage.from("country-flags").getPublicUrl(path);
  return data.publicUrl;
}


// ============ UNIVERSITIES ============
export async function listUniversities(opts: { search?: string; countryId?: string; status?: UniStatus } = {}): Promise<University[]> {
  let q = supabase
    .from("universities")
    .select("*, country:countries(*)")
    .order("name");
  if (opts.search) q = q.ilike("name", `%${opts.search}%`);
  if (opts.countryId) q = q.eq("country_id", opts.countryId);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as University[];
  // enrich with counts
  const ids = rows.map((r) => r.id);
  if (ids.length) {
    const [{ data: progs }, { data: apps }] = await Promise.all([
      supabase.from("university_programs").select("university_id").in("university_id", ids),
      supabase.from("applications").select("university_id").in("university_id", ids),
    ]);
    const pCount: Record<string, number> = {};
    const aCount: Record<string, number> = {};
    (progs ?? []).forEach((p: any) => { pCount[p.university_id] = (pCount[p.university_id] ?? 0) + 1; });
    (apps ?? []).forEach((a: any) => { if (a.university_id) aCount[a.university_id] = (aCount[a.university_id] ?? 0) + 1; });
    rows.forEach((r) => { r.program_count = pCount[r.id] ?? 0; r.application_count = aCount[r.id] ?? 0; });
  }
  return rows;
}

export async function getUniversity(id: string): Promise<University> {
  const { data, error } = await supabase
    .from("universities")
    .select("*, country:countries(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as University;
}

export async function createUniversity(input: Partial<University>) {
  if (input.name) {
    const dup = await findDuplicateId("universities", input.name);
    if (dup) throw new DuplicateError("university", input.name, dup);
  }
  const { data, error } = await supabase.from("universities").insert(input).select().single();
  if (error) {
    if (isUniqueViolation(error) && input.name) {
      const dup = await findDuplicateId("universities", input.name);
      if (dup) throw new DuplicateError("university", input.name, dup);
    }
    throw error;
  }
  return data as University;
}

export async function updateUniversity(id: string, input: Partial<University>) {
  const { data, error } = await supabase.from("universities").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as University;
}

export async function deleteUniversity(id: string) {
  const { error } = await supabase.from("universities").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadUniversityLogo(universityId: string, file: File): Promise<string> {
  if (file.size > 2 * 1024 * 1024) throw new Error("Logo must be under 2MB");
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${universityId}/logo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("university-logos").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from("university-logos").getPublicUrl(path);
  return data.publicUrl;
}

// ============ CAMPUSES ============
export async function listCampuses(universityId: string): Promise<Campus[]> {
  const { data, error } = await supabase.from("campuses").select("*").eq("university_id", universityId).order("name");
  if (error) throw error;
  return data as Campus[];
}
export async function createCampus(input: Partial<Campus>) {
  if (input.name && input.university_id) {
    const dup = await findDuplicateId("campuses", input.name, { university_id: input.university_id });
    if (dup) throw new DuplicateError("campus", input.name, dup);
  }
  const { data, error } = await supabase.from("campuses").insert(input).select().single();
  if (error) {
    if (isUniqueViolation(error) && input.name && input.university_id) {
      const dup = await findDuplicateId("campuses", input.name, { university_id: input.university_id });
      if (dup) throw new DuplicateError("campus", input.name, dup);
    }
    throw error;
  }
  return data as Campus;
}
export async function updateCampus(id: string, input: Partial<Campus>) {
  const { data, error } = await supabase.from("campuses").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Campus;
}
export async function deleteCampus(id: string) {
  const { error } = await supabase.from("campuses").delete().eq("id", id);
  if (error) throw error;
}

// ============ FACULTIES ============
export async function listFaculties(universityId: string): Promise<Faculty[]> {
  const { data, error } = await supabase.from("faculties").select("*").eq("university_id", universityId).order("name");
  if (error) throw error;
  return data as Faculty[];
}
export async function createFaculty(input: Partial<Faculty>) {
  if (input.name && input.university_id) {
    const dup = await findDuplicateId("faculties", input.name, { university_id: input.university_id });
    if (dup) throw new DuplicateError("faculty", input.name, dup);
  }
  const { data, error } = await supabase.from("faculties").insert(input).select().single();
  if (error) {
    if (isUniqueViolation(error) && input.name && input.university_id) {
      const dup = await findDuplicateId("faculties", input.name, { university_id: input.university_id });
      if (dup) throw new DuplicateError("faculty", input.name, dup);
    }
    throw error;
  }
  return data as Faculty;
}
export async function updateFaculty(id: string, input: Partial<Faculty>) {
  const { data, error } = await supabase.from("faculties").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as Faculty;
}
export async function deleteFaculty(id: string) {
  const { error } = await supabase.from("faculties").delete().eq("id", id);
  if (error) throw error;
}

// ============ PROGRAMS ============
export async function listPrograms(opts: {
  universityId?: string; search?: string; degree?: string; status?: UniStatus;
} = {}): Promise<UniversityProgram[]> {
  let q = supabase
    .from("university_programs")
    .select("*, campus:campuses(*), faculty:faculties(*)")
    .order("name");
  if (opts.universityId) q = q.eq("university_id", opts.universityId);
  if (opts.search) q = q.ilike("name", `%${opts.search}%`);
  if (opts.degree) q = q.eq("degree", opts.degree);
  if (opts.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as UniversityProgram[];
}
export async function createProgram(input: Partial<UniversityProgram>) {
  if (input.name && input.university_id) {
    const scope: Record<string, string | null> = {
      university_id: input.university_id,
      campus_id: input.campus_id ?? null,
    };
    const dup = await findDuplicateId("university_programs", input.name, scope);
    if (dup) throw new DuplicateError("program", input.name, dup);
  }
  const { data, error } = await supabase.from("university_programs").insert(input).select().single();
  if (error) {
    if (isUniqueViolation(error) && input.name && input.university_id) {
      const dup = await findDuplicateId("university_programs", input.name, {
        university_id: input.university_id, campus_id: input.campus_id ?? null,
      });
      if (dup) throw new DuplicateError("program", input.name, dup);
    }
    throw error;
  }
  return data as UniversityProgram;
}
export async function updateProgram(id: string, input: Partial<UniversityProgram>) {
  const { data, error } = await supabase.from("university_programs").update(input).eq("id", id).select().single();
  if (error) throw error;
  return data as UniversityProgram;
}
export async function deleteProgram(id: string) {
  const { error } = await supabase.from("university_programs").delete().eq("id", id);
  if (error) throw error;
}
