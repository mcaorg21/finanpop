// Consultas financeiras reutilizáveis (assistente do WhatsApp). Mesmas regras de GET /api/stats e GET /api/reports
// (index.ts), mas com filtro simples em vez do contexto HTTP e com "hoje" explícito (America/Sao_Paulo) no lugar de
// CURRENT_DATE. Nomes de coluna vêm de listas fixas; valores sempre entram como parâmetros.
import pool from "../db.js";

export type DateField = "date" | "due_date" | "payment_date";
const DATE_FIELDS: DateField[] = ["date", "due_date", "payment_date"];

export interface ReportFilter {
  tenantId: number;
  /** Intervalo (inclusive) aplicado ao campo `dateField`. */
  start: string;
  end: string;
  /** "hoje" em São Paulo, usado para decidir o que está atrasado. */
  today: string;
  dateField?: DateField;
  type?: "EXPENSE" | "REVENUE" | null;
  /** OVERDUE = pendente com vencimento antes de hoje. */
  status?: "PAID" | "PENDING" | "OVERDUE" | null;
  categoryIds?: number[];
  homeIds?: number[];
  paymentMethod?: string | null;
  /** Busca livre em descrição, observações, categoria, fornecedor, funcionário e centro de custo. */
  q?: string | null;
  amount?: number | null;
}

const FROM = `FROM transactions t
  LEFT JOIN homes h ON t.home_id = h.id
  LEFT JOIN categories c ON t.category_id = c.id
  LEFT JOIN categories pc ON c.parent_id = pc.id
  LEFT JOIN employees e ON t.employee_id = e.id
  LEFT JOIN companies co ON t.company_id = co.id`;

const CATEGORY_LABEL = `CASE WHEN pc.name IS NOT NULL THEN pc.name || ' → ' || c.name ELSE c.name END`;

const buildWhere = (f: ReportFilter) => {
  const field: DateField = f.dateField && DATE_FIELDS.includes(f.dateField) ? f.dateField : "date";
  const params: unknown[] = [f.tenantId];
  const where: string[] = ["t.tenant_id = $1", "t.status <> 'CANCELED'"];
  const add = (clause: string, value: unknown) => {
    params.push(value);
    where.push(clause.replace("?", `$${params.length}`));
  };
  add(`t.${field} >= ?`, f.start);
  add(`t.${field} <= ?`, f.end);
  if (f.type) add("t.type = ?", f.type);
  if (f.status === "PAID") where.push("t.status = 'PAID'");
  else if (f.status === "PENDING") where.push("t.status = 'PENDING'");
  else if (f.status === "OVERDUE") {
    params.push(f.today);
    where.push(`t.status = 'PENDING' AND t.due_date < $${params.length}`);
  }
  if (f.categoryIds?.length) {
    const ph = f.categoryIds.map((id) => { params.push(id); return `$${params.length}`; });
    where.push(`t.category_id IN (${ph.join(",")})`);
  }
  if (f.homeIds?.length) {
    const ph = f.homeIds.map((id) => { params.push(id); return `$${params.length}`; });
    where.push(`t.home_id IN (${ph.join(",")})`);
  }
  if (f.paymentMethod) add("t.payment_method = ?", f.paymentMethod);
  if (f.amount != null) add("ABS(t.amount - ?) < 0.005", f.amount);
  const q = (f.q ?? "").trim();
  if (q) {
    params.push(`%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`);
    const i = params.length;
    where.push(`(t.description ILIKE $${i} OR t.notes ILIKE $${i} OR c.name ILIKE $${i} OR pc.name ILIKE $${i} OR co.name ILIKE $${i} OR e.name ILIKE $${i} OR h.name ILIKE $${i})`);
  }
  return { whereSql: `WHERE ${where.join(" AND ")}`, params, field };
};

export interface Totals {
  receitas: number;
  despesas: number;
  receitas_pagas: number;
  receitas_pendentes: number;
  despesas_pagas: number;
  despesas_pendentes: number;
  atrasados: number;
  atrasados_total: number;
  lancamentos: number;
  saldo: number;
  /** Caixa: o que já foi recebido menos o que já foi pago. */
  realizado: number;
}

