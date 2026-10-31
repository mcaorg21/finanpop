// Formatação das respostas do WhatsApp (negrito com *...*, texto simples, até 4000 caracteres).
import { PAYMENT_LABELS } from "../ai/parse-expense.js";
import { brDay } from "../lib/periods.js";

export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const brDate = (iso: string) => iso.split("-").reverse().join("/");

/** Texto digitado pelo usuário (descrição, categoria) sem os caracteres que o WhatsApp interpreta como formatação. */
export const clean = (s: string | null | undefined, max = 40): string => {
  const t = (s ?? "").replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

export const paymentLabel = (pm: string | null | undefined): string => (pm ? PAYMENT_LABELS[pm] ?? pm : "—");

/** Barra de texto proporcional (share de 0 a 1). */
export const bar = (share: number, width = 10): string => {
  const filled = Math.max(share > 0 ? 1 : 0, Math.min(width, Math.round(share * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
};

export const percent = (part: number, total: number): string => (total > 0 ? `${Math.round((part / total) * 100)}%` : "0%");

/** "▲ 12%" / "▼ 8%" / "= igual" comparando com o período anterior. `upIsBad` só muda o emoji. */
export const variation = (cur: number, prev: number, upIsBad = true): string => {
  if (prev === 0 && cur === 0) return "—";
  if (prev === 0) return "novo (sem valor no período anterior)";
  const pct = ((cur - prev) / prev) * 100;
  if (Math.abs(pct) < 0.5) return "= igual ao período anterior";
  const up = pct > 0;
  const icon = up ? (upIsBad ? "🔺" : "🟢▲") : upIsBad ? "🟢▼" : "🔻";
  return `${icon} ${Math.abs(Math.round(pct))}% ${up ? "a mais" : "a menos"}`;
};

export const countLabel = (n: number): string => `${n} ${n === 1 ? "lançamento" : "lançamentos"}`;

export interface TxLine {
  date: string;
  due_date: string | null;
  type: string;
  amount: number;
  status: string;
  description: string | null;
  category: string | null;
}

/** Uma linha de lançamento: "05/11 · R$ 45,90 · Mercado — Alimentação → Mercado ⏳". */
export const txLine = (t: TxLine, today: string, n?: number): string => {
  const mark = t.status === "PAID" ? "✅" : t.status === "CANCELED" ? "🚫" : t.due_date && t.due_date < today ? "🔴" : t.due_date === today ? "🟡" : "⏳";
  const sign = t.type === "REVENUE" ? "+" : "";
  const what = clean(t.description, 28) || clean(t.category, 28) || "sem descrição";
  const when = t.status === "PENDING" && t.due_date ? `vence ${brDay(t.due_date)}` : brDay(t.date);
  const cat = t.category && t.description ? ` · ${clean(t.category, 24)}` : "";
  return `${n ? `${n}. ` : "• "}${when} · ${sign}${brl(t.amount)} · ${what}${cat} ${mark}`;
};

export const MORE_HINT = '\n\nEnvie *menu* para ver tudo que posso fazer.';
