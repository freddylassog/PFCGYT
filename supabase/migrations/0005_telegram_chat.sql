-- ============================================================================
-- Migración 5: chat de Telegram de coordinación (se detecta desde la app).
-- ============================================================================
alter table settings add column if not exists telegram_chat_id text;
alter table settings add column if not exists telegram_chat_nombre text;
