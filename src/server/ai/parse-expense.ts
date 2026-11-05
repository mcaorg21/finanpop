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

/** Rubrica (subcategoria) que o assistente propõe criar dentro de um grupo existente; só é criada quando o usuário confirma. */
export interface NewCategory {
  parent_id: number;
  parent_label: string;
  name: string;
}

export interface ExpenseDraft {
  type: "EXPENSE" | "REVENUE";
  amount: number;
  date: string;
  description: string;
  category_id: number | null;
  /** Sem certeza da categoria: em vez de forçar uma existente, propõe criar esta rubrica (category_id fica null). */
  new_category?: NewCategory;
  home_id: number | null;
  payment_method: string;
  status: "PENDING" | "PAID";
  due_date: string | null;
  payment_date: string | null;
  /** Campo que ainda precisa ser escolhido pelo usuário, com as opções numeradas. */
  awaiting?: { field: "category_id" | "home_id"; options: Option[] };
  /** Decisões automáticas que o resumo deve deixar explícitas. */
  assumed: string[];
  /** Edição de um lançamento existente: confirmar faz UPDATE nele em vez de criar outro. */
  replace_transaction_id?: number;
}

/** `correction` = a mensagem ajustou o rascunho existente (drafts tem 1 item); senão são lançamentos novos. */
export type ParseResult = { ok: true; drafts: ExpenseDraft[]; correction: boolean } | { ok: false; reply: string };

/** Teto de lançamentos extraídos de uma única mensagem. */
export const MAX_ITEMS = 10;

/** Mensagem anterior da conversa (do usuário ou do FinanPOP), em texto completo. */
export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface Context {
  categories: { id: number; kind: "EXPENSE" | "REVENUE"; label: string; name: string; parent_id: number | null }[];
  /** Categorias de topo que já têm subcategorias: são onde uma rubrica nova pode ser criada. */
  groups: { id: number; kind: "EXPENSE" | "REVENUE"; label: string }[];
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
      return {
        id: c.id as number,
        kind: c.kind as "EXPENSE" | "REVENUE",
        label: parent ? `${parent.name} → ${c.name}` : (c.name as string),
        name: c.name as string,
        parent_id: (c.parent_id ?? null) as number | null,
      };
    });
  // Só grupos que já têm subcategorias: criar uma filha numa categoria "folha" faria o assistente deixar de oferecê-la.
  const groups = cats.rows
    .filter((c: any) => c.parent_id == null && hasChildren.has(c.id))
    .map((c: any) => ({ id: c.id as number, kind: c.kind as "EXPENSE" | "REVENUE", label: c.name as string }));
  return {
    categories,
    groups,
    homes: homes.rows.map((h: any) => ({ id: h.id as number, label: h.name as string })),
    lastHomeId: last.rows[0]?.home_id ?? null,
  };
};

const plain = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

/** Nome de rubrica vindo da IA: uma linha, sem setas/barras (usadas nos rótulos "Pai → Filho"), inicial maiúscula, até 50 caracteres. */
export const cleanRubricName = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v
    .replace(/\p{Cc}/gu, " ")
    .replace(/[→>|\\/]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:\-–—]+|[\s.,;:\-–—]+$/g, "")
    .slice(0, 50)
    .trim();
  if (s.length < 2) return null;
  return s.charAt(0).toLocaleUpperCase("pt-BR") + s.slice(1);
};

const ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["type", "amount", "date", "description", "category_id", "category_confidence", "new_category", "home_id", "payment_method", "status", "due_date"],
  properties: {
    type: { type: "string", enum: ["EXPENSE", "REVENUE"] },
    amount: { type: ["number", "null"] },
    date: { type: ["string", "null"] },
    description: { type: ["string", "null"] },
    category_id: { type: ["integer", "null"] },
    category_confidence: { type: "string", enum: ["HIGH", "LOW"] },
    new_category: {
      type: ["object", "null"],
      additionalProperties: false,
      required: ["parent_id", "name"],
      properties: { parent_id: { type: "integer" }, name: { type: "string" } },
    },
    home_id: { type: ["integer", "null"] },
    payment_method: { type: ["string", "null"], enum: [...PAYMENT_METHOD_VALUES, null] },
    status: { type: "string", enum: ["PENDING", "PAID"] },
    due_date: { type: ["string", "null"] },
  },
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["understood", "reply", "is_correction", "items"],
  properties: {
    understood: { type: "boolean" },
    reply: { type: ["string", "null"] },
    is_correction: { type: "boolean" },
    items: { type: "array", items: ITEM_SCHEMA },
  },
};

interface RawResult {
  understood: boolean;
  reply: string | null;
  is_correction: boolean;
  items: RawItem[];
}

interface RawItem {
  type: "EXPENSE" | "REVENUE";
  amount: number | null;
  date: string | null;
  description: string | null;
  category_id: number | null;
  category_confidence?: "HIGH" | "LOW";
  new_category?: { parent_id: number; name: string } | null;
  home_id: number | null;
  payment_method: string | null;
  status: "PENDING" | "PAID";
  due_date: string | null;
}

const isISODate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

const buildSystemPrompt = (ctx: Context, today: string): string => `Você extrai lançamentos financeiros (despesas ou receitas) de mensagens em português do Brasil enviadas pelo WhatsApp: texto, transcrição de áudio ou foto de nota fiscal/comprovante.
Hoje é ${today} (fuso America/Sao_Paulo). Resolva datas relativas ("hoje", "ontem", "dia 20") a partir dela, no formato YYYY-MM-DD.

Regras:
- items: UM item por nota fiscal, comprovante, boleto ou gasto distinto. Duas notinhas na mesma foto = 2 itens; "gastei 50 no mercado e 30 na farmácia" = 2 itens. Nunca some valores de documentos diferentes e nunca repita o mesmo documento. No máximo ${MAX_ITEMS} itens.
- is_correction: true somente quando a mensagem vem acompanhada de um "Lançamento atual" e corrige esse lançamento (items traz só o corrigido); em qualquer outro caso, false.
- Os campos abaixo valem para cada item.
- type: EXPENSE para gastos/pagamentos; REVENUE só se a pessoa disser que RECEBEU ou vendeu algo.
- amount: valor TOTAL em reais, número decimal (ex.: 45.9). Em foto de nota, use o total pago.
- status: PAID se a pessoa já pagou ("paguei", "comprei", "gastei", comprovante); PENDING se é conta a pagar ("vence", "boleto para dia 20", "preciso pagar").
- due_date: só para PENDING com vencimento informado; senão null.
- date: data do gasto (padrão hoje; em nota/comprovante, a data impressa).
- description: o que foi comprado e onde, por extenso e sem abreviar (ex.: "Supermercado Pão de Açúcar — compras do mês", e não "Sup. PA"); em nota fiscal, o nome do estabelecimento completo como impresso, sem CNPJ.
- category_id: o id da lista de categorias (mesmo type) que melhor serve, ou null se nenhuma serve. Nunca force uma categoria que não descreve o gasto só para preencher o campo.
- category_confidence: HIGH somente quando você tem CERTEZA de que a categoria escolhida é exatamente onde esse gasto deve entrar (o nome dela descreve o gasto ou o tipo de estabelecimento, sem depender de interpretação). Categoria apenas parecida, genérica demais, plausível ou "a mais próxima" é LOW. Na dúvida, LOW. Com category_id null, use LOW.
- new_category: preencha SOMENTE quando category_id for null ou category_confidence for LOW; caso contrário, null. É a proposta de uma NOVA subcategoria (rubrica): parent_id = id de um item da lista "Grupos" (do mesmo type do lançamento) que melhor abrigaria o gasto, e name = nome curto e específico do que foi comprado ou do tipo de gasto, por extenso e com inicial maiúscula (ex.: "Pet shop", "Estacionamento", "Material escolar"), sem repetir o nome do grupo. Antes de propor, confira se alguma subcategoria existente já serve (mesmo sinônimo ou nome parecido): nesse caso use-a em category_id com HIGH e new_category null. Se nenhum grupo servir, new_category = null.
- home_id: SOMENTE um id da lista de centros de custo quando a mensagem citar um; senão null.
- payment_method: um dos valores permitidos quando for dito ou visível (pix, cartão, dinheiro, boleto, transferência); senão null.
- Escreva todos os nomes por extenso: não abrevie categorias, centros de custo, estabelecimentos nem formas de pagamento.
- Histórico: as mensagens anteriores da conversa vêm antes da última. Use-as só para entender referências ("o mesmo", "no cartão", "e mais 10 de gorjeta", "esse de ontem") e completar o que faltar. Extraia lançamentos SOMENTE da última mensagem do usuário; nunca extraia de novo um gasto que já aparece no histórico (os confirmados já foram lançados e os pendentes já têm rascunho).
- Se a mensagem não descreve nenhum lançamento (conversa, pergunta, valor ausente), understood=false, items vazio e reply com uma frase curta pedindo o que falta. Nunca invente valores.

Categorias (id | tipo | nome):
${ctx.categories.map((c) => `${c.id} | ${c.kind} | ${c.label}`).join("\n") || "(nenhuma cadastrada)"}

Grupos onde uma rubrica nova pode ser criada (id | tipo | nome):
${ctx.groups.map((g) => `${g.id} | ${g.kind} | ${g.label}`).join("\n") || "(nenhum)"}

Centros de custo (id | nome):
${ctx.homes.map((h) => `${h.id} | ${h.label}`).join("\n") || "(nenhum cadastrado)"}`;

