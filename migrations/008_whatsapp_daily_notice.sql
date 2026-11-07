-- Aviso diário das contas do dia pelo WhatsApp (plano Enterprise). Idempotente; sem schema qualificado.
-- daily_notice/notice_hour: escolha do usuário (desligado por padrão: ele precisa ativar).
-- last_inbound_at/wa_from: última mensagem recebida desse usuário e o "from" exato que a Meta mandou; a Meta só aceita
--   texto livre até 24 h depois da última mensagem do usuário, e o aviso só sai dentro dessa janela.
-- last_notice_on: dia (São Paulo) do último aviso reivindicado, para nunca enviar duas vezes no mesmo dia.
ALTER TABLE whatsapp_links ADD COLUMN IF NOT EXISTS daily_notice BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE whatsapp_links ADD COLUMN IF NOT EXISTS notice_hour SMALLINT NOT NULL DEFAULT 8;
ALTER TABLE whatsapp_links ADD COLUMN IF NOT EXISTS last_inbound_at TIMESTAMPTZ;
ALTER TABLE whatsapp_links ADD COLUMN IF NOT EXISTS wa_from TEXT;
ALTER TABLE whatsapp_links ADD COLUMN IF NOT EXISTS last_notice_on DATE;
