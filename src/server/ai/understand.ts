// Classifica a mensagem do WhatsApp (texto ou transcrição de áudio) em uma intenção + filtros.
// O LLM só escolhe a intenção e preenche campos; o servidor valida tudo (ids do tenant, datas, enums) e calcula os
// números em SQL. Nenhum valor financeiro é enviado à OpenAI: só a mensagem e os nomes de categorias/centros.
import pool from "../db.js";
import { addDays, PERIOD_PRESETS, resolvePeriod, todaySP, type PeriodPreset } from "../lib/periods.js";
import { categoryScope, type GroupBy } from "../lib/reports.js";
import type { ChartKind, Query } from "../whatsapp/assistant.js";
import { chatJson, type TenantAI } from "./openai.js";
import { PAYMENT_METHOD_VALUES } from "./parse-expense.js";

const GROUPS: GroupBy[] = ["category", "parent_category", "home", "payment_method", "description", "day", "month"];
const CHARTS: ChartKind[] = ["EVOLUTION", "CATEGORY", "DAILY", "RANKING"];
const QUERY_INTENTS = ["SUMMARY", "TOTAL", "BREAKDOWN", "TOP", "LIST", "COMPARE", "DUE", "CHART", "INSIGHTS"] as const;
const BASE_INTENTS = [...QUERY_INTENTS, "LAUNCH", "MARK_PAID", "DELETE", "EDIT_LAST", "UNDO", "HELP", "OTHER"] as const;
type RawIntent = (typeof BASE_INTENTS)[number] | "CORRECTION";

export type Understood =
  | { kind: "LAUNCH" }
  | { kind: "CORRECTION" }
  | { kind: "QUERY"; query: Query }
  | { kind: "MARK_PAID"; type: "EXPENSE" | "REVENUE"; q: string | null; amount: number | null }
  | { kind: "DELETE"; q: string | null; amount: number | null }
  | { kind: "EDIT_LAST"; instruction: string | null }
  | { kind: "UNDO" }
  | { kind: "HELP" }
  | { kind: "OTHER"; reply: string | null };

interface Raw {
  intent: RawIntent;
  reply: string | null;
  period: { preset: PeriodPreset; month: string | null; start: string | null; end: string | null };
  type: "EXPENSE" | "REVENUE" | "ALL";
  status_filter: "ALL" | "PAID" | "PENDING" | "OVERDUE";
  category_id: number | null;
  home_id: number | null;
  payment_method: string | null;
  search_text: string | null;
  amount: number | null;
  group_by: GroupBy | null;
  chart: ChartKind | null;
  months: number | null;
  limit: number | null;
  edit_instruction: string | null;
}

const schema = (withCorrection: boolean) => ({
  type: "object",
  additionalProperties: false,
  required: ["intent", "reply", "period", "type", "status_filter", "category_id", "home_id", "payment_method", "search_text", "amount", "group_by", "chart", "months", "limit", "edit_instruction"],
  properties: {
    intent: { type: "string", enum: withCorrection ? [...BASE_INTENTS, "CORRECTION"] : [...BASE_INTENTS] },
    reply: { type: ["string", "null"] },
    period: {
      type: "object",
      additionalProperties: false,
      required: ["preset", "month", "start", "end"],
      properties: {
        preset: { type: "string", enum: PERIOD_PRESETS },
        month: { type: ["string", "null"] },
        start: { type: ["string", "null"] },
        end: { type: ["string", "null"] },
      },
    },
    type: { type: "string", enum: ["EXPENSE", "REVENUE", "ALL"] },
    status_filter: { type: "string", enum: ["ALL", "PAID", "PENDING", "OVERDUE"] },
    category_id: { type: ["integer", "null"] },
    home_id: { type: ["integer", "null"] },
    payment_method: { type: ["string", "null"], enum: [...PAYMENT_METHOD_VALUES, null] },
    search_text: { type: ["string", "null"] },
    amount: { type: ["number", "null"] },
    group_by: { type: ["string", "null"], enum: [...GROUPS, null] },
    chart: { type: ["string", "null"], enum: [...CHARTS, null] },
    months: { type: ["integer", "null"] },
    limit: { type: ["integer", "null"] },
    edit_instruction: { type: ["string", "null"] },
  },
});

