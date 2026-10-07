-- Horario fijo de retiro y devolución de uniformes durante todo el periodo: una franja de 2 horas por día de la semana
-- (1 = lunes … 5 = viernes) y quién atiende. Se edita en Resumen → Ajustes. Se propone el horario que cuadra con las
-- clases de coordinación y de las estudiantes de apoyo: L-M-V 11:00–13:00 (estudiantes de apoyo) y M-J 13:00–15:00 (coordinación).
alter table settings add column if not exists uniforme_horario jsonb;
update settings set uniforme_horario = '[
  {"dia": 1, "inicio": "11:00", "fin": "13:00", "atiende": "Estudiantes de apoyo"},
  {"dia": 2, "inicio": "13:00", "fin": "15:00", "atiende": "Coordinación"},
  {"dia": 3, "inicio": "11:00", "fin": "13:00", "atiende": "Estudiantes de apoyo"},
  {"dia": 4, "inicio": "13:00", "fin": "15:00", "atiende": "Coordinación"},
  {"dia": 5, "inicio": "11:00", "fin": "13:00", "atiende": "Estudiantes de apoyo"}
]'::jsonb where uniforme_horario is null;
