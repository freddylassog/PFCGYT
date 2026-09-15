import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajeNuevoPedido, mensajePrueba } from '../../lib/notificar-texto';
import type { Pedido } from '../../lib/tipos';

const pedido: Pedido = {
  id: 'abc', periodo: '2026-2', numero: 5, codigo: 'SOL-2026-005', nombre: 'Carla Espinosa', cargo: 'Directora', institucion: 'Cámara de Comercio', correoSolicitante: 'carla@ejemplo.com',
  tipo: 'externo', convenio: 'no', evento: 'Feria <de> empleo', fecha: '2026-09-22', inicio: '08:00', fin: '12:00',
  dias: [{ fecha: '2026-09-22', inicio: '08:00', fin: '12:00' }, { fecha: '2026-09-23', inicio: '08:00', fin: '12:00' }],
  lugar: 'Centro de Convenciones', lejos: true, responsable: 'J. Andrade', responsableTelefono: '098 777 8899', cantidad: 10,
  actividades: ['Recepción y registro de invitados'], vestimenta: 'ninguna', evidenciaPath: null, evidenciaNombre: null, estado: 'Pendiente', convocadaAt: null, clave: null, createdAt: '2026-09-15T10:00:00Z',
};

test('mensaje de pedido nuevo', () => {
  const m = mensajeNuevoPedido(pedido, 'https://protocolo.test');
  assert.equal(m.asunto, 'Nuevo pedido SOL-2026-005 · Feria <de> empleo · 22 y 23 sep 2026');
  assert.match(m.texto, /Externo · sin convenio/);
  assert.match(m.texto, /08:00–12:00 · 8 h/);
  assert.match(m.texto, /J\. Andrade · 098 777 8899/);
  assert.match(m.texto, /https:\/\/protocolo\.test\/coordinacion\?sel=abc/);
  assert.match(m.html, /Feria &lt;de&gt; empleo/, 'el html escapa el texto del solicitante');
});

test('mensaje de prueba', () => {
  assert.match(mensajePrueba('https://protocolo.test').texto, /pedido nuevo/);
});
