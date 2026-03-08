import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function createPdf(title: string, from: string, to: string): jsPDF {
  const doc = new jsPDF();
  const now = new Date();
  const dateStr = `${now.toLocaleDateString('uz-UZ')} ${now.toLocaleTimeString('uz-UZ')}`;

  // Header
  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.text('BAREL.uz', 14, 14);
  doc.setFontSize(10);
  doc.text(title, 14, 22);
  doc.text(`Sana oralig'i: ${from} — ${to}`, 210 - 14, 14, { align: 'right' });
  doc.text(`PDF olingan: ${dateStr}`, 210 - 14, 22, { align: 'right' });

  doc.setTextColor(0, 0, 0);
  return doc;
}

export function addTable(doc: jsPDF, head: string[][], body: (string | number)[][], startY: number): number {
  autoTable(doc, {
    head,
    body,
    startY,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY;
}

export function addSummaryRow(doc: jsPDF, label: string, value: string, startY: number): number {
  autoTable(doc, {
    body: [[label, value]],
    startY,
    theme: 'plain',
    styles: { fontSize: 11, fontStyle: 'bold', cellPadding: 4 },
    columnStyles: { 0: { halign: 'left' }, 1: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY;
}

export function addFooter(doc: jsPDF) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`BAREL.uz — Sahifa ${i}/${pages}`, 105, 290, { align: 'center' });
  }
}

export function downloadPdf(doc: jsPDF, filename: string) {
  addFooter(doc);
  doc.save(filename);
}

export function formatNum(n: number): string {
  return n.toLocaleString('uz-UZ');
}
