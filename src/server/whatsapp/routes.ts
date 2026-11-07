import type { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import pool from "../db.js";
import { hasEnterprise } from "../lib/plan.js";
import { noticeCommand } from "./daily-notice.js";
import { phoneKey } from "../lib/phone.js";
import { todaySP } from "../lib/periods.js";
import { getTransaction, listTransactions } from "../lib/reports.js";
import { UPLOADS_DIR, addAttachment, createTransaction, deleteTransaction, setTransactionStatus, updateTransaction } from "../lib/transactions.js";
import { ensureRubric, removeRubricIfUnused } from "../lib/rubric.js";
import { OpenAIError, getTenantAI, transcribeAudio, type TenantAI } from "../ai/openai.js";
import { PAYMENT_LABELS, draftLabels, parseExpense, type ExpenseDraft, type HistoryMessage } from "../ai/parse-expense.js";
import { understandMessage, type Understood } from "../ai/understand.js";
import { runQuery, shortcutQuery, type Env, type Out } from "./assistant.js";
import { downloadMedia, sendButtons as sendButtonsRaw, sendImage, sendList, sendText as sendTextRaw, uploadMedia } from "./client.js";
import { brDate, brl, txLine, type TxLine } from "./format.js";
import { MENU_TEXT, SESSION_HINT, SHORTCUTS, SHORTCUTS_BODY, isGreeting, touchSession } from "./menu.js";

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_AUDIO = 5 * 1024 * 1024;
const PENDING_MINUTES = 30;
const MAX_WAITING = 20; // rascunhos aguardando confirmação, por telefone
const RATE_LIMIT = 20; // mensagens por minuto, por telefone
const EDIT_WINDOW_DAYS = 7;
const HISTORY_MESSAGES = 8; // no mínimo as 2 últimas trocas (o que o usuário mandou + o que o FinanPOP respondeu)
const HISTORY_MINUTES = 120; // conversa mais antiga que isso não entra como contexto
const HISTORY_KEEP_HOURS = 24; // depois disso o histórico é apagado

interface WaMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  audio?: { id: string; mime_type?: string };
  image?: { id: string; mime_type?: string; caption?: string };
  interactive?: {
    type: string;
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
}

/** Estado de uma conversa guardado em whatsapp_pending.draft (JSONB). Linhas antigas (sem `kind`) são rascunhos de lançamento. */
interface PickDraft {
  kind: "PICK";
  action: "DELETE" | "MARK_PAID";
  options: { id: number; label: string }[];
}
interface ConfirmDraft {
  kind: "CONFIRM_DELETE" | "CONFIRM_STATUS";
  transaction_id: number;
  status?: "PAID";
}
type PendingDraft = ExpenseDraft | PickDraft | ConfirmDraft;
const isLaunch = (d: PendingDraft): d is ExpenseDraft => !("kind" in d);

const hits = new Map<string, number[]>();
const rateLimited = (key: string): boolean => {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(key, list);
  return list.length > RATE_LIMIT;
};

// Histórico da conversa: contexto para a IA ("o mesmo", "no cartão", "e ontem?"). Falhar aqui nunca derruba o fluxo.
const remember = async (key: string, role: HistoryMessage["role"], content: string) => {
  try {
    await pool.query("INSERT INTO whatsapp_history (phone, role, content) VALUES ($1,$2,$3)", [key, role, content.slice(0, 1500)]);
  } catch (e) {
    console.error("WhatsApp history save error:", e);
  }
};

const loadHistory = async (key: string): Promise<HistoryMessage[]> => {
  try {
    const { rows } = await pool.query(
      "SELECT role, content FROM whatsapp_history WHERE phone = $1 AND created_at > NOW() - ($2 || ' minutes')::interval ORDER BY id DESC LIMIT $3",
      [key, String(HISTORY_MINUTES), HISTORY_MESSAGES]
    );
    return rows.reverse();
  } catch (e) {
    console.error("WhatsApp history load error:", e);
    return [];
  }
};

const rememberTo = async (to: string, content: string) => {
  const key = phoneKey(to);
  if (key) await remember(key, "assistant", content);
};

// Tudo que o FinanPOP envia entra no histórico, com o texto completo que o usuário viu (só se a Meta aceitou).
const sendText = async (to: string, text: string) => {
  const r = await sendTextRaw(to, text);
  if (r.ok) await rememberTo(to, text);
  return r;
};
const sendButtons = async (to: string, body: string, buttons: { id: string; title: string }[]) => {
  const r = await sendButtonsRaw(to, body, buttons);
  if (r.ok) await rememberTo(to, body);
  return r;
};

const isYes = (t: string) => /^(sim|s|confirmar|confirma|ok|isso|pode)\b/i.test(t.trim());
const isUndo = (t: string) => /^(desfazer|desfaz|desfa[çc]a|apagar [uú]ltimo|cancelar [uú]ltimo)/i.test(t.trim());
const isNo = (t: string) => /^(n[aã]o|n|cancelar|cancela)\b/i.test(t.trim());
const isYesAll = (t: string) => /^((sim|confirmar|confirma|ok|pode)\s+)?(todos|todas|tudo)\b/i.test(t.trim());
const isNoAll = (t: string) => /^(n[aã]o|cancelar|cancela)\s+(todos|todas|tudo)\b/i.test(t.trim());

const verifySignature = (raw: string, header: string | undefined): boolean => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const got = Buffer.from(header.slice(7), "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
};

/** Contexto de uma mensagem já autenticada (telefone vinculado, plano Enterprise, dentro do limite). */
interface Ctx {
  to: string;
  key: string;
  userId: number;
  tenantId: number;
  env: Env;
  /** Primeira mensagem de uma conversa nova: ganha a dica do menu no fim. */
  newSession: boolean;
  menuShown: boolean;
}

const sendMenu = async (c: Ctx) => {
  c.menuShown = true;
  await sendText(c.to, MENU_TEXT);
  await sendList(c.to, SHORTCUTS_BODY, "Atalhos", "Atalhos", SHORTCUTS);
};

const hint = async (c: Ctx) => {
  if (c.newSession && !c.menuShown) await sendText(c.to, SESSION_HINT.trim());
};

const sendOuts = async (to: string, outs: Out[]) => {
  for (const o of outs) {
    if (o.kind === "text") {
      await sendText(to, o.text);
      continue;
    }
    try {
      const id = await uploadMedia(o.png, "image/png", "grafico.png");
      const r = await sendImage(to, id, o.caption);
      if (r.ok) await rememberTo(to, `📊 ${o.caption}`);
      else await sendText(to, o.fallback);
    } catch (e) {
      console.error("WhatsApp image error:", e instanceof Error ? e.message : e);
      await sendText(to, o.fallback);
    }
  }
};

const summary = async (tenantId: number, d: ExpenseDraft, tag?: string): Promise<string> => {
  const { category, home } = await draftLabels(tenantId, d);
  const lines = [
    d.replace_transaction_id ? "✏️ Confirma a alteração deste lançamento?" : `📝 Confirma este lançamento${tag ? ` (${tag})` : ""}?`,
    "",
    `${d.type === "EXPENSE" ? "Despesa" : "Receita"} · ${brl(d.amount)}`,
    `Categoria: ${category}${d.new_category ? " 🆕 (nova rubrica)" : ""}`,
    `Centro de custo: ${home}`,
    `Data: ${brDate(d.date)} · ${PAYMENT_LABELS[d.payment_method] ?? d.payment_method}`,
    d.status === "PAID" ? "Situação: Pago" : `Situação: Pendente${d.due_date ? ` · vence ${brDate(d.due_date)}` : ""}`,
  ];
  if (d.description) lines.push(`Descrição: ${d.description}`);
  if (d.assumed.length) lines.push("", `ℹ️ Assumi — ${d.assumed.join("; ")}`);
  if (d.new_category) {
    lines.push("", `🆕 Não tenho certeza de qual categoria é. Ao confirmar, crio a rubrica *${d.new_category.name}* dentro de *${d.new_category.parent_label}* e lanço nela.`);
    lines.push("", "Para usar outra, responda o nome (ex.: \"categoria Mercado\"), ou mude outro dado (ex.: \"foi no cartão\").");
  } else {
    lines.push("", "Para corrigir, responda com a mudança (ex.: \"foi no cartão\").");
  }
  return lines.join("\n");
};

interface PendingRow {
  id: number;
  tenant_id: number;
  user_id: number;
  draft: PendingDraft;
  media_path: string | null;
  media_type: string | null;
}

/** `tag` identifica o rascunho quando há vários na mesma conversa (ex.: "2 de 3"). */
const askNext = async (to: string, p: { id: number; tenant_id: number }, draft: ExpenseDraft, tag?: string) => {
  if (draft.awaiting) {
    const list = draft.awaiting.options.map((o, i) => `${i + 1}) ${o.label}`).join("\n");
    const what = draft.awaiting.field === "category_id" ? "a categoria" : "o centro de custo";
    const of = tag ? ` do lançamento ${tag} (${brl(draft.amount)}${draft.description ? ` · ${draft.description}` : ""})` : "";
    await sendText(to, `Não identifiquei ${what}${of}. Responda com o número:\n${list}\n\n(ou "cancelar")`);
    return;
  }
  await sendButtons(to, await summary(p.tenant_id, draft, tag), [
    { id: `confirm:${p.id}`, title: "Confirmar" },
    { id: `cancel:${p.id}`, title: "Cancelar" },
  ]);
};

const removeMedia = (mediaPath: string | null) => {
  if (!mediaPath) return;
  try { fs.unlinkSync(path.join(UPLOADS_DIR, mediaPath)); } catch { /* já removido */ }
};

const confirmLaunch = async (to: string, p: PendingRow, d: ExpenseDraft) => {
  if (d.awaiting || (!d.category_id && !d.new_category) || !d.home_id) {
    await askNext(to, p, d);
    return;
  }
  // revalida os cadastros (podem ter sido removidos entre a pergunta e a confirmação)
  const [cat, home] = await Promise.all([
    d.category_id ? pool.query("SELECT id FROM categories WHERE id = $1 AND tenant_id = $2", [d.category_id, p.tenant_id]) : Promise.resolve({ rows: [{}] }),
    pool.query("SELECT id FROM homes WHERE id = $1 AND tenant_id = $2", [d.home_id, p.tenant_id]),
  ]);
  if (!cat.rows[0] || !home.rows[0]) {
    await pool.query("UPDATE whatsapp_pending SET status = 'CANCELED' WHERE id = $1", [p.id]);
    await sendText(to, "A categoria ou o centro de custo não existe mais. Envie o lançamento novamente.");
    return;
  }
  // Rubrica proposta pela IA: só é criada agora, na confirmação. Cancelar ou deixar expirar não cria nada.
  let categoryId = d.category_id as number; // com new_category, é substituído logo abaixo (a guarda do início garante um dos dois)
  let createdRubric: string | null = null;
  if (d.new_category) {
    const rubric = await ensureRubric(p.tenant_id, d.new_category.parent_id, d.new_category.name, d.type);
    if (!rubric) {
      await pool.query("UPDATE whatsapp_pending SET status = 'CANCELED' WHERE id = $1", [p.id]);
      await sendText(to, `A categoria *${d.new_category.parent_label}* não existe mais, então não criei a rubrica. Envie o lançamento novamente.`);
      return;
    }
    categoryId = rubric.id;
    if (rubric.created) createdRubric = `${d.new_category.parent_label} → ${d.new_category.name}`;
  }
  if (d.replace_transaction_id) {
    const ok = await updateTransaction(p.tenant_id, d.replace_transaction_id, {
      date: d.date,
      type: d.type,
      amount: d.amount,
      home_id: d.home_id,
      category_id: categoryId,
      payment_method: d.payment_method,
      status: d.status,
      description: d.description || null,
      due_date: d.due_date,
      payment_date: d.payment_date,
    });
    // sem transaction_id: "desfazer" não deve apagar um lançamento que apenas foi editado
    await pool.query("UPDATE whatsapp_pending SET status = 'DONE' WHERE id = $1", [p.id]);
    await sendText(to, ok ? `✅ Lançamento atualizado: ${d.type === "EXPENSE" ? "despesa" : "receita"} de ${brl(d.amount)}.${createdRubric ? `\n🆕 Criei a rubrica *${createdRubric}*.` : ""}` : "Esse lançamento não existe mais no FinanPOP.");
    return;
  }
  const id = await createTransaction(p.tenant_id, {
    date: d.date,
    type: d.type,
    amount: d.amount,
    home_id: d.home_id,
    category_id: categoryId,
    payment_method: d.payment_method,
    status: d.status,
    description: d.description || null,
    notes: "Lançado via WhatsApp",
    due_date: d.due_date,
    payment_date: d.payment_date,
  });
  if (p.media_path) {
    try {
      const buffer = fs.readFileSync(path.join(UPLOADS_DIR, p.media_path));
      const ext = path.extname(p.media_path) || ".jpg";
      await addAttachment(id, buffer, `whatsapp-${id}${ext}`, p.media_type || "image/jpeg");
    } catch (e) {
      console.error("WhatsApp attach error:", e);
    }
    removeMedia(p.media_path);
  }
  await pool.query("UPDATE whatsapp_pending SET status = 'DONE', transaction_id = $2 WHERE id = $1", [p.id, id]);
  await sendText(to, `✅ Lançado! ${d.type === "EXPENSE" ? "Despesa" : "Receita"} de ${brl(d.amount)} registrada${p.media_path ? " com a foto anexada" : ""}.${createdRubric ? `\n🆕 Criei a rubrica *${createdRubric}* e lancei nela.` : ""}
Se foi engano, envie "desfazer".`);
};

const confirmPending = async (c: Ctx, p: PendingRow) => {
  const d = p.draft;
  if (isLaunch(d)) return confirmLaunch(c.to, p, d);
  if (d.kind === "CONFIRM_DELETE") {
    const gone = await deleteTransaction(p.tenant_id, d.transaction_id);
    await pool.query("UPDATE whatsapp_pending SET status = 'DONE' WHERE id = $1", [p.id]);
    await sendText(c.to, gone ? `🗑️ Excluído! ${gone.type === "EXPENSE" ? "Despesa" : "Receita"} de ${brl(gone.amount)}${gone.description ? ` (${gone.description})` : ""} foi removida.` : "Esse lançamento já tinha sido removido no FinanPOP.");
    return;
  }
  if (d.kind === "CONFIRM_STATUS") {
    const tx = await getTransaction(p.tenant_id, d.transaction_id);
    const ok = tx ? await setTransactionStatus(p.tenant_id, d.transaction_id, "PAID", c.env.today) : false;
    await pool.query("UPDATE whatsapp_pending SET status = 'DONE' WHERE id = $1", [p.id]);
    if (!tx || !ok) {
      await sendText(c.to, "Essa conta não existe mais no FinanPOP.");
      return;
    }
    await sendText(c.to, `✅ Baixa feita! ${tx.type === "EXPENSE" ? "Conta paga" : "Recebimento registrado"}: ${brl(tx.amount)}${tx.description ? ` (${tx.description})` : ""} em ${brDate(c.env.today)}.`);
    return;
  }
  // PICK não se confirma por botão: pede o número
  await sendText(c.to, "Responda com o número da opção, ou envie \"cancelar\".");
};

const cancelPending = async (to: string, p: PendingRow) => {
  await pool.query("UPDATE whatsapp_pending SET status = 'CANCELED' WHERE id = $1", [p.id]);
  removeMedia(p.media_path);
  await sendText(to, isLaunch(p.draft) ? "Lançamento cancelado. Nada foi registrado." : "Ok, cancelado. Nada foi alterado.");
};

/** Confirma só os rascunhos de LANÇAMENTO já completos; nunca exclusões/baixas, que exigem o botão próprio. */
const confirmAll = async (c: Ctx, waiting: PendingRow[]) => {
  const launches = waiting.filter((w): w is PendingRow & { draft: ExpenseDraft } => isLaunch(w.draft));
  const ready = launches.filter((w) => !w.draft.awaiting && (w.draft.category_id || w.draft.new_category) && w.draft.home_id);
  for (const w of ready) await confirmLaunch(c.to, w, w.draft);
  const blocked = launches.length - ready.length;
  if (blocked) await sendText(c.to, `${blocked} lançamento(s) ainda precisam de categoria ou centro de custo. Responda com o número da opção pedida.`);
  if (launches.length === 0) await sendText(c.to, "Não há lançamentos aguardando confirmação.");
};

const cancelAll = async (to: string, waiting: PendingRow[]) => {
  for (const w of waiting) {
    await pool.query("UPDATE whatsapp_pending SET status = 'CANCELED' WHERE id = $1", [w.id]);
    removeMedia(w.media_path);
  }
  await sendText(to, `${waiting.length} item(ns) cancelado(s). Nada foi registrado ou alterado.`);
};

/** Apaga o último lançamento feito por este telefone (até 24 h atrás), se ainda existir. */
const undoLast = async (to: string, key: string) => {
  const { rows } = await pool.query(
    `SELECT id, tenant_id, transaction_id FROM whatsapp_pending
     WHERE phone = $1 AND status = 'DONE' AND transaction_id IS NOT NULL AND undone_at IS NULL
       AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY id DESC LIMIT 1`,
    [key]
  );
  const last = rows[0];
  if (!last) {
    await sendText(to, "Não há nenhum lançamento recente seu pelo WhatsApp para desfazer (só vale para as últimas 24 horas).");
    return;
  }
  const tx = await deleteTransaction(last.tenant_id, last.transaction_id);
  await pool.query("UPDATE whatsapp_pending SET undone_at = NOW() WHERE id = $1", [last.id]);
  if (!tx) {
    await sendText(to, "Esse lançamento já tinha sido removido no FinanPOP.");
    return;
  }
  const label = tx.description ? ` (${tx.description})` : "";
  // a rubrica que o assistente criou junto com esse lançamento sai também, se ficou vazia
  const removedRubric = tx.category_id ? await removeRubricIfUnused(last.tenant_id, tx.category_id) : null;
  await sendText(to, `↩️ Desfeito! ${tx.type === "EXPENSE" ? "Despesa" : "Receita"} de ${brl(tx.amount)}${label} foi removida.${removedRubric ? `\n🗂️ A rubrica *${removedRubric}*, criada junto, também foi removida.` : ""}`);
};

/** Pendências aguardando deste telefone, da mais antiga para a mais nova (a última é a mais recente). */
const getWaiting = async (key: string): Promise<PendingRow[]> => {
  const { rows } = await pool.query(
    "SELECT id, tenant_id, user_id, draft, media_path, media_type FROM whatsapp_pending WHERE phone = $1 AND status = 'WAITING' AND expires_at > NOW() ORDER BY id ASC",
    [key]
  );
  return rows;
};

/** Marca como expirados os rascunhos vencidos (e apaga as fotos temporárias) e poda o histórico antigo. */
const sweepExpired = async (key: string) => {
  const { rows } = await pool.query("UPDATE whatsapp_pending SET status = 'EXPIRED' WHERE phone = $1 AND status = 'WAITING' AND expires_at <= NOW() RETURNING media_path", [key]);
  rows.forEach((r: any) => removeMedia(r.media_path));
  try {
    await pool.query("DELETE FROM whatsapp_history WHERE phone = $1 AND created_at < NOW() - ($2 || ' hours')::interval", [key, String(HISTORY_KEEP_HOURS)]);
  } catch { /* histórico é opcional */ }
};

/** Escolhas e confirmações de outras ações (lista, exclusão, baixa) ficam velhas assim que o usuário pede outra coisa. */
const cancelNonLaunch = async (key: string) => {
  await pool.query("UPDATE whatsapp_pending SET status = 'CANCELED' WHERE phone = $1 AND status = 'WAITING' AND draft->>'kind' IS NOT NULL", [key]);
};

/** Cópia da foto para um rascunho próprio: cada lançamento apaga o seu arquivo ao ser confirmado ou cancelado. */
const cloneMedia = (m: { path: string; type: string }, n: number): { path: string; type: string } => {
  const ext = path.extname(m.path);
  const rel = `${m.path.slice(0, m.path.length - ext.length)}-${n}${ext}`;
  fs.copyFileSync(path.join(UPLOADS_DIR, m.path), path.join(UPLOADS_DIR, rel));
  return { path: rel, type: m.type };
};

const insertPending = async (key: string, tenantId: number, userId: number, draft: PendingDraft, media?: { path: string; type: string } | null) => {
  const { rows } = await pool.query(
    "INSERT INTO whatsapp_pending (tenant_id, user_id, phone, draft, media_path, media_type, status, expires_at) VALUES ($1,$2,$3,$4,$5,$6,'WAITING', NOW() + ($7 || ' minutes')::interval) RETURNING id",
    [tenantId, userId, key, JSON.stringify(draft), media?.path ?? null, media?.type ?? null, String(PENDING_MINUTES)]
  );
  return rows[0].id as number;
};

const savePending = async (key: string, tenantId: number, userId: number, draft: PendingDraft, media?: { path: string; type: string } | null) => {
  // Rascunhos de lançamento convivem: cada nota/conta enviada é o seu próprio lançamento e nenhum cancela o outro.
  // Os estados das outras ações (escolha da lista, confirmar exclusão/baixa) são um por vez: o novo substitui o anterior,
  // sem encostar nos rascunhos de lançamento que estão aguardando.
  if (!isLaunch(draft)) await cancelNonLaunch(key);
  return insertPending(key, tenantId, userId, draft, media);
};

// ---------- baixa, exclusão e edição (sempre com confirmação) ----------

const WIDE = { start: "1970-01-01", end: "2999-12-31", dateField: "date" as const };

const confirmButtons = (id: number) => [
  { id: `confirm:${id}`, title: "Confirmar" },
  { id: `cancel:${id}`, title: "Cancelar" },
];

/** Pede a confirmação de uma ação sobre um lançamento já escolhido. */
const askConfirm = async (c: Ctx, kind: "CONFIRM_DELETE" | "CONFIRM_STATUS", txId: number) => {
  const tx = await getTransaction(c.tenantId, txId);
  if (!tx) {
    await sendText(c.to, "Não encontrei esse lançamento (talvez já tenha sido removido).");
    return;
  }
  const draft: ConfirmDraft = kind === "CONFIRM_DELETE" ? { kind, transaction_id: txId } : { kind, transaction_id: txId, status: "PAID" };
  const id = await savePending(c.key, c.tenantId, c.userId, draft);
  const line = txLine(tx as TxLine, c.env.today);
  const body =
    kind === "CONFIRM_DELETE"
      ? `🗑️ Excluir este lançamento?\n\n${line}\n\nEsta ação não pode ser desfeita.`
      : `✅ Dar baixa nesta conta?\n\n${line}\n\nVou marcar como ${tx.type === "EXPENSE" ? "paga" : "recebida"} em ${brDate(c.env.today)}.`;
  await sendButtons(c.to, body, confirmButtons(id));
};

/** Vários candidatos: lista numerada. */
const askPick = async (c: Ctx, action: PickDraft["action"], rows: Awaited<ReturnType<typeof listTransactions>>) => {
  const options = rows.map((r) => ({ id: r.id, label: txLine(r as TxLine, c.env.today) }));
  await savePending(c.key, c.tenantId, c.userId, { kind: "PICK", action, options });
  const what = action === "DELETE" ? "excluir" : "dar baixa";
  await sendText(c.to, `Encontrei mais de um. Qual você quer ${what}? Responda com o número:\n\n${options.map((o, i) => `${i + 1}) ${o.label.replace(/^• /, "")}`).join("\n")}\n\n(ou "cancelar")`);
};

