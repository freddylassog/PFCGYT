-- Matrícula real por materia (NRC): cada clase del horario lleva su NRC y cada estudiante tiene la lista de NRC en los que
-- está matriculado. Así el cruce con clases (y los correos a docentes) se calcula por lo que cada estudiante cursa de verdad,
-- no por "todas las materias del semestre". Los listados por materia no traen correo: el correo puede quedar vacío hasta
-- completarlo (plantilla en Estudiantes).
alter table classes add column if not exists nrc text;
create table if not exists student_classes (
  student_id uuid not null references students (id) on delete cascade,
  nrc        text not null,
  primary key (student_id, nrc)
);
alter table student_classes enable row level security;
alter table students alter column correo drop not null;
