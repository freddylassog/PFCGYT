// Texto de las notificaciones (puro, sin dependencias de servidor).
import { cantidadDia, citaDevolucionTexto, citaEntregaTexto, citaEsPeriodo, diasEstudiante, fechaCorta, fechaLarga, fechaLargaDias, horarioCitaTexto, horarioTextoDias, horasDias, lugarDia, lugaresTexto, MINIMO_EVENTOS, repartoTexto, tipoLabel, type FaseDevolucion } from './reglas';
import type { CitaUniforme, DiaEvento, Estudiante, Pedido } from './tipos';
import { confirmadosEnDia, type PedidoVista } from './vista';

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
    `Lugar: ${lugaresTexto(p, true)}`,
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
    `Lugar: ${p.lugarTexto}`,
    `Cupos: ${p.cuposTexto}`,
    p.multidia ? `Si solo puedes uno de los días, márcalo al inscribirte.` : '',
    `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
    ...(p.uniformeAvisoTexto ? [`Uniforme: ${p.uniformeAvisoTexto}`] : []),
    `Actividades: ${p.actividadesTexto}`,
    p.comidas > 0 ? `Alimentación: ${p.comidas} por estudiante, la cubre el organizador.` : '',
    p.transporteTexto ? `Transporte (${p.transporteTexto.toLowerCase()}): lo garantiza el organizador.` : '',
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
      `Lugar: ${lugarDia(p, dia)}`,
      `Responsable en sitio: ${p.responsable}${p.responsableTelefono ? ` · ${p.responsableTelefono}` : ''}`,
      `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
    ...(p.uniformeAvisoTexto ? [`Uniforme: ${p.uniformeAvisoTexto}`] : []),
      `Confirmados${p.multidia ? ' ese día' : ''} (${confirmadosEnDia(p, dia.fecha).length}/${cantidadDia(p, dia)}): ${confirmadosEnDia(p, dia.fecha).map((e) => e.nombre).join(', ') || '—'}`,
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
  return 'Hola. Soy el bot de Protocolo FCGT. Para recibir tus avisos personales (confirmaciones, recordatorios y devolución de uniformes), escribe tu nombre completo tal como está en la lista de la facultad (nombre y dos apellidos) o tu correo institucional (nombre.apellido@ute.edu.ec).';
}

export function mensajeVariosNombres(nombres: string[]): string {
  return `Hay ${nombres.length} estudiantes que coinciden: ${nombres.slice(0, 5).join('; ')}. Escribe tu nombre con tus dos apellidos.`;
}

export function mensajeCorreoGuardado(nombre: string, correo: string): string {
  return `Guardé ${correo} en tu ficha, ${nombre.split(' ')[0]}. Con ese correo y la clave de cada evento también puedes entrar al portal web.`;
}

export function mensajeCorreoEnUso(correo: string): string {
  return `${correo} ya está registrado por otro estudiante. Si es tuyo, avisa a coordinación.`;
}

export function mensajeVinculado(e: Estudiante, eventosN: number): string {
  const sinCorreo = e.correo ? '' : ' Tu ficha no tiene correo: si quieres usar también el portal web, escríbeme tu correo institucional.';
  return `Listo, ${primerNombre(e)}. Quedaste vinculado como ${e.nombre} (${e.semestre}.º semestre). Te avisaré cuando coordinación confirme tu participación y el día antes de cada evento. Llevas ${eventosN} de ${MINIMO_EVENTOS} eventos del semestre.${sinCorreo}`;
}

export function mensajeCorreoNoEncontrado(correo: string): string {
  return `No encuentro ${correo} en el listado de estudiantes de protocolo de este semestre. Revisa que sea tu correo institucional o consulta a coordinación.`;
}

export function mensajeNoEntendido(): string {
  return 'No encuentro ese nombre. Escríbelo como en la lista de la facultad (nombre y dos apellidos), o escribe tu correo institucional (nombre.apellido@ute.edu.ec).';
}

