-- ============================================================================
-- Migración 6: canal de Telegram de estudiantes y recordatorios diarios.
-- ============================================================================
alter table settings add column if not exists telegram_canal_id text;
alter table settings add column if not exists telegram_canal_nombre text;
alter table settings add column if not exists ultimo_recordatorio date;
alter table requests add column if not exists telegram_post_at timestamptz;
