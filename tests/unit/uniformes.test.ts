import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITA_VACIA, citaDevolucionTexto, citaEntregaTexto, faltasCitaUniforme } from '../../lib/reglas';
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
