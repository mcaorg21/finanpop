-- Integração IA + WhatsApp (plano Enterprise). Idempotente; sem schema qualificado
-- (o search_path da conexão resolve: finanpop em produção).
BEGIN;

CREATE TABLE IF NOT EXISTS integrations (
  tenant_id INTEGER PRIMARY KEY,
  openai_key_enc TEXT,
  openai_key_last4 TEXT,
  openai_model TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_links (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  link_code TEXT,
  link_code_expires TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- um telefone só pode estar verificado em um usuário
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_links_phone_verified
  ON whatsapp_links (phone) WHERE verified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_whatsapp_links_code ON whatsapp_links (link_code) WHERE link_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS whatsapp_pending (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  draft JSONB NOT NULL,
  media_path TEXT,
  media_type TEXT,
  status TEXT NOT NULL DEFAULT 'WAITING',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_pending_phone ON whatsapp_pending (phone, status);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  wa_message_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

COMMIT;
