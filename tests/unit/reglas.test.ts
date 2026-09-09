import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOQUEAR_CRUCE_EVENTOS, FORM_INICIAL, claveVigente, codigoPedido, cruceClases, cruceEventos, cumple72h, faltasPedido, fechaLarga,
  fmtDur, genClave, horasDe, infoUniforme, normalizarClave, overlap, pasa4h, plazoTexto, semanaDe, transporteMotivo,
} from '../../lib/reglas';
import type { Clase } from '../../lib/tipos';

test('horas y duración', () => {
  assert.equal(horasDe('09:30', '13:00'), 3.5);
  assert.equal(horasDe('15:00', '18:00'), 3);
  assert.equal(horasDe('13:00', '09:00'), 0);
  assert.equal(fmtDur('09:00', '13:15'), '4 h 15 min');
  assert.equal(fmtDur('10:00', '10:00'), '—');
});

test('regla 72 h y plazo', () => {
  assert.equal(cumple72h('2026-09-11', '2026-09-08'), true);
  assert.equal(cumple72h('2026-09-10', '2026-09-08'), false);
  assert.equal(plazoTexto('2026-09-10', '2026-09-08'), '48 h · menos de 72 h');
  assert.equal(plazoTexto('2026-09-20', '2026-09-08'), '12 días de anticipación');
  assert.equal(plazoTexto('2026-09-01', '2026-09-08'), 'Fecha pasada');
});

test('alimentación y transporte', () => {
  assert.equal(pasa4h('09:00', '13:00'), false);
  assert.equal(pasa4h('09:00', '13:01'), true);
  assert.equal(transporteMotivo({ fin: '17:00', lejos: false }), null);
  assert.equal(transporteMotivo({ fin: '18:30', lejos: false }), 'Termina después de las 18:00');
  assert.equal(transporteMotivo({ fin: '12:00', lejos: true }), 'Lugar lejano');
  assert.equal(transporteMotivo({ fin: '22:00', lejos: true }), 'Termina después de las 18:00 y el lugar es lejano');
});

test('cruce de eventos', () => {
  const pedidos = [
    { id: 'a', fecha: '2026-09-22', inicio: '08:00', fin: '12:00', estado: 'Pendiente' as const, evento: 'A' },
    { id: 'b', fecha: '2026-09-22', inicio: '13:00', fin: '15:00', estado: 'Rechazado' as const, evento: 'B' },
  ];
  assert.equal(overlap('10:00', '13:00', '08:00', '12:00'), true);
  assert.equal(overlap('12:00', '13:00', '08:00', '12:00'), false);
  assert.equal(cruceEventos({ fecha: '2026-09-22', inicio: '10:00', fin: '13:00' }, pedidos)?.id, 'a');
  assert.equal(cruceEventos({ fecha: '2026-09-22', inicio: '13:00', fin: '14:00' }, pedidos), null, 'los rechazados no cuentan');
  assert.equal(cruceEventos({ fecha: '2026-09-22', inicio: '10:00', fin: '13:00' }, pedidos, 'a'), null, 'se excluye a sí mismo');
});