export function mensajeEstudianteConfirmado(p: PedidoVista, e: Estudiante, eventosN: number): string {
  return [
    `✅ ${primerNombre(e)}, tu participación en ${p.evento} está CONFIRMADA.`,
    ``,
    `Fecha: ${p.fechaLarga}`,
    `Horario: ${p.horarioTexto}`,
    `Lugar: ${p.lugarTexto}`,
    `Responsable en sitio: ${p.responsable}${p.responsableTelefono ? ` · ${p.responsableTelefono}` : ''}`,
    `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
    ...(p.uniformeAvisoTexto ? [`Uniforme: ${p.uniformeAvisoTexto}`] : []),
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
    `Lugar: ${lugarDia(p, dia)}`,
    `Responsable en sitio: ${p.responsable}${p.responsableTelefono ? ` · ${p.responsableTelefono}` : ''}`,
    `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
    ...(p.uniformeAvisoTexto ? [`Uniforme: ${p.uniformeAvisoTexto}`] : []),
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
  if (citaEsPeriodo(c)) l.push(`Puedes acercarte cualquier día del periodo, dentro de ese horario.`);
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
  // Hora o franja; si es un periodo de varios días, se indica hasta cuándo.
  const cuando = (fecha: string, hora: string, hasta: string, horaFin: string) => `${horarioCitaTexto(hora, horaFin)}${hasta && hasta !== fecha ? ` (hasta el ${fechaLarga(hasta)})` : ''}`;
  const lineas = items.map(({ p, c, tipo }) => tipo === 'entrega'
    ? `📦 Entrega del uniforme · ${p.evento}: ${cuando(c.entregaFecha, c.entregaHora, c.entregaHasta, c.entregaHoraFin)}${c.lugar ? ` · ${c.lugar}` : ''} (${p.confirmados.map((e) => e.nombre).join(', ')})`
    : `↩️ Devolución del uniforme lavado · ${p.evento}: ${cuando(c.devolucionFecha, c.devolucionHora, c.devolucionHasta, c.devolucionHoraFin)}${c.lugar ? ` · ${c.lugar}` : ''} (${p.confirmados.map((e) => e.nombre).join(', ')})`);
  return [`👔 Mañana ${fechaLarga(manana)}, uniformes:`, ...lineas].join('\n');
}

export function mensajeUniformesRecordatorioPersonal(p: PedidoVista, c: CitaUniforme, tipo: TipoCita, e: Estudiante): string {
  const lugar = c.lugar ? ` en ${c.lugar}` : '';
  if (tipo === 'entrega') {
    if (c.entregaHasta && c.entregaHasta !== c.entregaFecha) return `📦 ${primerNombre(e)}, desde mañana puedes retirar el uniforme para ${p.evento}: ${citaEntregaTexto(c)}${lugar}. Lleva tu cédula o carné.`;
    return `📦 ${primerNombre(e)}, mañana ${fechaLarga(c.entregaFecha)} ${c.entregaHoraFin ? `de ${c.entregaHora} a ${c.entregaHoraFin}` : `a las ${c.entregaHora}`} retiras el uniforme para ${p.evento}${lugar}. Lleva tu cédula o carné.`;
  }
  if (c.devolucionHasta && c.devolucionHasta !== c.devolucionFecha) return `↩️ ${primerNombre(e)}, desde mañana puedes devolver el uniforme de ${p.evento}: ${citaDevolucionTexto(c)}${lugar}. Recuerda entregarlo lavado.`;
  return `↩️ ${primerNombre(e)}, mañana ${fechaLarga(c.devolucionFecha)} ${c.devolucionHoraFin ? `de ${c.devolucionHora} a ${c.devolucionHoraFin}` : `a las ${c.devolucionHora}`} devuelves el uniforme de ${p.evento}${lugar}. Recuerda entregarlo lavado.`;
}

// ---------------------------------------------------------------- devolución del uniforme (plazo después del evento)

/** Mensaje personal según la fase: día después del evento, 2 días antes del plazo, el día del plazo y vencido. */
export function mensajeDevolucionPersonal(p: PedidoVista, e: Estudiante, limite: string, fase: FaseDevolucion): string {
  const donde = p.devolucionDondeTexto ? ` Dónde y cuándo: ${p.devolucionDondeTexto}.` : '';
  switch (fase) {
    case 'inicio': return `👔 ${primerNombre(e)}, gracias por participar en ${p.evento}. Devuelve el uniforme lavado hasta el ${fechaLarga(limite)} (${p.devolucionDias} días).${donde} Si no está lavado no se recibe.`;
    case 'recordatorio': return `⏰ ${primerNombre(e)}, te quedan 2 días para devolver el uniforme lavado de ${p.evento}: hasta el ${fechaLarga(limite)}.${donde}`;
    case 'vence': return `⏰ ${primerNombre(e)}, hoy ${fechaLarga(limite)} vence el plazo para devolver el uniforme lavado de ${p.evento}.${donde}`;
    default: return `⚠️ ${primerNombre(e)}, el plazo para devolver el uniforme de ${p.evento} venció el ${fechaLarga(limite)}. Devuélvelo lavado cuanto antes.${donde}`;
  }
}

/** Aviso general en el canal (sin nombres): el día después del evento y 2 días antes del plazo. */
export function mensajeDevolucionCanal(items: { p: PedidoVista; fase: FaseDevolucion }[]): string | null {
  const lineas = items.filter((x) => x.fase === 'inicio' || x.fase === 'recordatorio').map(({ p, fase }) => `• ${p.evento}: devolver el uniforme lavado hasta el ${fechaLarga(p.devolucionLimite)}${fase === 'recordatorio' ? ' (quedan 2 días)' : ''}${p.devolucionDondeTexto ? ` · ${p.devolucionDondeTexto}` : ''}`);
  return lineas.length ? [`👔 Devolución de uniformes (quienes participaron):`, ...lineas, `Si no está lavado no se recibe.`].join('\n') : null;
}

/** Resumen diario para coordinación: vencidos con nombre y cuántos siguen en plazo. */
export function mensajeDevolucionCoordinacion(vencidos: { p: PedidoVista; e: Estudiante; limite: string }[], enPlazo: number): string | null {
  if (!vencidos.length && !enPlazo) return null;
  const partes = [];
  if (vencidos.length) partes.push(`vencidos: ${vencidos.map(({ p, e, limite }) => `${e.nombre} (${p.evento}, hasta el ${fechaCorta(limite)})`).join(' · ')}`);
  if (enPlazo) partes.push(`en plazo: ${enPlazo}`);
  return `👔 Uniformes sin devolver · ${partes.join(' · ')}.`;
}

// ---------------------------------------------------------------- avisos a coordinación

export function mensajeInscripcionCoordinacion(p: PedidoVista, e: Estudiante, tipo: 'inscripcion' | 'retiro', appUrl: string): string {
  const cabecera = tipo === 'inscripcion' ? `📝 ${e.nombre} (${e.semestre}.º) se inscribió en` : `↩️ ${e.nombre} (${e.semestre}.º) retiró su inscripción de`;
  const porRevisar = p.inscritosN + (tipo === 'inscripcion' ? 1 : -1);
  const dias = p.multidia ? diasEstudiante(p, p.asistencia[e.id] ?? null) : [];
  const misDias = p.multidia && dias.length < p.dias.length ? ` · solo ${dias.map((d) => `día ${p.dias.indexOf(d) + 1} (${fechaCorta(d.fecha)})`).join(' y ')}` : '';
  return `${cabecera} ${p.codigo} · ${p.evento} (${p.fechaCorta})${misDias}.\nConfirmados ${p.progreso} · por revisar ${Math.max(0, porRevisar)}.\n${appUrl}/coordinacion?sel=${p.id}`;
}
