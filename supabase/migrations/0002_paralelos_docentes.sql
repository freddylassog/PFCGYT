-- ============================================================================
-- Migración 2: paralelos y docentes sin correo.
-- Pegar completa en Supabase → SQL Editor → Run (después de la migración 1).
-- ============================================================================

-- Los horarios de la universidad traen el nombre del docente pero no su correo.
alter table teachers alter column correo drop not null;

-- Paralelo (A, B, C, B1…) en estudiantes y clases. Vacío = aplica a todos.
alter table students add column if not exists paralelo text;
alter table classes  add column if not exists paralelo text;

-- La clase se identifica también por su paralelo.
alter table classes drop constraint if exists classes_periodo_semestre_dia_inicio_materia_key;
create unique index if not exists classes_unica
  on classes (periodo, semestre, dia, inicio, materia, coalesce(paralelo, ''));