test('cruce con clases por día de la semana y semestres', () => {
  const clases: Clase[] = [
    { id: 'c2', semestre: 1, paralelo: 'A', dia: 2, inicio: '10:00', fin: '13:00', materia: 'Lenguaje', teacherId: null, activo: true },
    { id: 'c2c', semestre: 1, paralelo: 'C', dia: 2, inicio: '09:00', fin: '11:00', materia: 'Lenguaje', teacherId: null, activo: true },
    { id: 'c7', semestre: 2, paralelo: null, dia: 2, inicio: '08:00', fin: '10:00', materia: 'Investigación', teacherId: null, activo: true },
    { id: 'c12', semestre: 3, paralelo: 'A', dia: 2, inicio: '14:00', fin: '17:00', materia: 'Cultura', teacherId: null, activo: true },
    { id: 'c1', semestre: 1, paralelo: 'A', dia: 1, inicio: '07:00', fin: '09:00', materia: 'Turismo', teacherId: null, activo: true },
  ];
  const ev = { fecha: '2026-09-22', inicio: '08:00', fin: '12:00' }; // martes
  assert.deepEqual(cruceClases(ev, clases, []).map((c) => c.id), ['c2', 'c2c', 'c7'], 'sin confirmados: todas');
  assert.deepEqual(cruceClases(ev, clases, [{ semestre: 2, paralelo: null }]).map((c) => c.id), ['c7']);
  assert.deepEqual(cruceClases(ev, clases, [{ semestre: 1, paralelo: 'A' }]).map((c) => c.id), ['c2'], 'solo el paralelo A');
  assert.deepEqual(cruceClases(ev, clases, [{ semestre: 1, paralelo: null }]).map((c) => c.id), ['c2', 'c2c'], 'estudiante sin paralelo: ambos');
  assert.deepEqual(cruceClases({ ...ev, fecha: '2026-09-26' }, clases, []), [], 'sábado sin clases');
});

test('clave del evento', () => {
  assert.equal(normalizarClave(' ute-4k7q '), 'UTE-4K7Q');
  assert.equal(normalizarClave('4k7q'), 'UTE-4K7Q');
  assert.equal(normalizarClave('sol-2026-003'), 'SOL-2026-003', 'la clave normal es el código del evento');
  assert.equal(normalizarClave('SOL 2026 3'), 'SOL-2026-003');
  assert.equal(normalizarClave('2026-003'), 'SOL-2026-003');
  assert.match(genClave(() => 0), /^UTE-AAAA$/);
  assert.equal(claveVigente({ fecha: '2026-09-22', fin: '12:00' }, '2026-09-21', '23:00'), true);
  assert.equal(claveVigente({ fecha: '2026-09-22', fin: '12:00' }, '2026-09-22', '12:00'), true);
  assert.equal(claveVigente({ fecha: '2026-09-22', fin: '12:00' }, '2026-09-22', '12:01'), false);
  assert.equal(claveVigente({ fecha: '2026-09-22', fin: '12:00' }, '2026-09-23', '08:00'), false);
});

test('código, semana y fechas', () => {
  assert.equal(codigoPedido('2026-2', 7), 'SOL-2026-007');
  assert.equal(semanaDe('2026-09-08', '2026-09-07'), 1);
  assert.equal(semanaDe('2026-09-14', '2026-09-07'), 2);
  assert.equal(fechaLarga('2026-09-08'), 'martes 8 sep 2026');
});

test('uniforme', () => {
  const u = infoUniforme('F', ['Vestido']);
  assert.equal(u.estado, 'Parcial 1/3');
  assert.deepEqual(u.faltan, ['Correa', 'Lazo']);
  assert.equal(infoUniforme('M', ['Pantalón', 'Camisa', 'Chaleco', 'Corbatín', 'Chaqueta', 'Pin']).completo, true);
});

test('validación del formulario por pasos', () => {
  const hoy = '2026-09-08';
  const f = { ...FORM_INICIAL, evidenciaPath: 'x', evidenciaNombre: 'x.pdf', nombre: 'A', cargo: 'B', institucion: 'C', correoSolicitante: 'a@b.co', evento: 'E', fecha: '2026-09-22', lugar: 'L', responsable: 'R', actividades: ['Guía de invitados'], acepta: true };
  assert.deepEqual(faltasPedido(f, hoy, null), [[], [], [], []]);
  assert.deepEqual(faltasPedido({ ...f, fecha: '2026-09-09' }, hoy, null)[1], ['fecha con al menos 72 h']);
  assert.deepEqual(faltasPedido({ ...f, correoSolicitante: 'malo' }, hoy, null)[0], ['correo válido']);
  const conCruce = faltasPedido(f, hoy, { evento: 'Otro' })[1];
  assert.equal(conCruce.includes('horario sin cruce'), BLOQUEAR_CRUCE_EVENTOS, 'el cruce bloquea solo si está configurado');
});
