-- ============================================================================
-- Migração 001 — adiciona updated_at às tabelas de registros/lançamentos que
-- passam a ter edição no painel administrativo (funcionalidade de EDIÇÃO
-- COMPLETA). Essas tabelas foram criadas originalmente como "somente
-- inserção", por isso não tinham a coluna. Idempotente (pode rodar mais de
-- uma vez sem erro).
-- ============================================================================

ALTER TABLE mortality_records      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE vaccinations           ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE medications            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE health_records         ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE feed_consumptions      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE feed_movements         ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE egg_inventory_movements ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE environmental_records  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
