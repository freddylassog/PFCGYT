import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLOQUEAR_CRUCE_EVENTOS, FORM_INICIAL, claveVigente, codigoPedido, cruceClases, cruceEventos, cumple72h, faltasDias, faltasPedido, fechaCortaDias, fechaLarga,
  fechaLargaDias, fmtDur, genClave, horarioTextoDias, horasDe, horasDias, infoUniforme, normalizarClave, overlap, pasa4h, pasa4hDias, plazoTexto, semanaDe, transporteMotivo, transporteMotivoDias,
  alternarActividad, ajustarRepartoATotal, faltasReparto, repartoTexto,
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

test('cruce de eventos (por día y hora)', () => {
  const pedidos = [
    { id: 'a', estado: 'Pendiente' as const, evento: 'A', dias: [{ fecha: '2026-09-22', inicio: '08:00', fin: '12:00' }, { fecha: '2026-09-23', inicio: '08:00', fin: '12:00' }] },
    { id: 'b', estado: 'Rechazado' as const, evento: 'B', dias: [{ fecha: '2026-09-22', inicio: '13:00', fin: '15:00' }] },
  ];
  assert.equal(overlap('10:00', '13:00', '08:00', '12:00'), true);
  assert.equal(overlap('12:00', '13:00', '08:00', '12:00'), false);
  const c = cruceEventos({ dias: [{ fecha: '2026-09-23', inicio: '10:00', fin: '13:00' }] }, pedidos);
  assert.equal(c?.pedido.id, 'a');
  assert.equal(c?.dia.fecha, '2026-09-23', 'indica el día que se cruza');
  assert.equal(cruceEventos({ dias: [{ fecha: '2026-09-22', inicio: '13:00', fin: '14:00' }] }, pedidos), null, 'mismo día, otra hora: permitido; los rechazados no cuentan');
  assert.equal(cruceEventos({ dias: [{ fecha: '2026-09-22', inicio: '10:00', fin: '13:00' }] }, pedidos, 'a'), null, 'se excluye a sí mismo');
});

test('eventos de varios días: horas, textos, reglas', () => {
  const dias = [{ fecha: '2026-09-23', inicio: '09:00', fin: '13:00' }, { fecha: '2026-09-22', inicio: '08:00', fin: '12:30' }, { fecha: '2026-09-24', inicio: '14:00', fin: '19:00' }];
  assert.equal(horasDias(dias), 13.5, 'suma de los tres días');
  assert.equal(fechaLargaDias(dias), '22, 23 y 24 sep 2026');
  assert.equal(fechaCortaDias(dias), '22–24 sep');
  assert.equal(horarioTextoDias(dias), '22 sep 08:00–12:30 · 23 sep 09:00–13:00 · 24 sep 14:00–19:00');
  assert.equal(horarioTextoDias([{ fecha: '2026-09-22', inicio: '08:00', fin: '12:00' }, { fecha: '2026-09-23', inicio: '08:00', fin: '12:00' }]), '08:00–12:00', 'mismo horario todos los días');
  assert.equal(pasa4hDias(dias), true, 'un día pasa de 4 h');
  assert.equal(pasa4hDias([{ fecha: '2026-09-22', inicio: '08:00', fin: '11:00' }, { fecha: '2026-09-23', inicio: '08:00', fin: '11:00' }]), false, '6 h en dos días de 3 h no exige alimentación');
  assert.equal(transporteMotivoDias({ dias, lejos: false }), 'Termina después de las 18:00');
  assert.deepEqual(faltasDias(dias, '2026-09-08'), []);
  assert.deepEqual(faltasDias([dias[0], dias[0]], '2026-09-08'), ['fechas sin repetir']);
  assert.deepEqual(faltasDias([{ fecha: '2026-09-09', inicio: '08:00', fin: '12:00' }], '2026-09-08'), ['fecha con al menos 72 h']);
  assert.deepEqual(faltasDias([{ fecha: '2026-09-09', inicio: '08:00', fin: '12:00' }], '2026-09-08', false), [], 'coordinación puede editar fechas cercanas');
});

test('cruce con clases por día de la semana y semestres', () => {
  const clases: Clase[] = [
    { id: 'c2', semestre: 1, paralelo: 'A', dia: 2, inicio: '10:00', fin: '13:00', materia: 'Lenguaje', teacherId: null, activo: true },
    { id: 'c2c', semestre: 1, paralelo: 'C', dia: 2, inicio: '09:00', fin: '11:00', materia: 'Lenguaje', teacherId: null, activo: true },
    { id: 'c7', semestre: 2, paralelo: null, dia: 2, inicio: '08:00', fin: '10:00', materia: 'Investigación', teacherId: null, activo: true },
    { id: 'c12', semestre: 3, paralelo: 'A', dia: 2, inicio: '14:00', fin: '17:00', materia: 'Cultura', teacherId: null, activo: true },
    { id: 'c1', semestre: 1, paralelo: 'A', dia: 1, inicio: '07:00', fin: '09:00', materia: 'Turismo', teacherId: null, activo: true },
  ];
  const ev = { dias: [{ fecha: '2026-09-22', inicio: '08:00', fin: '12:00' }] }; // martes
  assert.deepEqual(cruceClases(ev, clases, []).map((c) => c.id), ['c2', 'c2c', 'c7'], 'sin confirmados: todas');
  assert.deepEqual(cruceClases(ev, clases, [{ semestre: 2, paralelo: null }]).map((c) => c.id), ['c7']);
  assert.deepEqual(cruceClases(ev, clases, [{ semestre: 1, paralelo: 'A' }]).map((c) => c.id), ['c2'], 'solo el paralelo A');
  assert.deepEqual(cruceClases(ev, clases, [{ semestre: 1, paralelo: null }]).map((c) => c.id), ['c2', 'c2c'], 'estudiante sin paralelo: ambos');
  assert.deepEqual(cruceClases({ dias: [{ fecha: '2026-09-26', inicio: '08:00', fin: '12:00' }] }, clases, []), [], 'sábado sin clases');
  assert.deepEqual(cruceClases({ dias: [{ fecha: '2026-09-21', inicio: '07:00', fin: '08:00' }, { fecha: '2026-09-22', inicio: '08:00', fin: '09:00' }] }, clases, [{ semestre: 1, paralelo: 'A' }]).map((c) => c.id), ['c1', 'c2c'].filter((x) => x === 'c1'), 'evento de dos días: lunes 07–08 choca con c1');
});

