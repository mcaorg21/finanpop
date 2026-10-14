import { formatDate } from "@/react-app/lib/format";
import { paymentMethodLabel, statusLabel, typeLabel } from "@/react-app/lib/labels";

export interface ExportRow {
  date: string;
  due_date: string | null;
  payment_date: string | null;
  type: string;
  category_name?: string | null;
  home_name?: string | null;
  employee_name?: string | null;
  company_name?: string | null;
  amount: number | string;
  status: string;
  payment_method: string | null;
  description?: string | null;
}

const COLUMNS: { header: string; value: (r: ExportRow) => string }[] = [
  { header: "Data", value: (r) => formatDate(r.date) },
  { header: "Vencimento", value: (r) => (r.due_date ? formatDate(r.due_date) : "") },
  { header: "Pagamento", value: (r) => (r.payment_date ? formatDate(r.payment_date) : "") },
  { header: "Tipo", value: (r) => typeLabel(r.type) },
  { header: "Categoria", value: (r) => r.category_name ?? "" },
  { header: "Centro de Custo", value: (r) => r.home_name ?? "" },
  { header: "Funcionário", value: (r) => r.employee_name ?? "" },
  { header: "Empresa", value: (r) => r.company_name ?? "" },
  { header: "Valor", value: (r) => Number(r.amount).toFixed(2).replace(".", ",") },
  { header: "Status", value: (r) => statusLabel(r.status) },
  { header: "Forma Pagamento", value: (r) => paymentMethodLabel(r.payment_method) },
  { header: "Descrição", value: (r) => r.description ?? "" },
];

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/** Exporta linhas em .xls (tabela HTML lida pelo Excel) ou .csv (UTF-8 com BOM). */
export function exportRows(rows: ExportRow[], format: "xls" | "csv", filenameBase: string) {
  if (format === "xls") {
    const head = COLUMNS.map((c) => `<th>${escapeHtml(c.header)}</th>`).join("");
    const body = rows
      .map((r) => `<tr>${COLUMNS.map((c) => `<td>${escapeHtml(c.value(r))}</td>`).join("")}</tr>`)
      .join("");
    const html = `<html><head><meta charset="utf-8"></head><body><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></body></html>`;
    download(new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" }), `${filenameBase}.xls`);
    return;
  }

  const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    COLUMNS.map((c) => quote(c.header)).join(","),
    ...rows.map((r) => COLUMNS.map((c) => quote(c.value(r))).join(",")),
  ];
  download(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), `${filenameBase}.csv`);
}