export const totals = async (f: ReportFilter): Promise<Totals> => {
  const { whereSql, params } = buildWhere(f);
  params.push(f.today);
  const todayParam = `$${params.length}`;
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN t.type = 'REVENUE' THEN t.amount END), 0)::float AS receitas,
            COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount END), 0)::float AS despesas,
            COALESCE(SUM(CASE WHEN t.type = 'REVENUE' AND t.status = 'PAID' THEN t.amount END), 0)::float AS receitas_pagas,
            COALESCE(SUM(CASE WHEN t.type = 'REVENUE' AND t.status = 'PENDING' THEN t.amount END), 0)::float AS receitas_pendentes,
            COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' AND t.status = 'PAID' THEN t.amount END), 0)::float AS despesas_pagas,
            COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' AND t.status = 'PENDING' THEN t.amount END), 0)::float AS despesas_pendentes,
            COUNT(*) FILTER (WHERE t.status = 'PENDING' AND t.due_date < ${todayParam})::int AS atrasados,
            COALESCE(SUM(CASE WHEN t.status = 'PENDING' AND t.due_date < ${todayParam} THEN t.amount END), 0)::float AS atrasados_total,
            COUNT(*)::int AS lancamentos
     ${FROM} ${whereSql}`,
    params
  );
  const r = rows[0];
  return { ...r, saldo: r.receitas - r.despesas, realizado: r.receitas_pagas - r.despesas_pagas };
};

export type GroupBy = "category" | "parent_category" | "home" | "payment_method" | "description" | "day" | "month";

export interface GroupRow {
  key: string;
  label: string;
  value: number;
  count: number;
  paid: number;
  pending: number;
}

/** Soma por agrupamento. Use sempre com `f.type` definido (somar receita com despesa não faz sentido). */
export const byGroup = async (f: ReportFilter, groupBy: GroupBy, limit = 50): Promise<GroupRow[]> => {
  const { whereSql, params, field } = buildWhere(f);
  const dims: Record<GroupBy, { key: string; label: string; order: string }> = {
    category: { key: "t.category_id::text", label: CATEGORY_LABEL, order: "value DESC" },
    parent_category: { key: "COALESCE(pc.id, c.id)::text", label: "COALESCE(pc.name, c.name)", order: "value DESC" },
    home: { key: "t.home_id::text", label: "h.name", order: "value DESC" },
    payment_method: { key: "t.payment_method", label: "t.payment_method", order: "value DESC" },
    description: { key: "LOWER(TRIM(t.description))", label: "LOWER(TRIM(t.description))", order: "value DESC" },
    day: { key: `to_char(t.${field}, 'YYYY-MM-DD')`, label: `to_char(t.${field}, 'YYYY-MM-DD')`, order: "key ASC" },
    month: { key: `to_char(t.${field}, 'YYYY-MM')`, label: `to_char(t.${field}, 'YYYY-MM')`, order: "key ASC" },
  };
  const d = dims[groupBy];
  params.push(Math.min(500, Math.max(1, Math.floor(limit))));
  const { rows } = await pool.query(
    `SELECT ${d.key} AS key, COALESCE(${d.label}, '(sem nome)') AS label,
            SUM(t.amount)::float AS value, COUNT(*)::int AS count,
            COALESCE(SUM(CASE WHEN t.status = 'PAID' THEN t.amount END), 0)::float AS paid,
            COALESCE(SUM(CASE WHEN t.status = 'PENDING' THEN t.amount END), 0)::float AS pending
     ${FROM} ${whereSql} AND t.${field} IS NOT NULL${groupBy === "description" ? " AND TRIM(COALESCE(t.description, '')) <> ''" : ""}
     GROUP BY 1, 2 ORDER BY ${d.order}, 2 LIMIT $${params.length}`,
    params
  );
  return rows;
};

export interface SeriesPoint {
  key: string;
  receitas: number;
  despesas: number;
}

/** Receitas e despesas por dia ou por mês (ignora `f.type`). Períodos sem lançamento não aparecem. */
export const series = async (f: ReportFilter, granularity: "day" | "month"): Promise<SeriesPoint[]> => {
  const { whereSql, params, field } = buildWhere({ ...f, type: null });
  const fmt = granularity === "day" ? "YYYY-MM-DD" : "YYYY-MM";
  const { rows } = await pool.query(
    `SELECT to_char(t.${field}, '${fmt}') AS key,
            COALESCE(SUM(CASE WHEN t.type = 'REVENUE' THEN t.amount END), 0)::float AS receitas,
            COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount END), 0)::float AS despesas
     ${FROM} ${whereSql} AND t.${field} IS NOT NULL
     GROUP BY 1 ORDER BY 1`,
    params
  );
  return rows;
};

export interface TxRow {
  id: number;
  date: string;
  due_date: string | null;
  payment_date: string | null;
  type: "EXPENSE" | "REVENUE";
  amount: number;
  status: "PENDING" | "PAID";
  description: string | null;
  payment_method: string | null;
  category: string | null;
  home: string | null;
  company: string | null;
}

export type TxSort = "date_desc" | "amount_desc" | "due_asc";
const SORTS: Record<TxSort, string> = {
  date_desc: "t.date DESC, t.id DESC",
  amount_desc: "t.amount DESC, t.id DESC",
  due_asc: "t.due_date ASC NULLS LAST, t.id ASC",
};

/** `date` vem como string YYYY-MM-DD (o pg devolve DATE como Date; to_char evita deslocamento de fuso). */
export const listTransactions = async (f: ReportFilter, sort: TxSort = "date_desc", limit = 10): Promise<TxRow[]> => {
  const { whereSql, params } = buildWhere(f);
  params.push(Math.min(50, Math.max(1, Math.floor(limit))));
  const { rows } = await pool.query(
    `SELECT t.id, to_char(t.date, 'YYYY-MM-DD') AS date, to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
            to_char(t.payment_date, 'YYYY-MM-DD') AS payment_date, t.type, t.amount::float AS amount, t.status,
            t.description, t.payment_method, ${CATEGORY_LABEL} AS category, h.name AS home, co.name AS company
     ${FROM} ${whereSql} ORDER BY ${SORTS[sort]} LIMIT $${params.length}`,
    params
  );
  return rows;
};

/** Um lançamento do tenant no formato de listagem, ou null. */
export const getTransaction = async (tenantId: number, id: number): Promise<TxRow | null> => {
  const { rows } = await pool.query(
    `SELECT t.id, to_char(t.date, 'YYYY-MM-DD') AS date, to_char(t.due_date, 'YYYY-MM-DD') AS due_date,
            to_char(t.payment_date, 'YYYY-MM-DD') AS payment_date, t.type, t.amount::float AS amount, t.status,
            t.description, t.payment_method, ${CATEGORY_LABEL} AS category, h.name AS home, co.name AS company
     ${FROM} WHERE t.id = $1 AND t.tenant_id = $2`,
    [id, tenantId]
  );
  return rows[0] ?? null;
};

/** Menor data de lançamento do tenant (início do "até hoje"), ou null se não há lançamentos. */
export const firstDate = async (tenantId: number): Promise<string | null> => {
  const { rows } = await pool.query("SELECT to_char(MIN(date), 'YYYY-MM-DD') AS d FROM transactions WHERE tenant_id = $1 AND status <> 'CANCELED'", [tenantId]);
  return rows[0]?.d ?? null;
};

/** Id da categoria + ids dos filhos (o filtro de categoria é IN exato, então "Alimentação" precisa dos filhos). */
export const categoryScope = async (tenantId: number, categoryId: number): Promise<number[]> => {
  const { rows } = await pool.query(
    "SELECT id FROM categories WHERE tenant_id = $1 AND (id = $2 OR parent_id = $2)",
    [tenantId, categoryId]
  );
  return rows.map((r: any) => r.id as number);
};
