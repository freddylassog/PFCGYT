-- Acta de compromiso firmada (opcional): archivo que coordinación sube al pedido.
alter table requests add column if not exists acta_firmada_path text;
alter table requests add column if not exists acta_firmada_nombre text;
alter table requests add column if not exists acta_firmada_at timestamptz;
