import pool from "../db.js";

// O banco não tem chaves estrangeiras entre essas tabelas, então nada impede um lançamento de
// apontar para o centro de custo/categoria/funcionário/empresa de OUTRO tenant se o id vier do
// cliente (foi o que o bug de cache do front permitia, e o que um usuário mal-intencionado faria
// de propósito). Toda rota que grava ids vindos do cliente passa por aqui antes.

export interface TenantRefs {
  home_id?: unknown;
  category_id?: unknown;
  employee_id?: unknown;
  company_id?: unknown;
}

type RefKey = keyof TenantRefs;

const LABELS: Record<RefKey, string> = {
  home_id: "Centro de custo",
  category_id: "Categoria",
  employee_id: "Funcionário",
  company_id: "Empresa",
};

// undefined / null / "" = não informado; inteiro positivo = id; qualquer outra coisa = inválido.
const toId = (v: unknown): number | null | "invalid" => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,12}$/.test(v.trim()) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : "invalid";
};

/**
 * Confere que cada id informado existe E pertence ao tenant. `required` lista os campos que não
 * podem faltar. Devolve a mensagem de erro (400) ou null quando está tudo certo.
 */
export const checkTenantRefs = async (
  tenantId: number,
  refs: TenantRefs,
  required: RefKey[] = []
): Promise<string | null> => {
  const ids = {} as Record<RefKey, number | null>;
  for (const key of Object.keys(LABELS) as RefKey[]) {
    const id = toId(refs[key]);
    if (id === "invalid") return `${LABELS[key]} inválido(a)`;
    if (id === null && required.includes(key)) return `${LABELS[key]} é obrigatório(a)`;
    ids[key] = id;
  }

  const { rows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM homes      WHERE id = $2 AND tenant_id = $1)::int AS home_id,
       (SELECT COUNT(*) FROM categories WHERE id = $3 AND tenant_id = $1)::int AS category_id,
       (SELECT COUNT(*) FROM employees  WHERE id = $4 AND tenant_id = $1)::int AS employee_id,
       (SELECT COUNT(*) FROM companies  WHERE id = $5 AND tenant_id = $1)::int AS company_id`,
    [tenantId, ids.home_id, ids.category_id, ids.employee_id, ids.company_id]
  );
  for (const key of Object.keys(LABELS) as RefKey[]) {
    if (ids[key] !== null && rows[0][key] === 0) return `${LABELS[key]} inválido(a)`;
  }
  return null;
};