export interface ParseInput {
  text?: string;
  imageDataUrl?: string;
  /** Últimas mensagens da conversa, da mais antiga para a mais nova (sem a atual). */
  history?: HistoryMessage[];
}

type Part = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

/** Interpreta texto e/ou imagem em um rascunho validado contra os cadastros do tenant. `existing` aplica uma correção. */
export const parseExpense = async (tenantId: number, ai: TenantAI, input: ParseInput, existing?: ExpenseDraft): Promise<ParseResult> => {
  const ctx = await loadContext(tenantId);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

  const parts: Part[] = [];
  if (existing) {
    const { awaiting: _a, assumed: _s, replace_transaction_id: _r, ...rest } = existing;
    // além dos ids, os nomes completos: a IA entende "Moradia → Água" melhor do que "category_id 14"
    const current = {
      ...rest,
      category_name: ctx.categories.find((c) => c.id === existing.category_id)?.label ?? null,
      home_name: ctx.homes.find((h) => h.id === existing.home_id)?.label ?? null,
      payment_method_name: PAYMENT_LABELS[existing.payment_method] ?? existing.payment_method,
    };
    parts.push({ type: "text", text: `Lançamento atual (JSON): ${JSON.stringify(current)}\nSe a mensagem abaixo CORRIGE esse lançamento (valor, categoria, data, forma de pagamento, situação...), responda is_correction=true com UM item: o lançamento corrigido, mantendo o restante igual. Se a mensagem não fala da categoria: mantenha category_id e category_confidence como estão no lançamento atual (HIGH quando há category_id) e, se ele traz new_category, repita o mesmo new_category (parent_id e name) com category_id null e category_confidence LOW. Se a pessoa indicar a categoria certa ("é mercado", "categoria Transporte"), responda com o category_id dela, category_confidence HIGH e new_category null. Se ela descreve OUTRO gasto ou conta, responda is_correction=false com os lançamentos novos, sem alterar o atual.` });
  }
  if (input.text) parts.push({ type: "text", text: input.text });
  if (input.imageDataUrl) parts.push({ type: "image_url", image_url: { url: input.imageDataUrl } });
  if (parts.length === 0) return { ok: false, reply: "Não recebi nada para interpretar." };

  const messages: ChatMessage[] = [
    { role: "system", content: buildSystemPrompt(ctx, today) },
    ...(input.history ?? []).map((h): ChatMessage => ({ role: h.role, content: h.content })),
    { role: "user", content: parts },
  ];
  const result = await chatJson<RawResult>(ai, messages, "expense_drafts", SCHEMA);

  const drafts: ExpenseDraft[] = [];
  for (const item of (result.items ?? []).slice(0, MAX_ITEMS)) {
    const built = buildDraft(item, ctx, today);
    if (built && "error" in built) return { ok: false, reply: built.error };
    if (built) drafts.push(built);
  }
  if (!result.understood || drafts.length === 0) {
    return { ok: false, reply: result.reply || 'Não consegui identificar o valor. Envie, por exemplo: "gastei 45,90 no mercado no pix".' };
  }
  return { ok: true, drafts, correction: !!existing && !!result.is_correction };
};

