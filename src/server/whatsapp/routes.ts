import type { Hono } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import pool from "../db.js";
import { hasEnterprise } from "../lib/plan.js";
import { phoneKey } from "../lib/phone.js";
import { UPLOADS_DIR, addAttachment, createTransaction } from "../lib/transactions.js";
import { OpenAIError, getTenantAI, transcribeAudio, type TenantAI } from "../ai/openai.js";
import { PAYMENT_LABELS, draftLabels, parseExpense, type ExpenseDraft } from "../ai/parse-expense.js";
import { downloadMedia, sendButtons, sendText } from "./client.js";

const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_AUDIO = 5 * 1024 * 1024;
const PENDING_MINUTES = 30;
const RATE_LIMIT = 20; // mensagens por minuto, por telefone

interface WaMessage {
  id: string;
  from: string;
  type: string;
  text?: { body: string };
  audio?: { id: string; mime_type?: string };
  image?: { id: string; mime_type?: string; caption?: string };
  interactive?: { type: string; button_reply?: { id: string; title: string } };
}

const hits = new Map<string, number[]>();
const rateLimited = (key: string): boolean => {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(key, list);
  return list.length > RATE_LIMIT;
};

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const brDate = (iso: string) => iso.split("-").reverse().join("/");
const isYes = (t: string) => /^(sim|s|confirmar|confirma|ok|isso|pode)\b/i.test(t.trim());
const isNo = (t: string) => /^(n[aã]o|n|cancelar|cancela)\b/i.test(t.trim());

