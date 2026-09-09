import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDia, parseEstudiantes, parseGenero, parseHora, parseHorarios, parseRangos, parsearCsv } from '../../lib/importar';

test('horas en varios formatos', () => {
  assert.equal(parseHora('8:00'), '08:00');
  assert.equal(parseHora('10h30'), '10:30');
  assert.equal(parseHora('2 pm'), '14:00');
  assert.equal(parseHora('25:00'), null);
});

test('días y género', () => {
  assert.equal(parseDia('Miércoles'), 3);
  assert.equal(parseDia('VIERNES'), 5);
  assert.equal(parseDia('lun'), 1);
  assert.equal(parseDia('sábado'), null);
  assert.equal(parseGenero('Femenino'), 'F');
  assert.equal(parseGenero('m'), 'M');
  assert.equal(parseGenero('Mujer'), 'F');
  assert.equal(parseGenero(''), null);
});

test('estudiantes con columnas con acentos y errores por fila', () => {
  const filas = [
    { nombre: 'Camila Ríos', correo: 'Camila.Rios@ute.edu.ec', semestre: '1', genero: 'F' },
    { nombre: 'Sin correo', correo: '', semestre: '2', genero: 'M' },
    { nombre: 'Semestre malo', correo: 'x@ute.edu.ec', semestre: '7', genero: 'M' },
  ];
  const { ok, errores } = parseEstudiantes(filas);
  assert.equal(ok.length, 1);
  assert.equal(ok[0].correo, 'camila.rios@ute.edu.ec');
  assert.equal(errores.length, 2);
  assert.match(errores[0], /Fila 3/);
});

test('horarios', () => {
  const { ok, errores } = parseHorarios([
    { semestre: '1', dia: 'Martes', inicio: '10:00', fin: '13:00', materia: 'Lenguaje', 'correo docente': 'mcobo@ute.edu.ec' },
    { semestre: '1', dia: 'Martes', inicio: '13:00', fin: '10:00', materia: 'Al revés', 'correo docente': '' },
  ]);
  assert.equal(ok.length, 1);
  assert.deepEqual(ok[0], { semestre: 1, paralelo: '', dia: 2, inicio: '10:00', fin: '13:00', materia: 'Lenguaje', correoDocente: 'mcobo@ute.edu.ec', docenteNombre: '' });
  assert.equal(errores.length, 1);
});

test('rangos de hora escritos de cualquier manera', () => {
  assert.deepEqual(parseRangos('9:00-11:00'), [{ inicio: '09:00', fin: '11:00' }]);
  assert.deepEqual(parseRangos('07:00 -09:00'), [{ inicio: '07:00', fin: '09:00' }]);
  assert.deepEqual(parseRangos('9:00 10:00'), [{ inicio: '09:00', fin: '10:00' }]);
  assert.deepEqual(parseRangos('7:00-9:00 / 10:00-11:00'), [{ inicio: '07:00', fin: '09:00' }, { inicio: '10:00', fin: '11:00' }]);
  assert.deepEqual(parseRangos(''), []);
});

test('horario en formato ancho de la universidad', () => {
  const { ok, errores } = parseHorarios([
    { 'carrera programa': 'GASTRONOMIA', asignatura: 'TÉCNICAS BÁSICAS DE COCINA I', nivel: '1', paralelo: 'C1', horas: '5', nrc: '3180', docente: 'MARIN RIVADENEIRA FRANCISCO JAVIER', lunes: '', martes: '', miercoles: '', jueves: '13:30-17:30', viernes: '18:00 - 19:00' },
    { 'carrera programa': 'GASTRONOMIA', asignatura: 'SIN HORAS', nivel: '2', paralelo: 'A', horas: '3', nrc: '1', docente: 'ALGUIEN', lunes: '', martes: '', miercoles: '', jueves: '', viernes: '' },
  ]);
  assert.equal(ok.length, 2);
  assert.deepEqual(ok[0], { semestre: 1, paralelo: 'C1', dia: 4, inicio: '13:30', fin: '17:30', materia: 'TÉCNICAS BÁSICAS DE COCINA I', correoDocente: '', docenteNombre: 'MARIN RIVADENEIRA FRANCISCO JAVIER' });
  assert.equal(ok[1].dia, 5);
  assert.equal(errores.length, 1);
});

test('csv con punto y coma, comillas y BOM', () => {
  const filas = parsearCsv('﻿Nombre;Correo\n"Mena, Pablo";pmena@ute.edu.ec\n');
  assert.deepEqual(filas, [['Nombre', 'Correo'], ['Mena, Pablo', 'pmena@ute.edu.ec']]);
});
