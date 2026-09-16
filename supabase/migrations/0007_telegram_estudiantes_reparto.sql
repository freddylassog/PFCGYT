-- ============================================================================
-- Migración 7: Telegram de cada estudiante (sobrevive al cambio de semestre,
-- se vincula por correo) y reparto de estudiantes por actividad.
-- ============================================================================
create table if not exists telegram_estudiantes (
  correo     text primary key,
  chat_id    text not null,
  nombre     text,
  created_at timestamptz not null default now()
);
alter table telegram_estudiantes enable row level security;

alter table settings add column if not exists telegram_bot_username text;
alter table settings add column if not exists telegram_webhook_url text;

alter table requests add column if not exists reparto jsonb not null default '[]'::jsonb;
