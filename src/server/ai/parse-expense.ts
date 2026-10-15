import pool from "../db.js";
import { chatJson, type ChatMessage, type TenantAI } from "./openai.js";

export const PAYMENT_METHOD_VALUES = ["PIX", "CARD", "CASH", "BOLETO", "BOLETO_DDA", "TRANSFER", "PIX_PARCELADO"] as const;
export const PAYMENT_LABELS: Record<string, string> = {
  PIX: "Pix",
  CARD: "Cartão",
  CASH: "Dinheiro",
  BOLETO: "Boleto",
  BOLETO_DDA: "Boleto (DDA)",
  TRANSFER: "Transferência",
  PIX_PARCELADO: "Pix Parcelado",
};

export interface Option {
  id: number;
  label: string;
}

export interface ExpenseDraft {
  type: "EXPENSE" | "REVENUE";
  amount: number;
  date: string;
  description: string;
  category_id: number | null;
  home_id: number | null;
  payment_method: string;
  status: "PENDING" | "PAID";
  due_date: string | null;
  payment_date: string | null;
  /** Campo que ainda precisa ser escolhido pelo usuário, com as opções numeradas. */
  awaiting?: { field: "category_id" | "home_id"; options: Option[] };
  /** Decisões automáticas que o resumo deve deixar explícitas. */
  assumed: string[];
}

export type ParseResult = { ok: true; draft: ExpenseDraft } | { ok: false; reply: string };

interface Context {
  categories: { id: number; kind: "EXPENSE" | "REVENUE"; label: string }[];
  homes: Option[];
  lastHomeId: number | null;
}

export const loadContext = async (tenantId: number): Promise<Context> => {
  const [cats, homes, last] = await Promise.all([
    pool.query("SELECT id, name, kind, parent_id FROM categories WHERE tenant_id = $1 ORDER BY name", [tenantId]),
    pool.query("SELECT id, name FROM homes WHERE tenant_id = $1 ORDER BY name", [tenantId]),
    pool.query("SELECT home_id FROM transactions WHERE tenant_id = $1 ORDER BY id DESC LIMIT 1", [tenantId]),
  ]);
  const byId = new Map<number, { name: string; parent_id: number | null }>(cats.rows.map((c: any) => [c.id, c]));
  const hasChildren = new Set<number>(cats.rows.filter((c: any) => c.parent_id != null).map((c: any) => c.parent_id));
  const categories = cats.rows
    .filter((c: any) => c.parent_id != null || !hasChildren.has(c.id))
    .map((c: any) => {
      const parent = c.parent_id != null ? byId.get(c.parent_id) : null;
      return { id: c.id as number, kind: c.kind as "EXPENSE" | "REVENUE", label: parent ? `${parent.name} → ${c.name}` : (c.name as string) };
    });
  return {
    categories,
    homes: homes.rows.map((h: any) => ({ id: h.id as number, label: h.name as string })),
    lastHomeId: last.rows[0]?.home_id ?? null,
  };
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["understood", "reply", "type", "amount", "date", "description", "category_id", "home_id", "payment_method", "status", "due_date"],
  properties: {
    understood: { type: "boolean" },
    reply: { type: ["string", "null"] },
    type: { type: "string", enum: ["EXPENSE", "REVENUE"] },
    amount: { type: ["number", "null"] },
    date: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    category_id: { type: ["integer", "null"] },
    home_id: { type: ["integer", "null"] },
    payment_method: { type: ["string", "null"], enum: [...PAYMENT_METHOD_VALUES, null] },
    status: { type: "string", enum: ["PENDING", "PAID"] },
    due_date: { type: ["string", "null"] },
  },
};

interface RawDraft {
  understood: boolean;
  reply: string | null;
  type: "EXPENSE" | "REVENUE";
  amount: number | null;
  date: string | null;
  description: string | null;
  category_id: number | null;
  home_id: number | null;
  payment_method: string | null;
  status: "PENDING" | "PAID";
  due_date: string | null;
}

const isISODate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

const buildSystemPrompt = (ctx: Context, today: string): string => `Você extrai UM lançamento financeiro (despesa ou receita) de mensagens em português do Brasil enviadas pelo WhatsApp: texto, transcrição de áudio ou foto de nota fiscal/comprovante.
Hoje é ${today} (fuso America/Sao_Paulo). Resolva datas relativas ("hoje", "ontem", "dia 20") a partir dela, no formato YYYY-MM-DD.

Regras:
- type: EXPENSE para gastos/pagamentos; REVENUE só se a pessoa disser que RECEBEU ou vendeu algo.
- amount: valor TOTAL em reais, número decimal (ex.: 45.9). Em foto de nota, use o total pago.
- status: PAID se a pessoa já pagou ("paguei", "comprei", "gastei", comprovante); PENDING se é conta a pagar ("vence", "boleto para dia 20", "preciso pagar").
- due_date: só para PENDING com vencimento informado; senão null.
- date: data do gasto (padrão hoje; em nota/comprovante, a data impressa).
- description: curta (estabelecimento ou o que foi comprado).
- category_id: escolha SOMENTE um id da lista de categorias do mesmo type; se nenhuma servir, null.
- home_id: SOMENTE um id da lista de centros de custo quando a mensagem citar um; senão null.
- payment_method: um dos valores permitidos quando for dito ou visível (pix, cartão, dinheiro, boleto, transferência); senão null.
- Se a mensagem não descreve um lançamento (conversa, pergunta, valor ausente), understood=false e reply com uma frase curta pedindo o que falta. Nunca invente valores.

Categorias (id | tipo | nome):
${ctx.categories.map((c) => `${c.id} | ${c.kind} | ${c.label}`).join("\n") || "(nenhuma cadastrada)"}

Centros de custo (id | nome):
${ctx.homes.map((h) => `${h.id} | ${h.label}`).join("\n") || "(nenhum cadastrado)"}`;

