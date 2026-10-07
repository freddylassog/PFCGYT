-- Vínculo de Telegram por estudiante (y no solo por correo): los listados por materia de la universidad no traen correo,
-- así que el estudiante puede vincularse escribiendo su nombre completo al bot, y luego (opcional) su correo para el portal.
create table if not exists telegram_vinculos (
  chat_id    text primary key,
  student_id uuid not null references students (id) on delete cascade,
  nombre     text,
  at         timestamptz not null default now()
);
create index if not exists telegram_vinculos_student on telegram_vinculos (student_id);
alter table telegram_vinculos enable row level security;
