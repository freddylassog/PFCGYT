// Texto de las notificaciones (puro, sin dependencias de servidor).
import { MINIMO_EVENTOS, fechaLarga, fechaLargaDias, horarioTextoDias, horasDias, tipoLabel } from './reglas';
import type { Pedido } from './tipos';
import type { PedidoVista } from './vista';

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

// ---------------------------------------------------------------- canal de estudiantes

/** Convocatoria para el canal de Telegram de estudiantes (texto plano). */
export function mensajeConvocatoriaCanal(p: PedidoVista, appUrl: string): string {
  const lineas = [
    `📣 CONVOCATORIA DE APOYO PROTOCOLARIO`,
    ``,
    `Evento: ${p.evento}`,
    `Organiza: ${p.institucion} (${p.tipoLabel.toLowerCase()})`,
    `Fecha: ${p.fechaLarga}`,
    `Horario: ${p.horarioTexto} · ${p.horas} h de protocolo${p.multidia ? ` en ${p.dias.length} días` : ''}`,
    `Lugar: ${p.lugar}`,
    `Cupos: ${p.cantidad} estudiantes`,
    `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
    `Actividades: ${p.actividades.join(' · ')}`,
    p.pasa4h ? `Alimentación: la cubre el organizador (más de 4 h).` : '',
    p.transporte ? `Transporte de regreso: lo garantiza el organizador.` : '',
    ``,
    `Inscríbete aquí con tu correo institucional:`,
    `${appUrl}/estudiante?clave=${encodeURIComponent(p.clave ?? '')}`,
    `Clave del evento: ${p.clave ?? '—'}`,
    ``,
    `Coordinación confirma quién entra. Recuerda: mínimo ${MINIMO_EVENTOS} eventos en el semestre.`,
  ];
  return lineas.filter((l) => l !== '').join('\n');
}

/** Recordatorio para el canal: eventos que tienen un día de participación mañana. */
export function mensajeRecordatorioCanal(pedidos: PedidoVista[], manana: string): string | null {
  const bloques = pedidos.map((p) => {
    const dia = p.dias.find((d) => d.fecha === manana);
    if (!dia) return null;
    return [
      `📌 ${p.evento}`,
      `Horario: ${dia.inicio}–${dia.fin}${p.multidia ? ` (día ${p.dias.indexOf(dia) + 1} de ${p.dias.length})` : ''}`,
      `Lugar: ${p.lugar}`,
      `Responsable en sitio: ${p.responsable}${p.responsableTelefono ? ` · ${p.responsableTelefono}` : ''}`,
      `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
      `Confirmados (${p.confirmadosN}/${p.cantidad}): ${p.confirmados.map((e) => e.nombre).join(', ') || '—'}`,
    ].join('\n');
  }).filter((b): b is string => !!b);
  if (!bloques.length) return null;
  return `⏰ RECORDATORIO · MAÑANA ${fechaLarga(manana).toUpperCase()}\n\n${bloques.join('\n\n')}\n\nLlega 15 minutos antes. Realiza solo las actividades asignadas y retírate a la hora de salida.`;
}
