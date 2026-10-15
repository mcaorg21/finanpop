import type { Hono } from "hono";
import { randomInt } from "crypto";
import pool from "./db.js";
import { encryptSecret } from "./lib/crypto.js";
import { hasEnterprise, requireEnterprise } from "./lib/plan.js";
import { phoneKey } from "./lib/phone.js";
import { DEFAULT_MODEL, OpenAIError, getTenantAI, validateOpenAIKey } from "./ai/openai.js";
import { parseExpense } from "./ai/parse-expense.js";

type Env = { Variables: { currentUser: { id: number; name: string; username: string; tenant_id: number }; tenantId: number } };

const MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];

/** Rotas de Configurações → IA e WhatsApp. Tudo, exceto /status, exige plano Enterprise. */
export function registerIntegrationRoutes(app: Hono<Env>, authMiddleware: any) {
  app.get("/api/integrations/status", authMiddleware, async (c) => {
    const tenantId = c.get("tenantId") as number;
    const user = c.get("currentUser") as { id: number };
    const enterprise = await hasEnterprise(tenantId);
    if (!enterprise) return c.json({ enterprise: false });

    const [integ, link] = await Promise.all([
      pool.query("SELECT openai_key_last4, openai_model FROM integrations WHERE tenant_id = $1 AND openai_key_enc IS NOT NULL", [tenantId]),
      pool.query("SELECT phone, verified_at, link_code, link_code_expires FROM whatsapp_links WHERE user_id = $1", [user.id]),
    ]);
    const l = link.rows[0];
    const pendingCode = l && !l.verified_at && l.link_code && new Date(l.link_code_expires) > new Date();
    return c.json({
      enterprise: true,
      models: MODELS,
      openai: integ.rows[0]
        ? { configured: true, last4: integ.rows[0].openai_key_last4, model: integ.rows[0].openai_model || DEFAULT_MODEL }
        : { configured: false, last4: null, model: DEFAULT_MODEL },
      whatsapp: {
        number: process.env.WHATSAPP_DISPLAY_NUMBER || null,
        linked: !!l?.verified_at,
        phone: l?.phone ?? null,
        pending_code: pendingCode ? l.link_code : null,
        pending_expires: pendingCode ? l.link_code_expires : null,
      },
    });
  });

  app.put("/api/integrations/openai", authMiddleware, requireEnterprise, async (c) => {
    const tenantId = c.get("tenantId") as number;
    const { api_key, model } = await c.req.json();
    const chosenModel = MODELS.includes(model) ? model : DEFAULT_MODEL;

    if (api_key) {
      const key = String(api_key).trim();
      if (!key.startsWith("sk-")) return c.json({ error: "Chave inválida: ela deve começar com sk-" }, 400);
      try {
        await validateOpenAIKey(key);
      } catch (e) {
        const msg = e instanceof OpenAIError ? e.message : "Não foi possível validar a chave";
        return c.json({ error: `A OpenAI recusou a chave: ${msg}` }, 400);
      }
      let enc: string;
      try {
        enc = encryptSecret(key);
      } catch (e) {
        console.error("encryptSecret:", e);
        return c.json({ error: "Servidor sem SECRETS_KEY configurada" }, 500);
      }
      await pool.query(
        `INSERT INTO integrations (tenant_id, openai_key_enc, openai_key_last4, openai_model, updated_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (tenant_id) DO UPDATE SET openai_key_enc = $2, openai_key_last4 = $3, openai_model = $4, updated_at = NOW()`,
        [tenantId, enc, key.slice(-4), chosenModel]
      );
    } else {
      // só troca o modelo, mantendo a chave atual
      const { rowCount } = await pool.query("UPDATE integrations SET openai_model = $1, updated_at = NOW() WHERE tenant_id = $2 AND openai_key_enc IS NOT NULL", [chosenModel, tenantId]);
      if (!rowCount) return c.json({ error: "Informe a chave da OpenAI" }, 400);
    }
    return c.json({ success: true });
  });

  app.delete("/api/integrations/openai", authMiddleware, requireEnterprise, async (c) => {
    const tenantId = c.get("tenantId") as number;
    await pool.query("UPDATE integrations SET openai_key_enc = NULL, openai_key_last4 = NULL, updated_at = NOW() WHERE tenant_id = $1", [tenantId]);
    return c.json({ success: true });
  });

  app.post("/api/integrations/whatsapp/link", authMiddleware, requireEnterprise, async (c) => {
    const tenantId = c.get("tenantId") as number;
    const user = c.get("currentUser") as { id: number };
    const { phone } = await c.req.json();
    const key = phoneKey(String(phone ?? ""));
    if (!key) return c.json({ error: "Telefone inválido. Use DDD + número, ex.: (11) 99999-8888" }, 400);

    const { rows: taken } = await pool.query("SELECT user_id FROM whatsapp_links WHERE phone = $1 AND verified_at IS NOT NULL AND user_id <> $2", [key, user.id]);
    if (taken[0]) return c.json({ error: "Este telefone já está vinculado a outro usuário" }, 400);

    const code = String(randomInt(100000, 1000000));
    await pool.query(
      `INSERT INTO whatsapp_links (tenant_id, user_id, phone, link_code, link_code_expires, verified_at)
       VALUES ($1,$2,$3,$4, NOW() + INTERVAL '15 minutes', NULL)
       ON CONFLICT (user_id) DO UPDATE SET tenant_id = $1, phone = $3, link_code = $4, link_code_expires = NOW() + INTERVAL '15 minutes', verified_at = NULL`,
      [tenantId, user.id, key, code]
    );
    return c.json({ success: true, code, number: process.env.WHATSAPP_DISPLAY_NUMBER || null, message: `VINCULAR ${code}` });
  });

  app.delete("/api/integrations/whatsapp/link", authMiddleware, requireEnterprise, async (c) => {
    const user = c.get("currentUser") as { id: number };
    await pool.query("DELETE FROM whatsapp_links WHERE user_id = $1", [user.id]);
    return c.json({ success: true });
  });

  // Teste do interpretador sem passar pelo WhatsApp.
  app.post("/api/integrations/ai/parse", authMiddleware, requireEnterprise, async (c) => {
    const tenantId = c.get("tenantId") as number;
    const { text } = await c.req.json();
    if (!text || typeof text !== "string") return c.json({ error: "Informe o texto" }, 400);
    const ai = await getTenantAI(tenantId);
    if (!ai) return c.json({ error: "Cadastre a chave da OpenAI primeiro" }, 400);
    try {
      return c.json(await parseExpense(tenantId, ai, { text }));
    } catch (e) {
      return c.json({ error: e instanceof OpenAIError ? e.message : "Erro ao interpretar" }, 502);
    }
  });
}