interface Ctx {
  categories: { id: number; kind: "EXPENSE" | "REVENUE"; label: string; isGroup: boolean }[];
  homes: { id: number; label: string }[];
}

const loadCtx = async (tenantId: number): Promise<Ctx> => {
  const [cats, homes] = await Promise.all([
    pool.query("SELECT id, name, kind, parent_id FROM categories WHERE tenant_id = $1 ORDER BY name", [tenantId]),
    pool.query("SELECT id, name FROM homes WHERE tenant_id = $1 ORDER BY name", [tenantId]),
  ]);
  const byId = new Map<number, { name: string }>(cats.rows.map((c: any) => [c.id, c]));
  const parents = new Set<number>(cats.rows.filter((c: any) => c.parent_id != null).map((c: any) => c.parent_id));
  return {
    categories: cats.rows.slice(0, 300).map((c: any) => ({
      id: c.id as number,
      kind: c.kind as "EXPENSE" | "REVENUE",
      label: c.parent_id != null && byId.get(c.parent_id) ? `${byId.get(c.parent_id)!.name} → ${c.name}` : (c.name as string),
      isGroup: parents.has(c.id),
    })),
    homes: homes.rows.slice(0, 100).map((h: any) => ({ id: h.id as number, label: h.name as string })),
  };
};

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

const buildPrompt = (ctx: Ctx, today: string, pending: string | null): string => `Você classifica mensagens em português do Brasil enviadas pelo WhatsApp a um assistente financeiro (FinanPOP) e preenche filtros. Você NUNCA calcula valores nem inventa dados: o sistema calcula.
Hoje é ${today} (${WEEKDAYS[new Date(`${today}T00:00:00Z`).getUTCDay()]}), fuso America/Sao_Paulo.

INTENÇÕES (intent):
- LAUNCH: a pessoa está REGISTRANDO um gasto ou recebimento novo ("gastei 45,90 no mercado", "recebi 3000 de salário", "comprei X por Y", "boleto da luz 230 vence dia 20").
- SUMMARY: resumo geral/saldo/"como estou" ("resumo do mês", "meu saldo", "como estão minhas finanças").
- TOTAL: quanto gastou/recebeu em um período, opcionalmente filtrado ("quanto gastei hoje", "quanto gastei com mercado essa semana", "quanto já gastei até hoje", "quanto recebi em outubro").
- BREAKDOWN: divisão por categoria / centro de custo / forma de pagamento / estabelecimento (description) / dia / mês ("gastos por categoria", "por forma de pagamento", "onde mais gasto", "gastos por dia").
- INSIGHTS: pede análise, dicas, insights, onde economizar, "como estou gastando", "o que posso melhorar", "me dá um panorama". Período padrão this_month.
- TOP: maiores lançamentos ("maiores gastos da semana", "qual foi meu maior gasto").
- LIST: listar ou buscar lançamentos ("últimos lançamentos", "buscar uber", "o que gastei no ifood"). Sem período citado use period.preset all_time.
- COMPARE: comparar períodos ("comparar com o mês passado", "gastei mais que mês passado?"). Use o período ATUAL em period (ex.: this_month).
- DUE: contas pendentes por vencimento ("o que vence hoje/amanhã/essa semana/nos próximos 7 dias", "contas atrasadas" → status_filter OVERDUE, "o que tenho a pagar", "o que tenho a receber" → type REVENUE). Sem período citado use all_time (= todas as pendentes).
- CHART: a pessoa pede GRÁFICO/imagem. chart: EVOLUTION (evolução mensal receitas x despesas; informe months de 2 a 12, padrão 6), CATEGORY (pizza/rosca por categoria), DAILY (mês dia a dia, acumulado vs mês anterior), RANKING (barras; use group_by category/home/payment_method).
- MARK_PAID: a pessoa diz que PAGOU ou RECEBEU uma conta que já existe e quer dar baixa ("paguei a luz", "recebi o aluguel", "baixar o boleto da internet"). search_text = o que é a conta; amount se informado; type EXPENSE se pagou, REVENUE se recebeu.
- DELETE: excluir/apagar um lançamento específico ("excluir uber", "apagar o lançamento do mercado de ontem"). search_text e amount se informados.
- EDIT_LAST: editar/corrigir o ÚLTIMO lançamento feito ("editar o último", "o último foi 52,90"). edit_instruction = só a mudança pedida (ex.: "valor 52,90"), ou null se a pessoa só pediu para editar.
- UNDO: desfazer o último lançamento ("desfazer", "apaga o que acabei de lançar").
- HELP: perguntas sobre o que o assistente faz.
- OTHER: conversa solta, agradecimento ou algo que não é financeiro; reply = uma frase curta e simpática.${pending ? `
- CORRECTION: há um lançamento aguardando confirmação (abaixo) e a mensagem AJUSTA esse lançamento ("foi no cartão", "é 52,90", "ontem"). Se for outra coisa (consulta, outro lançamento), use a intenção própria.

