-- Eventos de varios días: ¿van los mismos estudiantes todos los días (true) o se reparte el total entre los días (false)?
alter table requests add column if not exists mismos_estudiantes boolean not null default true;
