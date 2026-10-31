// Despacha as consultas do assistente (resumo, totais, ranking, comparativo, contas, gráficos) para
// lib/reports.ts e monta a resposta em texto/imagem. Os números são sempre calculados em SQL; o LLM só classifica.
import { addDays, brDay, diffDays, lastMonths, monthEndOf, monthShort, previousPeriod, resolvePeriod, type Period } from "../lib/periods.js";
import { byGroup, firstDate, listTransactions, series, totals, type GroupBy, type GroupRow, type ReportFilter, type Totals } from "../lib/reports.js";
import { svgToPng } from "../charts/render.js";
import { dailySvg, donutSvg, evolutionSvg, rankingSvg } from "../charts/svg.js";
import { bar, brl, clean, countLabel, paymentLabel, percent, txLine, variation } from "./format.js";

export type Intent = "SUMMARY" | "TOTAL" | "BREAKDOWN" | "TOP" | "LIST" | "COMPARE" | "DUE" | "CHART" | "INSIGHTS";
export type ChartKind = "EVOLUTION" | "CATEGORY" | "DAILY" | "RANKING";

export interface Scope {
  categoryIds?: number[];
  categoryLabel?: string | null;
  homeIds?: number[];
  homeLabel?: string | null;
  paymentMethod?: string | null;
  q?: string | null;
}

/** Consulta já validada pelo servidor (datas resolvidas, ids conferidos com o tenant). */
export interface Query {
  intent: Intent;
  period: Period;
  type: "EXPENSE" | "REVENUE" | "ALL";
  status: "ALL" | "PAID" | "PENDING" | "OVERDUE";
  scope: Scope;
  groupBy?: GroupBy | null;
  chart?: ChartKind | null;
  limit?: number | null;
  months?: number | null;
}

export type Out =
  | { kind: "text"; text: string }
  | { kind: "image"; png: Buffer; caption: string; fallback: string };

export interface Env {
  tenantId: number;
  /** Hoje em São Paulo (YYYY-MM-DD). */
  today: string;
}

const text = (t: string): Out[] => [{ kind: "text", text: t }];

// ---------- atalhos da mensagem de lista (sem LLM) ----------

export const shortcutQuery = (id: string, env: Env): Query | null => {
  const p = (preset: Parameters<typeof resolvePeriod>[0]) => resolvePeriod(preset, env.today);
  const base = { type: "EXPENSE" as const, status: "ALL" as const, scope: {} };
  switch (id) {
    case "q:resumo": return { ...base, intent: "SUMMARY", type: "ALL", period: p({ preset: "this_month" }) };
    case "q:hoje": return { ...base, intent: "TOTAL", period: p({ preset: "today" }) };
    case "q:semana": return { ...base, intent: "TOTAL", period: p({ preset: "this_week" }) };
    case "q:mes": return { ...base, intent: "TOTAL", period: p({ preset: "this_month" }) };
    case "q:categorias": return { ...base, intent: "BREAKDOWN", groupBy: "parent_category", period: p({ preset: "this_month" }) };
    case "q:vencer": return { ...base, intent: "DUE", type: "ALL", status: "PENDING", period: p({ preset: "next_7_days" }) };
    case "q:atrasadas": return { ...base, intent: "DUE", status: "OVERDUE", period: p({ preset: "all_time" }) };
    case "q:grafico_evolucao": return { ...base, intent: "CHART", chart: "EVOLUTION", months: 6, period: p({ preset: "this_month" }) };
    case "q:grafico_categoria": return { ...base, intent: "CHART", chart: "CATEGORY", period: p({ preset: "this_month" }) };
    case "q:insights": return { ...base, intent: "INSIGHTS", type: "ALL", period: p({ preset: "this_month" }) };
    case "q:ultimos": return { ...base, intent: "LIST", type: "ALL", limit: 10, period: p({ preset: "all_time" }) };
    default: return null;
  }
};

// ---------- utilidades ----------

const hasScope = (s: Scope) => !!(s.categoryIds?.length || s.homeIds?.length || s.paymentMethod || s.q);

