// CSV helpers for Universities, Countries, Campuses, Faculties, Programs.
// Supports preview (dry-run), row-level validation, and upsert on import.

import {
  listUniversities, listCountries, listCampuses, listPrograms,
  createUniversity, updateUniversity, createCountry,
  createCampus, updateCampus,
  createProgram, updateProgram,
  type University, type Country, type Campus, type UniversityProgram,
  type UniStatus, UNI_STATUSES,
} from "./universities";

export type CsvRow = Record<string, string>;

export type ImportKind = "universities" | "campuses" | "programs";
export type PlanAction = "create" | "update" | "skip" | "error";

export type PlanRow = {
  rowNumber: number;                 // CSV row number (2 = first data row after header)
  raw: CsvRow;                       // parsed CSV row
  action: PlanAction;
  message?: string;                  // reason for skip/error, or "will update existing"
  existingId?: string;               // populated for update/skip
  displayName: string;               // primary label to show in preview
  payload?: Record<string, unknown>; // resolved DB payload (for create/update)
};

export type ImportPlan = {
  kind: ImportKind;
  headers: string[];
  knownHeaders: string[];
  unmappedHeaders: string[];
  requiredMissing: string[];
  rows: PlanRow[];
  summary: { create: number; update: number; skip: number; error: number };
};

export type ImportOptions = { dryRun?: boolean; upsert?: boolean };
export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
  dryRun: boolean;
};

// ---------- core parse/serialize ----------
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let i = 0;
  let inQ = false;
  while (i < text.length) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQ = false; i++; continue;
      }
      field += c; i++; continue;
    }
    if (c === '"') { inQ = true; i++; continue; }
    if (c === ",") { cur.push(field); field = ""; i++; continue; }
    if (c === "\r") { i++; continue; }
    if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; i++; continue; }
    field += c; i++;
  }
  if (field.length || cur.length) { cur.push(field); rows.push(cur); }
  if (!rows.length) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const data = rows.slice(1)
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const o: CsvRow = {};
      headers.forEach((h, idx) => { o[h] = (r[idx] ?? "").trim(); });
      return o;
    });
  return { headers, rows: data };
}

function escape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(headers: string[], rows: Record<string, unknown>[]): string {
  const lines = [headers.map(escape).join(",")];
  for (const r of rows) lines.push(headers.map((h) => escape(r[h])).join(","));
  return lines.join("\n");
}
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// ---------- validation helpers ----------
function normStatus(v: string | undefined, fallback: UniStatus = "active"): UniStatus {
  const s = (v ?? "").toLowerCase();
  return (UNI_STATUSES as string[]).includes(s) ? (s as UniStatus) : fallback;
}
function truthy(v: string | undefined) {
  return /^(1|true|yes|y|main)$/i.test((v ?? "").trim());
}
export function validUrl(v: string | undefined): boolean {
  if (!v) return true;
  try { new URL(v); return true; } catch { return false; }
}

// ---------- known field mappings ----------
export const KNOWN_HEADERS: Record<ImportKind, string[]> = {
  universities: ["name","short_name","country","city","website","logo_url","status","description"],
  campuses:     ["university","name","city","address","is_main","status"],
  programs:     ["university","name","degree","duration","campus","intake","application_deadline","tuition_fee","currency","scholarship","requirements","description","status"],
};

