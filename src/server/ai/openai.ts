import pool from "../db.js";
import { decryptSecret } from "../lib/crypto.js";

const API = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
export const DEFAULT_MODEL = "gpt-4o-mini";
export const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

export class OpenAIError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export interface TenantAI {
  apiKey: string;
  model: string;
}

/** Chave OpenAI do tenant (cadastrada em Configurações), ou null. */
export const getTenantAI = async (tenantId: number): Promise<TenantAI | null> => {
  const { rows } = await pool.query("SELECT openai_key_enc, openai_model FROM integrations WHERE tenant_id = $1", [tenantId]);
  if (!rows[0]?.openai_key_enc) return null;
  return { apiKey: decryptSecret(rows[0].openai_key_enc), model: rows[0].openai_model || DEFAULT_MODEL };
};

const fail = async (res: Response): Promise<never> => {
  let msg = `OpenAI ${res.status}`;
  try {
    const data = (await res.json()) as { error?: { message?: string } };
    if (data?.error?.message) msg = data.error.message;
  } catch { /* sem corpo */ }
  throw new OpenAIError(msg, res.status);
};

/** Valida a chave listando modelos. */
export const validateOpenAIKey = async (apiKey: string): Promise<void> => {
  const res = await fetch(`${API}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) await fail(res);
};

type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

/** Chat completion com saída estruturada (JSON schema estrito). */
export const chatJson = async <T>(ai: TenantAI, messages: ChatMessage[], schemaName: string, schema: object): Promise<T> => {
  const res = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ai.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ai.model,
      temperature: 0,
      messages,
      response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
    }),
  });
  if (!res.ok) await fail(res);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new OpenAIError("Resposta vazia da OpenAI");
  return JSON.parse(content) as T;
};

/** Transcreve áudio (nota de voz do WhatsApp: ogg/opus) em português. */
export const transcribeAudio = async (ai: TenantAI, audio: Buffer, mime: string): Promise<string> => {
  const ext = mime.includes("ogg") ? "ogg" : mime.includes("mpeg") ? "mp3" : mime.includes("mp4") ? "m4a" : "ogg";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), `audio.${ext}`);
  form.append("model", TRANSCRIBE_MODEL);
  form.append("language", "pt");
  const res = await fetch(`${API}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${ai.apiKey}` },
    body: form,
  });
  if (!res.ok) await fail(res);
  const data = (await res.json()) as { text?: string };
  return (data.text || "").trim();
};