/** true se tratou; false quando não há conta pendente e a frase deve virar um lançamento novo. */
const startMarkPaid = async (c: Ctx, u: Extract<Understood, { kind: "MARK_PAID" }>): Promise<boolean> => {
  const rows = await listTransactions(
    { tenantId: c.tenantId, today: c.env.today, ...WIDE, status: "PENDING", type: u.type, q: u.q, amount: u.amount },
    "due_asc",
    10
  );
  if (rows.length === 0) {
    if (u.amount) return false; // "paguei a luz 230" sem conta cadastrada: é um gasto novo
    await sendText(c.to, `Não achei conta pendente${u.q ? ` com "${u.q}"` : ""}. Se foi um gasto novo, envie com o valor, por exemplo: *paguei a luz 230*.`);
    return true;
  }
  if (rows.length === 1) await askConfirm(c, "CONFIRM_STATUS", rows[0].id);
  else await askPick(c, "MARK_PAID", rows);
  return true;
};

const startDelete = async (c: Ctx, u: Extract<Understood, { kind: "DELETE" }>) => {
  if (!u.q && !u.amount) {
    await sendText(c.to, "Qual lançamento excluir? Diga o que é, por exemplo: *excluir uber* ou *excluir mercado 45,90*. Para o último, envie *desfazer*.");
    return;
  }
  const rows = await listTransactions({ tenantId: c.tenantId, today: c.env.today, ...WIDE, q: u.q, amount: u.amount }, "date_desc", 10);
  if (rows.length === 0) await sendText(c.to, `Não encontrei lançamento${u.q ? ` com "${u.q}"` : ""}${u.amount ? ` de ${brl(u.amount)}` : ""}.`);
  else if (rows.length === 1) await askConfirm(c, "CONFIRM_DELETE", rows[0].id);
  else await askPick(c, "DELETE", rows);
};

