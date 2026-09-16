-- Fin de evento: coordinación marca un evento aprobado como finalizado (fecha en que se cerró).
alter table requests add column if not exists finalizado_at date;