const scopeText = (s: Scope): string => {
  const parts = [
    s.categoryLabel ? clean(s.categoryLabel, 30) : null,
    s.homeLabel ? clean(s.homeLabel, 24) : null,
    s.paymentMethod ? paymentLabel(s.paymentMethod) : null,
    s.q ? `"${clean(s.q, 24)}"` : null,
  ].filter(Boolean);
  return parts.length ? ` · ${parts.join(" · ")}` : "";
};

const baseFilter = (env: Env, q: Query, period: Period, over: Partial<ReportFilter> = {}): ReportFilter => ({
  tenantId: env.tenantId,
  today: env.today,
  start: period.start,
  end: period.end,
  type: q.type === "ALL" ? null : q.type,
  status: q.status === "ALL" ? null : q.status,
  categoryIds: q.scope.categoryIds,
  homeIds: q.scope.homeIds,
  paymentMethod: q.scope.paymentMethod,
  q: q.scope.q,
  ...over,
});

/** Dias decorridos do período até hoje (para a média diária). */
const daysCovered = async (env: Env, period: Period): Promise<number> => {
  const end = period.end < env.today ? period.end : env.today;
  const start = period.preset === "all_time" ? (await firstDate(env.tenantId)) ?? end : period.start;
  return Math.max(1, diffDays(start, end) + 1);
};

const pickSide = (t: Totals, expense: boolean) =>
  expense
    ? { total: t.despesas, paid: t.despesas_pagas, pending: t.despesas_pendentes }
    : { total: t.receitas, paid: t.receitas_pagas, pending: t.receitas_pendentes };

const NONE = "\n\nNenhum lançamento encontrado nesse período.";

/** Ranking numerado: "1. Mercado — R$ 420,00 (34%)" + barra. */
const rankLines = (rows: { label: string; value: number }[], total: number, withBar = true): string[] =>
  rows.map((r, i) => `${i + 1}. ${clean(r.label, 34)} — ${brl(r.value)} (${percent(r.value, total)})${withBar ? `\n    ${bar(total > 0 ? r.value / total : 0)}` : ""}`);

const capitalize = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

const groupLabel = (gb: GroupBy, r: GroupRow): string =>
  gb === "payment_method" ? paymentLabel(r.key) : gb === "day" ? brDay(r.key) : gb === "month" ? monthShort(r.key) : gb === "description" ? capitalize(r.label) : r.label;

const withOthers = (rows: { label: string; value: number }[], keep: number) => {
  if (rows.length <= keep) return rows;
  const head = rows.slice(0, keep);
  head.push({ label: "Outros", value: rows.slice(keep).reduce((s, r) => s + r.value, 0) });
  return head;
};

// ---------- respostas ----------

const total = async (env: Env, q: Query): Promise<Out[]> => {
  if (q.type === "ALL") return summary(env, q);
  const expense = q.type === "EXPENSE";
  const f = baseFilter(env, q, q.period);
  const cur = await totals(f);
  const title = `${expense ? "📉" : "📈"} *${expense ? "Gastos" : "Receitas"} · ${q.period.label}*${scopeText(q.scope)}`;
  if (cur.lancamentos === 0) return text(title + NONE);
  const c = pickSide(cur, expense);
  const lines = [title, "", `*${brl(c.total)}* · ${countLabel(cur.lancamentos)}`];
  if (q.status === "ALL") lines.push(`${expense ? "✅ Pago" : "✅ Recebido"} ${brl(c.paid)} · ⏳ ${expense ? "A pagar" : "A receber"} ${brl(c.pending)}`);
  const days = await daysCovered(env, q.period);
  if (days > 1) lines.push(`📅 Média: ${brl(c.total / days)}/dia`);
  const prev = previousPeriod(q.period, env.today);
  if (prev) {
    const p = pickSide(await totals({ ...f, start: prev.start, end: prev.end }), expense);
    lines.push(`🔁 vs ${prev.label}: ${variation(c.total, p.total, expense)} (${brl(p.total)})`);
  }
  if (!hasScope(q.scope)) {
    const rows = await byGroup(f, "parent_category", 3);
    if (rows.length) lines.push("", `*Maiores categorias*`, ...rankLines(rows, c.total, false));
  } else {
    const top = await listTransactions(f, "amount_desc", 3);
    if (top.length > 1) lines.push("", "*Maiores lançamentos*", ...top.map((t, i) => txLine(t, env.today, i + 1)));
  }
  return text(lines.join("\n"));
};