/** Reabre o último lançamento feito pelo WhatsApp como rascunho; o fluxo de correção edita e confirmar faz UPDATE. */
const startEdit = async (c: Ctx, ai: TenantAI, instruction: string | null) => {
  const { rows } = await pool.query(
    `SELECT transaction_id FROM whatsapp_pending
     WHERE phone = $1 AND status = 'DONE' AND transaction_id IS NOT NULL AND undone_at IS NULL
       AND created_at > NOW() - ($2 || ' days')::interval
     ORDER BY id DESC LIMIT 1`,
    [c.key, String(EDIT_WINDOW_DAYS)]
  );
  const txId = rows[0]?.transaction_id as number | undefined;
  const { rows: tx } = txId
    ? await pool.query(
        `SELECT type, amount::float AS amount, to_char(date,'YYYY-MM-DD') AS date, COALESCE(description,'') AS description, category_id, home_id,
                payment_method, status, to_char(due_date,'YYYY-MM-DD') AS due_date, to_char(payment_date,'YYYY-MM-DD') AS payment_date
         FROM transactions WHERE id = $1 AND tenant_id = $2`,
        [txId, c.tenantId]
      )
    : { rows: [] as any[] };
  if (!txId || !tx[0]) {
    await sendText(c.to, `Não encontrei um lançamento seu pelo WhatsApp dos últimos ${EDIT_WINDOW_DAYS} dias para editar.`);
    return;
  }
  let draft: ExpenseDraft = { ...tx[0], assumed: [], replace_transaction_id: txId };
  if (instruction) {
    const r = await parseExpense(c.tenantId, ai, { text: instruction }, draft);
    if (!r.ok) {
      await sendText(c.to, r.reply);
      return;
    }
    draft = { ...r.drafts[0], replace_transaction_id: txId };
  }
  const id = await savePending(c.key, c.tenantId, c.userId, draft);
  await askNext(c.to, { id, tenant_id: c.tenantId }, draft);
};