test('clave del evento', () => {
  assert.equal(normalizarClave(' ute-4k7q '), 'UTE-4K7Q');
  assert.equal(normalizarClave('4k7q'), 'UTE-4K7Q');
  assert.equal(normalizarClave('sol-2026-003'), 'SOL-2026-003', 'la clave normal es el código del evento');
  assert.equal(normalizarClave('SOL 2026 3'), 'SOL-2026-003');
  assert.equal(normalizarClave('2026-003'), 'SOL-2026-003');
  assert.match(genClave(() => 0), /^UTE-AAAA$/);
  const ev = { dias: [{ fecha: '2026-09-22', inicio: '08:00', fin: '12:00' }] };
  assert.equal(claveVigente(ev, '2026-09-21', '23:00'), true);
  assert.equal(claveVigente(ev, '2026-09-22', '12:00'), true);
  assert.equal(claveVigente(ev, '2026-09-22', '12:01'), false);
  assert.equal(claveVigente(ev, '2026-09-23', '08:00'), false);
  assert.equal(claveVigente({ dias: [...ev.dias, { fecha: '2026-09-24', inicio: '08:00', fin: '12:00' }] }, '2026-09-23', '08:00'), true, 'vale hasta el último día');
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
  const f = { ...FORM_INICIAL, evidenciaPath: 'x', evidenciaNombre: 'x.pdf', nombre: 'A', cargo: 'B', institucion: 'C', correoSolicitante: 'a@b.co', evento: 'E', dias: [{ fecha: '2026-09-22', inicio: '09:00', fin: '13:00' }], lugar: 'L', responsable: 'R', responsableTelefono: '099 123 4567', reparto: [{ actividad: 'Guía de invitados', cantidad: 4 }], acepta: true };
  assert.deepEqual(faltasPedido(f, hoy, null), [[], [], [], []]);
  assert.deepEqual(faltasPedido({ ...f, dias: [{ fecha: '2026-09-09', inicio: '09:00', fin: '13:00' }] }, hoy, null)[1], ['fecha con al menos 72 h']);
  assert.deepEqual(faltasPedido({ ...f, correoSolicitante: 'malo' }, hoy, null)[0], ['correo válido']);
  assert.deepEqual(faltasPedido({ ...f, evidenciaPath: '' }, hoy, null)[1], ['evidencia del pedido'], 'la evidencia se pide en el paso 2');
  assert.deepEqual(faltasPedido({ ...f, responsableTelefono: '12' }, hoy, null)[1], ['teléfono del responsable']);
  const conCruce = faltasPedido(f, hoy, { evento: 'Otro' })[1];
  assert.equal(conCruce.includes('horario sin cruce'), BLOQUEAR_CRUCE_EVENTOS, 'el cruce bloquea solo si está configurado');
});

test('reparto de estudiantes por actividad', () => {
  let r = alternarActividad([], 'Guía de invitados', 4);
  assert.deepEqual(r, [{ actividad: 'Guía de invitados', cantidad: 4 }], 'la primera actividad toma todos');
  r = alternarActividad(r, 'Acompañamiento en recorridos', 4);
  assert.deepEqual(r, [{ actividad: 'Guía de invitados', cantidad: 3 }, { actividad: 'Acompañamiento en recorridos', cantidad: 1 }], 'la segunda toma 1 de la mayor');
  assert.deepEqual(faltasReparto(r, 4), []);
  assert.deepEqual(faltasReparto([{ actividad: 'Guía de invitados', cantidad: 2 }, { actividad: 'Acompañamiento en recorridos', cantidad: 1 }], 4), ['repartir los 4 estudiantes entre las actividades (asignados: 3)']);
  assert.deepEqual(faltasReparto([], 4), ['al menos una actividad']);
  assert.deepEqual(faltasReparto([{ actividad: 'Guía de invitados', cantidad: 0 }, { actividad: 'Acompañamiento en recorridos', cantidad: 4 }], 4), ['al menos 1 estudiante en cada actividad marcada']);
  assert.deepEqual(ajustarRepartoATotal(r, 6), [{ actividad: 'Guía de invitados', cantidad: 5 }, { actividad: 'Acompañamiento en recorridos', cantidad: 1 }]);
  assert.deepEqual(alternarActividad(r, 'Guía de invitados', 4), [{ actividad: 'Acompañamiento en recorridos', cantidad: 4 }], 'al desmarcar, la restante recibe el total');
  assert.equal(repartoTexto([{ actividad: 'Guía de invitados', cantidad: 2 }, { actividad: 'Apoyo en mesa de honor', cantidad: 2 }], []), 'Guía de invitados (2), Apoyo en mesa de honor (2)');
  assert.equal(repartoTexto([], ['Guía de invitados']), 'Guía de invitados', 'pedidos antiguos sin reparto');
});