const summary = async (env: Env, q: Query): Promise<Out[]> => {
  const f = baseFilter(env, q, q.period, { type: null, status: null });
  const t = await totals(f);
  const title = `📋 *Resumo · ${q.period.label}*${scopeText(q.scope)}`;
  if (t.lancamentos === 0) return text(title + NONE);
  const lines = [
    title,
    "",
    `💰 Receitas: *${brl(t.receitas)}*  (✅ ${brl(t.receitas_pagas)} · ⏳ ${brl(t.receitas_pendentes)})`,
    `💸 Despesas: *${brl(t.despesas)}*  (✅ ${brl(t.despesas_pagas)} · ⏳ ${brl(t.despesas_pendentes)})`,
    `⚖️ Saldo: *${brl(t.saldo)}* ${t.saldo >= 0 ? "🟢" : "🔴"}`,
    `🏦 Realizado (caixa): ${brl(t.realizado)}`,
  ];
  const overdue = await totals({
    tenantId: env.tenantId, today: env.today, start: "1970-01-01", end: addDays(env.today, -1),
    dateField: "due_date", type: "EXPENSE", status: "OVERDUE",
  });
  lines.push(overdue.atrasados > 0 ? `🔴 Atrasadas: ${overdue.atrasados} ${overdue.atrasados === 1 ? "conta" : "contas"} · ${brl(overdue.atrasados_total)}` : "🟢 Nenhuma conta atrasada");
  const prev = previousPeriod(q.period, env.today);
  if (prev) {
    const p = await totals({ ...f, start: prev.start, end: prev.end });
    lines.push(`🔁 Despesas vs ${prev.label}: ${variation(t.despesas, p.despesas, true)}`);
  }
  const top = await byGroup({ ...f, type: "EXPENSE" }, "parent_category", 1);
  if (top[0]) lines.push(`🏷️ Maior categoria: ${clean(top[0].label, 30)} — ${brl(top[0].value)} (${percent(top[0].value, t.despesas)})`);
  return text(lines.join("\n"));
};

const BREAKDOWN_TITLES: Record<GroupBy, string> = {
  category: "por categoria",
  parent_category: "por categoria",
  home: "por centro de custo",
  payment_method: "por forma de pagamento",
  description: "por estabelecimento",
  day: "por dia",
  month: "por mês",
};

const breakdown = async (env: Env, q: Query): Promise<Out[]> => {
  const gb = q.groupBy ?? "parent_category";
  const expense = q.type !== "REVENUE";
  const f = baseFilter(env, q, q.period, { type: expense ? "EXPENSE" : "REVENUE" });
  const rows = await byGroup(f, gb, 200);
  const title = `🏷️ *${expense ? "Gastos" : "Receitas"} ${BREAKDOWN_TITLES[gb]} · ${q.period.label}*${scopeText(q.scope)}`;
  if (!rows.length) return text(title + NONE);
  const sum = rows.reduce((s, r) => s + r.value, 0);
  const timeline = gb === "day" || gb === "month";
  const labeled = rows.map((r) => ({ label: groupLabel(gb, r), value: r.value }));
  const shown = timeline ? labeled.slice(-31) : withOthers(labeled, 8);
  const body = timeline
    ? shown.map((r) => `${r.label} — ${brl(r.value)}`)
    : rankLines(shown, sum);
  return text([title, `Total: *${brl(sum)}*`, "", ...body].join("\n"));
};

const topTransactions = async (env: Env, q: Query): Promise<Out[]> => {
  const expense = q.type !== "REVENUE";
  const f = baseFilter(env, q, q.period, { type: expense ? "EXPENSE" : "REVENUE" });
  const rows = await listTransactions(f, "amount_desc", Math.min(10, q.limit ?? 5));
  const title = `🔝 *Maiores ${expense ? "gastos" : "receitas"} · ${q.period.label}*${scopeText(q.scope)}`;
  if (!rows.length) return text(title + NONE);
  return text([title, "", ...rows.map((t, i) => txLine(t, env.today, i + 1))].join("\n"));
};

