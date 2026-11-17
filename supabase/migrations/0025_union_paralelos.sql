-- Paralelos unidos: en un semestre, las materias de aula (hasta N horas de clase por día) se dictan a todos los
-- paralelos con el horario de uno de ellos; los talleres prácticos (más de N horas en un día) siguen por paralelo.
-- Este periodo: 1.º semestre unido con el horario de 1C, talleres > 2 h por día por separado.
-- Se edita en Horarios → Paralelos unidos.
alter table settings add column if not exists union_paralelos jsonb not null default '[]'::jsonb;
update settings set union_paralelos = '[{"semestre": 1, "paralelo": "C", "horasMax": 2}]'::jsonb
 where actual and union_paralelos = '[]'::jsonb;
