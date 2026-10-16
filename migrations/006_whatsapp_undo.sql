-- "Desfazer" no WhatsApp: guarda qual lançamento cada confirmação criou.
ALTER TABLE whatsapp_pending ADD COLUMN IF NOT EXISTS transaction_id INTEGER;
ALTER TABLE whatsapp_pending ADD COLUMN IF NOT EXISTS undone_at TIMESTAMPTZ;
