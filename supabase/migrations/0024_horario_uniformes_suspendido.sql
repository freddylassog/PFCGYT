-- Horario fijo de retiro y devolución de uniformes suspendido hasta nueva orden (coordinación tendrá horarios nuevos).
-- Se guarda una copia del horario anterior en uniforme_horario_anterior y el horario queda vacío: la app muestra
-- «horario por confirmar» hasta que coordinación fije el nuevo en Resumen → Ajustes. Corre una sola vez.
alter table settings add column if not exists uniforme_horario_anterior jsonb;
update settings
   set uniforme_horario_anterior = uniforme_horario,
       uniforme_horario = '[]'::jsonb
 where actual and uniforme_horario is not null and uniforme_horario <> '[]'::jsonb;
