import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensajeConvocatoriaCanal, mensajeNuevoPedido, mensajePrueba, mensajeRecordatorioCanal } from '../../lib/notificar-texto';
import { vistaPedido } from '../../lib/vista';
import type { Datos } from '../../lib/tipos';
import type { Pedido } from '../../lib/tipos';

const pedido: Pedido = {
  id: 'abc', periodo: '2026-2', numero: 5, codigo: 'SOL-2026-005', nombre: 'Carla Espinosa', cargo: 'Directora', institucion: 'Cámara de Comercio', correoSolicitante: 'carla@ejemplo.com',
  tipo: 'externo', convenio: 'no', evento: 'Feria <de> empleo', fecha: '2026-09-22', inicio: '08:00', fin: '12:00',
  dias: [{ fecha: '2026-09-22', inicio: '08:00', fin: '12:00' }, { fecha: '2026-09-23', inicio: '08:00', fin: '12:00' }],
  lugar: 'Centro de Convenciones', lejos: true, responsable: 'J. Andrade', responsableTelefono: '098 777 8899', cantidad: 10,
  actividades: ['Recepción y registro de invitados'], reparto: [{ actividad: 'Recepción y registro de invitados', cantidad: 10 }], vestimenta: 'ninguna', evidenciaPath: null, evidenciaNombre: null, estado: 'Pendiente', convocadaAt: null, clave: null, telegramPostAt: null, finalizadoAt: null, createdAt: '2026-09-15T10:00:00Z',
};

test('mensaje de pedido nuevo', () => {
  const m = mensajeNuevoPedido(pedido, 'https://protocolo.test');
  assert.equal(m.asunto, 'Nuevo pedido SOL-2026-005 · Feria <de> empleo · 22 y 23 sep 2026');
  assert.match(m.texto, /Externo · sin convenio/);
  assert.match(m.texto, /08:00–12:00 · 8 h/);
  assert.match(m.texto, /Recepción y registro de invitados \(10\)/);
  assert.match(m.texto, /J\. Andrade · 098 777 8899/);
  assert.match(m.texto, /https:\/\/protocolo\.test\/coordinacion\?sel=abc/);
  assert.match(m.html, /Feria &lt;de&gt; empleo/, 'el html escapa el texto del solicitante');
});

test('mensaje de prueba', () => {
  assert.match(mensajePrueba('https://protocolo.test').texto, /pedido nuevo/);
});

function datosMin(p: Pedido): Datos {
  return {
    hoy: '2026-09-21', appUrl: 'https://protocolo.test', notificaciones: { canales: [], telegramSinChat: false, telegramSinCanal: false, canalEstudiantes: 'Canal', botUsername: null },
    ajustes: { periodo: '2026-2', inicioSemestre: '2026-10-05', semanas: 16, horasSemana: 20, correoDecanato: '', correoGrupoEstudiantes: '', correoCoordinacion: '', matrizEnviada: {}, archivos: {}, telegramChatId: '', telegramChatNombre: '', telegramCanalId: '-100', telegramCanalNombre: 'Canal', ultimoRecordatorio: '', telegramBotUsername: '', telegramWebhookUrl: '' },
    pedidos: [p], estudiantes: [{ id: 's1', nombre: 'Camila Ríos', correo: 'c@ute.edu.ec', semestre: 1, paralelo: null, genero: 'F', activo: true, telegramChatId: '55' }], docentes: [], clases: [], materias: [],
    inscripciones: [{ id: 'i1', requestId: p.id, studentId: 's1', estado: 'confirmado', createdAt: '' }], avisos: [], prendas: [], devoluciones: [], novedades: [],
  };
}

test('convocatoria y recordatorio para el canal', () => {
  const aprobado: Pedido = { ...pedido, estado: 'Aprobado', clave: 'SOL-2026-005', convocadaAt: '2026-09-15' };
  const pv = vistaPedido(datosMin(aprobado), aprobado);
  const conv = mensajeConvocatoriaCanal(pv, 'https://protocolo.test');
  assert.match(conv, /CONVOCATORIA/);
  assert.match(conv, /22 y 23 sep 2026/);
  assert.match(conv, /estudiante\?clave=SOL-2026-005/);
  assert.match(conv, /Transporte de regreso/);
  const rec = mensajeRecordatorioCanal([pv], '2026-09-23');
  assert.match(rec ?? '', /RECORDATORIO · MAÑANA MIÉRCOLES 23 SEP 2026/);
  assert.match(rec ?? '', /día 2 de 2/);
  assert.match(rec ?? '', /Camila Ríos/);
  assert.equal(mensajeRecordatorioCanal([pv], '2026-09-24'), null, 'sin eventos mañana');
});
