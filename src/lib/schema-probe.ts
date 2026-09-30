import { supabase } from "./supabase";

// Columns the current codebase expects on public.students, paired with the
// migration file that introduces them. The admin schema page uses this list to
// probe the live DB and surface an exact list of missing columns plus copy-
// paste migration commands.
export interface ExpectedColumn {
  column: string;
  migration: string;
  description: string;
}

export interface ColumnStatus extends ExpectedColumn {
  present: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface SchemaReport {
  table: string;
  checkedAt: string;
  columns: ColumnStatus[];
  missing: ColumnStatus[];
  ok: boolean;
}

export const STUDENTS_EXPECTED_COLUMNS: ExpectedColumn[] = [
  { column: "preferred_universities", migration: "20260752000000_student_pdf_fields.sql", description: "Desired country / university / course rows (JSONB array)." },
  { column: "test_scores",            migration: "20260752000000_student_pdf_fields.sql", description: "IELTS / UKVI / PTE / DUOLINGO / SAT / ACT scores (JSONB array)." },
  { column: "academic_history",       migration: "20260720000000_students.sql",            description: "Bachelor's & Master's academic entries (JSONB array)." },
  { column: "passport_no",            migration: "20260720000000_students.sql",            description: "Passport number." },
  { column: "passport_expiry",        migration: "20260720000000_students.sql",            description: "Passport expiry date." },
  { column: "guardian_name",          migration: "20260720000000_students.sql",            description: "Guardian full name." },
  { column: "guardian_phone",         migration: "20260720000000_students.sql",            description: "Guardian phone number." },
  { column: "current_address",        migration: "20260720000000_students.sql",            description: "Current mailing address." },
  { column: "permanent_address",      migration: "20260720000000_students.sql",            description: "Permanent home address." },
];

function looksMissing(error: any): boolean {
  const code = String(error?.code ?? "");
  const msg = String(error?.message ?? "");
  return (
    code === "42703" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    /Could not find the '.*' column/i.test(msg) ||
    /column .* does not exist/i.test(msg)
  );
}

export async function probeStudentSchema(): Promise<SchemaReport> {
  const results: ColumnStatus[] = await Promise.all(
    STUDENTS_EXPECTED_COLUMNS.map(async (c) => {
      try {
        const { error } = await supabase.from("students").select(c.column).limit(1);
        if (!error) return { ...c, present: true };
        if (looksMissing(error)) {
          return {
            ...c,
            present: false,
            errorCode: (error as any).code,
            errorMessage: error.message,
          };
        }
        // Any other error (RLS, network) — treat as unknown, mark present so
        // we don't spam false alarms. Bubble the message for context.
        return {
          ...c,
          present: true,
          errorCode: (error as any).code,
          errorMessage: error.message,
        };
      } catch (e: any) {
        return { ...c, present: true, errorMessage: e?.message ?? String(e) };
      }
    }),
  );
  const missing = results.filter((r) => !r.present);
  return {
    table: "public.students",
    checkedAt: new Date().toISOString(),
    columns: results,
    missing,
    ok: missing.length === 0,
  };
}
