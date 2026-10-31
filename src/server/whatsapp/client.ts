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

export interface SendResult {
  ok: boolean;
  wamid?: string;
}

const post = async (body: object): Promise<SendResult> => {
  const res = await fetch(`${GRAPH}/${phoneNumberId()}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  if (!res.ok) {
    console.error("WhatsApp send error:", res.status, await res.text());
    return { ok: false };
  }
  const data = (await res.json().catch(() => null)) as { messages?: { id?: string }[] } | null;
  return { ok: true, wamid: data?.messages?.[0]?.id };
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

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

/**
 * Mensagem de lista (menu de atalhos). Limites da Meta: no máximo 10 linhas no total, título da linha ≤ 24,
 * descrição ≤ 72, botão ≤ 20, corpo ≤ 1024.
 */
export const sendList = (to: string, body: string, buttonLabel: string, sectionTitle: string, rows: ListRow[]) =>
  post({
    to,
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: body.slice(0, 1024) },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: [
          {
            title: sectionTitle.slice(0, 24),
            rows: rows.slice(0, 10).map((r) => ({
              id: r.id,
              title: r.title.slice(0, 24),
              ...(r.description ? { description: r.description.slice(0, 72) } : {}),
            })),
          },
        ],
      },
    },
  });

/** Envia a imagem ao servidor da Meta e devolve o id da mídia (PNG/JPEG até 5 MB). */
export const uploadMedia = async (buffer: Buffer, mime: string, filename: string): Promise<string> => {
  if (buffer.length > 5 * 1024 * 1024) throw new Error("MEDIA_TOO_LARGE");
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mime }), filename);
  const res = await fetch(`${GRAPH}/${phoneNumberId()}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Falha ao enviar mídia (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Resposta sem id de mídia");
  return data.id;
};

/** Imagem já enviada com `uploadMedia`; a legenda aceita até 1024 caracteres. */
export const sendImage = (to: string, mediaId: string, caption: string) =>
  post({ to, type: "image", image: { id: mediaId, caption: caption.slice(0, 1024) } });

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
