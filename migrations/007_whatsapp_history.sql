-- Histórico curto da conversa no WhatsApp: dá contexto à IA ("o mesmo", "no cartão", "e mais 10").
-- Guarda o que o usuário enviou (texto/transcrição) e o que o FinanPOP respondeu; apagado após 24 h.
CREATE TABLE IF NOT EXISTS whatsapp_history (
  id SERIAL PRIMARY KEY,
  phone TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_history_phone ON whatsapp_history (phone, id);
