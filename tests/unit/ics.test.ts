import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aUTC, calendarioICS, escapar, eventosCalendario, plegar } from '../../lib/ics';
import { datosDemo } from './datos-demo';

test('hora de Ecuador a UTC y escape de texto', () => {
  assert.equal(aUTC('2026-09-11', '15:00'), '20260911T200000Z');
  assert.equal(aUTC('2026-09-11', '21:30'), '20260912T023000Z'); // pasa de medianoche en UTC
  assert.equal(aUTC('2026-09-11', '10:00', 30), '20260911T153000Z');
  assert.equal(escapar('Auditorio, bloque B; piso 2\nnota'), 'Auditorio\\, bloque B\; piso 2\\nnota');
});

test('plegado a 75 octetos con continuación', () => {
  const larga = 'DESCRIPTION:' + 'ñ'.repeat(100);
  const plegada = plegar(larga);
  const lineas = plegada.split('\r\n');
  assert.ok(lineas.length > 1);
  assert.ok(lineas.every((l) => new TextEncoder().encode(l).length <= 75));
  assert.ok(lineas.slice(1).every((l) => l.startsWith(' ')));
  assert.equal(lineas.map((l, i) => (i ? l.slice(1) : l)).join(''), larga);
});

test('calendario: un evento por día, pendientes como [Por aprobar], rechazados fuera, citas de uniformes', () => {
  const d = datosDemo();
  d.pedidos[0].uniformeCita = { entregaFecha: '2026-09-10', entregaHora: '10:00', devolucionFecha: '2026-09-14', devolucionHora: '16:00', lugar: 'Oficina', avisoAt: null };
  d.pedidos.push({ ...d.pedidos[1], id: 'p3', numero: 3, codigo: 'SOL-2026-003', evento: 'Rechazado', estado: 'Rechazado' });
  const ev = eventosCalendario(d, 'https://protocolo.test');
  assert.deepEqual(ev.map((e) => e.titulo), ['Incorporación', 'Entrega de uniformes · Incorporación', 'Devolución de uniformes · Incorporación', '[Por aprobar] Recepción (día 1 de 2)', '[Por aprobar] Recepción (día 2 de 2)']);
  assert.equal(ev[0].inicio, '20260911T200000Z');
  assert.equal(ev[0].fin, '20260911T230000Z');
  assert.equal(ev[0].estado, 'CONFIRMED');
  assert.equal(ev[3].estado, 'TENTATIVE');
  assert.equal(ev[1].fin, '20260910T153000Z');
  assert.match(ev[0].descripcion!, /Estudiantes: 1\/2 confirmados \(Camila Ríos\)/);
  assert.match(ev[0].descripcion!, /https:\/\/protocolo\.test\/coordinacion\?sel=p1/);
  const ics = calendarioICS(d, 'https://protocolo.test', new Date('2026-09-08T12:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /X-WR-CALNAME:Protocolo FCGT 2026-2/);
  assert.match(ics, /UID:p1-2026-09-11@protocolo-fcgt/);
  assert.match(ics, /DTSTAMP:20260908T120000Z/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 5);
});