const handlePick = async (c: Ctx, p: PendingRow, d: PickDraft, n: number) => {
  const opt = d.options[n - 1];
  if (!opt) {
    await sendText(c.to, "Número inválido. Responda com um dos números da lista.");
    return;
  }
  await askConfirm(c, d.action === "DELETE" ? "CONFIRM_DELETE" : "CONFIRM_STATUS", opt.id);
};

const handleLinkCode = async (to: string, key: string, text: string): Promise<boolean> => {
  const m = text.trim().match(/^vincular\s+(\d{6})$/i);
  if (!m) return false;
  const { rows } = await pool.query(
    "SELECT id, phone FROM whatsapp_links WHERE link_code = $1 AND verified_at IS NULL AND link_code_expires > NOW()",
    [m[1]]
  );
  const link = rows[0];
  if (!link) {
    await sendText(to, "Código inválido ou expirado. Gere um novo em Configurações → IA e WhatsApp no FinanPOP.");
    return true;
  }
  if (link.phone !== key) {
    await sendText(to, "Este código foi gerado para outro número de telefone. Gere um novo com o número que você está usando agora.");
    return true;
  }
  try {
    await pool.query("UPDATE whatsapp_links SET verified_at = NOW(), link_code = NULL, link_code_expires = NULL WHERE id = $1", [link.id]);
  } catch {
    await sendText(to, "Este telefone já está vinculado a outro usuário.");
    return true;
  }
  await sendText(to, "✅ WhatsApp vinculado ao FinanPOP!");
  await sendText(to, MENU_TEXT);
  await sendList(to, SHORTCUTS_BODY, "Atalhos", "Atalhos", SHORTCUTS);
  return true;
};

