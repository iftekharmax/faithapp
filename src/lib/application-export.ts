import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { APPLICATION_STATUS_LABELS, type Application } from "./applications";

export function exportApplicationPDF(app: Application, filename?: string): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const RED: [number, number, number] = [166, 25, 46];
  const NAVY: [number, number, number] = [30, 42, 74];
  const GRAY_BG: [number, number, number] = [248, 250, 252];
  const TEXT_DARK: [number, number, number] = [30, 41, 59];
  const TEXT_MUTED: [number, number, number] = [100, 116, 139];

  const MX = 40;
  const contentW = pageW - MX * 2;

  // Header — Brand Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...NAVY);
  doc.text("FAITH OVERSEAS LTD.", MX, 48);

  doc.setFontSize(8);
  doc.setTextColor(...RED);
  doc.text("STUDENTS' NO.1 CHOICE · APPLICATION MANAGEMENT SYSTEM", MX, 60);

  // Right Header: Application Code Badge
  const rx = pageW - MX;
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("APPLICATION REFERENCE", rx, 44, { align: "right" });
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text(app.application_code || "APP-REF", rx, 60, { align: "right" });

  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1.5);
  doc.line(MX, 72, pageW - MX, 72);

  // Application Overview Box
  doc.setFillColor(...GRAY_BG);
  doc.roundedRect(MX, 82, contentW, 60, 6, 6, "F");

  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("PROGRAM", MX + 14, 98);
  doc.text("UNIVERSITY", MX + 14, 124);

  doc.setFontSize(11);
  doc.setTextColor(...TEXT_DARK);
  doc.text(app.program || "—", MX + 85, 98);
  doc.text(app.university || "—", MX + 85, 124);

  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("CURRENT STATUS", rx - 14, 98, { align: "right" });
  doc.setFontSize(11);
  doc.setTextColor(...RED);
  doc.text(APPLICATION_STATUS_LABELS[app.status] || app.status, rx - 14, 114, { align: "right" });

  // 1. Student Details Table
  let currentY = 156;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("1. Student Information", MX, currentY);

  autoTable(doc, {
    startY: currentY + 8,
    margin: { left: MX, right: MX },
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 5, textColor: TEXT_DARK },
    body: [
      ["Full Name", app.student?.full_name || "—", "Student Code", app.student?.student_code || "—"],
      ["Email", app.student?.email || "—", "Country", app.country || "—"],
    ],
  });

  // 2. Program & Institution Details Table
  currentY = (doc as any).lastAutoTable.finalY + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("2. Program & Admission Details", MX, currentY);

  autoTable(doc, {
    startY: currentY + 8,
    margin: { left: MX, right: MX },
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 5, textColor: TEXT_DARK },
    body: [
      ["University", app.university || "—", "Campus", app.campus || "—"],
      ["Program", app.program || "—", "Degree", app.degree || "—"],
      ["Intake", app.intake || "—", "Scholarship", app.scholarship || "—"],
    ],
  });

  // 3. Financial Fees Table
  currentY = (doc as any).lastAutoTable.finalY + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("3. Fee Schedule & Summary", MX, currentY);

  const totalFee =
    (Number(app.application_fee) || 0) +
    (Number(app.registration_fee) || 0) +
    (Number(app.emgs_fee) || 0) +
    (Number(app.others_fee) || 0);

  autoTable(doc, {
    startY: currentY + 8,
    margin: { left: MX, right: MX },
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 5, textColor: TEXT_DARK },
    body: [
      ["Application Fee", app.application_fee != null ? String(app.application_fee) : "—", "Registration Fee", app.registration_fee != null ? String(app.registration_fee) : "—"],
      ["EMGS Fee", app.emgs_fee != null ? String(app.emgs_fee) : "—", "Others Fee", app.others_fee != null ? String(app.others_fee) : "—"],
      ["Total Estimated Fees", `${totalFee.toLocaleString()}`, "Payment Status", totalFee > 0 ? "Pending / See Workflow" : "None"],
    ],
  });

  // 4. Workflow & Staff Assignment Table
  currentY = (doc as any).lastAutoTable.finalY + 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("4. Workflow & Management", MX, currentY);

  const assignedName = app.assigned_team?.full_name || app.assigned_team?.email || "Unassigned";

  autoTable(doc, {
    startY: currentY + 8,
    margin: { left: MX, right: MX },
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 5, textColor: TEXT_DARK },
    body: [
      ["Application Status", APPLICATION_STATUS_LABELS[app.status] || app.status, "Assigned Team", assignedName],
      ["Submission Date", app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : "—", "Decision Date", app.decision_at ? new Date(app.decision_at).toLocaleDateString() : "—"],
      ["Notes / Remarks", { content: app.notes || "No notes recorded.", colSpan: 3 }],
    ],
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MUTED);
  doc.text(
    `Generated on ${new Date().toLocaleString()} · Faith AMS Application Document`,
    MX,
    pageH - 30
  );
  doc.text(`Page 1 of 1`, rx, pageH - 30, { align: "right" });

  const finalName = filename || `${app.application_code || "application"}-summary.pdf`;
  doc.save(finalName);
}
