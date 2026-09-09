-- ============================================================================
-- Protocolo de eventos · FCGT · Universidad UTE
-- Migración inicial. Pegar completa en Supabase → SQL Editor → Run.
-- Es idempotente: se puede volver a ejecutar sin romper nada.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Configuración por periodo (semestre). Solo una fila puede ser "actual".
-- ---------------------------------------------------------------------------
create table if not exists settings (
  periodo                  text primary key,               -- '2026-2'
  actual                   boolean not null default false,
  inicio_semestre          date not null,                  -- lunes de la semana 1
  semanas                  integer not null default 16,
  horas_semana             integer not null default 20,
  correo_decanato          text,
  correo_grupo_estudiantes text,                           -- grupo de Outlook de estudiantes
  correo_coordinacion      text,
  matriz_enviada           jsonb not null default '{}'::jsonb,  -- {"1":"2026-09-08"}
  archivos                 jsonb not null default '{}'::jsonb,  -- info de los Excel cargados
  created_at               timestamptz not null default now()
);
create unique index if not exists settings_actual_unico on settings (actual) where actual;

-- ---------------------------------------------------------------------------
-- Estudiantes (se cargan desde Excel; nunca se borran, se desactivan)
-- ---------------------------------------------------------------------------
create table if not exists students (
  id         uuid primary key default gen_random_uuid(),
  periodo    text not null references settings (periodo),
  nombre     text not null,
  correo     text not null,
  semestre   integer not null check (semestre between 1 and 3),
  genero     text not null check (genero in ('F', 'M')),
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (periodo, correo)
);

-- ---------------------------------------------------------------------------
-- Docentes
-- ---------------------------------------------------------------------------
create table if not exists teachers (
  id         uuid primary key default gen_random_uuid(),
  periodo    text not null references settings (periodo),
  nombre     text not null,
  correo     text not null,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (periodo, correo)
);

-- ---------------------------------------------------------------------------
-- Clases (horario semanal por semestre). dia: 1 = lunes … 5 = viernes
-- ---------------------------------------------------------------------------
create table if not exists classes (
  id         uuid primary key default gen_random_uuid(),
  periodo    text not null references settings (periodo),
  semestre   integer not null check (semestre between 1 and 3),
  dia        integer not null check (dia between 1 and 5),
  inicio     time not null,
  fin        time not null,
  materia    text not null,
  teacher_id uuid references teachers (id) on delete set null,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (periodo, semestre, dia, inicio, materia)
);

-- ---------------------------------------------------------------------------
-- Materia que recibe la nota de protocolo en cada semestre
-- ---------------------------------------------------------------------------
create table if not exists grade_subjects (
  periodo    text not null references settings (periodo),
  semestre   integer not null check (semestre between 1 and 3),
  materia    text not null,
  teacher_id uuid references teachers (id) on delete set null,
  primary key (periodo, semestre)
);

-- ---------------------------------------------------------------------------
-- Pedidos de apoyo protocolario
-- ---------------------------------------------------------------------------
create table if not exists requests (
  id                 uuid primary key default gen_random_uuid(),
  periodo            text not null references settings (periodo),
  numero             integer not null,
  codigo             text not null unique,                 -- SOL-2026-001
  nombre             text not null,
  cargo              text not null,
  institucion        text not null,
  correo_solicitante text,
  tipo               text not null check (tipo in ('interno', 'externo')),
  convenio           text not null default 'si' check (convenio in ('si', 'no')),
  evento             text not null,
  fecha              date not null,
  inicio             time not null,
  fin                time not null,
  lugar              text not null,
  lejos              boolean not null default false,
  responsable        text not null,
  cantidad           integer not null check (cantidad between 1 and 20),
  actividades        text[] not null default '{}',
  vestimenta         text not null check (vestimenta in ('uniforme', 'formal', 'ninguna')),
  evidencia_path     text,
  evidencia_nombre   text,
  estado             text not null default 'Pendiente'
                     check (estado in ('Pendiente', 'Ajustes', 'Aprobado', 'Rechazado')),
  convocada_at       date,
  clave              text,
  created_at         timestamptz not null default now(),
  unique (periodo, numero)
);
create index if not exists requests_fecha_idx on requests (periodo, fecha);

-- ---------------------------------------------------------------------------
-- Inscripciones de estudiantes a eventos
-- ---------------------------------------------------------------------------
create table if not exists enrollments (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references requests (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  estado     text not null default 'inscrito'
             check (estado in ('inscrito', 'confirmado', 'rechazado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, student_id)
);

-- ---------------------------------------------------------------------------
-- Avisos a docentes por cruce con clases (uno por evento + clase)
-- ---------------------------------------------------------------------------
create table if not exists teacher_notices (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references requests (id) on delete cascade,
  class_id    uuid not null references classes (id) on delete cascade,
  student_ids uuid[] not null default '{}',
  sent_at     date,                                        -- null = pendiente de envío
  created_at  timestamptz not null default now(),
  unique (request_id, class_id)
);

-- ---------------------------------------------------------------------------
-- Uniformes: prendas entregadas y devolución
-- ---------------------------------------------------------------------------
create table if not exists uniform_items (
  student_id   uuid not null references students (id) on delete cascade,
  item         text not null,
  entregado_at date not null default current_date,
  primary key (student_id, item)
);

create table if not exists uniform_returns (
  student_id uuid primary key references students (id) on delete cascade,
  estado     text not null check (estado in ('lavado', 'rechazado')),
  at         date not null default current_date
);

-- ---------------------------------------------------------------------------
-- Novedades (incidentes) de estudiantes en eventos
-- ---------------------------------------------------------------------------
create table if not exists incidents (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references requests (id) on delete cascade,
  student_id   uuid not null references students (id) on delete cascade,
  tipo         text not null,
  nota         text not null default '',
  fecha        date not null default current_date,
  reportado_at date,                                       -- null = sin reportar
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Seguridad: RLS activado sin políticas. La app se conecta con el rol
-- propietario (postgres) y nunca expone la anon key para tablas, así que
-- nadie puede leer datos desde fuera con la API pública.
-- ---------------------------------------------------------------------------
alter table settings        enable row level security;
alter table students        enable row level security;
alter table teachers        enable row level security;
alter table classes         enable row level security;
alter table grade_subjects  enable row level security;
alter table requests        enable row level security;
alter table enrollments     enable row level security;
alter table teacher_notices enable row level security;
alter table uniform_items   enable row level security;
alter table uniform_returns enable row level security;
alter table incidents       enable row level security;

-- ---------------------------------------------------------------------------
-- Bucket privado de evidencias (solo existe en Supabase; se omite en local)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('evidencias', 'evidencias', false, 15728640,
            array['image/jpeg','image/png','image/webp','image/heic','image/gif','application/pdf'])
    on conflict (id) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Semilla: periodo 2026-2 (16 semanas desde el lunes 5 oct 2026) y materias fijas
-- ---------------------------------------------------------------------------
insert into settings (periodo, actual, inicio_semestre, semanas, horas_semana)
values ('2026-2', true, '2026-10-05', 16, 20)
on conflict (periodo) do nothing;

insert into grade_subjects (periodo, semestre, materia) values
  ('2026-2', 1, 'Lenguaje'),
  ('2026-2', 2, 'Investigación'),
  ('2026-2', 3, 'Cultura Gastronómica')
on conflict (periodo, semestre) do nothing;
