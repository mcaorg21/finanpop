// Cliente mínimo da WhatsApp Cloud API (Meta). Credenciais são da plataforma FinanPOP (env).
const GRAPH = process.env.WHATSAPP_GRAPH_URL || "https://graph.facebook.com/v21.0";

const token = () => {
  const t = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!t) throw new Error("WHATSAPP_ACCESS_TOKEN não configurado");
  return t;
};
const phoneNumberId = () => {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error("WHATSAPP_PHONE_NUMBER_ID não configurado");
  return id;
};

const post = async (body: object) => {
  const res = await fetch(`${GRAPH}/${phoneNumberId()}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  if (!res.ok) console.error("WhatsApp send error:", res.status, await res.text());
};

export const sendText = (to: string, text: string) =>
  post({ to, type: "text", text: { body: text.slice(0, 4000) } });

/** Mensagem com até 3 botões de resposta rápida (título ≤ 20 caracteres). */
export const sendButtons = (to: string, body: string, buttons: { id: string; title: string }[]) =>
  post({
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: body.slice(0, 1024) },
      action: { buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  });

/** Baixa uma mídia recebida (duas chamadas: metadados → URL assinada). */
export const downloadMedia = async (mediaId: string, maxBytes: number): Promise<{ buffer: Buffer; mime: string }> => {
  const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token()}` } });
  if (!meta.ok) throw new Error(`Falha ao obter mídia (${meta.status})`);
  const info = (await meta.json()) as { url: string; mime_type: string; file_size?: number };
  if (info.file_size && info.file_size > maxBytes) throw new Error("MEDIA_TOO_LARGE");
  const file = await fetch(info.url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!file.ok) throw new Error(`Falha ao baixar mídia (${file.status})`);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > maxBytes) throw new Error("MEDIA_TOO_LARGE");
  return { buffer, mime: info.mime_type };
};
