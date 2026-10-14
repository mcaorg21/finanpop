import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import type { ExportRow } from "@/react-app/lib/export";
import { formatCurrency, formatDate } from "@/react-app/lib/format";
import { statusLabel, typeLabel } from "@/react-app/lib/labels";

const ROWS_PER_PAGE = 38;
const MAX_ROWS = 1000;

// Colunas da tabela em texto (mm a partir da margem esquerda). Largura útil A4: 190mm.
const COLS: { header: string; x: number; width: number; align?: "right"; value: (r: ExportRow) => string }[] = [
  { header: "Data", x: 0, width: 18, value: (r) => formatDate(r.date, { year: "2-digit" }) },
  { header: "Venc.", x: 18, width: 18, value: (r) => (r.due_date ? formatDate(r.due_date, { year: "2-digit" }) : "—") },
  { header: "Tipo", x: 36, width: 16, value: (r) => typeLabel(r.type) },
  { header: "Categoria", x: 52, width: 44, value: (r) => r.category_name ?? "" },
  { header: "Descrição", x: 96, width: 48, value: (r) => r.description ?? "" },
  { header: "Status", x: 144, width: 18, value: (r) => statusLabel(r.status) },
  { header: "Valor", x: 162, width: 28, align: "right", value: (r) => `${r.type === "REVENUE" ? "+" : "-"} ${formatCurrency(r.amount)}` },
];

const fitText = (pdf: jsPDF, text: string, maxWidth: number): string => {
  if (pdf.getTextWidth(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && pdf.getTextWidth(t + "…") > maxWidth) t = t.slice(0, -1);
  return t + "…";
};

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * PDF do relatório: cabeçalho com período e filtros em texto, imagem dos KPIs + gráficos
 * e, em seguida, páginas de tabela em texto (legível e pesquisável, ao contrário da captura).
 */
export async function exportReportPdf({
  captureEl,
  filterLines,
  summaryLine,
  rows,
  filename,
}: {
  captureEl: HTMLElement;
  filterLines: string[];
  summaryLine: string;
  rows: ExportRow[];
  filename: string;
}) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const logo = await loadImage(`${import.meta.env.BASE_URL}logo-secgo.png`);
  if (logo) {
    const w = 26;
    const h = (logo.height / logo.width) * w;
    pdf.addImage(logo, "PNG", margin, y, w, h);
    y += h + 4;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.text("Relatório financeiro", margin, y + 4);
  y += 10;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(90);
  for (const line of filterLines) {
    pdf.text(fitText(pdf, line, contentWidth), margin, y);
    y += 4.5;
  }
  pdf.text(summaryLine, margin, y);
  y += 4.5;
  pdf.setTextColor(0);
  y += 2;

  const canvas = await html2canvas(captureEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
  const imgHeight = (canvas.height / canvas.width) * contentWidth;
  const available = pageHeight - y - margin;
  if (imgHeight <= available) {
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, y, contentWidth, imgHeight);
  } else {
    const scale = available / imgHeight;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, y, contentWidth * scale, available);
  }

  const limited = rows.slice(0, MAX_ROWS);
  const drawHeader = (top: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setFillColor(243, 244, 246);
    pdf.rect(margin, top - 4, contentWidth, 6, "F");
    for (const c of COLS) {
      const x = margin + c.x + (c.align === "right" ? c.width - 1 : 1);
      pdf.text(c.header, x, top, { align: c.align ?? "left" });
    }
    pdf.setFont("helvetica", "normal");
  };

  if (limited.length > 0) {
    let rowIndex = 0;
    let pageNo = 0;
    while (rowIndex < limited.length) {
      pdf.addPage();
      pageNo++;
      let top = margin + 4;
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(`Lançamentos (${limited.length}${rows.length > MAX_ROWS ? ` de ${rows.length}` : ""})`, margin, top);
      top += 7;
      drawHeader(top);
      top += 6;
      pdf.setFontSize(8);
      const slice = limited.slice(rowIndex, rowIndex + ROWS_PER_PAGE);
      slice.forEach((r, i) => {
        if (i % 2 === 1) {
          pdf.setFillColor(250, 250, 250);
          pdf.rect(margin, top - 3.6, contentWidth, 5.2, "F");
        }
        for (const c of COLS) {
          const x = margin + c.x + (c.align === "right" ? c.width - 1 : 1);
          pdf.text(fitText(pdf, c.value(r), c.width - 2), x, top, { align: c.align ?? "left" });
        }
        top += 5.2;
      });
      rowIndex += slice.length;
      pdf.setFontSize(7);
      pdf.setTextColor(120);
      pdf.text(`Página ${pageNo + 1}`, pageWidth - margin, pageHeight - 5, { align: "right" });
      pdf.setTextColor(0);
    }
    if (rows.length > MAX_ROWS) {
      pdf.setFontSize(8);
      pdf.text(`Exibindo os primeiros ${MAX_ROWS} lançamentos. Use Excel/CSV para a lista completa.`, margin, pageHeight - 10);
    }
  }

  pdf.save(filename);
}