/** Valida um item da IA contra os cadastros do tenant. `null` = item sem valor utilizável. */
const buildDraft = (raw: RawItem, ctx: Context, today: string): ExpenseDraft | { error: string } | null => {
  const amount = Number(raw.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

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

  // Categoria existente só entra com certeza. Sem ela, propõe uma rubrica nova (ou reaproveita a que já existe com o mesmo nome).
  const suggested = ctx.categories.find((c) => c.id === raw.category_id && c.kind === type) ?? null;
  let category = raw.category_confidence === "HIGH" ? suggested : null;
  let newCategory: NewCategory | undefined;
  if (!category && raw.new_category) {
    const group = ctx.groups.find((g) => g.id === Number(raw.new_category!.parent_id) && g.kind === type);
    const name = cleanRubricName(raw.new_category.name);
    if (group && name && plain(name) !== plain(group.label)) {
      category = ctx.categories.find((c) => c.kind === type && c.parent_id === group.id && plain(c.name) === plain(name)) ?? null;
      if (!category) newCategory = { parent_id: group.id, parent_label: group.label, name };
    }
  }
  let homeId =ctx.homes.find((h) => h.id === raw.home_id)?.id ?? null;
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
    ...(newCategory ? { new_category: newCategory } : {}),
    home_id: homeId,
    payment_method: paymentMethod,
    status,
    due_date: status === "PAID" ? dueDate ?? date : dueDate,
    payment_date: status === "PAID" ? date : null,
    assumed,
  };

  if (!draft.category_id && !draft.new_category) {
    // sem certeza e sem grupo para abrigar uma rubrica nova: pergunta, com a melhor suposição da IA em primeiro
    const ofType = ctx.categories.filter((c) => c.kind === type);
    const ordered = suggested ? [suggested, ...ofType.filter((c) => c.id !== suggested.id)] : ofType;
    const opts = ordered.slice(0, 10).map((c) => ({ id: c.id, label: c.label }));
    if (opts.length === 0) return { error: "Você ainda não tem categorias cadastradas. Cadastre em Cadastros → Categorias no FinanPOP." };
    draft.awaiting = { field: "category_id", options: opts };
  } else if (!draft.home_id) {
    if (ctx.homes.length === 0) return { error: "Você ainda não tem centros de custo cadastrados. Cadastre em Cadastros → Centros de Custo no FinanPOP." };
    draft.awaiting = { field: "home_id", options: ctx.homes.slice(0, 10) };
  }
  return draft;
};

/** Rótulos para o resumo ("Pai → Filho" e nome do centro de custo). */
export const draftLabels = async (tenantId: number, draft: ExpenseDraft): Promise<{ category: string; home: string }> => {
  const ctx = await loadContext(tenantId);
  return {
    category: draft.new_category ? `${draft.new_category.parent_label} → ${draft.new_category.name}` : ctx.categories.find((c) => c.id === draft.category_id)?.label ?? "—",
    home: ctx.homes.find((h) => h.id === draft.home_id)?.label ?? "—",
  };
};