// ---------- EXPORTS (unchanged shapes) ----------
export async function exportUniversitiesCsv() {
  const [uni, countries] = await Promise.all([listUniversities(), listCountries()]);
  const cById = new Map(countries.map((c) => [c.id, c.name] as const));
  const rows = uni.map((u) => ({
    name: u.name, short_name: u.short_name ?? "", country: u.country_id ? cById.get(u.country_id) ?? "" : "",
    city: u.city ?? "", website: u.website ?? "", logo_url: u.logo_url ?? "",
    status: u.status, description: u.description ?? "",
  }));
  downloadCsv("universities.csv", toCsv(KNOWN_HEADERS.universities, rows));
}
export async function exportCountriesCsv() {
  const list = await listCountries();
  downloadCsv("countries.csv", toCsv(
    ["name","flag_url","status"],
    list.map((c) => ({ name: c.name, flag_url: c.flag_url ?? "", status: c.status })),
  ));
}
export async function exportCampusesCsv(universityId?: string, universityName?: string) {
  if (universityId) {
    const list = await listCampuses(universityId);
    downloadCsv(`campuses-${(universityName ?? "university").toLowerCase().replace(/\s+/g,"-")}.csv`, toCsv(
      ["name","city","address","is_main","status"],
      list.map((c) => ({ name: c.name, city: c.city ?? "", address: c.address ?? "", is_main: c.is_main ? "true":"false", status: c.status })),
    ));
    return;
  }
  const uni = await listUniversities();
  const rows: Record<string, unknown>[] = [];
  for (const u of uni) {
    const cs = await listCampuses(u.id);
    for (const c of cs) rows.push({ university: u.name, name: c.name, city: c.city ?? "", address: c.address ?? "", is_main: c.is_main ? "true":"false", status: c.status });
  }
  downloadCsv("campuses.csv", toCsv(KNOWN_HEADERS.campuses, rows));
}
export async function exportProgramsCsv(universityId?: string, universityName?: string) {
  if (universityId) {
    const [progs, camps] = await Promise.all([
      listPrograms({ universityId }), listCampuses(universityId),
    ]);
    const cById = new Map(camps.map((c) => [c.id, c.name] as const));
    downloadCsv(`programs-${(universityName ?? "university").toLowerCase().replace(/\s+/g,"-")}.csv`, toCsv(
      ["name","degree","duration","campus","intake","application_deadline","tuition_fee","currency","scholarship","requirements","description","status"],
      progs.map((p) => ({
        name: p.name, degree: p.degree ?? "", duration: p.duration ?? "",
        campus: p.campus_id ? cById.get(p.campus_id) ?? "" : "",
        
        intake: p.intake ?? "", application_deadline: p.application_deadline ?? "",
        tuition_fee: p.tuition_fee ?? "", currency: p.currency ?? "",
        scholarship: p.scholarship ?? "", requirements: p.requirements ?? "",
        description: p.description ?? "", status: p.status,
      })),
    ));
    return;
  }
  const [uni, allProgs] = await Promise.all([listUniversities(), listPrograms()]);
  const uById = new Map(uni.map((u) => [u.id, u.name] as const));
  downloadCsv("programs.csv", toCsv(
    ["university","name","degree","duration","campus","intake","application_deadline","tuition_fee","currency","scholarship","status"],
    allProgs.map((p) => ({
      university: uById.get(p.university_id) ?? "",
      name: p.name, degree: p.degree ?? "", duration: p.duration ?? "",
      campus: p.campus?.name ?? "",
      intake: p.intake ?? "", application_deadline: p.application_deadline ?? "",
      tuition_fee: p.tuition_fee ?? "", currency: p.currency ?? "",
      scholarship: p.scholarship ?? "", status: p.status,
    })),
  ));
}

// ============ PREVIEW HELPERS ============
function summarize(rows: PlanRow[]): ImportPlan["summary"] {
  const s = { create: 0, update: 0, skip: 0, error: 0 };
  for (const r of rows) s[r.action]++;
  return s;
}
function baseHeaderInfo(kind: ImportKind, headers: string[]) {
  const known = KNOWN_HEADERS[kind];
  const knownHeaders = headers.filter((h) => known.includes(h));
  const unmappedHeaders = headers.filter((h) => !known.includes(h));
  const requiredMissing = headers.includes("name") ? [] : ["name"];
  return { knownHeaders, unmappedHeaders, requiredMissing };
}

// ============ UNIVERSITIES ============
export async function previewUniversitiesCsv(text: string): Promise<ImportPlan> {
  const { headers, rows: data } = parseCsv(text);
  const info = baseHeaderInfo("universities", headers);
  const [existing, countries] = await Promise.all([listUniversities(), listCountries()]);
  const byName = new Map(existing.map((u) => [u.name.toLowerCase(), u] as const));
  const countryByName = new Map(countries.map((c) => [c.name.toLowerCase(), c] as const));
  const planRows: PlanRow[] = data.map((r, i) => {
    const rowNumber = i + 2;
    const name = (r.name ?? "").trim();
    const displayName = name || "(no name)";
    if (!name) return { rowNumber, raw: r, action: "error", message: "name is required", displayName };
    if (r.website && !validUrl(r.website))
      return { rowNumber, raw: r, action: "error", message: "invalid website URL", displayName };
    const cn = (r.country ?? "").trim();
    const countryMatch = cn ? countryByName.get(cn.toLowerCase()) : undefined;
    const payload = {
      name, short_name: r.short_name || null,
      country: cn || null, country_id: countryMatch?.id ?? null,
      city: r.city || null, website: r.website || null, logo_url: r.logo_url || null,
      status: normStatus(r.status), description: r.description || null,
    };
    const dup = byName.get(name.toLowerCase());
    if (dup) return {
      rowNumber, raw: r, action: "update", existingId: dup.id, displayName,
      message: cn && !countryMatch ? `country "${cn}" will be created` : undefined, payload,
    };
    return {
      rowNumber, raw: r, action: "create", displayName,
      message: cn && !countryMatch ? `country "${cn}" will be created` : undefined, payload,
    };
  });
  return { kind: "universities", headers, ...info, rows: planRows, summary: summarize(planRows) };
}

