-- Al recibir el uniforme lavado, las prendas del estudiante vuelven a bodega (se borran de uniform_items) y se
-- guardan aquí para poder deshacer el registro y restituirlas.
alter table uniform_event_returns add column if not exists prendas text[] not null default '{}';
