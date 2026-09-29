-- Días a los que asiste cada estudiante en un evento de varios días (null = todos los días).
alter table enrollments add column if not exists dias jsonb;
