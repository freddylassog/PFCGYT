-- Estudiantes de otros semestres (4.º en adelante) que apoyan en un evento puntual: se registran a mano con su semestre.
-- Las reglas del programa (mínimo de eventos, matriz, horarios y materias) siguen siendo de 1.º a 3.º.
alter table students drop constraint if exists students_semestre_check;
alter table students add constraint students_semestre_check check (semestre between 1 and 10);