Lançamento aguardando confirmação: ${pending}` : ""}

CAMPOS:
- period.preset: today, yesterday, tomorrow, next_7_days, next_30_days (para vencimentos futuros), this_week (segunda a domingo), last_week, last_7_days, last_30_days, this_month, last_month, this_year, last_year, all_time ("até hoje", "desde o começo", "total"), month (mês citado; preencha period.month YYYY-MM; sem ano, use o mais recente que já começou), custom (intervalo; preencha start e end YYYY-MM-DD). Sem período citado: this_month. Campos não usados do period ficam null.
- type: EXPENSE para gastos/despesas/contas a pagar; REVENUE para receitas/entradas/recebimentos/a receber; ALL quando envolve os dois ou não se aplica.
- status_filter: OVERDUE (atrasadas/vencidas), PENDING (a pagar/a receber/pendentes), PAID (já pagas/recebidas), senão ALL.
- category_id: SOMENTE um id da lista de categorias quando a pessoa citar uma categoria ("mercado", "alimentação"). Um id de grupo (pai) inclui as subcategorias.
- home_id: SOMENTE um id da lista de centros de custo quando citado ("na loja", "da casa").
- payment_method: quando citado (pix, cartão, dinheiro, boleto, transferência).
- search_text: termo livre (estabelecimento, fornecedor, descrição: "uber", "ifood") somente quando NÃO corresponde a categoria nem centro de custo. Nunca repita no search_text o que já foi para category_id/home_id.
- group_by: BREAKDOWN/RANKING; padrão parent_category; use category só se pedirem subcategorias/detalhado.
- limit: quantidade pedida em TOP/LIST (máx. 10).
Preencha com null o que não se aplica. Não invente ids.

Categorias (id | tipo | nome):
${ctx.categories.map((c) => `${c.id} | ${c.kind}${c.isGroup ? " (grupo)" : ""} | ${c.label}`).join("\n") || "(nenhuma cadastrada)"}

Centros de custo (id | nome):
${ctx.homes.map((h) => `${h.id} | ${h.label}`).join("\n") || "(nenhum cadastrado)"}`;

