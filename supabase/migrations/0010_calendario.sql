-- Enlace privado del calendario suscrito (iCalendar) de coordinación.
alter table settings add column if not exists calendario_token text;
