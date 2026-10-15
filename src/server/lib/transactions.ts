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
