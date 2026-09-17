-- Citas de entrega y devolución de uniformes por evento (fecha, hora y lugar que fija coordinación)
-- y lugar habitual de entrega en los ajustes del periodo.
alter table requests add column if not exists uniforme_cita jsonb;
alter table settings add column if not exists uniforme_lugar text not null default '';