const list = async (env: Env, q: Query): Promise<Out[]> => {
  const f = baseFilter(env, q, q.period);
  const rows = await listTransactions(f, "date_desc", Math.min(10, q.limit ?? 10));
  const search = !!q.scope.q;
  const where = q.period.preset === "all_time" ? "" : ` · ${q.period.label}`;
  const title = search ? `🔎 *Resultados para "${clean(q.scope.q, 30)}"*${where}${scopeText({ ...q.scope, q: null })}` : `🧾 *Últimos lançamentos*${where}${scopeText(q.scope)}`;
  if (!rows.length) return text(title + NONE);
  const lines = [title, "", ...rows.map((t) => txLine(t, env.today))];
  if (search) {
    const t = await totals(f);
    lines.push("", `Total: ${t.despesas > 0 ? `despesas ${brl(t.despesas)}` : ""}${t.despesas > 0 && t.receitas > 0 ? " · " : ""}${t.receitas > 0 ? `receitas ${brl(t.receitas)}` : ""} em ${countLabel(t.lancamentos)}`);
  }
  return text(lines.join("\n"));
};

const compare = async (env: Env, q: Query): Promise<Out[]> => {
  const prev = previousPeriod(q.period, env.today);
  if (!prev) return text("Para comparar, escolha um período, por exemplo: *comparar com o mês passado*.");
  const f = baseFilter(env, q, q.period, { type: null, status: null });
  const [cur, old] = await Promise.all([totals(f), totals({ ...f, start: prev.start, end: prev.end })]);
  if (cur.lancamentos === 0 && old.lancamentos === 0) return text(`⚖️ *Comparativo*${NONE}`);
  const lines = [
    `⚖️ *Comparativo*${scopeText(q.scope)}`,
    `${q.period.label}  ×  ${prev.label}`,
    "",
    `💰 Receitas: ${brl(cur.receitas)} × ${brl(old.receitas)}  ${variation(cur.receitas, old.receitas, false)}`,
    `💸 Despesas: ${brl(cur.despesas)} × ${brl(old.despesas)}  ${variation(cur.despesas, old.despesas, true)}`,
    `⚖️ Saldo: ${brl(cur.saldo)} × ${brl(old.saldo)}`,
  ];
  const ef = { ...f, type: "EXPENSE" as const };
  const [a, b] = await Promise.all([byGroup(ef, "parent_category", 100), byGroup({ ...ef, start: prev.start, end: prev.end }, "parent_category", 100)]);
  const before = new Map(b.map((r) => [r.key, r.value]));
  const seen = new Set(a.map((r) => r.key));
  const diffs = [
    ...a.map((r) => ({ label: r.label, diff: r.value - (before.get(r.key) ?? 0), now: r.value })),
    ...b.filter((r) => !seen.has(r.key)).map((r) => ({ label: r.label, diff: -r.value, now: 0 })),
  ];
  const up = diffs.filter((d) => d.diff > 0.005).sort((x, y) => y.diff - x.diff).slice(0, 3);
  const down = diffs.filter((d) => d.diff < -0.005).sort((x, y) => x.diff - y.diff).slice(0, 2);
  if (up.length) lines.push("", "*Categorias que mais subiram*", ...up.map((d) => `🔺 ${clean(d.label, 30)}: ${brl(d.now)} (+${brl(d.diff)})`));
  if (down.length) lines.push("", "*Categorias que mais caíram*", ...down.map((d) => `🟢 ${clean(d.label, 30)}: ${brl(d.now)} (−${brl(-d.diff)})`));
  return text(lines.join("\n"));
};

