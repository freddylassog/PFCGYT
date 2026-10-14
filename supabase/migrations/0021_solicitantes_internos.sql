-- Solicitantes internos frecuentes: personal de la universidad que pide eventos seguido. Al escribir su correo en el
-- formulario público, el pedido se reconoce como evento interno y no necesita adjunto (el formulario es el pedido).
-- Se editan en Coordinación → Resumen → Ajustes; no van en el código.
alter table settings add column if not exists solicitantes_internos jsonb not null default '[]'::jsonb;