const isIso = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Valida a saída do LLM e devolve a consulta pronta ou a ação correspondente. */
const interpret = async (tenantId: number, raw: Raw, ctx: Ctx, today: string): Promise<Understood> => {
  switch (raw.intent) {
    case "LAUNCH": return { kind: "LAUNCH" };
    case "CORRECTION": return { kind: "CORRECTION" };
    case "UNDO": return { kind: "UNDO" };
    case "HELP": return { kind: "HELP" };
    case "OTHER": return { kind: "OTHER", reply: raw.reply?.trim() || null };
    default: break;
  }
  const searchText = raw.search_text?.trim().slice(0, 60) || null;
  const amount = typeof raw.amount === "number" && Number.isFinite(raw.amount) && raw.amount > 0 ? Math.round(raw.amount * 100) / 100 : null;

  if (raw.intent === "MARK_PAID") return { kind: "MARK_PAID", type: raw.type === "REVENUE" ? "REVENUE" : "EXPENSE", q: searchText, amount };
  if (raw.intent === "DELETE") return { kind: "DELETE", q: searchText, amount };
  if (raw.intent === "EDIT_LAST") return { kind: "EDIT_LAST", instruction: raw.edit_instruction?.trim() || null };

  // consultas
  let period = resolvePeriod(
    { preset: raw.period?.preset, month: raw.period?.month, start: isIso(raw.period?.start) ? raw.period.start : null, end: isIso(raw.period?.end) ? raw.period.end : null },
    today
  );
  if (raw.intent === "DUE" && period.preset === "all_time") period = { ...period, end: addDays(today, 3650), label: "pendentes" };

  const scope: Query["scope"] = { q: searchText };
  const cat = ctx.categories.find((c) => c.id === raw.category_id);
  if (cat) {
    scope.categoryIds = await categoryScope(tenantId, cat.id);
    scope.categoryLabel = cat.label.split(" → ").pop() ?? cat.label;
  }
  const home = ctx.homes.find((h) => h.id === raw.home_id);
  if (home) {
    scope.homeIds = [home.id];
    scope.homeLabel = home.label;
  }
  if (raw.payment_method && (PAYMENT_METHOD_VALUES as readonly string[]).includes(raw.payment_method)) scope.paymentMethod = raw.payment_method;

  const intent = raw.intent as Query["intent"];
  let type = raw.type === "EXPENSE" || raw.type === "REVENUE" || raw.type === "ALL" ? raw.type : "ALL";
  if (intent === "SUMMARY" || intent === "COMPARE" || intent === "INSIGHTS") type = "ALL";
  if ((intent === "TOTAL" || intent === "BREAKDOWN" || intent === "TOP") && type === "ALL" && intent !== "TOTAL") type = "EXPENSE";
  if (intent === "TOTAL" && type === "ALL" && (raw.status_filter !== "ALL" || scope.q || cat || home || scope.paymentMethod)) type = "EXPENSE";
  if (intent === "CHART") type = type === "REVENUE" ? "REVENUE" : "EXPENSE";

  return {
    kind: "QUERY",
    query: {
      intent,
      period,
      type,
      status: raw.status_filter,
      scope,
      groupBy: raw.group_by && GROUPS.includes(raw.group_by) ? raw.group_by : null,
      chart: raw.chart && CHARTS.includes(raw.chart) ? raw.chart : intent === "CHART" ? "EVOLUTION" : null,
      limit: raw.limit && raw.limit > 0 ? Math.min(10, raw.limit) : null,
      months: raw.months && raw.months > 0 ? Math.min(12, Math.max(2, raw.months)) : null,
    },
  };
};

export interface UnderstandOptions {
  /** JSON curto do rascunho aguardando confirmação (habilita a intenção CORRECTION). */
  pendingDraft?: string | null;
}

export const understandMessage = async (tenantId: number, ai: TenantAI, text: string, opts: UnderstandOptions = {}): Promise<Understood> => {
  const ctx = await loadCtx(tenantId);
  const today = todaySP();
  const pending = opts.pendingDraft ?? null;
  const raw = await chatJson<Raw>(
    ai,
    [
      { role: "system", content: buildPrompt(ctx, today, pending) },
      { role: "user", content: text },
    ],
    "assistant_intent",
    schema(!!pending)
  );
  return interpret(tenantId, raw, ctx, today);
};
