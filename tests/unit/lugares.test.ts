import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compromisosPedido, lugaresTexto, mismoLugar, transporteDetallePorDia, transporteDias } from '../../lib/reglas';

const d1 = { fecha: '2026-10-20', inicio: '09:00', fin: '13:00', lugar: 'Auditorio UTE', lejos: false };
const d2 = { fecha: '2026-10-21', inicio: '09:00', fin: '13:00', lugar: 'Aeropuerto de Tababela', lejos: true };

test('lugar por día: igual en todos los días o distinto por día', () => {
  const igual = { lugar: 'Auditorio UTE', lejos: false, dias: [d1, { ...d2, lugar: 'Auditorio UTE', lejos: false }] };
  assert.equal(mismoLugar(igual), true);
  assert.equal(lugaresTexto(igual), 'Auditorio UTE');
  const distinto = { lugar: 'Auditorio UTE', lejos: true, dias: [d1, d2] };
  assert.equal(mismoLugar(distinto), false);
  assert.equal(lugaresTexto(distinto), 'Día 1: Auditorio UTE · Día 2: Aeropuerto de Tababela');
  assert.equal(lugaresTexto(distinto, true), 'Día 1: Auditorio UTE · Día 2: Aeropuerto de Tababela (fuera del DMQ / aeropuerto)');
  // pedidos antiguos sin lugar por día usan el del pedido
  assert.equal(lugaresTexto({ lugar: 'Salón Quito', lejos: false, dias: [{ fecha: '2026-10-20', inicio: '09:00', fin: '12:00' }] }), 'Salón Quito');
});

test('transporte por día: ida solo el día que es fuera del DMQ', () => {
  const p = { lugar: 'Auditorio UTE', lejos: true, dias: [d1, d2] };
  assert.deepEqual(transporteDias(p), { ida: true, regreso: true, motivos: ['lugar fuera del Distrito Metropolitano de Quito o aeropuerto'] });
  assert.equal(transporteDetallePorDia(p), 'día 1: por su cuenta; día 2: ida y regreso (lugar fuera del Distrito Metropolitano de Quito o aeropuerto)');
  assert.equal(transporteDetallePorDia({ lugar: 'X', lejos: false, dias: [d1, { ...d2, lugar: 'X', lejos: false }] }), null);
  const c = compromisosPedido({ ...p, cantidad: 4, reparto: [], actividades: ['Guía de invitados'], responsable: 'R', responsableTelefono: '' });
  assert.match(c[1].texto, /Ida y regreso para los 4 estudiantes/);
  assert.match(c[1].texto, /Por día: día 1: por su cuenta; día 2: ida y regreso/);
});
