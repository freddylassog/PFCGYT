-- Vestimenta «Otra»: el solicitante la describe con sus palabras (reemplaza a «No aplica · informal» en el formulario;
-- los pedidos antiguos con 'ninguna' se conservan).
alter table requests drop constraint if exists requests_vestimenta_check;
alter table requests add constraint requests_vestimenta_check check (vestimenta in ('uniforme', 'formal', 'ninguna', 'otra'));
alter table requests add column if not exists vestimenta_detalle text not null default '';
