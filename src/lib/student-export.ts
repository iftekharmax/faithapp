import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  STUDENT_STATUS_LABELS, GENDER_LABELS, type Student,
} from "./students";

// Full field set for CSV — includes passport + English test details.
const CSV_COLUMNS: { key: string; label: string; get: (s: Student) => string }[] = [
  { key: "student_code", label: "Student ID", get: (s) => s.student_code },
  { key: "full_name", label: "Full name", get: (s) => s.full_name },
  { key: "email", label: "Email", get: (s) => s.email ?? "" },
  { key: "phone", label: "Phone", get: (s) => s.phone ?? "" },
  { key: "date_of_birth", label: "Date of birth", get: (s) => s.date_of_birth ?? "" },
  { key: "gender", label: "Gender", get: (s) => s.gender ? GENDER_LABELS[s.gender] : "" },
  { key: "nationality", label: "Nationality", get: (s) => s.nationality ?? "" },
  { key: "passport_no", label: "Passport no.", get: (s) => s.passport_no ?? "" },
  { key: "passport_expiry", label: "Passport expiry", get: (s) => s.passport_expiry ?? "" },
  { key: "test_scores", label: "Test scores", get: (s) => (s.test_scores ?? []).map((t) => `${t.test} ${t.score}`).join("; ") },
  { key: "guardian_name", label: "Guardian", get: (s) => s.guardian_name ?? "" },
  { key: "guardian_phone", label: "Guardian phone", get: (s) => s.guardian_phone ?? "" },
  { key: "emergency_contact_name", label: "Emergency contact", get: (s) => s.emergency_contact_name ?? "" },
  { key: "emergency_contact_phone", label: "Emergency phone", get: (s) => s.emergency_contact_phone ?? "" },
  { key: "current_address", label: "Current address", get: (s) => s.current_address ?? "" },
  { key: "permanent_address", label: "Permanent address", get: (s) => s.permanent_address ?? "" },
  { key: "status", label: "Status", get: (s) => STUDENT_STATUS_LABELS[s.status] },
  { key: "created_at", label: "Created", get: (s) => new Date(s.created_at).toISOString() },
];