const verifySignature = (raw: string, header: string | undefined): boolean => {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const got = Buffer.from(header.slice(7), "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
};

const summary = async (tenantId: number, d: ExpenseDraft): Promise<string> => {
  const { category, home } = await draftLabels(tenantId, d);
  const lines = [
    "📝 Confirma este lançamento?",
    "",
    `${d.type === "EXPENSE" ? "Despesa" : "Receita"} · ${brl(d.amount)}`,
    `Categoria: ${category}`,
    `Centro de custo: ${home}`,
    `Data: ${brDate(d.date)} · ${PAYMENT_LABELS[d.payment_method] ?? d.payment_method}`,
    d.status === "PAID" ? "Situação: Pago" : `Situação: Pendente${d.due_date ? ` · vence ${brDate(d.due_date)}` : ""}`,
  ];
  if (d.description) lines.push(`Descrição: ${d.description}`);
  if (d.assumed.length) lines.push("", `ℹ️ Assumi — ${d.assumed.join("; ")}`);
  lines.push("", "Para corrigir, responda com a mudança (ex.: \"foi no cartão\").");
  return lines.join("\n");
};

interface PendingRow {
  id: number;
  tenant_id: number;
  user_id: number;
  draft: ExpenseDraft;
  media_path: string | null;
  media_type: string | null;
}

const askNext = async (to: string, p: { id: number; tenant_id: number }, draft: ExpenseDraft) => {
  if (draft.awaiting) {
    const list = draft.awaiting.options.map((o, i) => `${i + 1}) ${o.label}`).join("\n");
    const what = draft.awaiting.field === "category_id" ? "a categoria" : "o centro de custo";
    await sendText(to, `Não identifiquei ${what}. Responda com o número:\n${list}\n\n(ou "cancelar")`);
    return;
  }
  await sendButtons(to, await summary(p.tenant_id, draft), [
    { id: `confirm:${p.id}`, title: "Confirmar" },
    { id: `cancel:${p.id}`, title: "Cancelar" },
  ]);
};

const removeMedia = (mediaPath: string | null) => {
  if (!mediaPath) return;
  try { fs.unlinkSync(path.join(UPLOADS_DIR, mediaPath)); } catch { /* já removido */ }
};

const confirmPending = async (to: string, p: PendingRow) => {
  const d = p.draft;
  if (d.awaiting || !d.category_id || !d.home_id) {
    await askNext(to, p, d);
    return;
  }
  // revalida os cadastros (podem ter sido removidos entre a pergunta e a confirmação)
  const [cat, home] = await Promise.all([
    pool.query("SELECT id FROM categories WHERE id = $1 AND tenant_id = $2", [d.category_id, p.tenant_id]),
    pool.query("SELECT id FROM homes WHERE id = $1 AND tenant_id = $2", [d.home_id, p.tenant_id]),
  ]);
  if (!cat.rows[0] || !home.rows[0]) {
    await pool.query("UPDATE whatsapp_pending SET status = 'CANCELED' WHERE id = $1", [p.id]);
    await sendText(to, "A categoria ou o centro de custo não existe mais. Envie o lançamento novamente.");
    return;
  }
  const id = await createTransaction(p.tenant_id, {
    date: d.date,
    type: d.type,
    amount: d.amount,
    home_id: d.home_id,
    category_id: d.category_id,
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
  await pool.query("UPDATE whatsapp_pending SET status = 'DONE' WHERE id = $1", [p.id]);
  await sendText(to, `✅ Lançado! ${d.type === "EXPENSE" ? "Despesa" : "Receita"} de ${brl(d.amount)} registrada${p.media_path ? " com a foto anexada" : ""}.`);
};

const cancelPending = async (to: string, p: PendingRow) => {
  await pool.query("UPDATE whatsapp_pending SET status = 'CANCELED' WHERE id = $1", [p.id]);
  removeMedia(p.media_path);
  await sendText(to, "Lançamento cancelado. Nada foi registrado.");
};

const getWaitingPending = async (key: string): Promise<PendingRow | null> => {
  const { rows } = await pool.query(
    "SELECT id, tenant_id, user_id, draft, media_path, media_type FROM whatsapp_pending WHERE phone = $1 AND status = 'WAITING' AND expires_at > NOW() ORDER BY id DESC LIMIT 1",
    [key]
  );
  return rows[0] ?? null;
};

const savePending = async (key: string, tenantId: number, userId: number, draft: ExpenseDraft, media?: { path: string; type: string } | null) => {
  // uma pendência por vez: a anterior é descartada
  const { rows: old } = await pool.query("UPDATE whatsapp_pending SET status = 'CANCELED' WHERE phone = $1 AND status = 'WAITING' RETURNING media_path", [key]);
  old.forEach((o: any) => removeMedia(o.media_path));
  const { rows } = await pool.query(
    "INSERT INTO whatsapp_pending (tenant_id, user_id, phone, draft, media_path, media_type, status, expires_at) VALUES ($1,$2,$3,$4,$5,$6,'WAITING', NOW() + ($7 || ' minutes')::interval) RETURNING id",
    [tenantId, userId, key, JSON.stringify(draft), media?.path ?? null, media?.type ?? null, String(PENDING_MINUTES)]
  );
  return rows[0].id as number;
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
  await sendText(to, "✅ WhatsApp vinculado ao FinanPOP! Agora é só me mandar despesas por texto, áudio ou foto da nota. Ex.: \"gastei 45,90 no mercado no pix\".");
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

  if (!(await hasEnterprise(tenantId))) {
    await sendText(to, "Lançar despesas pelo WhatsApp é um recurso exclusivo do plano Enterprise do FinanPOP.");
    return;
  }
  if (rateLimited(key)) {
    await sendText(to, "Muitas mensagens em pouco tempo. Aguarde um minuto e tente novamente.");
    return;
  }
  const ai = await getTenantAI(tenantId);
  if (!ai) {
    await sendText(to, "Falta cadastrar a chave da OpenAI em Configurações → IA e WhatsApp no FinanPOP.");
    return;
  }

  const pending = await getWaitingPending(key);

  // botões de confirmação
  const buttonId = msg.type === "interactive" ? msg.interactive?.button_reply?.id : undefined;
  if (buttonId) {
    const [action, id] = buttonId.split(":");
    if (!pending || String(pending.id) !== id) {
      await sendText(to, "Esse lançamento já foi tratado ou expirou. Envie novamente.");
      return;
    }
    if (action === "confirm") await confirmPending(to, pending);
    else await cancelPending(to, pending);
    return;
  }

  if (pending && text) {
    // escolha numerada de categoria / centro de custo
    if (pending.draft.awaiting && /^\d{1,2}$/.test(text.trim())) {
      const opt = pending.draft.awaiting.options[parseInt(text.trim(), 10) - 1];
      if (!opt) {
        await sendText(to, "Número inválido. Responda com um dos números da lista.");
        return;
      }
      const draft: ExpenseDraft = { ...pending.draft, [pending.draft.awaiting.field]: opt.id, awaiting: undefined };
      if (!draft.home_id) {
        const { rows } = await pool.query("SELECT id, name FROM homes WHERE tenant_id = $1 ORDER BY name LIMIT 10", [tenantId]);
        draft.awaiting = { field: "home_id", options: rows.map((h: any) => ({ id: h.id, label: h.name })) };
      }
      await pool.query("UPDATE whatsapp_pending SET draft = $1 WHERE id = $2", [JSON.stringify(draft), pending.id]);
      await askNext(to, pending, draft);
      return;
    }
    if (!pending.draft.awaiting && isYes(text)) return confirmPending(to, pending);
    if (isNo(text)) return cancelPending(to, pending);
  }

  await interpret(to, key, link.user_id, tenantId, ai, msg, pending);
};

/** Texto, áudio ou imagem → rascunho → pergunta/resumo. Com pendência aberta, o texto vira correção. */
const interpret = async (to: string, key: string, userId: number, tenantId: number, ai: TenantAI, msg: WaMessage, pending: PendingRow | null) => {
  let text = msg.type === "text" ? msg.text?.body ?? "" : "";
  let imageDataUrl: string | undefined;
  let media: { path: string; type: string } | null = null;

  try {
    if (msg.type === "audio" && msg.audio) {
      const { buffer, mime } = await downloadMedia(msg.audio.id, MAX_AUDIO);
      text = await transcribeAudio(ai, buffer, msg.audio.mime_type || mime);
      if (!text) {
        await sendText(to, "Não consegui entender o áudio. Tente de novo ou envie por texto.");
        return;
      }
      await sendText(to, `🎤 Entendi: "${text}"`);
    } else if (msg.type === "image" && msg.image) {
      const { buffer, mime } = await downloadMedia(msg.image.id, MAX_IMAGE);
      imageDataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
      text = msg.image.caption ?? "";
      const ext = mime.includes("png") ? ".png" : mime.includes("webp") ? ".webp" : ".jpg";
      const rel = `whatsapp-tmp/${Date.now()}-${msg.id.slice(-8).replace(/\W/g, "")}${ext}`;
      fs.mkdirSync(path.dirname(path.join(UPLOADS_DIR, rel)), { recursive: true });
      fs.writeFileSync(path.join(UPLOADS_DIR, rel), buffer);
      media = { path: rel, type: mime };
    } else if (msg.type !== "text") {
      await sendText(to, "Envie a despesa por texto, áudio ou foto da nota fiscal/comprovante.");
      return;
    }

    const correcting = pending && !pending.draft.awaiting && !imageDataUrl ? pending.draft : undefined;
    const result = await parseExpense(tenantId, ai, { text, imageDataUrl }, correcting);
    if (!result.ok) {
      removeMedia(media?.path ?? null);
      await sendText(to, result.reply);
      return;
    }
    // correção mantém a foto já anexada à pendência
    const keepMedia = correcting && pending?.media_path ? { path: pending.media_path, type: pending.media_type || "image/jpeg" } : media;
    if (correcting) await pool.query("UPDATE whatsapp_pending SET status = 'CANCELED' WHERE id = $1", [pending!.id]);
    const id = await (async () => {
      if (correcting) {
        const { rows } = await pool.query(
          "INSERT INTO whatsapp_pending (tenant_id, user_id, phone, draft, media_path, media_type, status, expires_at) VALUES ($1,$2,$3,$4,$5,$6,'WAITING', NOW() + ($7 || ' minutes')::interval) RETURNING id",
          [tenantId, userId, key, JSON.stringify(result.draft), keepMedia?.path ?? null, keepMedia?.type ?? null, String(PENDING_MINUTES)]
        );
        return rows[0].id as number;
      }
      return savePending(key, tenantId, userId, result.draft, keepMedia);
    })();
    await askNext(to, { id, tenant_id: tenantId }, result.draft);
  } catch (e) {
    removeMedia(media?.path ?? null);
    if (e instanceof Error && e.message === "MEDIA_TOO_LARGE") {
      await sendText(to, "Arquivo muito grande. Envie imagens de até 10 MB e áudios de até 5 MB.");
    } else if (e instanceof OpenAIError) {
      console.error("WhatsApp OpenAI error:", e.message);
      await sendText(to, e.status === 401 ? "A chave da OpenAI foi recusada. Atualize em Configurações → IA e WhatsApp." : `Erro na OpenAI: ${e.message}`);
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
    // responde 200 já; o processamento (IA) continua em segundo plano
    void (async () => {
      for (const m of messages) {
        try { await processMessage(m); } catch (e) { console.error("WhatsApp processMessage error:", e); }
      }
    })();
    return c.text("OK");
  });
}
