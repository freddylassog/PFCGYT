-- ============================================================================
-- Migración 3: eventos de varios días. Cada pedido guarda su lista de días
-- (fecha, inicio, fin). fecha/inicio/fin siguen siendo el primer día.
-- ============================================================================
alter table requests add column if not exists dias jsonb not null default '[]'::jsonb;

update requests
   set dias = jsonb_build_array(jsonb_build_object('fecha', fecha::text, 'inicio', to_char(inicio, 'HH24:MI'), 'fin', to_char(fin, 'HH24:MI')))
 where dias = '[]'::jsonb;
