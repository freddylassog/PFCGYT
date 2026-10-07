-- Devolución del uniforme por evento: cada estudiante confirmado devuelve el uniforme lavado dentro del plazo
-- (settings.uniforme_dias_devolucion días después de su último día del evento; 7 por defecto). Reemplaza la
-- devolución única de fin de semestre (uniform_returns), que queda sin uso.
create table if not exists uniform_event_returns (
  request_id uuid not null references requests (id) on delete cascade,
  student_id uuid not null references students (id) on delete cascade,
  estado     text not null check (estado in ('lavado', 'rechazado')),
  at         date not null default current_date,
  primary key (request_id, student_id)
);
alter table uniform_event_returns enable row level security;
alter table settings add column if not exists uniforme_dias_devolucion integer not null default 7;
