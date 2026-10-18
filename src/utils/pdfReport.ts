import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DailyReportData } from '../types';
import { getColomboDateString, getColomboTimeString } from './time';

/**
 * Generates and downloads a clean, publication-grade PDF report
 * for Classroom 1 Daily Attendance & In-Out tracking.
 */
export function generateDailyReportPDF(report: DailyReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Top Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // University & Venue Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('CLASSROOM 1 — DETAILED IN/OUT ATTENDANCE REPORT', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text('University Academic Access Portal · Mandatory Google Verified Audit Trail', 14, 18);
  doc.text(`Timezone: Asia/Colombo (Sri Lanka) · Generated: ${getColomboDateString()} ${getColomboTimeString()}`, 14, 23);

  // Status Badge / Date Box on top right
  doc.setFillColor(30, 58, 138); // blue-900
  doc.roundedRect(pageWidth - 52, 6, 42, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(191, 219, 254);
  doc.text('REPORT DATE', pageWidth - 31, 11, { align: 'center' });
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(report.date, pageWidth - 31, 18, { align: 'center' });

  // 2. Summary KPI Cards
  const cardY = 33;
  const cardWidth = (pageWidth - 28 - 12) / 5; // 5 cards
  const cardHeight = 16;

  const kpis = [
    { label: 'UNIQUE STUDENTS', val: String(report.totalUniqueStudents), color: [30, 41, 59] },
    { label: 'TOTAL ENTRIES', val: String(report.totalEntries), color: [4, 120, 87] }, // emerald-700
    { label: 'TOTAL EXITS', val: String(report.totalExits), color: [29, 78, 216] }, // blue-700
    { label: 'CURRENTLY INSIDE', val: String(report.currentlyInside), color: [126, 34, 206] }, // purple-700
    { label: 'STILL INSIDE', val: String(report.enteredNotExited), color: [180, 83, 9] }, // amber-700
  ];

  kpis.forEach((kpi, idx) => {
    const cardX = 14 + idx * (cardWidth + 3);
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.3);
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(kpi.label, cardX + cardWidth / 2, cardY + 5.5, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2]);
    doc.text(kpi.val, cardX + cardWidth / 2, cardY + 12.5, { align: 'center' });
  });

  // 3. Detailed Sessions Table
  const tableData = report.sessions.map((ses, idx) => [
    String(idx + 1),
    ses.indexNumber || '—',
    ses.studentName || '—',
    ses.googleEmail || '—',
    ses.entryTime || '—',
    ses.exitTime || 'Not recorded',
    ses.status === 'INSIDE' ? 'INSIDE' : 'COMPLETED',
  ]);

  if (tableData.length === 0) {
    tableData.push(['—', '—', 'No sessions recorded for this date', '—', '—', '—', '—']);
  }

  autoTable(doc, {
    startY: 53,
    head: [['#', 'Index Number', 'Student Name', 'Google Account Email', 'Entry Time', 'Exit Time', 'Status']],
    body: tableData,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      valign: 'middle',
    },
    headStyles: {
      fillColor: [30, 58, 138], // blue-900
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 24, fontStyle: 'bold', textColor: [30, 58, 138] },
      2: { cellWidth: 42, fontStyle: 'bold' },
      3: { cellWidth: 50, textColor: [71, 85, 105], fontSize: 7.5 },
      4: { cellWidth: 20, textColor: [4, 120, 87] },
      5: { cellWidth: 20, textColor: [29, 78, 216] },
      6: { cellWidth: 18, halign: 'center' },
    },
    didDrawCell: (data) => {
      // Custom colored pill badge for Status column
      if (data.section === 'body' && data.column.index === 6 && data.cell.text[0]) {
        const text = data.cell.text[0];
        if (text === 'INSIDE') {
          doc.setFillColor(254, 243, 199); // amber-100
          doc.setTextColor(146, 64, 14); // amber-800
        } else if (text === 'COMPLETED') {
          doc.setFillColor(241, 245, 249); // slate-100
          doc.setTextColor(51, 65, 85); // slate-700
        }
      }
    },
    didDrawPage: (data) => {
      // Running Page Footer
      const str = `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`;
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        'Classroom 1 Entry & Exit System · University Academic Access Control · Official Audit Record',
        14,
        pageHeight - 8
      );
      doc.text(str, pageWidth - 14, pageHeight - 8, { align: 'right' });
    },
    margin: { left: 14, right: 14, bottom: 14 },
  });

  // 4. Save and trigger browser download
  const filename = `Classroom1_In_Out_Report_${report.date}.pdf`;
  doc.save(filename);
}
