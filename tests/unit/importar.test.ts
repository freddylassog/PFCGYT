import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDia, parseEstudiantes, parseGenero, parseHora, parseHorarios, parsearCsv } from '../../lib/importar';

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
  assert.deepEqual(ok[0], { semestre: 1, dia: 2, inicio: '10:00', fin: '13:00', materia: 'Lenguaje', correoDocente: 'mcobo@ute.edu.ec' });
  assert.equal(errores.length, 1);
});

test('csv con punto y coma, comillas y BOM', () => {
  const filas = parsearCsv('﻿Nombre;Correo\n"Mena, Pablo";pmena@ute.edu.ec\n');
  assert.deepEqual(filas, [['Nombre', 'Correo'], ['Mena, Pablo', 'pmena@ute.edu.ec']]);
});
