-- Migration 003: agrupamento de parcelas/repetições e índices por vencimento/pagamento.
-- Idempotente; colunas nulas para não afetar o código anterior.

BEGIN;

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS group_index INTEGER;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS group_count INTEGER;

CREATE INDEX IF NOT EXISTS idx_transactions_group_id ON transactions (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_due ON transactions (tenant_id, due_date);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_payment ON transactions (tenant_id, payment_date);

COMMIT;