async function executeUniversitiesPlan(plan: ImportPlan, opts: ImportOptions): Promise<ImportResult> {
  const res: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [], dryRun: !!opts.dryRun };
  const countries = await listCountries();
  const countryByName = new Map(countries.map((c) => [c.name.toLowerCase(), c] as const));
  for (const r of plan.rows) {
    if (r.action === "error") { res.errors.push({ row: r.rowNumber, message: r.message ?? "invalid" }); continue; }
    if (r.action === "update" && !opts.upsert) { res.skipped++; continue; }
    if (opts.dryRun) { if (r.action === "create") res.created++; else if (r.action === "update") res.updated++; continue; }
    try {
      const p: any = { ...(r.payload ?? {}) };
      const cn: string | null = p.country ?? null; delete p.country;
      if (cn && !p.country_id) {
        const found = countryByName.get(cn.toLowerCase());
        if (found) p.country_id = found.id;
        else { const c = await createCountry({ name: cn, status: "active" }); countryByName.set(cn.toLowerCase(), c); p.country_id = c.id; }
      }
      if (r.action === "update" && r.existingId) { await updateUniversity(r.existingId, p as Partial<University>); res.updated++; }
      else { await createUniversity(p as Partial<University>); res.created++; }
    } catch (e: any) {
      res.errors.push({ row: r.rowNumber, message: e?.message ?? String(e) });
    }
  }
  return res;
}

// ============ CAMPUSES ============
async function resolveUniversityId(uni: University[], name: string): Promise<string | null> {
  const found = uni.find((u) => u.name.toLowerCase() === name.toLowerCase());
  return found?.id ?? null;
}

export async function previewCampusesCsv(text: string, universityId?: string): Promise<ImportPlan> {
  const { headers, rows: data } = parseCsv(text);
  const info = baseHeaderInfo("campuses", headers);
  const uni = universityId ? [] : await listUniversities();
  const cache = new Map<string, Campus[]>();
  const planRows: PlanRow[] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i]; const rowNumber = i + 2;
    const name = (r.name ?? "").trim();
    const displayName = name || "(no name)";
    if (!name) { planRows.push({ rowNumber, raw: r, action: "error", message: "name is required", displayName }); continue; }
    let uid = universityId;
    if (!uid) {
      const un = (r.university ?? "").trim();
      if (!un) { planRows.push({ rowNumber, raw: r, action: "error", message: "university column is required", displayName }); continue; }
      const found = await resolveUniversityId(uni, un);
      if (!found) { planRows.push({ rowNumber, raw: r, action: "error", message: `university not found: ${un}`, displayName }); continue; }
      uid = found;
    }
    if (!cache.has(uid)) cache.set(uid, await listCampuses(uid));
    const existing = cache.get(uid)!.find((c) => c.name.toLowerCase() === name.toLowerCase());
    const payload = { university_id: uid, name, city: r.city || null, address: r.address || null, is_main: truthy(r.is_main), status: normStatus(r.status) };
    if (existing) planRows.push({ rowNumber, raw: r, action: "update", existingId: existing.id, displayName, payload });
    else planRows.push({ rowNumber, raw: r, action: "create", displayName, payload });
  }
  return { kind: "campuses", headers, ...info, rows: planRows, summary: summarize(planRows) };
}

async function executeCampusesPlan(plan: ImportPlan, opts: ImportOptions): Promise<ImportResult> {
  const res: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [], dryRun: !!opts.dryRun };
  for (const r of plan.rows) {
    if (r.action === "error") { res.errors.push({ row: r.rowNumber, message: r.message ?? "invalid" }); continue; }
    if (r.action === "update" && !opts.upsert) { res.skipped++; continue; }
    if (opts.dryRun) { if (r.action === "create") res.created++; else if (r.action === "update") res.updated++; continue; }
    try {
      if (r.action === "update" && r.existingId) { await updateCampus(r.existingId, r.payload as Partial<Campus>); res.updated++; }
      else { await createCampus(r.payload as Partial<Campus>); res.created++; }
    } catch (e: any) { res.errors.push({ row: r.rowNumber, message: e?.message ?? String(e) }); }
  }
  return res;
}

