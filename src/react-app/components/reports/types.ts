// Formato de resposta de GET /api/reports (servidor já devolve números, não strings).

export interface ReportTotals {
  receitas: number;
  despesas: number;
  saldo: number;
  realizado: number;
  receitas_pagas: number;
  receitas_pendentes: number;
  despesas_pagas: number;
  despesas_pendentes: number;
  atrasados: number;
  atrasados_total: number;
  lancamentos: number;
  cancelados: number;
}

export interface EvolutionPoint {
  /** YYYY-MM */
  date: string;
  receitas: number;
  despesas: number;
  receitas_pagas: number;
  receitas_pendentes: number;
  despesas_pagas: number;
  despesas_pendentes: number;
}

export interface CategoryTotal {
  type: "REVENUE" | "EXPENSE";
  category_id: number;
  name: string;
  parent_id: number | null;
  parent_name: string | null;
  value: number;
}

export interface PaymentMethodTotal {
  type: "REVENUE" | "EXPENSE";
  payment_method: string;
  value: number;
}

export interface ReportData {
  date_field: "date" | "due_date" | "payment_date";
  totals: ReportTotals;
  evolution: EvolutionPoint[];
  byCategory: CategoryTotal[];
  byPaymentMethod: PaymentMethodTotal[];
}

export const emptyTotals: ReportTotals = {
  receitas: 0, despesas: 0, saldo: 0, realizado: 0,
  receitas_pagas: 0, receitas_pendentes: 0, despesas_pagas: 0, despesas_pendentes: 0,
  atrasados: 0, atrasados_total: 0, lancamentos: 0, cancelados: 0,
};
