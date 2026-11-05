import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pool from "../db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, "..", "..", "uploads");

export interface NewTransaction {
  date: string;
  type: string;
  amount: number;
  home_id: number | string;
  category_id: number | string;
  employee_id?: number | string | null;
  company_id?: number | string | null;
  payment_method: string;
  status?: string | null;
  description?: string | null;
  notes?: string | null;
  due_date?: string | null;
  payment_date?: string | null;
}

/** INSERT único de lançamento, usado pela API e pelo fluxo WhatsApp. */
export const createTransaction = async (tenantId: number, t: NewTransaction): Promise<number> => {
  const { rows } = await pool.query(
    `INSERT INTO transactions (date, type, amount, home_id, category_id, employee_id, company_id, payment_method, status, description, notes, due_date, payment_date, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [t.date, t.type, t.amount, t.home_id, t.category_id, t.employee_id || null, t.company_id || null, t.payment_method, t.status || "PENDING", t.description || null, t.notes || null, t.due_date || null, t.payment_date || null, tenantId]
  );
  return rows[0].id;
};

/** Mesma regra de PATCH /api/transactions/:id/status, mas a data da baixa vem de quem chama (hoje em São Paulo). */
export const setTransactionStatus = async (tenantId: number, id: number, status: "PAID" | "PENDING" | "CANCELED", paymentDate: string | null): Promise<boolean> => {
  const date = status === "PAID" ? paymentDate : null;
  const { rowCount } = await pool.query(
    "UPDATE transactions SET status = $1, payment_date = $2, due_date = CASE WHEN $1 = 'PAID' THEN COALESCE(due_date, date) ELSE due_date END, updated_at = NOW() WHERE id = $3 AND tenant_id = $4",
    [status, date, id, tenantId]
  );
  return !!rowCount;
};

/** Remove o lançamento e seus anexos (linhas e arquivos); `attachments` não tem chave estrangeira. */
export const deleteTransaction = async (tenantId: number, id: number): Promise<{ type: string; amount: number; description: string | null; category_id: number | null } | null> => {
  const { rows: files } = await pool.query(
    "SELECT a.filename FROM attachments a JOIN transactions t ON t.id = a.transaction_id WHERE a.transaction_id = $1 AND t.tenant_id = $2",
    [id, tenantId]
  );
  const { rows } = await pool.query("DELETE FROM transactions WHERE id = $1 AND tenant_id = $2 RETURNING type, amount::float AS amount, description, category_id", [id, tenantId]);
  if (!rows[0]) return null;
  await pool.query("DELETE FROM attachments WHERE transaction_id = $1", [id]);
  for (const f of files) {
    try { fs.unlinkSync(path.join(UPLOADS_DIR, f.filename)); } catch { /* arquivo já removido */ }
  }
  return rows[0];
};

export interface TransactionFields {
  date: string;
  type: string;
  amount: number;
  home_id: number | string;
  category_id: number | string;
  payment_method: string;
  status: string;
  description?: string | null;
  due_date?: string | null;
  payment_date?: string | null;
}

/** Atualiza os campos que o rascunho do WhatsApp controla; o resto do lançamento (anexos, fornecedor) fica como está. */
export const updateTransaction = async (tenantId: number, id: number, t: TransactionFields): Promise<boolean> => {
  const { rowCount } = await pool.query(
    `UPDATE transactions SET date = $1, type = $2, amount = $3, home_id = $4, category_id = $5, payment_method = $6,
            status = $7, description = $8, due_date = $9, payment_date = $10, updated_at = NOW()
     WHERE id = $11 AND tenant_id = $12`,
    [t.date, t.type, t.amount, t.home_id, t.category_id, t.payment_method, t.status, t.description || null, t.due_date || null, t.payment_date || null, id, tenantId]
  );
  return !!rowCount;
};

/** Salva um arquivo como anexo de um lançamento (mesmo layout de POST /api/transactions/:id/attachments). */
export const addAttachment = async (transactionId: number, buffer: Buffer, originalName: string, contentType: string): Promise<void> => {
  const filename = `transactions/${transactionId}/${Date.now()}-${originalName}`;
  const fullPath = path.join(UPLOADS_DIR, filename);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, buffer);
  await pool.query(
    `INSERT INTO attachments (transaction_id, filename, original_name, content_type, size) VALUES ($1,$2,$3,$4,$5)`,
    [transactionId, filename, originalName, contentType, buffer.length]
  );
};