const due = async (env: Env, q: Query): Promise<Out[]> => {
  const overdueOnly = q.status === "OVERDUE";
  const period: Period = overdueOnly ? { ...q.period, start: "1970-01-01", end: addDays(env.today, -1), label: "atrasadas" } : q.period;
  const f = baseFilter(env, q, period, { dateField: "due_date", status: overdueOnly ? "OVERDUE" : "PENDING" });
  const [rows, t] = await Promise.all([listTransactions(f, "due_asc", 10), totals(f)]);
  const kind = q.type === "REVENUE" ? "💰 *A receber" : q.type === "EXPENSE" ? "🗓️ *A pagar" : "🗓️ *Contas a vencer";
  const title = overdueOnly ? `🔴 *Contas atrasadas*${scopeText(q.scope)}` : `${kind} · ${period.label}*${scopeText(q.scope)}`;
  if (!rows.length) return text(`${title}\n\n${overdueOnly ? "Nenhuma conta atrasada. 🟢" : "Nada pendente nesse período. 🟢"}`);
  const sums =
    q.type === "REVENUE" ? `A receber *${brl(t.receitas)}*`
    : q.type === "EXPENSE" ? `A pagar *${brl(t.despesas)}*`
    : `A pagar *${brl(t.despesas)}* · A receber *${brl(t.receitas)}*`;
  const lines = [title, sums, "", ...rows.map((r) => txLine(r, env.today, undefined))];
  if (t.lancamentos > rows.length) lines.push(`… e mais ${t.lancamentos - rows.length}`);
  if (!overdueOnly && q.type !== "REVENUE") {
    const od = await totals({ tenantId: env.tenantId, today: env.today, start: "1970-01-01", end: addDays(env.today, -1), dateField: "due_date", type: "EXPENSE", status: "OVERDUE" });
    if (od.atrasados > 0) lines.push("", `🔴 Você também tem ${od.atrasados} ${od.atrasados === 1 ? "conta atrasada" : "contas atrasadas"} (${brl(od.atrasados_total)}). Envie *contas atrasadas*.`);
  }
  lines.push("", q.type === "REVENUE" ? "Para dar baixa, envie por exemplo: *recebi o aluguel*" : "Para dar baixa, envie por exemplo: *paguei a luz*");
  return text(lines.join("\n"));
};

// ---------- insights (análises calculadas em SQL; o texto vem de regras, sem LLM) ----------

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