const processMessage = async (msg: WaMessage) => {
  const to = msg.from;
  const key = phoneKey(msg.from);
  if (!key) return;

  const { rowCount } = await pool.query("INSERT INTO whatsapp_messages (wa_message_id) VALUES ($1) ON CONFLICT DO NOTHING", [msg.id]);
  if (!rowCount) return; // reenvio da Meta

  const text = msg.type === "text" ? msg.text?.body ?? "" : "";
  if (text && (await handleLinkCode(to, key, text))) return;

  const { rows: links } = await pool.query("SELECT user_id, tenant_id FROM whatsapp_links WHERE phone = $1 AND verified_at IS NOT NULL", [key]);
  const link = links[0];
  if (!link) {
    await sendText(to, "Este número ainda não está vinculado ao FinanPOP. No app, abra Configurações → IA e WhatsApp, gere o código e envie aqui: VINCULAR 123456.");
    return;
  }
  const tenantId = link.tenant_id as number;
  // Abre a janela de 24 h da Meta: o aviso diário só sai para quem escreveu recentemente (e usa este "from" exato).
  await pool
    .query("UPDATE whatsapp_links SET last_inbound_at = NOW(), wa_from = $2 WHERE user_id = $1", [link.user_id, to])
    .catch((e) => console.error("last_inbound_at:", e));

  if (!(await hasEnterprise(tenantId))) {
    await sendText(to, "O assistente do FinanPOP no WhatsApp (lançar, consultar, gráficos) é exclusivo do plano Enterprise (R$ 39,90/mês). Para contratar, abra o app em Configurações → IA e WhatsApp.");
    return;
  }
  const c: Ctx = { to, key, userId: link.user_id, tenantId, env: { tenantId, today: todaySP() }, newSession: touchSession(key), menuShown: false };
  if (rateLimited(key)) {
    await sendText(to, "Muitas mensagens em pouco tempo. Aguarde um minuto e tente novamente.");
    return;
  }

  await sweepExpired(key);
  const history = await loadHistory(key); // lido antes de registrar a mensagem atual
  if (text) await remember(key, "user", text);

  // ---- respostas que não precisam da OpenAI: atalhos, botões, escolhas numéricas, menu, desfazer ----
  const listId = msg.type === "interactive" ? msg.interactive?.list_reply?.id : undefined;
  if (listId) {
    await remember(key, "user", `Atalho: ${msg.interactive?.list_reply?.title ?? listId}`);
    const q = shortcutQuery(listId, c.env);
    if (!q) return sendMenu(c);
    await sendOuts(to, await runQuery(c.env, q));
    return hint(c);
  }

  const waiting = await getWaiting(key);
  const pending = waiting[waiting.length - 1] ?? null; // a mais recente
  // Alvo sem ambiguidade para "sim"/"não"/"desfazer": a única pendência, ou a ação de outro tipo que acabou de ser pedida.
  // Com vários rascunhos de lançamento abertos, o usuário precisa dizer qual (botão) ou usar "confirmar todos"/"cancelar todos".
  const target = pending && (!isLaunch(pending.draft) || waiting.length === 1) ? pending : null;
  const ambiguous = !!pending && !target;
  const askWhich = () =>
    sendText(to, `Você tem ${waiting.length} lançamentos aguardando. Use os botões de cada um, ou responda "confirmar todos" ou "cancelar todos".`);

  if (text && isGreeting(text)) return sendMenu(c);

  if (text) {
    const reply = await noticeCommand(link.user_id, text);
    if (reply) {
      await sendText(to, reply);
      return;
    }
  }

  if (text && isUndo(text)) {
    // com rascunho aberto, "desfazer" equivale a cancelar; senão apaga o último lançamento
    if (target) return cancelPending(to, target);
    if (ambiguous) return askWhich();
    return undoLast(to, key);
  }

  const buttonId = msg.type === "interactive" ? msg.interactive?.button_reply?.id : undefined;
  if (buttonId) {
    // cada botão age no rascunho do seu próprio id, mesmo havendo outros aguardando
    const [action, id] = buttonId.split(":");
    const hit = waiting.find((w) => String(w.id) === id);
    if (!hit) {
      await sendText(to, "Essa ação já foi tratada ou expirou. Envie novamente.");
      return;
    }
    if (action === "confirm") await confirmPending(c, hit);
    else await cancelPending(to, hit);
    return;
  }

  if (pending && text) {
    if (isNoAll(text)) return cancelAll(to, waiting);
    if (isYesAll(text)) return confirmAll(c, waiting);

    const digits = /^\d{1,2}$/.test(text.trim()) ? parseInt(text.trim(), 10) : null;
    // escolha numerada (lista de lançamentos ou categoria/centro de custo): vale para a pergunta mais recente
    const asking = [...waiting].reverse().find((w) => (isLaunch(w.draft) ? !!w.draft.awaiting : w.draft.kind === "PICK"));
    if (asking && digits !== null) {
      const d = asking.draft;
      if (!isLaunch(d) && d.kind === "PICK") return handlePick(c, asking, d, digits);
      if (isLaunch(d) && d.awaiting) {
        const opt = d.awaiting.options[digits - 1];
        if (!opt) {
          await sendText(to, "Número inválido. Responda com um dos números da lista.");
          return;
        }
        const draft: ExpenseDraft = { ...d, [d.awaiting.field]: opt.id, awaiting: undefined, ...(d.awaiting.field === "category_id" ? { new_category: undefined } : {}) };
        if (!draft.home_id) {
          const { rows } = await pool.query("SELECT id, name FROM homes WHERE tenant_id = $1 ORDER BY name LIMIT 10", [tenantId]);
          draft.awaiting = { field: "home_id", options: rows.map((h: any) => ({ id: h.id, label: h.name })) };
        }
        await pool.query("UPDATE whatsapp_pending SET draft = $1 WHERE id = $2", [JSON.stringify(draft), asking.id]);
        const launches = waiting.filter((w) => isLaunch(w.draft));
        await askNext(to, asking, draft, launches.length > 1 ? `${launches.indexOf(asking) + 1} de ${launches.length}` : undefined);
        return;
      }
    }
    if (ambiguous && (isYes(text) || isNo(text))) return askWhich();
    const open = target && (isLaunch(target.draft) ? !target.draft.awaiting : target.draft.kind !== "PICK");
    if (target && open && isYes(text)) return confirmPending(c, target);
    if (target && isNo(text)) return cancelPending(to, target);
  }

  if (msg.type !== "text" && msg.type !== "audio" && msg.type !== "image") {
    await sendText(to, "Entendo texto, áudio e foto de nota ou comprovante. Envie *menu* para ver o que posso fazer.");
    return;
  }

  // ---- daqui em diante precisa da chave OpenAI do tenant ----
  const ai = await getTenantAI(tenantId);
  if (!ai) {
    await sendText(to, "Para entender mensagens livres, áudios e fotos falta cadastrar a chave da OpenAI em Configurações → IA e WhatsApp no FinanPOP. Os atalhos do *menu* funcionam sem ela.");
    if (!c.menuShown) await sendList(to, SHORTCUTS_BODY, "Atalhos", "Atalhos", SHORTCUTS);
    return;
  }
  await interpret(c, ai, msg, waiting, history);
};

