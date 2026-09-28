-- Anticipación mínima configurable (horas) con fecha de caducidad de la excepción.
-- Regla normal: 72 h. Excepción de esta semana: 24 h hasta el 4 de octubre de 2026; después vuelve sola a 72 h.
alter table settings add column if not exists anticipacion_horas integer not null default 72;
alter table settings add column if not exists anticipacion_hasta date;
update settings set anticipacion_horas = 24, anticipacion_hasta = '2026-10-04' where actual and anticipacion_hasta is null and anticipacion_horas = 72;
