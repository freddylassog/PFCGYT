import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actividadesTextoPedido, ajustarCantidadesDias, cantidadDia, compromisosPedido, cuposTexto, diasEstudiante, diasLlenos, faltasCantidadesDias, faltasPedido, FORM_INICIAL, horasEstudiante, nombrarDias, repartirCantidad, unirRepartos } from '../../lib/reglas';
import { confirmadosEnDia, diasLlenosDe, vistaPedido } from '../../lib/vista';
import { datosDemo } from './datos-demo';

const d1 = { fecha: '2026-10-20', inicio: '09:00', fin: '17:00', lugar: 'A', lejos: false, cantidad: 14 };
const d2 = { fecha: '2026-10-21', inicio: '09:00', fin: '13:00', lugar: 'A', lejos: false, cantidad: 6 };

test('cantidad por día: por defecto todos; se acota al total', () => {
  assert.equal(cantidadDia({ cantidad: 20 }, d1), 14);
  assert.equal(cantidadDia({ cantidad: 20 }, { ...d2, cantidad: undefined }), 20);
  assert.equal(cantidadDia({ cantidad: 5 }, d1), 5, 'nunca más que el total');
  assert.equal(cuposTexto({ cantidad: 20, dias: [d1, d2] }), '20 estudiantes (día 1: 14 · día 2: 6)');
  assert.equal(cuposTexto({ cantidad: 20, dias: [{ ...d1, cantidad: 20 }, { ...d2, cantidad: 20 }] }), '20 estudiantes');
  assert.equal(cuposTexto({ cantidad: 1, dias: [d1] }), '1 estudiante');
});

test('validación de cantidades por día', () => {
  assert.deepEqual(faltasCantidadesDias(20, [d1, d2]), []);
  assert.deepEqual(faltasCantidadesDias(20, [d1]), [], 'un solo día no valida cantidades por día');
  assert.deepEqual(faltasCantidadesDias(20, [{ ...d1, cantidad: 0 }, d2]), ['estudiantes por día entre 1 y 20']);
  assert.deepEqual(faltasCantidadesDias(20, [{ ...d1, cantidad: 10 }, d2]), ['las cantidades por día deben sumar 20 (suman 16)']);
  assert.deepEqual(faltasCantidadesDias(20, [{ ...d1, cantidad: 14 }, { ...d2, cantidad: 8 }]), ['las cantidades por día deben sumar 20 (suman 22)']);
  const ajustados = ajustarCantidadesDias([{ ...d1, cantidad: 20 }, d2], 10);
  assert.deepEqual(ajustados.map((d) => d.cantidad), [5, 5], 'si no suman el total se reparten parejo');
  assert.deepEqual(ajustarCantidadesDias([d1, d2], 20).map((d) => d.cantidad), [14, 6], 'si ya suman el total se conservan');
  assert.deepEqual(repartirCantidad(4, 2), [2, 2]);
  assert.deepEqual(repartirCantidad(5, 2), [3, 2]);
  assert.deepEqual(repartirCantidad(20, 3), [7, 7, 6]);
});

test('días y horas de cada estudiante', () => {
  const p = { dias: [d1, d2] };
  assert.equal(diasEstudiante(p, null).length, 2);
  assert.equal(diasEstudiante(p, ['2026-10-21']).length, 1);
  assert.equal(diasEstudiante(p, ['2099-01-01']).length, 2, 'fechas que ya no existen → todos');
  assert.equal(horasEstudiante(p, null), 12);
  assert.equal(horasEstudiante(p, ['2026-10-21']), 4);
});

test('compromisos con cantidades por día: alimentación total y transporte por día', () => {
  const c = compromisosPedido({ dias: [d1, d2], lejos: false, cantidad: 20, reparto: [], actividades: ['Guía'], responsable: 'R', responsableTelefono: '' });
  assert.match(c[0].texto, /2 alimentaciones por estudiante.*: 28 en total \(día 1: 14 × 2, día 2: 6 × 0\)/);
  assert.equal(c[1].aplica, false);
  const t = compromisosPedido({ dias: [{ ...d1, fin: '20:00' }, d2], lejos: false, cantidad: 20, reparto: [], actividades: [], responsable: 'R', responsableTelefono: '' });
  assert.match(t[1].texto, /Regreso a casa para los estudiantes de cada día \(día 1: 14 · día 2: 6\)/);
});