const insights = async (env: Env, q: Query): Promise<Out[]> => {
  const p = q.period;
  const f = baseFilter(env, q, p, { type: null, status: null });
  const t = await totals(f);
  const title = `💡 *Insights · ${p.label}*${scopeText(q.scope)}`;
  if (t.lancamentos === 0) return text(title + NONE);

  const ef: ReportFilter = { ...f, type: "EXPENSE" };
  const prev = previousPeriod(p, env.today);
  const monthly = p.preset === "this_month" || p.preset === "last_month" || p.preset === "month";
  const fullPrev = monthly ? previousPeriod({ ...p, inProgress: false }, env.today) : null;
  const win = baseFilter(env, q, { ...p, start: addDays(env.today, -90), end: env.today }, { type: null, status: null });
  const [prevT, fullPrevT, cats, prevCats, topTx, shops, overdue, upcoming, recent] = await Promise.all([
    prev ? totals({ ...f, start: prev.start, end: prev.end }) : null,
    fullPrev ? totals({ ...f, start: fullPrev.start, end: fullPrev.end }) : null,
    byGroup(ef, "parent_category", 50),
    prev ? byGroup({ ...ef, start: prev.start, end: prev.end }, "parent_category", 50) : Promise.resolve([] as GroupRow[]),
    listTransactions(ef, "amount_desc", 1),
    byGroup(ef, "description", 5),
    totals({ tenantId: env.tenantId, today: env.today, start: "1970-01-01", end: addDays(env.today, -1), dateField: "due_date", type: "EXPENSE", status: "OVERDUE" }),
    totals({ tenantId: env.tenantId, today: env.today, start: env.today, end: addDays(env.today, 7), dateField: "due_date", type: "EXPENSE", status: "PENDING" }),
    series(win, "day"),
  ]);

  const items: { score: number; text: string }[] = [];
  const add = (score: number, line: string) => items.push({ score, text: line });
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  // 1. saldo / taxa de poupança
  if (t.receitas > 0) {
    const rate = t.saldo / t.receitas;
    const pct = Math.round(Math.abs(rate) * 100);
    if (rate >= 0.2) add(5, `🟢 Você está guardando ${pct}% da receita (${brl(t.saldo)}). Ótimo ritmo: o usual recomendado é 20% ou mais.`);
    else if (rate >= 0) add(8, `🟡 Sobram só ${pct}% da receita (${brl(t.saldo)}). Uma meta saudável é guardar 20% ou mais.`);
    else add(10, `🔴 As despesas passaram das receitas em ${brl(-t.saldo)} neste período.`);
  } else {
    add(2, "ℹ️ Não há receitas lançadas no período; registre os recebimentos para eu calcular quanto sobra.");
  }

  // 2. projeção de fechamento do mês
  if (p.preset === "this_month" && p.inProgress) {
    const elapsed = Math.max(1, Number(env.today.slice(8, 10)));
    const daysInMonth = Number(p.end.slice(8, 10));
    const daily = t.despesas / elapsed;
    const proj = daily * daysInMonth;
    const vs = fullPrevT && fullPrevT.despesas > 0 ? ` O mês passado fechou em ${brl(fullPrevT.despesas)} (${variation(proj, fullPrevT.despesas, true)}).` : "";
    add(9, `📈 No ritmo atual (${brl(daily)}/dia), as despesas do mês fecham em cerca de ${brl(proj)}.${vs}`);
  }

  // 3. variação das despesas
  if (prev && prevT && prevT.despesas > 0) {
    const pct = Math.abs((t.despesas - prevT.despesas) / prevT.despesas) * 100;
    add(pct >= 10 ? 7 : 3, `🔁 Despesas ${variation(t.despesas, prevT.despesas, true)} vs ${prev.label} (${brl(prevT.despesas)}).`);
  }

  // 4. categorias que mais subiram / caíram
  if (prev) {
    const before = new Map(prevCats.map((r) => [r.key, r.value]));
    const seen = new Set(cats.map((r) => r.key));
    const diffs = [
      ...cats.map((r) => ({ label: r.label, now: r.value, was: before.get(r.key) ?? 0 })),
      ...prevCats.filter((r) => !seen.has(r.key)).map((r) => ({ label: r.label, now: 0, was: r.value })),
    ].map((d) => ({ ...d, diff: d.now - d.was }));
    for (const d of diffs.filter((x) => x.diff >= Math.max(50, x.was * 0.2)).sort((a, b) => b.diff - a.diff).slice(0, 2)) {
      add(8, `🔺 ${clean(d.label, 30)} subiu ${brl(d.diff)} vs ${prev.label}${d.was > 0 ? ` (+${Math.round((d.diff / d.was) * 100)}%)` : " (categoria nova no período)"}.`);
    }
    const drop = diffs.filter((x) => x.diff <= -Math.max(50, x.was * 0.2)).sort((a, b) => a.diff - b.diff)[0];
    if (drop) add(4, `🟢 ${clean(drop.label, 30)} caiu ${brl(-drop.diff)} vs ${prev.label}. Bom sinal.`);
  }

  // 5. concentração por categoria
  if (cats[0] && t.despesas > 0 && cats[0].value / t.despesas >= 0.3) {
    add(7, `🏷️ ${clean(cats[0].label, 30)} concentra ${percent(cats[0].value, t.despesas)} dos gastos (${brl(cats[0].value)}). Reduzir 10% ali economizaria ${brl(cats[0].value * 0.1)} no período.`);
  }

  // 6. maior gasto
  if (topTx[0]) {
    const x = topTx[0];
    const share = t.despesas > 0 ? x.amount / t.despesas : 0;
    add(5, `💸 Maior gasto: ${brl(x.amount)} — ${clean(x.description, 30) || clean(x.category, 30) || "sem descrição"} (${brDay(x.date)})${share >= 0.25 ? `, ${Math.round(share * 100)}% das despesas` : ""}.`);
  }

  // 7. gastos recorrentes (mesma descrição várias vezes)
  const rec = shops.filter((r) => r.count >= 3).slice(0, 3);
  if (rec.length) add(4, `🔂 Gastos que mais se repetem: ${rec.map((r) => `${clean(capitalize(r.label), 22)} (${r.count}× · ${brl(r.value)})`).join(", ")}.`);

  // 8. contas
  if (overdue.atrasados > 0) add(9, `🔴 ${overdue.atrasados} ${plural(overdue.atrasados, "conta atrasada", "contas atrasadas")} somando ${brl(overdue.atrasados_total)}. Quitar logo evita multa e juros (envie *contas atrasadas*).`);
  if (upcoming.despesas > 0) add(6, `🗓️ ${brl(upcoming.despesas)} vencem nos próximos 7 dias (${upcoming.lancamentos} ${plural(upcoming.lancamentos, "conta", "contas")}). Deixe esse valor reservado.`);

  // 9. dia da semana mais pesado (últimos 90 dias)
  const sums = new Array<number>(7).fill(0);
  for (const r of recent) sums[new Date(`${r.key}T00:00:00Z`).getUTCDay()] += r.despesas;
  const totalWin = sums.reduce((a, b) => a + b, 0);
  if (recent.filter((r) => r.despesas > 0).length >= 14 && totalWin > 0) {
    const best = sums.indexOf(Math.max(...sums));
    const share = sums[best] / totalWin;
    if (share >= 0.2) add(3, `📅 ${capitalize(WEEKDAYS[best])} é o dia mais pesado: ${Math.round(share * 100)}% dos gastos dos últimos 90 dias (uma distribuição igual daria ${Math.round(100 / 7)}%).`);
  }

  const picked = items.sort((a, b) => b.score - a.score).slice(0, 7).map((i) => i.text);
  return text([title, "", ...picked, "", "_Para detalhar: *gastos por categoria*, *comparar com o mês passado* ou *gráfico dos últimos 6 meses*._"].join("\n"));
};

