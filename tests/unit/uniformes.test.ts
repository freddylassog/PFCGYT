import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITA_VACIA, citaDevolucionTexto, citaEntregaTexto, citaEsPeriodo, faltasCitaUniforme, fechasCita, periodoTexto } from '../../lib/reglas';
import { mensajeUniformesCanal, mensajeUniformesRecordatorioCanal, mensajeUniformesRecordatorioPersonal } from '../../lib/notificar-texto';
import type { PedidoVista } from '../../lib/vista';

const cita = { ...CITA_VACIA, entregaFecha: '2026-09-24', entregaHora: '10:30', devolucionFecha: '2026-10-06', devolucionHora: '16:00', lugar: 'Oficina de protocolo' };
const est = { id: 's1', nombre: 'Camila Ríos', correo: 'camila.rios@ute.edu.ec', semestre: 1 as const, paralelo: null, genero: 'F' as const, activo: true, telegramChatId: '555' };
const pedido = { evento: 'Feria Gastronómica', fechaCorta: '25 sep', confirmados: [est], confirmadosN: 1 } as unknown as PedidoVista;

test('cita de uniformes: parejas fecha+hora completas y al menos una', () => {
  assert.deepEqual(faltasCitaUniforme(cita), []);
  assert.deepEqual(faltasCitaUniforme(CITA_VACIA), ['al menos la entrega o la devolución']);
  assert.deepEqual(faltasCitaUniforme({ ...CITA_VACIA, entregaFecha: '2026-09-24' }), ['fecha y hora de entrega']);
  assert.deepEqual(faltasCitaUniforme({ ...CITA_VACIA, devolucionHora: '16:00' }), ['fecha y hora de devolución']);
  assert.deepEqual(faltasCitaUniforme({ ...cita, devolucionFecha: '2026-09-20' }), ['la devolución no puede ser antes de la entrega']);
  assert.deepEqual(faltasCitaUniforme({ ...CITA_VACIA, devolucionFecha: '2026-10-06', devolucionHora: '16:00' }), []); // solo devolución
});

test('textos de la cita', () => {
  assert.equal(citaEntregaTexto(cita), 'jueves 24 sep 2026 · 10:30');
  assert.equal(citaDevolucionTexto(cita), 'martes 6 oct 2026 · 16:00');
  assert.equal(citaEntregaTexto(null), null);
  const canal = mensajeUniformesCanal(pedido, cita);
  assert.match(canal, /Uniformes · Feria Gastronómica/);
  assert.match(canal, /Entrega del uniforme: jueves 24 sep 2026 · 10:30/);
  assert.match(canal, /Devolución \(lavado\): martes 6 oct 2026 · 16:00/);
  assert.match(canal, /Lugar: Oficina de protocolo/);
  assert.match(canal, /Camila Ríos/);
  const rec = mensajeUniformesRecordatorioCanal([{ p: pedido, c: cita, tipo: 'entrega' }], '2026-09-24')!;
  assert.match(rec, /Mañana jueves 24 sep 2026, uniformes:/);
  assert.match(rec, /Entrega del uniforme · Feria Gastronómica: 10:30 · Oficina de protocolo/);
  assert.equal(mensajeUniformesRecordatorioCanal([], '2026-09-24'), null);
  assert.match(mensajeUniformesRecordatorioPersonal(pedido, cita, 'devolucion', est), /Camila, mañana martes 6 oct 2026 a las 16:00 devuelves el uniforme de Feria Gastronómica en Oficina de protocolo/);
});

test('periodo de entrega: varios días y franja horaria (lunes a miércoles de 10:00 a 11:00)', () => {
  const per = { ...cita, entregaHora: '10:00', entregaHasta: '2026-09-28', entregaHoraFin: '11:00' };
  assert.equal(citaEntregaTexto(per), 'jueves 24 a lunes 28 sep 2026 · de 10:00 a 11:00');
  assert.equal(citaEntregaTexto({ ...cita, entregaHoraFin: '11:30' }), 'jueves 24 sep 2026 · de 10:30 a 11:30', 'un día con franja');
  assert.equal(periodoTexto('2026-09-28', '2026-10-01'), 'lunes 28 sep a jueves 1 oct 2026');
  assert.equal(periodoTexto('2026-09-24', '2026-09-24'), 'jueves 24 sep 2026');
  assert.equal(periodoTexto('2026-12-30', '2027-01-02'), 'miércoles 30 dic 2026 a sábado 2 ene 2027');
  assert.equal(citaEsPeriodo(per), true);
  assert.equal(citaEsPeriodo(cita), false);
  assert.deepEqual(faltasCitaUniforme(per), []);
  assert.deepEqual(faltasCitaUniforme({ ...per, entregaHasta: '2026-09-20' }), ['el último día de entrega no puede ser antes del primero']);
  assert.deepEqual(faltasCitaUniforme({ ...per, entregaHoraFin: '09:00' }), ['la hora final de entrega debe ser después de la inicial']);
  assert.deepEqual(faltasCitaUniforme({ ...CITA_VACIA, entregaHasta: '2026-09-28' }), ['fecha y hora de entrega'], 'solo "hasta" no basta');
  assert.deepEqual(fechasCita('2026-09-24', '2026-09-26'), ['2026-09-24', '2026-09-25', '2026-09-26']);
  assert.deepEqual(fechasCita('2026-09-24', ''), ['2026-09-24']);
  assert.deepEqual(fechasCita('2026-09-24', '2026-09-20'), ['2026-09-24'], 'un "hasta" anterior se ignora');
  const canal = mensajeUniformesCanal(pedido, per);
  assert.match(canal, /Entrega del uniforme: jueves 24 a lunes 28 sep 2026 · de 10:00 a 11:00/);
  assert.match(canal, /cualquier día del periodo/);
  assert.doesNotMatch(mensajeUniformesCanal(pedido, cita), /cualquier día del periodo/);
  const rec = mensajeUniformesRecordatorioCanal([{ p: pedido, c: per, tipo: 'entrega' }], '2026-09-24')!;
  assert.match(rec, /Entrega del uniforme · Feria Gastronómica: de 10:00 a 11:00 \(hasta el lunes 28 sep 2026\) · Oficina de protocolo/);
  assert.match(mensajeUniformesRecordatorioPersonal(pedido, per, 'entrega', est), /Camila, desde mañana puedes retirar el uniforme para Feria Gastronómica: jueves 24 a lunes 28 sep 2026 · de 10:00 a 11:00 en Oficina de protocolo/);
  assert.match(mensajeUniformesRecordatorioPersonal(pedido, { ...cita, entregaHoraFin: '11:30' }, 'entrega', est), /mañana jueves 24 sep 2026 de 10:30 a 11:30 retiras el uniforme/);
});
