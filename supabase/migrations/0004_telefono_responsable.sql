-- ============================================================================
-- Migración 4: teléfono del responsable en sitio (contacto para coordinar el evento).
-- ============================================================================
alter table requests add column if not exists responsable_telefono text not null default '';