/** Resumo mínimo do rascunho para o LLM decidir se a mensagem é uma correção (com os nomes por extenso, além dos ids). */
const slim = async (tenantId: number, d: ExpenseDraft) => {
  const { category, home } = await draftLabels(tenantId, d);
  return JSON.stringify({
    type: d.type,
    amount: d.amount,
    date: d.date,
    description: d.description,
    category_id: d.category_id,
    category_name: d.category_id ? category : null,
    new_category: d.new_category ? { parent_id: d.new_category.parent_id, parent_label: d.new_category.parent_label, name: d.new_category.name } : null,
    home_id: d.home_id,
    home_name: d.home_id ? home : null,
    payment_method: d.payment_method,
    payment_method_name: PAYMENT_LABELS[d.payment_method] ?? d.payment_method,
    status: d.status,
    due_date: d.due_date,
  });
};

const friendlyOpenAIError = (e: OpenAIError): string => {
  if (e.status === 401) return "A chave da OpenAI foi recusada. Atualize em Configurações → IA e WhatsApp.";
  if (e.status === 429) return "Sua conta da OpenAI recusou o pedido (limite de uso ou falta de crédito). Confira em platform.openai.com → Billing e tente de novo. Os atalhos do *menu* continuam funcionando.";
  return "Não consegui falar com a IA agora. Tente novamente em instantes.";
};

