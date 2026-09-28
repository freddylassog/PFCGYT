import { test } from 'node:test';
import assert from 'node:assert/strict';
import { comidasDia, comidasDias, compromisosPedido, transporteDias, transporteTexto } from '../../lib/reglas';
import { generarActa, fechaHoraEcuador } from '../../lib/acta';
import { vistaPedido } from '../../lib/vista';
import { datosDemo } from './datos-demo';

const dia = (inicio: string, fin: string) => ({ fecha: '2026-10-20', inicio, fin });

test('alimentación: una por cada 4 horas de participación, ninguna hasta 4 h', () => {
  assert.equal(comidasDia(dia('09:00', '13:00')), 0); // 4 h exactas
  assert.equal(comidasDia(dia('09:00', '14:00')), 1); // 5 h
  assert.equal(comidasDia(dia('09:00', '17:00')), 2); // 8 h
  assert.equal(comidasDia(dia('08:00', '20:00')), 3); // 12 h
  assert.equal(comidasDias([dia('09:00', '17:00'), { fecha: '2026-10-21', inicio: '09:00', fin: '12:00' }]), 2);
});

test('transporte: ida y regreso si es lejano; solo regreso si termina después de las 18:00', () => {
  assert.deepEqual(transporteDias({ dias: [dia('09:00', '12:00')], lejos: false }), { ida: false, regreso: false, motivos: [] });
  assert.equal(transporteTexto(transporteDias({ dias: [dia('15:00', '21:00')], lejos: false })), 'Regreso a casa');
  assert.equal(transporteTexto(transporteDias({ dias: [dia('09:00', '12:00')], lejos: true })), 'Ida y regreso');
  assert.deepEqual(transporteDias({ dias: [dia('15:00', '21:00')], lejos: true }).motivos, ['lugar lejano o fuera del campus', 'termina después de las 18:00']);
});

test('compromisos con cantidades: 21 estudiantes, 8 h, lejos', () => {
  const c = compromisosPedido({ dias: [dia('09:00', '17:00')], lejos: true, cantidad: 21, reparto: [{ actividad: 'Guía de invitados', cantidad: 21 }], actividades: [], responsable: 'María Paz', responsableTelefono: '0991234567' });
  assert.equal(c[0].corto, 'Alimentación ×2');
  assert.match(c[0].texto, /2 alimentaciones por estudiante.*42 en total para 21 estudiantes/);
  assert.equal(c[1].corto, 'Transporte ida y regreso');
  assert.match(c[1].texto, /Ida y regreso para los 21 estudiantes/);
  assert.match(c[2].texto, /únicamente las actividades marcadas: Guía de invitados \(21\)/);
  assert.match(c[3].texto, /María Paz · 0991234567/);
  const sin = compromisosPedido({ dias: [dia('09:00', '12:00')], lejos: false, cantidad: 2, reparto: [], actividades: ['Apoyo en mesa de honor'], responsable: 'X', responsableTelefono: '' });
  assert.equal(sin[0].aplica, false); assert.equal(sin[1].aplica, false);
  assert.match(sin[2].texto, /Apoyo en mesa de honor/);
});

test('acta en PDF: se genera con los datos del pedido', async () => {
  const d = datosDemo();
  d.pedidos[1].dias = [dia('09:00', '17:00')]; d.pedidos[1].lejos = true;
  const p = vistaPedido(d, d.pedidos[1]);
  assert.equal(p.comidas, 2);
  assert.equal(p.compromisos, 'Alimentación ×2 · Transporte ida y regreso');
  const pdf = await generarActa(p, '2026-2', new Date('2026-09-20T12:00:00Z'));
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), '%PDF-');
  assert.ok(pdf.length > 5000, 'el PDF debería tener contenido (logo y texto)');
  assert.equal(fechaHoraEcuador('2026-09-06T15:30:00Z'), 'domingo 6 sep 2026 · 10:30');
});
