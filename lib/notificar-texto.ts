// Texto de las notificaciones (puro, sin dependencias de servidor).
import { fechaLargaDias, horarioTextoDias, horasDias, tipoLabel } from './reglas';
import type { Pedido } from './tipos';

export interface Mensaje { asunto: string; texto: string; html: string }

function escapar(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function mensajeNuevoPedido(p: Pedido, appUrl: string): Mensaje {
  const enlace = `${appUrl}/coordinacion?sel=${p.id}`;
  const lineas = [
    `Pedido: ${p.codigo} · ${tipoLabel(p.tipo)}${p.tipo === 'externo' && p.convenio === 'no' ? ' · sin convenio' : ''}`,
    `Evento: ${p.evento}`,
    `Fecha: ${fechaLargaDias(p.dias)} · ${horarioTextoDias(p.dias)} · ${horasDias(p.dias)} h`,
    `Solicita: ${p.nombre}, ${p.cargo} · ${p.institucion}${p.correoSolicitante ? ` · ${p.correoSolicitante}` : ''}`,
    `Estudiantes: ${p.cantidad} · ${p.actividades.join(', ')}`,
    `Lugar: ${p.lugar}${p.lejos ? ' (lejos)' : ''}`,
    `Responsable en sitio: ${p.responsable}${p.responsableTelefono ? ` · ${p.responsableTelefono}` : ''}`,
  ];
  const texto = `Nuevo pedido de apoyo protocolario\n\n${lineas.join('\n')}\n\nRevisar en el panel: ${enlace}`;
  const html = `<p><strong>Nuevo pedido de apoyo protocolario</strong></p><p>${lineas.map(escapar).join('<br>')}</p><p><a href="${enlace}">Revisar en el panel</a></p>`;
  return { asunto: `Nuevo pedido ${p.codigo} · ${p.evento} · ${fechaLargaDias(p.dias)}`, texto, html };
}

export function mensajePrueba(appUrl: string): Mensaje {
  const texto = `Prueba de notificaciones de Protocolo FCGT. Si recibes este mensaje, la app te avisará cada vez que entre un pedido nuevo.\n\n${appUrl}/coordinacion`;
  return { asunto: 'Prueba de notificaciones · Protocolo FCGT', texto, html: `<p>${escapar(texto).replace(/\n/g, '<br>')}</p>` };
}