test('vista: cupos por día, lleno por días y confirmados de cada día', () => {
  const d = datosDemo();
  d.pedidos[0].dias = [d1, { ...d2, cantidad: 1 }]; d.pedidos[0].cantidad = 2; d.pedidos[0].mismosEstudiantes = false;
  d.inscripciones = [
    { id: 'i1', requestId: 'p1', studentId: 's1', estado: 'confirmado', dias: ['2026-10-20'], createdAt: '' },
    { id: 'i2', requestId: 'p1', studentId: 's2', estado: 'confirmado', dias: null, createdAt: '' },
  ];
  const p = vistaPedido(d, d.pedidos[0]);
  assert.deepEqual(p.cuposDias, [{ fecha: '2026-10-20', cantidad: 2, confirmados: 2 }, { fecha: '2026-10-21', cantidad: 1, confirmados: 1 }]);
  assert.equal(p.lleno, true);
  assert.deepEqual(confirmadosEnDia(p, '2026-10-21').map((e) => e.id), ['s2']);
  assert.equal(p.cuposTexto, '2 estudiantes (día 1: 2 · día 2: 1)');
  assert.equal(p.progreso, 'D1 2/2 · D2 1/1');
  const solo = datosDemo();
  assert.equal(vistaPedido(solo, solo.pedidos[0]).progreso, `1/${solo.pedidos[0].cantidad}`, 'un solo día: confirmados/cantidad');
});

test('los mismos estudiantes pedidos: el cupo es por día; uno puede ir un solo día y otro cubre el otro', () => {
  const d = datosDemo();
  d.pedidos[0].dias = [d1, d2]; d.pedidos[0].cantidad = 2; d.pedidos[0].mismosEstudiantes = true;
  d.estudiantes.push({ id: 's4', nombre: 'Lucía Paz', correo: 'lucia.paz@ute.edu.ec', semestre: 2, paralelo: null, genero: 'F', activo: true, telegramChatId: null });
  d.inscripciones = [
    { id: 'i1', requestId: 'p1', studentId: 's1', estado: 'confirmado', dias: null, createdAt: '' }, // los dos días
    { id: 'i2', requestId: 'p1', studentId: 's2', estado: 'confirmado', dias: ['2026-10-20'], createdAt: '' }, // solo el día 1
    { id: 'i3', requestId: 'p1', studentId: 's4', estado: 'inscrito', dias: null, createdAt: '' }, // pide los dos días
  ];
  let p = vistaPedido(d, d.pedidos[0]);
  assert.deepEqual(p.cuposDias.map((c) => `${c.confirmados}/${c.cantidad}`), ['2/2', '1/2']);
  assert.equal(p.lleno, false, 'ya hay 2 confirmados pero el día 2 sigue con cupo');
  assert.equal(p.progreso, 'D1 2/2 · D2 1/2');
  assert.deepEqual(diasLlenosDe(p, 's4'), ['2026-10-20'], 'la inscrita a los dos días choca con el día 1 lleno');
  assert.deepEqual(diasLlenos(p, [null, ['2026-10-20']], ['2026-10-20', '2026-10-21']), ['2026-10-20']);
  assert.deepEqual(diasLlenos(p, [null, ['2026-10-20']], ['2026-10-21']), []);
  assert.equal(nombrarDias(['2026-10-20'], ['2026-10-20', '2026-10-21']), 'El día 1 (20 oct)');
  assert.equal(nombrarDias(['2026-10-20', '2026-10-21'], ['2026-10-20', '2026-10-21']), 'Los días 1 (20 oct) y 2 (21 oct)');
  d.inscripciones[2] = { ...d.inscripciones[2], estado: 'confirmado', dias: ['2026-10-21'] };
  p = vistaPedido(d, d.pedidos[0]);
  assert.equal(p.lleno, true, '3 personas cubren 2 cupos × 2 días');
  assert.equal(p.confirmadosN, 3);
  assert.deepEqual(diasLlenosDe(p, 's4'), [], 'un confirmado no se bloquea a sí mismo');
  assert.deepEqual(confirmadosEnDia(p, '2026-10-21').map((e) => e.id), ['s1', 's4']);
});

