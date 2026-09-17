// Texto de las notificaciones (puro, sin dependencias de servidor).
import { MINIMO_EVENTOS, citaDevolucionTexto, citaEntregaTexto, fechaLarga, fechaLargaDias, horarioTextoDias, horasDias, repartoTexto, tipoLabel } from './reglas';
import type { CitaUniforme, DiaEvento, Estudiante, Pedido } from './tipos';
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
    `Estudiantes: ${p.cantidad} · ${repartoTexto(p.reparto, p.actividades)}`,
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
    `Actividades: ${p.actividadesTexto}`,
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

// ---------------------------------------------------------------- mensajes personales a estudiantes

function primerNombre(e: Estudiante): string {
  return e.nombre.split(' ')[0];
}

export function mensajeBienvenidaBot(): string {
  return 'Hola. Soy el bot de Protocolo FCGT. Para recibir tus avisos personales (confirmaciones y recordatorios de eventos), escribe tu correo institucional (nombre.apellido@ute.edu.ec).';
}

export function mensajeVinculado(e: Estudiante, eventosN: number): string {
  return `Listo, ${primerNombre(e)}. Quedaste vinculado como ${e.nombre} (${e.semestre}.º semestre). Te avisaré cuando coordinación confirme tu participación y el día antes de cada evento. Llevas ${eventosN} de ${MINIMO_EVENTOS} eventos del semestre.`;
}

export function mensajeCorreoNoEncontrado(correo: string): string {
  return `No encuentro ${correo} en el listado de estudiantes de protocolo de este semestre. Revisa que sea tu correo institucional o consulta a coordinación.`;
}

export function mensajeNoEntendido(): string {
  return 'Para vincular tu cuenta escribe solo tu correo institucional (nombre.apellido@ute.edu.ec).';
}

export function mensajeEstudianteConfirmado(p: PedidoVista, e: Estudiante, eventosN: number): string {
  return [
    `✅ ${primerNombre(e)}, tu participación en ${p.evento} está CONFIRMADA.`,
    ``,
    `Fecha: ${p.fechaLarga}`,
    `Horario: ${p.horarioTexto}`,
    `Lugar: ${p.lugar}`,
    `Responsable en sitio: ${p.responsable}${p.responsableTelefono ? ` · ${p.responsableTelefono}` : ''}`,
    `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
    `Actividades del evento: ${p.actividadesTexto}`,
    ``,
    `Con este evento llevas ${eventosN} de ${MINIMO_EVENTOS} del semestre. Realiza solo las actividades asignadas y retírate a la hora de salida.`,
  ].join('\n');
}

export function mensajeEstudianteNoConfirmado(p: PedidoVista, e: Estudiante): string {
  return `${primerNombre(e)}, gracias por inscribirte en ${p.evento} (${p.fechaLarga}). Esta vez no fue posible confirmar tu participación. Atento a las próximas convocatorias.`;
}

export function mensajeEstudianteRetirado(p: PedidoVista, e: Estudiante): string {
  return `${primerNombre(e)}, coordinación retiró tu participación en ${p.evento} (${p.fechaLarga}). Si tienes dudas, escribe a coordinación.`;
}

export function mensajeRecordatorioPersonal(p: PedidoVista, dia: DiaEvento, e: Estudiante): string {
  return [
    `⏰ ${primerNombre(e)}, mañana ${fechaLarga(dia.fecha)} tienes el evento ${p.evento}.`,
    `Horario: ${dia.inicio}–${dia.fin}`,
    `Lugar: ${p.lugar}`,
    `Responsable en sitio: ${p.responsable}${p.responsableTelefono ? ` · ${p.responsableTelefono}` : ''}`,
    `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
    `Llega 15 minutos antes.`,
  ].join('\n');
}

// ---------------------------------------------------------------- uniformes: entrega y devolución

function lineasCita(c: CitaUniforme): string[] {
  const l: string[] = [];
  const e = citaEntregaTexto(c), d = citaDevolucionTexto(c);
  if (e) l.push(`📦 Entrega del uniforme: ${e}`);
  if (d) l.push(`↩️ Devolución (lavado): ${d}`);
  if (c.lugar) l.push(`📍 Lugar: ${c.lugar}`);
  return l;
}

/** Aviso en el canal: para los confirmados del evento. */
export function mensajeUniformesCanal(p: PedidoVista, c: CitaUniforme): string {
  return [
    `👔 Uniformes · ${p.evento} (${p.fechaCorta})`,
    ...lineasCita(c),
    `Para: ${p.confirmados.map((e) => e.nombre).join(', ') || 'los estudiantes confirmados'}.`,
    `Lleva tu cédula o carné para retirar el uniforme y devuélvelo lavado.`,
  ].join('\n');
}

export function mensajeUniformesPersonal(p: PedidoVista, c: CitaUniforme, e: Estudiante): string {
  return [
    `👔 ${primerNombre(e)}, uniforme para el evento ${p.evento} (${p.fechaCorta}):`,
    ...lineasCita(c),
    `Lleva tu cédula o carné para retirarlo y devuélvelo lavado.`,
  ].join('\n');
}

export type TipoCita = 'entrega' | 'devolucion';

/** Recordatorio del día anterior a una entrega o devolución (canal). */
export function mensajeUniformesRecordatorioCanal(items: { p: PedidoVista; c: CitaUniforme; tipo: TipoCita }[], manana: string): string | null {
  if (!items.length) return null;
  const lineas = items.map(({ p, c, tipo }) => tipo === 'entrega'
    ? `📦 Entrega del uniforme · ${p.evento}: ${c.entregaHora}${c.lugar ? ` · ${c.lugar}` : ''} (${p.confirmados.map((e) => e.nombre).join(', ')})`
    : `↩️ Devolución del uniforme lavado · ${p.evento}: ${c.devolucionHora}${c.lugar ? ` · ${c.lugar}` : ''} (${p.confirmados.map((e) => e.nombre).join(', ')})`);
  return [`👔 Mañana ${fechaLarga(manana)}, uniformes:`, ...lineas].join('\n');
}

export function mensajeUniformesRecordatorioPersonal(p: PedidoVista, c: CitaUniforme, tipo: TipoCita, e: Estudiante): string {
  return tipo === 'entrega'
    ? `📦 ${primerNombre(e)}, mañana ${fechaLarga(c.entregaFecha)} a las ${c.entregaHora} retiras el uniforme para ${p.evento}${c.lugar ? ` en ${c.lugar}` : ''}. Lleva tu cédula o carné.`
    : `↩️ ${primerNombre(e)}, mañana ${fechaLarga(c.devolucionFecha)} a las ${c.devolucionHora} devuelves el uniforme de ${p.evento}${c.lugar ? ` en ${c.lugar}` : ''}. Recuerda entregarlo lavado.`;
}

// ---------------------------------------------------------------- avisos a coordinación

export function mensajeInscripcionCoordinacion(p: PedidoVista, e: Estudiante, tipo: 'inscripcion' | 'retiro', appUrl: string): string {
  const cabecera = tipo === 'inscripcion' ? `📝 ${e.nombre} (${e.semestre}.º) se inscribió en` : `↩️ ${e.nombre} (${e.semestre}.º) retiró su inscripción de`;
  const porRevisar = p.inscritosN + (tipo === 'inscripcion' ? 1 : -1);
  return `${cabecera} ${p.codigo} · ${p.evento} (${p.fechaCorta}).\nConfirmados ${p.confirmadosN}/${p.cantidad} · por revisar ${Math.max(0, porRevisar)}.\n${appUrl}/coordinacion?sel=${p.id}`;
}