// ============ PROGRAMS ============
export async function previewProgramsCsv(text: string, universityId?: string): Promise<ImportPlan> {
  const { headers, rows: data } = parseCsv(text);
  const info = baseHeaderInfo("programs", headers);
  const uni = universityId ? [] : await listUniversities();
  const campCache = new Map<string, Campus[]>();
  const progCache = new Map<string, UniversityProgram[]>();
  const planRows: PlanRow[] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i]; const rowNumber = i + 2;
    const name = (r.name ?? "").trim();
    const displayName = name || "(no name)";
    if (!name) { planRows.push({ rowNumber, raw: r, action: "error", message: "name is required", displayName }); continue; }
    let uid = universityId;
    if (!uid) {
      const un = (r.university ?? "").trim();
      if (!un) { planRows.push({ rowNumber, raw: r, action: "error", message: "university column is required", displayName }); continue; }
      const found = await resolveUniversityId(uni, un);
      if (!found) { planRows.push({ rowNumber, raw: r, action: "error", message: `university not found: ${un}`, displayName }); continue; }
      uid = found;
    }
    if (!campCache.has(uid)) campCache.set(uid, await listCampuses(uid));
    
    if (!progCache.has(uid)) progCache.set(uid, await listPrograms({ universityId: uid }));
    const camps = campCache.get(uid)!; const progs = progCache.get(uid)!;
    let campus_id: string | null = null;
    if (r.campus) {
      const c = camps.find((x) => x.name.toLowerCase() === r.campus.toLowerCase());
      if (!c) { planRows.push({ rowNumber, raw: r, action: "error", message: `campus not found: ${r.campus}`, displayName }); continue; }
      campus_id = c.id;
    }
    let tuition: number | null = null;
    if (r.tuition_fee && r.tuition_fee.trim() !== "") {
      const n = Number(r.tuition_fee);
      if (!Number.isFinite(n) || n < 0) {
        planRows.push({ rowNumber, raw: r, action: "error", message: "tuition_fee must be a positive number", displayName }); continue;
      }
      tuition = n;
    }
    if (r.application_deadline && Number.isNaN(new Date(r.application_deadline).getTime())) {
      planRows.push({ rowNumber, raw: r, action: "error", message: "invalid application_deadline (use YYYY-MM-DD)", displayName }); continue;
    }
    const payload = {
      university_id: uid, name,
      degree: r.degree || null, duration: r.duration || null,
      campus_id,
      intake: r.intake || null,
      application_deadline: r.application_deadline || null,
      tuition_fee: tuition,
      currency: r.currency || "USD",
      scholarship: r.scholarship || null,
      requirements: r.requirements || null,
      description: r.description || null,
      status: normStatus(r.status),
    };
    const existing = progs.find((p) => p.name.toLowerCase() === name.toLowerCase() && (p.campus_id ?? null) === campus_id);
    if (existing) planRows.push({ rowNumber, raw: r, action: "update", existingId: existing.id, displayName, payload });
    else planRows.push({ rowNumber, raw: r, action: "create", displayName, payload });
  }
  return { kind: "programs", headers, ...info, rows: planRows, summary: summarize(planRows) };
}

async function executeProgramsPlan(plan: ImportPlan, opts: ImportOptions): Promise<ImportResult> {
  const res: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [], dryRun: !!opts.dryRun };
  for (const r of plan.rows) {
    if (r.action === "error") { res.errors.push({ row: r.rowNumber, message: r.message ?? "invalid" }); continue; }
    if (r.action === "update" && !opts.upsert) { res.skipped++; continue; }
    if (opts.dryRun) { if (r.action === "create") res.created++; else if (r.action === "update") res.updated++; continue; }
    try {
      if (r.action === "update" && r.existingId) { await updateProgram(r.existingId, r.payload as Partial<UniversityProgram>); res.updated++; }
      else { await createProgram(r.payload as Partial<UniversityProgram>); res.created++; }
    } catch (e: any) { res.errors.push({ row: r.rowNumber, message: e?.message ?? String(e) }); }
  }
  return res;
}

// ============ dispatch ============
export async function executeImportPlan(plan: ImportPlan, opts: ImportOptions): Promise<ImportResult> {
  switch (plan.kind) {
    case "universities": return executeUniversitiesPlan(plan, opts);
    case "campuses":     return executeCampusesPlan(plan, opts);
    case "programs":     return executeProgramsPlan(plan, opts);
  }
}