// ---------- gráficos ----------

const fallbackRank = (rows: { label: string; value: number }[]) => {
  const sum = rows.reduce((s, r) => s + r.value, 0);
  return rankLines(rows, sum).join("\n");
};

const chart = async (env: Env, q: Query): Promise<Out[]> => {
  const kind = q.chart ?? "EVOLUTION";

  if (kind === "EVOLUTION") {
    const months = lastMonths(env.today, Math.min(12, Math.max(2, q.months ?? 6)));
    const f: ReportFilter = { tenantId: env.tenantId, today: env.today, start: `${months[0]}-01`, end: monthEndOf(`${months[months.length - 1]}-01`), ...(q.scope.categoryIds ? { categoryIds: q.scope.categoryIds } : {}), homeIds: q.scope.homeIds, paymentMethod: q.scope.paymentMethod, q: q.scope.q };
    const data = new Map((await series(f, "month")).map((p) => [p.key, p]));
    const points = months.map((m) => ({ label: monthShort(m), receitas: data.get(m)?.receitas ?? 0, despesas: data.get(m)?.despesas ?? 0 }));
    const rec = points.reduce((s, p) => s + p.receitas, 0);
    const desp = points.reduce((s, p) => s + p.despesas, 0);
    if (rec + desp === 0) return text(`📈 *Evolução · últimos ${months.length} meses*${NONE}`);
    const worst = points.reduce((a, b) => (b.despesas > a.despesas ? b : a));
    const caption = `📈 *Últimos ${months.length} meses*${scopeText(q.scope)}\n💰 Receitas ${brl(rec)} · 💸 Despesas ${brl(desp)}\n⚖️ Saldo ${brl(rec - desp)}\n📌 Maior gasto: ${worst.label} (${brl(worst.despesas)})`;
    const fallback = `${caption}\n\n${points.map((p) => `${p.label}  💸 ${brl(p.despesas)}  💰 ${brl(p.receitas)}`).join("\n")}`;
    const png = await svgToPng(evolutionSvg({ title: "Receitas × despesas", subtitle: `Últimos ${months.length} meses${scopeText(q.scope)}`, points }));
    return png ? [{ kind: "image", png, caption, fallback }] : text(fallback);
  }

  if (kind === "DAILY") {
    const cur = q.period.preset === "this_month" || q.period.preset === "last_month" || q.period.preset === "month" ? q.period : resolvePeriod({ preset: "this_month" }, env.today);
    const prev = previousPeriod({ ...cur, inProgress: false }, env.today);
    const dayCount = (p: Period) => Number(p.end.slice(8, 10));
    const cumulative = (rows: { key: string; despesas: number }[], p: Period, until: number): (number | null)[] => {
      const byDay = new Map(rows.map((r) => [Number(r.key.slice(8, 10)), r.despesas]));
      let acc = 0;
      return Array.from({ length: dayCount(p) }, (_, i) => {
        if (i + 1 > until) return null;
        acc += byDay.get(i + 1) ?? 0;
        return acc;
      });
    };
    const mk = (p: Period): ReportFilter => ({ tenantId: env.tenantId, today: env.today, start: p.start, end: p.end, homeIds: q.scope.homeIds, categoryIds: q.scope.categoryIds, paymentMethod: q.scope.paymentMethod, q: q.scope.q });
    const [curRows, prevRows] = await Promise.all([series(mk(cur), "day"), prev ? series(mk(prev), "day") : Promise.resolve([])]);
    const untilCur = cur.end < env.today ? dayCount(cur) : Math.max(1, Number(env.today.slice(8, 10)));
    const current = cumulative(curRows, cur, untilCur);
    const previous = prev ? (cumulative(prevRows, prev, dayCount(prev)) as number[]) : [];
    const spent = (current.filter((v) => v != null).pop() as number | undefined) ?? 0;
    if (spent === 0 && (previous[previous.length - 1] ?? 0) === 0) return text(`📉 *Gastos dia a dia*${NONE}`);
    const prevSame = previous[Math.min(untilCur, previous.length) - 1] ?? 0;
    const caption = `📉 *Gastos acumulados · ${cur.label}*\nAté o dia ${untilCur}: ${brl(spent)}\nNo mês anterior, até o dia ${Math.min(untilCur, previous.length)}: ${brl(prevSame)}\n${variation(spent, prevSame, true)}`;
    const png = await svgToPng(dailySvg({ title: "Despesa acumulada no mês", subtitle: `${cur.label}${prev ? ` × ${prev.label}` : ""}`, current, previous, currentLabel: cur.label, previousLabel: prev?.label ?? "mês anterior" }));
    return png ? [{ kind: "image", png, caption, fallback: caption }] : text(caption);
  }

  // CATEGORY (rosca) e RANKING (barras): mesma consulta, desenho diferente
  const gb: GroupBy = kind === "CATEGORY" ? "parent_category" : q.groupBy ?? "parent_category";
  const expense = q.type !== "REVENUE";
  const f = baseFilter(env, q, q.period, { type: expense ? "EXPENSE" : "REVENUE" });
  const rows = await byGroup(f, gb, 200);
  const title = `${expense ? "Gastos" : "Receitas"} ${BREAKDOWN_TITLES[gb]}`;
  if (!rows.length) return text(`📊 *${title} · ${q.period.label}*${NONE}`);
  const sum = rows.reduce((s, r) => s + r.value, 0);
  const shown = withOthers(rows.map((r) => ({ label: groupLabel(gb, r), value: r.value })), kind === "CATEGORY" ? 8 : 7);
  const caption = `📊 *${title} · ${q.period.label}*${scopeText(q.scope)}\nTotal: ${brl(sum)}\n🥇 ${clean(shown[0].label, 30)}: ${brl(shown[0].value)} (${percent(shown[0].value, sum)})`;
  const fallback = `${caption}\n\n${fallbackRank(shown)}`;
  const subtitle = `${q.period.label} · total ${brl(sum)}`;
  const svg = kind === "CATEGORY" ? donutSvg({ title, subtitle, total: sum, slices: shown }) : rankingSvg({ title, subtitle, rows: shown });
  const png = await svgToPng(svg);
  return png ? [{ kind: "image", png, caption, fallback }] : text(fallback);
};

// ---------- entrada ----------

export const runQuery = async (env: Env, q: Query): Promise<Out[]> => {
  switch (q.intent) {
    case "SUMMARY": return summary(env, q);
    case "TOTAL": return total(env, q);
    case "BREAKDOWN": return breakdown(env, q);
    case "TOP": return topTransactions(env, q);
    case "LIST": return list(env, q);
    case "COMPARE": return compare(env, q);
    case "DUE": return due(env, q);
    case "CHART": return chart(env, q);
    case "INSIGHTS": return insights(env, q);
  }
};