test('actividades por día: texto, unión y validación del paso 3', () => {
  const dias = [
    { ...d1, cantidad: 2, reparto: [{ actividad: 'Guía de invitados', cantidad: 2 }] },
    { ...d2, cantidad: 2, reparto: [{ actividad: 'Recepción y registro de invitados', cantidad: 1 }, { actividad: 'Guía de invitados', cantidad: 1 }] },
  ];
  assert.equal(actividadesTextoPedido({ reparto: [], actividades: [], dias }), 'Día 1: Guía de invitados (2) · Día 2: Recepción y registro de invitados (1), Guía de invitados (1)');
  assert.deepEqual(unirRepartos(dias), [{ actividad: 'Recepción y registro de invitados', cantidad: 1 }, { actividad: 'Guía de invitados', cantidad: 3 }]);
  const f = { ...FORM_INICIAL, nombre: 'A', cargo: 'B', institucion: 'C', correoSolicitante: 'a@b.co', evento: 'E', evidenciaPath: 'x', responsable: 'R', responsableTelefono: '0991234567', acepta: true, cantidad: 4, mismosEstudiantes: false, dias };
  assert.deepEqual(faltasPedido(f, '2026-09-08', null)[2], []);
  const mal = { ...f, dias: [dias[0], { ...dias[1], reparto: [{ actividad: 'Guía de invitados', cantidad: 1 }] }] };
  assert.deepEqual(faltasPedido(mal, '2026-09-08', null)[2], ['día 2: repartir los 2 estudiantes entre las actividades (asignados: 1)']);
});

test('los mismos estudiantes todos los días: no se reparte el total', () => {
  const p = { cantidad: 2, mismosEstudiantes: true, dias: [d1, d2] };
  assert.equal(cantidadDia(p, d1), 2);
  assert.equal(cantidadDia(p, d2), 2);
  assert.equal(cuposTexto(p), '2 estudiantes cada día (en lo posible los mismos)');
  assert.deepEqual(faltasCantidadesDias(2, [d1, d2], true), []);
  assert.equal(ajustarCantidadesDias([d1, d2], 2, true).every((d) => d.cantidad === undefined), true, 'sin cantidades por día');
  const c = compromisosPedido({ ...p, lejos: false, reparto: [], actividades: ['Guía'], responsable: 'R', responsableTelefono: '' });
  assert.match(c[0].texto, /2 alimentaciones por estudiante.*: 4 en total para 2 estudiantes/);
  const f = { ...FORM_INICIAL, nombre: 'A', cargo: 'B', institucion: 'C', correoSolicitante: 'a@b.co', evento: 'E', evidenciaPath: 'x', responsable: 'R', responsableTelefono: '0991234567', acepta: true, cantidad: 2, mismosEstudiantes: true,
    dias: [{ ...d1, reparto: [{ actividad: 'Guía de invitados', cantidad: 2 }] }, { ...d2, reparto: [{ actividad: 'Apoyo en mesa de honor', cantidad: 2 }] }] };
  assert.deepEqual(faltasPedido(f, '2026-09-08', null)[2], []);
  assert.deepEqual(faltasPedido({ ...f, dias: [f.dias[0], { ...f.dias[1], reparto: [{ actividad: 'Apoyo en mesa de honor', cantidad: 1 }] }] }, '2026-09-08', null)[2], ['día 2: repartir los 2 estudiantes entre las actividades (asignados: 1)']);
});