/** Texto, áudio ou imagem: classifica a intenção (consulta, baixa, exclusão...) ou vira rascunho de lançamento. */
const interpret = async (c: Ctx, ai: TenantAI, msg: WaMessage, waiting: PendingRow[], history: HistoryMessage[]) => {
  const { to, key, userId, tenantId } = c;
  let text = msg.type === "text" ? msg.text?.body ?? "" : "";
  let imageDataUrl: string | undefined;
  let media: { path: string; type: string } | null = null;
  let mediaSaved = false; // depois de entregue a um rascunho, a foto não pode ser apagada aqui

  if (waiting.length >= MAX_WAITING) {
    await sendText(to, `Você já tem ${waiting.length} itens aguardando. Responda "confirmar todos" ou "cancelar todos" antes de enviar mais.`);
    return;
  }

  try {
    if (msg.type === "audio" && msg.audio) {
      const { buffer, mime } = await downloadMedia(msg.audio.id, MAX_AUDIO);
      text = await transcribeAudio(ai, buffer, msg.audio.mime_type || mime);
      if (!text) {
        await sendText(to, "Não consegui entender o áudio. Tente de novo ou envie por texto.");
        return;
      }
      await remember(key, "user", `🎤 ${text}`);
      await sendText(to, `🎤 Entendi: "${text}"`);
    } else if (msg.type === "image" && msg.image) {
      const { buffer, mime } = await downloadMedia(msg.image.id, MAX_IMAGE);
      imageDataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      text = msg.image.caption ?? "";
      await remember(key, "user", `📷 Foto de nota ou comprovante${text ? `: ${text}` : ""}`);
      const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
      const rel = `whatsapp-tmp/${Date.now()}-${msg.id.slice(-8).replace(/\W/g, "")}${ext}`;
      fs.mkdirSync(path.dirname(path.join(UPLOADS_DIR, rel)), { recursive: true });
      fs.writeFileSync(path.join(UPLOADS_DIR, rel), buffer);
      media = { path: rel, type: mime };
    }

    // O último rascunho de lançamento aberto (mesmo o que espera categoria/centro de custo, ex.: "no mercado")
    // pode receber a mensagem como correção; os demais continuam intactos.
    const openRow = [...waiting].reverse().find((w) => isLaunch(w.draft)) ?? null;
    const openDraft = openRow && isLaunch(openRow.draft) ? openRow.draft : null;
    let correcting: ExpenseDraft | undefined;

    if (!imageDataUrl) {
      if (!text.trim() || isGreeting(text)) return sendMenu(c);
      const u = await understandMessage(tenantId, ai, text, { pendingDraft: openDraft ? await slim(tenantId, openDraft) : null, history });
      // escolha/confirmação antiga de outra ação não deve ficar viva depois de um pedido novo
      await cancelNonLaunch(key);

      switch (u.kind) {
        case "QUERY":
          await sendOuts(to, await runQuery(c.env, u.query));
          return hint(c);
        case "UNDO":
          return undoLast(to, key);
        case "HELP":
          return sendMenu(c);
        case "OTHER":
          if (!u.reply) {
            await sendText(to, "Não entendi o que você quis dizer. Veja o que posso fazer:");
            return sendMenu(c);
          }
          await sendText(to, u.reply);
          return hint(c);
        case "DELETE":
          await startDelete(c, u);
          return;
        case "EDIT_LAST":
          return startEdit(c, ai, u.instruction);
        case "MARK_PAID":
          if (await startMarkPaid(c, u)) return;
          break; // sem conta pendente e com valor: segue como lançamento novo
        case "CORRECTION":
          correcting = openDraft ?? undefined;
          break;
        case "LAUNCH":
          break;
      }
    } else {
      await cancelNonLaunch(key); // foto nova: escolhas/confirmações de outras ações ficaram velhas
    }

    const result = await parseExpense(tenantId, ai, { text, imageDataUrl, history }, correcting);
    if (!result.ok) {
      removeMedia(media?.path ?? null);
      await sendText(to, result.reply);
      if (!imageDataUrl) await sendText(to, "Envie *menu* para ver tudo que posso fazer.");
      return;
    }

    if (result.correction && correcting && openRow) {
      // correção: substitui só esse rascunho (mantendo a foto já anexada e o lançamento que está sendo editado)
      const keepMedia = openRow.media_path ? { path: openRow.media_path, type: openRow.media_type || "image/jpeg" } : null;
      const draft: ExpenseDraft = correcting.replace_transaction_id ? { ...result.drafts[0], replace_transaction_id: correcting.replace_transaction_id } : result.drafts[0];
      await pool.query("UPDATE whatsapp_pending SET status = 'CANCELED' WHERE id = $1", [openRow.id]);
      const id = await insertPending(key, tenantId, userId, draft, keepMedia);
      await askNext(to, { id, tenant_id: tenantId }, draft);
      await hint(c);
      return;
    }

    // lançamentos novos: um rascunho para cada nota/conta, sem mexer nos que já aguardam
    const total = result.drafts.length;
    if (total > 1) await sendText(to, `Encontrei ${total} lançamentos nesta mensagem. Confirme cada um:`);
    for (const [i, draft] of result.drafts.entries()) {
      // a foto vale para todos os lançamentos dela; cada rascunho guarda a sua cópia
      const own = media ? (i === 0 ? media : cloneMedia(media, i)) : null;
      const id = await savePending(key, tenantId, userId, draft, own);
      if (i === 0 && media) mediaSaved = true;
      await askNext(to, { id, tenant_id: tenantId }, draft, total > 1 ? `${i + 1} de ${total}` : undefined);
    }
    await hint(c);
  } catch (e) {
    if (!mediaSaved) removeMedia(media?.path ?? null);
    if (e instanceof Error && e.message === "MEDIA_TOO_LARGE") {
      await sendText(to, "Arquivo muito grande. Envie imagens de até 10 MB e áudios de até 5 MB.");
    } else if (e instanceof OpenAIError) {
      console.error("WhatsApp OpenAI error:", e.status, e.message);
      await sendText(to, friendlyOpenAIError(e));
    } else {
      console.error("WhatsApp interpret error:", e);
      await sendText(to, "Não consegui processar sua mensagem agora. Tente novamente em instantes.");
    }
  }
};