export interface ParseInput {
  text?: string;
  imageDataUrl?: string;
}

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

/** Interpreta texto e/ou imagem em um rascunho validado contra os cadastros do tenant. `existing` aplica uma correção. */
export const parseExpense = async (tenantId: number, ai: TenantAI, input: ParseInput, existing?: ExpenseDraft): Promise<ParseResult> => {
  const ctx = await loadContext(tenantId);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const parts: Part[] = [];
  if (existing) {
    const { awaiting: _a, assumed: _s, ...current } = existing;
    parts.push({ type: "text", text: `Lançamento atual (JSON): ${JSON.stringify(current)}\nAplique a CORREÇÃO abaixo mantendo o restante igual.` });
  }
  if (input.text) parts.push({ type: "text", text: input.text });
  if (input.imageDataUrl) parts.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  if (parts.length === 0) return { ok: false, reply: "Não recebi nada para interpretar." };

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(ctx, today) },
    { role: "user", content: parts },
  ];
  const raw = await chatJson<RawDraft>(ai, messages, "expense_draft", SCHEMA);

  const amount = Number(raw.amount);
  if (!raw.understood || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, reply: raw.reply || 'Não consegui identificar o valor. Envie, por exemplo: "gastei 45,90 no mercado no pix".' };
  }

  const type = raw.type === "REVENUE" ? "REVENUE" : "EXPENSE";
  const assumed: string[] = [];
  const date = isISODate(raw.date) ? raw.date : today;
  const status = raw.status === "PAID" ? "PAID" : "PENDING";
  const dueDate = isISODate(raw.due_date) ? raw.due_date : null;

  let paymentMethod = raw.payment_method && (PAYMENT_METHOD_VALUES as readonly string[]).includes(raw.payment_method) ? raw.payment_method : null;
  if (!paymentMethod) {
    paymentMethod = "PIX";
    assumed.push("forma de pagamento: Pix");
  }

  const category = ctx.categories.find((c) => c.id === raw.category_id && c.kind === type) ?? null;
  let homeId = ctx.homes.find((h) => h.id === raw.home_id)?.id ?? null;
  if (!homeId && ctx.homes.length === 1) homeId = ctx.homes[0].id;
  if (!homeId && ctx.lastHomeId && ctx.homes.some((h) => h.id === ctx.lastHomeId)) {
    homeId = ctx.lastHomeId;
    assumed.push("centro de custo: o último usado");
  }

  const draft: ExpenseDraft = {
    type,
    amount: Math.round(amount * 100) / 100,
    date,
    description: (raw.description || "").trim().slice(0, 200),
    category_id: category?.id ?? null,
    home_id: homeId,
    payment_method: paymentMethod,
    status,
    due_date: status === "PAID" ? dueDate ?? date : dueDate,
    payment_date: status === "PAID" ? date : null,
    assumed,
  };

  if (!draft.category_id) {
    const opts = ctx.categories.filter((c) => c.kind === type).slice(0, 10).map((c) => ({ id: c.id, label: c.label }));
    if (opts.length === 0) return { ok: false, reply: "Você ainda não tem categorias cadastradas. Cadastre em Cadastros → Categorias no FinanPOP." };
    draft.awaiting = { field: "category_id", options: opts };
  } else if (!draft.home_id) {
    if (ctx.homes.length === 0) return { ok: false, reply: "Você ainda não tem centros de custo cadastrados. Cadastre em Cadastros → Centros de Custo no FinanPOP." };
    draft.awaiting = { field: "home_id", options: ctx.homes.slice(0, 10) };
  }
  return { ok: true, draft };
};

/** Rótulos para o resumo ("Pai → Filho" e nome do centro de custo). */
export const draftLabels = async (tenantId: number, draft: ExpenseDraft): Promise<{ category: string; home: string }> => {
  const ctx = await loadContext(tenantId);
  return {
    category: ctx.categories.find((c) => c.id === draft.category_id)?.label ?? "—",
    home: ctx.homes.find((h) => h.id === draft.home_id)?.label ?? "—",
  };
};
