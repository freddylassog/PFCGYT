-- La tabla de control de migraciones también queda con seguridad por filas (aviso de Supabase: rls_disabled_in_public).
alter table if exists schema_migrations enable row level security;
