import type { TransactionRecord } from "@/react-app/hooks/use-transaction-sheet";
import { numberToInputCurrency, parseCurrencyToNumber, todayISO } from "@/react-app/lib/format";

// Mesmos campos do formulário antigo (Registro.tsx) — nada foi adicionado nem removido.
export interface TransactionFormValues {
  date: string;
  type: "REVENUE" | "EXPENSE";
  amount: string; // mascarado: "1.234,56"
  home_id: string;
  category_id: string;
  employee_id: string;
  company_id: string;
  payment_method: string;
  status: "PENDING" | "PAID" | "CANCELED";
  description: string;
  notes: string;
  due_date: string;
  payment_date: string;
}

export const LAST_HOME_KEY = "finanpop_last_home_id";

export const emptyForm = (): TransactionFormValues => ({
  date: todayISO(),
  type: "EXPENSE",
  amount: "",
  home_id: "",
  category_id: "",
  employee_id: "",
  company_id: "",
  payment_method: "",
  status: "PENDING",
  description: "",
  notes: "",
  due_date: "",
  payment_date: "",
});

/** Edição usa os valores do registro; duplicar reseta data/status/pagamento (regra antiga). */
export const fromRecord = (t: TransactionRecord, opts: { duplicate?: boolean } = {}): TransactionFormValues => ({
  date: opts.duplicate ? todayISO() : t.date,
  type: t.type,
  amount: numberToInputCurrency(t.amount),
  home_id: String(t.home_id),
  category_id: String(t.category_id),
  employee_id: t.employee_id != null ? String(t.employee_id) : "",
  company_id: t.company_id != null ? String(t.company_id) : "",
  payment_method: t.payment_method,
  status: opts.duplicate ? "PENDING" : t.status,
  description: t.description || "",
  notes: t.notes || "",
  due_date: t.due_date || "",
  payment_date: opts.duplicate ? "" : t.payment_date || "",
});

export const toPayload = (f: TransactionFormValues, amount: number) => ({
  date: f.date,
  type: f.type,
  amount,
  home_id: parseInt(f.home_id),
  category_id: parseInt(f.category_id),
  employee_id: f.employee_id ? parseInt(f.employee_id) : null,
  company_id: f.company_id ? parseInt(f.company_id) : null,
  payment_method: f.payment_method,
  status: f.status,
  description: f.description || null,
  notes: f.notes || null,
  due_date: f.due_date || null,
  payment_date: f.payment_date || null,
});

export function validateForm(
  f: TransactionFormValues,
  opts: { requireCardType: boolean; cardType: string }
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!f.date) errors.date = "Data é obrigatória";
  const amount = parseCurrencyToNumber(f.amount);
  if (!f.amount || !Number.isFinite(amount) || amount <= 0) errors.amount = "Valor deve ser maior que zero";
  if (!f.home_id) errors.home_id = "Selecione um centro de custo";
  if (!f.category_id) errors.category_id = "Selecione uma categoria";
  if (!f.payment_method) errors.payment_method = "Selecione uma forma de pagamento";
  if (opts.requireCardType && f.payment_method === "CARD" && !opts.cardType) errors.cardType = "Selecione Débito ou Crédito";
  return errors;
}

export const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);