const csvCell = (v: string) => {
  const needs = /[",\n\r]/.test(v);
  const escaped = v.replace(/"/g, '""');
  return needs ? `"${escaped}"` : escaped;
};

export function exportStudentsCSV(students: Student[], filename = "students.csv"): void {
  const header = CSV_COLUMNS.map((c) => csvCell(c.label)).join(",");
  const rows = students.map((s) => CSV_COLUMNS.map((c) => csvCell(c.get(s))).join(","));
  const blob = new Blob(["\ufeff" + [header, ...rows].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, filename);
}

// Compact set for PDF (landscape A4)
const PDF_COLUMNS: { header: string; get: (s: Student) => string }[] = [
  { header: "ID", get: (s) => s.student_code },
  { header: "Name", get: (s) => s.full_name },
  { header: "Email", get: (s) => s.email ?? "" },
  { header: "Phone", get: (s) => s.phone ?? "" },
  { header: "Nationality", get: (s) => s.nationality ?? "" },
  { header: "Passport", get: (s) => s.passport_no ?? "" },
  { header: "Expiry", get: (s) => s.passport_expiry ?? "" },
  { header: "Tests", get: (s) => {
    const primary = (s.test_scores ?? [])[0];
    return primary ? `${primary.test} ${primary.score}` : "";
  }},
  { header: "Status", get: (s) => STUDENT_STATUS_LABELS[s.status] },
];

export function exportStudentsPDF(students: Student[], filename = "students.pdf"): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const now = new Date().toLocaleString();
  doc.setFontSize(14);
  doc.text("Faith AMS — Students", 40, 40);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Generated ${now} · ${students.length} record${students.length === 1 ? "" : "s"}`, 40, 56);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 72,
    head: [PDF_COLUMNS.map((c) => c.header)],
    body: students.map((s) => PDF_COLUMNS.map((c) => c.get(s))),
    styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    margin: { left: 40, right: 40 },
  });

  doc.save(filename);
}

// Diagnostic report returned by exportSingleStudentPDF so callers can tell the
// user exactly which sections were blank and what fallback text was used.
export interface PdfExportReport {
  filename: string;
  missing: { field: string; fallback: string }[];
  totalFields: number;
}

// Faith Overseas Ltd — branded student registration form
export function exportSingleStudentPDF(s: Student, filename?: string): PdfExportReport {
  const missing: { field: string; fallback: string }[] = [];
  const BLANK = "(left blank in PDF)";
  const track = (field: string, value: unknown, fallback = BLANK) => {
    const isEmpty =
      value == null ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0);
    if (isEmpty) missing.push({ field, fallback });
  };

  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();


  const RED: [number, number, number] = [166, 25, 46];
  const NAVY: [number, number, number] = [30, 42, 74];
  const FIELD: [number, number, number] = [213, 216, 220];
  const TEXT_MUTED: [number, number, number] = [110, 110, 120];

  const MX = 36;
  const contentW = pageW - MX * 2;

  // Header — left tagline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("STUDY ABROAD IS", MX, 44);
  doc.setFontSize(16);
  doc.setTextColor(...RED);
  doc.text("NO MORE A", MX, 62);
  doc.text("DREAM", MX, 80);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1);
  doc.line(MX + 78, 58, MX + 118, 58);

  // Center brand
  const cx = pageW / 2;
  doc.setFillColor(...NAVY);
  doc.triangle(cx - 20, 46, cx + 20, 46, cx, 32, "F");
  doc.rect(cx - 16, 46, 32, 5, "F");
  doc.setFontSize(22);
  doc.setTextColor(...NAVY);
  doc.text("FAITH", cx, 74, { align: "center" });
  doc.setFontSize(8);
  doc.setTextColor(...RED);
  doc.text("OVERSEAS LTD.", cx, 86, { align: "center" });

  // Right callout
  const rx = pageW - MX;
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("STUDENTS'", rx, 44, { align: "right" });
  doc.setFontSize(20);
  doc.setTextColor(...RED);
  doc.text("NO.1", rx, 64, { align: "right" });
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("CHOICE", rx, 80, { align: "right" });
  doc.setDrawColor(...NAVY);
  doc.line(rx - 58, 68, rx - 42, 68);

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  const title = "STUDENT REGISTRATION FORM";
  doc.text(title, cx, 118, { align: "center" });
  const tw = doc.getTextWidth(title);
  doc.setLineWidth(0.8);
  doc.line(cx - tw / 2, 122, cx + tw / 2, 122);

  // Counselor / Date
  let y = 146;
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("COUNSELOR NAME:", MX, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("—", MX + 120, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("DATE :", rx - 110, y);
  doc.setTextColor(...RED);
  doc.text(new Date(s.created_at).toLocaleDateString("en-GB").replace(/\//g, " - "), rx, y, { align: "right" });

  const sectionHeader = (label: string, color: [number, number, number]) => {
    y += 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...color);
    doc.text(label, MX, y);
    y += 6;
  };

  const labelValueRow = (label: string, value: string, labelColor: [number, number, number]) => {
    const rowH = 20;
    const labelW = 140;
    doc.setFillColor(...labelColor);
    doc.rect(MX, y, labelW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text(label, MX + 10, y + 13);
    doc.setFillColor(...FIELD);
    doc.rect(MX + labelW + 2, y, contentW - labelW - 2, rowH, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(value || "", MX + labelW + 12, y + 13);
    y += rowH + 3;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 80) { doc.addPage(); y = 60; }
  };

  sectionHeader("STUDENT PARTICULARS", RED);
  track("Full name", s.full_name);
  labelValueRow("STUDENT NAME", s.full_name, NAVY);
  track("Gender", s.gender);
  labelValueRow("GENDER", s.gender ? GENDER_LABELS[s.gender] : "", NAVY);
  track("Email address", s.email);
  labelValueRow("EMAIL ADDRESS", s.email ?? "", NAVY);
  track("Date of birth", s.date_of_birth);
  labelValueRow("DATE OF BIRTH", s.date_of_birth ?? "", NAVY);
  track("Mobile number", s.phone);
  labelValueRow("MOBILE NO.", s.phone ?? "", NAVY);
  y += 6;
  track("Guardian's name", s.guardian_name);
  labelValueRow("GUARDIAN'S NAME", s.guardian_name ?? "", NAVY);
  track("Guardian's number", s.guardian_phone);
  labelValueRow("GUARDIAN'S NO.", s.guardian_phone ?? "", NAVY);
  y += 6;


  ensureSpace(80);
  {
    const rowH = 64;
    const labelW = 140;
    doc.setFillColor(...RED);
    doc.rect(MX, y, labelW, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text("ADDRESS", MX + 10, y + 20);
    doc.setFillColor(...FIELD);
    doc.rect(MX + labelW + 2, y, contentW - labelW - 2, rowH, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    const addr = [s.current_address, s.permanent_address].filter(Boolean).join("\n");
    track("Current address", s.current_address);
    track("Permanent address", s.permanent_address);
    doc.text(doc.splitTextToSize(addr || "", contentW - labelW - 24), MX + labelW + 12, y + 16);
    y += rowH + 10;
  }

  track("Bachelor's & Master's rows", s.academic_history, "Empty rows shown");
  track("Preferred universities", s.preferred_universities, "Empty rows shown");
  track("Language proficiency scores", s.test_scores, "All test rows blank");



  ensureSpace(90);
  sectionHeader("EDUCATIONAL BACKGROUND", RED);
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("SECONDARY & HIGHER SECONDARY", MX, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    head: [["LEVEL OF EDUCATION", "BOARD/GROUP", "YEAR OF GRADUATION", "GRADES/CGPA"]],
    body: [["O LEVEL/SSC/DAKHIL", "", "", ""], ["A2 LEVEL/HSC/ALIM", "", "", ""]],
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6, textColor: [30, 30, 30], lineColor: [255, 255, 255], lineWidth: 1, minCellHeight: 22 },
    headStyles: { fillColor: NAVY, textColor: 255, halign: "center", fontStyle: "bold" },
    bodyStyles: { fillColor: FIELD },
    columnStyles: { 0: { fillColor: NAVY, textColor: 255, fontStyle: "bold", halign: "center" } },
    margin: { left: MX, right: MX },
  });
  y = (doc as any).lastAutoTable.finalY + 14;

  ensureSpace(90);
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("BACHELOR'S & MASTER'S", MX, y);
  y += 8;

  const bmRows = (s.academic_history || []).slice(0, 4).map((a) => [
    a.institution || "", a.qualification || "", "", a.grade || "", a.year || "",
  ]);
  while (bmRows.length < 2) bmRows.push(["", "", "", "", ""]);

  autoTable(doc, {
    startY: y,
    head: [["UNIVERSITY", "DEGREE", "PROGRAM/SUBJECT", "CGPA/DIVISION/CLASS", "YEAR OF GRADUATION"]],
    body: bmRows,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 6, textColor: [30, 30, 30], lineColor: [255, 255, 255], lineWidth: 1, minCellHeight: 22 },
    headStyles: { fillColor: RED, textColor: 255, halign: "center", fontStyle: "bold" },
    bodyStyles: { fillColor: FIELD },
    margin: { left: MX, right: MX },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  ensureSpace(120);
  sectionHeader("LIST OF PREFERRED UNIVERSITIES", RED);
  const prefRows = (s.preferred_universities ?? []).slice(0, 5).map((p) => [
    p.country || "", p.university || "", p.course || "",
  ]);
  while (prefRows.length < 5) prefRows.push(["", "", ""]);
  autoTable(doc, {
    startY: y,
    head: [["DESIRED COUNTRY", "DESIRED UNIVERSITY", "DESIRED COURSE/SUBJECT"]],
    body: prefRows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6, lineColor: [255, 255, 255], lineWidth: 1, minCellHeight: 20 },
    headStyles: { fillColor: NAVY, textColor: 255, halign: "center", fontStyle: "bold" },
    bodyStyles: { fillColor: FIELD },
    margin: { left: MX, right: MX },
  });
  y = (doc as any).lastAutoTable.finalY + 16;

  ensureSpace(160);
  sectionHeader("LANGUAGE & OTHER PROFICIENCY SCORES", RED);
  const tests = ["IELTS", "UKVI", "PTE", "DUOLINGO", "SAT", "ACT"];
  const scoreMap = new Map<string, string>();
  for (const t of s.test_scores ?? []) {
    if (t?.test) scoreMap.set(String(t.test).toUpperCase(), t.score ?? "");
  }
  const testRows = tests.map((t) => [t, scoreMap.get(t) ?? ""]);

  autoTable(doc, {
    startY: y,
    head: [["TEST", "SCORE"]],
    body: testRows,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 6, lineColor: [255, 255, 255], lineWidth: 1, minCellHeight: 18 },
    headStyles: { fillColor: RED, textColor: 255, halign: "center", fontStyle: "bold" },
    columnStyles: {
      0: { fillColor: RED, textColor: 255, fontStyle: "bold", halign: "center", cellWidth: contentW * 0.4 },
      1: { fillColor: FIELD, textColor: [30, 30, 30] },
    },
    margin: { left: MX, right: MX },
  });
  y = (doc as any).lastAutoTable.finalY + 20;

  // Footer
  const footerY = pageH - 46;
  doc.setFillColor(...NAVY);
  doc.rect(0, footerY, pageW, 46, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("House: 14 (Ground & 2nd Floor), Road: 09", MX, footerY + 18);
  doc.text("Sector: 04, Uttara, Dhaka-1230", MX, footerY + 32);
  doc.text("www.faithoverseas.com", pageW * 0.4, footerY + 18);
  doc.text("info@faithoverseas.com", pageW * 0.4, footerY + 32);
  doc.setFont("helvetica", "bold");
  doc.text("Regional Offices", pageW * 0.68, footerY + 18);
  doc.setFont("helvetica", "normal");
  doc.text("Khulna | Chattogram | Sylhet | Barishal", pageW * 0.68, footerY + 32);
  doc.setFont("helvetica", "bold");
  doc.text("/faithoverseasltd", pageW - MX, footerY + 32, { align: "right" });

  const finalName = filename || `student-${s.student_code}.pdf`;
  doc.save(finalName);
  return { filename: finalName, missing, totalFields: 13 };
}



function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