export function registerWhatsAppRoutes(app: Hono<any>) {
  // Verificação do webhook (configuração no painel da Meta)
  app.get("/api/whatsapp/webhook", (c) => {
    const ok = c.req.query("hub.mode") === "subscribe" && !!process.env.WHATSAPP_VERIFY_TOKEN && c.req.query("hub.verify_token") === process.env.WHATSAPP_VERIFY_TOKEN;
    return ok ? c.text(c.req.query("hub.challenge") ?? "") : c.text("Forbidden", 403);
  });

  app.post("/api/whatsapp/webhook", async (c) => {
    const raw = await c.req.text();
    if (!verifySignature(raw, c.req.header("x-hub-signature-256"))) return c.text("Invalid signature", 401);

    let payload: any;
    try { payload = JSON.parse(raw); } catch { return c.text("Bad request", 400); }

    const messages: WaMessage[] = (payload.entry ?? []).flatMap((e: any) => (e.changes ?? []).flatMap((ch: any) => ch.value?.messages ?? []));
    // A Meta avisa aqui o destino das mensagens que enviamos; sem isso uma falha de entrega some em silêncio.
    // Registra só o estado e, nas falhas, o código/motivo (sem telefone nem id da mensagem).
    const statuses: any[] = (payload.entry ?? []).flatMap((e: any) => (e.changes ?? []).flatMap((ch: any) => ch.value?.statuses ?? []));
    for (const s of statuses) {
      if (s.status === "failed") {
        console.error("WhatsApp delivery failed:", JSON.stringify((s.errors ?? []).map((er: any) => ({ code: er.code, title: er.title, details: er.error_data?.details ?? er.message }))));
      } else {
        console.log("WhatsApp status:", s.status);
      }
    }
    // responde 200 já; o processamento (IA) continua em segundo plano
    void (async () => {
      for (const m of messages) {
        try { await processMessage(m); } catch (e) { console.error("WhatsApp processMessage error:", e); }
      }
    })();
    return c.text("OK");
  });
}
