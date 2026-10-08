import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoDevolucion, faseDevolucion, limiteDevolucion } from '../../lib/reglas';
import { estadoDevolucionDe, limiteDevolucionDe, pendientesDevolucion, vistaPedido, vistaUniformes } from '../../lib/vista';
import { mensajeDevolucionCanal, mensajeDevolucionCoordinacion, mensajeDevolucionPersonal } from '../../lib/notificar-texto';
import { correoDevolucionPendiente } from '../../lib/correos';
import { datosDemo } from './datos-demo';

test('plazo y estado de la devolución del uniforme', () => {
  assert.equal(limiteDevolucion('2026-09-11', 7), '2026-09-18');
  assert.equal(limiteDevolucion('2026-09-11', 0), '2026-09-18', 'plazo inválido → 7');
  assert.equal(estadoDevolucion(null, '2026-09-11', '2026-09-18', '2026-09-08').clave, 'en-curso');
  assert.equal(estadoDevolucion(null, '2026-09-11', '2026-09-18', '2026-09-11').clave, 'pendiente', 'desde el último día se puede devolver');
  assert.equal(estadoDevolucion(null, '2026-09-11', '2026-09-18', '2026-09-18').clave, 'pendiente');
  assert.equal(estadoDevolucion(null, '2026-09-11', '2026-09-18', '2026-09-19').label, 'Vencido · era hasta el 18 sep');
  assert.equal(estadoDevolucion({ estado: 'lavado', at: '2026-09-15' }, '2026-09-11', '2026-09-18', '2026-09-30').label, 'Devuelto lavado · 15 sep');
  assert.equal(estadoDevolucion({ estado: 'rechazado', at: '2026-09-15' }, '2026-09-11', '2026-09-18', '2026-09-16').clave, 'rechazado');
  assert.equal(faseDevolucion('2026-09-11', '2026-09-18', '2026-09-12'), 'inicio');
  assert.equal(faseDevolucion('2026-09-11', '2026-09-18', '2026-09-16'), 'recordatorio');
  assert.equal(faseDevolucion('2026-09-11', '2026-09-18', '2026-09-18'), 'vence');
  assert.equal(faseDevolucion('2026-09-11', '2026-09-18', '2026-09-19'), 'vencido');
  assert.equal(faseDevolucion('2026-09-11', '2026-09-18', '2026-09-14'), null);
  assert.equal(faseDevolucion('2026-09-11', '2026-09-13', '2026-09-12'), 'inicio', 'con plazo corto no se duplica el aviso');
});

test('vista: pendientes y vencidos por evento, resumen por estudiante y textos', () => {
  const d = datosDemo();
  d.pedidos[0].vestimenta = 'uniforme'; d.pedidos[0].estado = 'Aprobado'; d.pedidos[0].convocadaAt = '2026-09-01';
  d.inscripciones = [
    { id: 'i1', requestId: 'p1', studentId: 's1', estado: 'confirmado', dias: null, createdAt: '' },
    { id: 'i2', requestId: 'p1', studentId: 's2', estado: 'confirmado', dias: null, createdAt: '' },
  ];
  d.ajustes.uniformeHorario = [{ dia: 1, inicio: '11:00', fin: '13:00', atiende: 'Estudiantes de apoyo' }];
  d.ajustes.uniformeLugar = 'Oficina de protocolo';
  d.devoluciones = [{ requestId: 'p1', studentId: 's1', estado: 'lavado', at: '2026-09-14', prendas: [] }];
  d.hoy = '2026-09-20'; // evento del 11 sep, plazo hasta el 18
  const p = vistaPedido(d, d.pedidos[0]);
  assert.equal(p.devolucionLimite, '2026-09-18');
  assert.equal(limiteDevolucionDe(p, 's2'), '2026-09-18');
  assert.equal(estadoDevolucionDe(p, 's1', d.hoy).clave, 'devuelto');
  assert.equal(estadoDevolucionDe(p, 's2', d.hoy).clave, 'vencido');
  assert.deepEqual(pendientesDevolucion(p, d.hoy).map((x) => x.e.id), ['s2']);
  assert.match(p.uniformeAvisoTexto!, /devuélvelo lavado hasta el viernes 18 sep 2026 \(7 días después\), en lunes 11:00–13:00 \(Estudiantes de apoyo\) · Oficina de protocolo/);
  assert.equal(p.devolucionDondeTexto, 'lunes 11:00–13:00 (Estudiantes de apoyo) · Oficina de protocolo');
  const u = vistaUniformes(d);
  assert.equal(u.find((x) => x.id === 's1')!.devLabel, 'Al día');
  assert.equal(u.find((x) => x.id === 's2')!.devLabel, 'Vencido (1)');
  const s2 = d.estudiantes[1];
  assert.match(mensajeDevolucionPersonal(p, s2, '2026-09-18', 'inicio'), /Andrés, gracias por participar en Incorporación\. Devuelve el uniforme lavado hasta el viernes 18 sep 2026 \(7 días\)\. Dónde y cuándo: lunes 11:00–13:00/);
  assert.match(mensajeDevolucionPersonal(p, s2, '2026-09-18', 'recordatorio'), /te quedan 2 días/);
  assert.match(mensajeDevolucionPersonal(p, s2, '2026-09-18', 'vence'), /hoy viernes 18 sep 2026 vence/);
  assert.match(mensajeDevolucionPersonal(p, s2, '2026-09-18', 'vencido'), /venció el viernes 18 sep 2026/);
  assert.match(mensajeDevolucionCanal([{ p, fase: 'inicio' }])!, /Incorporación: devolver el uniforme lavado hasta el viernes 18 sep 2026 · lunes/);
  assert.equal(mensajeDevolucionCanal([{ p, fase: 'vence' }]), null, 'el canal no repite el día del plazo');
  assert.match(mensajeDevolucionCoordinacion([{ p, e: s2, limite: '2026-09-18' }], 1)!, /vencidos: Andrés Molina \(Incorporación, hasta el 18 sep\) · en plazo: 1/);
  assert.equal(mensajeDevolucionCoordinacion([], 0), null);
  // Devolución especial fijada para el evento: el plazo pasa a ser ese día
  d.pedidos[0].uniformeCita = { entregaFecha: '', entregaHora: '', entregaHasta: '', entregaHoraFin: '', devolucionFecha: '2026-09-21', devolucionHora: '16:00', devolucionHasta: '2026-09-23', devolucionHoraFin: '', lugar: 'Oficina', avisoAt: null };
  const pc = vistaPedido(d, d.pedidos[0]);
  assert.equal(pc.devolucionLimite, '2026-09-23');
  assert.equal(limiteDevolucionDe(pc, 's2'), '2026-09-23');
  assert.equal(estadoDevolucionDe(pc, 's2', d.hoy).clave, 'pendiente', 'con la devolución especial aún no vence');
  d.pedidos[0].uniformeCita = null;
  const correo = correoDevolucionPendiente(p, pendientesDevolucion(p, d.hoy));
  assert.deepEqual(correo.cco, ['andres.molina@ute.edu.ec']);
  assert.match(correo.asunto, /hasta el viernes 18 sep 2026/);
  assert.match(correo.cuerpo, /Dónde y cuándo: lunes 11:00–13:00/);
});
