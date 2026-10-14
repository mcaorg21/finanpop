import type { Category, Company, Employee, Home } from "@/react-app/hooks/use-reference-data";
import { addDays, currentMonth, formatDate, monthRange, shiftMonth, todayISO } from "@/react-app/lib/format";
import { dateFieldLabels, isDateField, statusLabel, typeLabel, type DateField } from "@/react-app/lib/labels";

// Um único construtor de parâmetros para relatório, tabela e exports: antes cada export
// montava os seus (e mandava "all" para o servidor, que respondia 500 em silêncio).

export type ReportPreset = "this_month" | "last_month" | "3_months" | "this_year" | "custom";

export const PRESETS: { value: ReportPreset; label: string }[] = [
  { value: "this_month", label: "Este mês" },
  { value: "last_month", label: "Mês passado" },
  { value: "3_months", label: "3 meses" },
  { value: "this_year", label: "Este ano" },
  { value: "custom", label: "Personalizado" },
];

export const isPreset = (v: unknown): v is ReportPreset =>
  typeof v === "string" && PRESETS.some((p) => p.value === v);

export interface ReportFilterState {
  preset: ReportPreset;
  dateField: DateField;
  start: string;
  end: string;
  homeIds: string[];
  categoryIds: string[];
  employeeId: string;
  companyId: string;
  type: string;
  status: string;
}

export const presetRange = (preset: Exclude<ReportPreset, "custom">): { start: string; end: string } => {
  const month = currentMonth();
  switch (preset) {
    case "this_month":
      return monthRange(month);
    case "last_month":
      return monthRange(shiftMonth(month, -1));
    case "3_months":
      return { start: monthRange(shiftMonth(month, -2)).start, end: monthRange(month).end };
    case "this_year":
      return { start: `${month.slice(0, 4)}-01-01`, end: `${month.slice(0, 4)}-12-31` };
  }
};

const DATE_KEYS: Record<DateField, [string, string]> = {
  date: ["start_date", "end_date"],
  due_date: ["due_date_start", "due_date_end"],
  payment_date: ["payment_date_start", "payment_date_end"],
};

/** Parâmetros comuns (período + dimensões). Nunca envia valores vazios nem "all". */
export function buildReportParams(f: ReportFilterState): URLSearchParams {
  const p = new URLSearchParams();
  const [startKey, endKey] = DATE_KEYS[f.dateField];
  p.set("date_field", f.dateField);
  if (f.start) p.set(startKey, f.start);
  if (f.end) p.set(endKey, f.end);
  f.homeIds.forEach((id) => p.append("home_ids[]", id));
  f.categoryIds.forEach((id) => p.append("category_ids[]", id));
  if (f.employeeId) p.set("employee_id", f.employeeId);
  if (f.companyId) p.set("company_id", f.companyId);
  if (f.type) p.set("type", f.type);
  if (f.status) p.set("status", f.status);
  return p;
}

export const DATE_FIELD_KEY = "finanpop_report_date_field";

export function readFiltersFromSearch(sp: URLSearchParams): ReportFilterState {
  const preset = isPreset(sp.get("preset")) ? (sp.get("preset") as ReportPreset) : "3_months";
  const fromUrl = sp.get("date_field");
  const saved = localStorage.getItem(DATE_FIELD_KEY);
  const dateField: DateField = isDateField(fromUrl) ? fromUrl : isDateField(saved) ? saved : "due_date";
  const range = preset === "custom"
    ? { start: sp.get("start") ?? addDays(todayISO(), -90), end: sp.get("end") ?? todayISO() }
    : presetRange(preset);
  return {
    preset,
    dateField,
    start: range.start,
    end: range.end,
    homeIds: sp.getAll("home_ids"),
    categoryIds: sp.getAll("category_ids"),
    employeeId: sp.get("employee_id") ?? "",
    companyId: sp.get("company_id") ?? "",
    type: sp.get("type") ?? "",
    status: sp.get("status") ?? "",
  };
}

export const hasDimensionFilters = (f: ReportFilterState): boolean =>
  f.homeIds.length > 0 || f.categoryIds.length > 0 || !!f.employeeId || !!f.companyId || !!f.type || !!f.status;

export interface ReferenceLists {
  homes: Home[];
  categories: Category[];
  employees: Employee[];
  companies: Company[];
}

/** Linhas de texto descrevendo os filtros (cabeçalho do PDF e resumo na tela). */
export function describeFilters(f: ReportFilterState, refs: ReferenceLists, selectedCategoryName?: string | null): string[] {
  const lines: string[] = [];
  lines.push(`Período (${dateFieldLabels[f.dateField].toLowerCase()}): ${formatDate(f.start)} a ${formatDate(f.end)}`);
  const names = (ids: string[], list: { id: number; name: string }[]) =>
    ids.map((id) => list.find((x) => String(x.id) === id)?.name ?? id).join(", ");
  if (f.homeIds.length) lines.push(`Centros de custo: ${names(f.homeIds, refs.homes)}`);
  if (f.categoryIds.length) lines.push(`Categorias: ${names(f.categoryIds, refs.categories)}`);
  if (selectedCategoryName) lines.push(`Categoria selecionada: ${selectedCategoryName}`);
  if (f.employeeId) lines.push(`Funcionário: ${names([f.employeeId], refs.employees)}`);
  if (f.companyId) lines.push(`Empresa: ${names([f.companyId], refs.companies)}`);
  if (f.type) lines.push(`Tipo: ${typeLabel(f.type)}`);
  if (f.status) lines.push(`Status: ${statusLabel(f.status)}`);
  return lines;
}
