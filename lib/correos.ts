// Textos de los correos. La app NO envía correos: los genera listos para
// copiar o abrir en Outlook (mailto:), y coordinación los manda desde su cuenta.
import { citaDevolucionTexto, citaEntregaTexto, citaEsPeriodo, fechaLarga, semLabel } from './reglas';
import type { Datos, Estudiante } from './tipos';
import type { CruceVista, MatrizSemestre, NovedadVista, PedidoVista } from './vista';

export interface Correo {
  para: string[];
  cco?: string[];
  asunto: string;
  cuerpo: string;
}

const FIRMA = 'Coordinación de Protocolo · FCGT · Universidad UTE';

export function mailtoUrl(c: Correo): string {
  const params = new URLSearchParams();
  if (c.cco?.length) params.set('bcc', c.cco.join(','));
  params.set('subject', c.asunto);
  params.set('body', c.cuerpo.replace(/\n/g, '\r\n'));
  // URLSearchParams codifica espacios como "+", que los clientes de correo no entienden.
  const q = params.toString().replace(/\+/g, '%20');
  return `mailto:${c.para.map(encodeURIComponent).join(',')}?${q}`;
}

/** Redacción en Outlook web (la cuenta institucional abierta en el navegador). Solo para correos sin CCO:
 *  el enlace no admite copia oculta y se mandaría sin ella. */
export function outlookWebUrl(c: Correo): string {
  const params = new URLSearchParams({ to: c.para.join(';'), subject: c.asunto, body: c.cuerpo, online: '1' });
  return `https://outlook.office.com/mail/deeplink/compose?${params.toString().replace(/\+/g, '%20')}`;
}

export function textoCorreo(c: Correo): string {
  const lineas = [`Para: ${c.para.join(', ') || '—'}`];
  if (c.cco?.length) lineas.push(`CCO: ${c.cco.join(', ')}`);
  lineas.push(`Asunto: ${c.asunto}`, '', c.cuerpo);
  return lineas.join('\n');
}

function lista(items: string[]): string {
  return items.map((x) => `  • ${x}`).join('\n');
}

// ---------------------------------------------------------------- 1. convocatoria

export function correoConvocatoria(d: Datos, p: PedidoVista): Correo {
  const activos = d.estudiantes.filter((e) => e.activo);
  const grupo = d.ajustes.correoGrupoEstudiantes.trim();
  const link = `${d.appUrl}/estudiante?clave=${encodeURIComponent(p.clave ?? '')}`;
  const cuerpo = [
    `Estimados estudiantes de 1.º a 3.º semestre:`,
    ``,
    `La facultad abre la convocatoria para apoyo protocolario en el siguiente evento:`,
    ``,
    `Evento: ${p.evento}`,
    `Organiza: ${p.institucion} (${p.tipoLabel.toLowerCase()})`,
    `Fecha: ${p.fechaLarga}`,
    `Horario de participación: ${p.horarioTexto} (${p.duracion})`,
    `Horas de protocolo: ${p.horas} h`,
    `Lugar: ${p.lugarTexto}`,
    `Cupos: ${p.cuposTexto}`,
    p.multidia ? `Si solo puedes uno de los días, márcalo al inscribirte.` : '',
    `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
    ...(p.uniformeAvisoTexto ? [`Uniforme: ${p.uniformeAvisoTexto}`] : []),
    `Actividades:`,
    lista(p.actividadesEtiquetas),
    p.comidas > 0 ? `Alimentación: ${p.comidas} por estudiante (una por cada 4 h de participación), a cargo del organizador.` : '',
    p.transporteTexto ? `Transporte: ${p.transporteTexto.toLowerCase()} a cargo del organizador (${p.transporteInfo.motivos.join(' y ')}).` : '',
    ``,
    `Para inscribirte entra a ${link}`,
    `con tu correo institucional y la clave del evento: ${p.clave ?? '—'}`,
    `La clave sirve solo para inscribirse y vence al terminar el evento. Coordinación confirma quién entra.`,
    ``,
    `Recuerda: cada estudiante debe cumplir al menos 2 eventos en el semestre para la nota de la materia asignada.`,
    ``,
    FIRMA,
  ].filter((l) => l !== '').join('\n');
  return {
    para: grupo ? [grupo] : [],
    cco: grupo ? undefined : activos.map((e) => e.correo).filter(Boolean),
    asunto: `Convocatoria de apoyo protocolario · ${p.evento} · ${p.fechaLarga}`,
    cuerpo,
  };
}

// ---------------------------------------------------------------- 2. aviso a docente

export function correoAvisoDocente(p: PedidoVista, c: CruceVista, estudiantes: Estudiante[]): Correo {
  const cuerpo = [
    `Estimado/a docente:`,
    ``,
    `Los siguientes estudiantes participarán en el evento ${p.evento} (${p.horarioTexto}) el ${c.fechas?.length ? c.fechas.map(fechaLarga).join(' y ') : p.fechaLarga} como apoyo protocolario de la facultad, por lo que no asistirán a su clase de ${c.materia} de ${c.inicio}–${c.fin}.`,
    ``,
    lista(estudiantes.map((e) => `${e.nombre}${e.correo ? ` · ${e.correo}` : ''}`)),
    ``,
    `Agradecemos considerar la ausencia como justificada.`,
    ``,
    FIRMA,
  ].join('\n');
  return {
    para: c.docente?.correo ? [c.docente.correo] : [],
    asunto: `Ausencia justificada en ${c.materia} (${semLabel(c.semestre)}) · ${p.fechaLarga}`,
    cuerpo,
  };
}

// ---------------------------------------------------------------- 3. confirmación al estudiante

export function correoEstudianteDecision(p: PedidoVista, e: Estudiante, aceptado: boolean): Correo {
  const cuerpo = aceptado
    ? [
        `Hola ${e.nombre}:`,
        ``,
        `Tu inscripción al evento ${p.evento} fue confirmada.`,
        ``,
        `Fecha: ${p.fechaLarga}`,
        `Tu horario: ${p.horarioTexto} (${p.duracion})`,
        `Lugar: ${p.lugarTexto}`,
        `Responsable en sitio: ${p.responsable}${p.responsableTelefono ? ` · ${p.responsableTelefono}` : ''}`,
        `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
    ...(p.uniformeAvisoTexto ? [`Uniforme: ${p.uniformeAvisoTexto}`] : []),
        `Actividades del evento:`,
        lista(p.actividadesEtiquetas),
        ``,
        `Realiza únicamente las actividades indicadas y retírate a la hora de salida, aunque el evento continúe.`,
        ``,
        FIRMA,
      ].join('\n')
    : [
        `Hola ${e.nombre}:`,
        ``,
        `Gracias por inscribirte al evento ${p.evento} (${p.fechaLarga}). En esta ocasión no fue posible confirmar tu participación. Te invitamos a inscribirte en las próximas convocatorias.`,
        ``,
        FIRMA,
      ].join('\n');
  return { para: [e.correo], asunto: `${aceptado ? 'Confirmación' : 'Inscripción no confirmada'} · ${p.evento} · ${p.fechaLarga}`, cuerpo };
}

// ---------------------------------------------------------------- 4. matriz al docente

export function correoMatriz(d: Datos, m: MatrizSemestre): Correo {
  const filas = m.filas.map((f) => `${f.nombre} · ${f.eventosN} evento(s) · ${f.horas} h · ${f.estado}${f.detalle !== '—' ? ` · ${f.detalle}` : ''}`);
  const cuerpo = [
    `Estimado/a docente:`,
    ``,
    `Adjunto la matriz de participación en eventos de protocolo de ${m.semLabel} (periodo ${d.ajustes.periodo}).`,
    `Cada estudiante debe cumplir al menos 2 eventos; quien no cumpla puede recibir 0 en la materia correspondiente.`,
    ``,
    `Cumplen: ${m.cumplenN} de ${m.n}.`,
    ``,
    lista(filas),
    ``,
    `(La matriz completa en Excel se adjunta a este correo.)`,
    ``,
    FIRMA,
  ].join('\n');
  return { para: m.docente?.correo ? [m.docente.correo] : [], asunto: `Matriz de protocolo · ${m.semLabel} · ${d.ajustes.periodo}`, cuerpo };
}

// ---------------------------------------------------------------- 5. reporte a decanato

export function correoDecanato(d: Datos, grupos: { pedido: PedidoVista; novedades: NovedadVista[] }[]): Correo {
  const bloques = grupos.map((g) => [
    `${g.pedido.codigo} · ${g.pedido.evento} · ${g.pedido.fechaLarga}`,
    lista(g.novedades.map((n) => `${n.estudiante?.nombre ?? '—'} (${n.estudiante ? semLabel(n.estudiante.semestre) : '—'}) · ${n.tipo}${n.nota ? ` · ${n.nota}` : ''}`)),
  ].join('\n'));
  const cuerpo = [
    `Estimado Decanato:`,
    ``,
    `Se reportan las siguientes novedades de estudiantes en eventos de apoyo protocolario, para el trámite que corresponda:`,
    ``,
    bloques.join('\n\n'),
    ``,
    FIRMA,
  ].join('\n');
  const total = grupos.reduce((a, g) => a + g.novedades.length, 0);
  return { para: d.ajustes.correoDecanato ? [d.ajustes.correoDecanato] : [], asunto: `Novedades de protocolo · ${total} caso(s) · ${fechaLarga(d.hoy)}`, cuerpo };
}

// ---------------------------------------------------------------- 6. recordatorio 24 h

export function correoRecordatorio(p: PedidoVista): Correo {
  const cuerpo = [
    `Hola:`,
    ``,
    `Recordatorio: mañana participas en el evento ${p.evento}.`,
    ``,
    `Fecha: ${p.fechaLarga}`,
    `Tu horario: ${p.horarioTexto}`,
    `Lugar: ${p.lugarTexto}`,
    `Responsable en sitio: ${p.responsable}${p.responsableTelefono ? ` · ${p.responsableTelefono}` : ''}`,
    `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
    ...(p.uniformeAvisoTexto ? [`Uniforme: ${p.uniformeAvisoTexto}`] : []),
    ``,
    `Llega 15 minutos antes. Realiza únicamente las actividades asignadas y retírate a la hora de salida.`,
    ``,
    FIRMA,
  ].join('\n');
  return { para: [], cco: p.confirmados.map((e) => e.correo).filter(Boolean), asunto: `Recordatorio · ${p.evento} · ${p.fechaLarga}`, cuerpo };
}

// ---------------------------------------------------------------- 6b. uniformes: entrega y devolución

export function correoUniformes(p: PedidoVista): Correo {
  const c = p.uniformeCita;
  const entrega = citaEntregaTexto(c), devolucion = citaDevolucionTexto(c);
  const cuerpo = [
    `Hola:`,
    ``,
    `Para el evento ${p.evento} (${p.fechaLarga}) el uniforme institucional se entrega y se devuelve así:`,
    ``,
    entrega ? `Entrega del uniforme: ${entrega}` : null,
    devolucion ? `Devolución del uniforme (lavado): ${devolucion}` : null,
    c?.lugar ? `Lugar: ${c.lugar}` : null,
    citaEsPeriodo(c) ? `Puedes acercarte cualquier día del periodo indicado, dentro de ese horario.` : null,
    ``,
    `Lleva tu cédula o carné para retirarlo. El uniforme se recibe únicamente lavado; si no está lavado no se recibe.`,
    ``,
    FIRMA,
  ].filter((l) => l !== null).join('\n');
  return { para: [], cco: p.confirmados.map((e) => e.correo).filter(Boolean), asunto: `Uniformes · ${p.evento} · ${entrega ? `entrega ${entrega}` : `devolución ${devolucion}`}`, cuerpo };
}

// ---------------------------------------------------------------- 6c. uniformes: recordatorio de devolución

/** Correo (Outlook) a los confirmados que aún no devuelven el uniforme de un evento. */
export function correoDevolucionPendiente(p: PedidoVista, pendientes: { e: Estudiante; limite: string }[]): Correo {
  const limite = pendientes.length ? pendientes.map((x) => x.limite).sort()[0] : p.devolucionLimite;
  const cuerpo = [
    `Hola:`,
    ``,
    `Gracias por participar en ${p.evento} (${p.fechaLarga}). Recuerda devolver el uniforme institucional lavado hasta el ${fechaLarga(limite)} (${p.devolucionDias} días después del evento).`,
    p.devolucionDondeTexto ? `Dónde y cuándo: ${p.devolucionDondeTexto}.` : null,
    ``,
    `El uniforme se recibe únicamente lavado; si no está lavado no se recibe y el plazo sigue corriendo.`,
    ``,
    FIRMA,
  ].filter((l) => l !== null).join('\n');
  return { para: [], cco: pendientes.map((x) => x.e.correo).filter(Boolean), asunto: `Devolución del uniforme · ${p.evento} · hasta el ${fechaLarga(limite)}`, cuerpo };
}

// ---------------------------------------------------------------- 7. respuesta al solicitante

export function correoSolicitante(p: PedidoVista): Correo {
  const estado: Record<string, string> = {
    Aprobado: `Su pedido ${p.codigo} fue APROBADO. La facultad convocará a ${p.cantidad} estudiante(s) para el evento ${p.evento} el ${p.fechaLarga} (${p.horarioTexto}).`,
    Ajustes: `Su pedido ${p.codigo} para el evento ${p.evento} (${p.fechaLarga}) requiere AJUSTES antes de aprobarse. Por favor responda a este correo para coordinar los cambios.`,
    Rechazado: `Lamentamos informar que su pedido ${p.codigo} para el evento ${p.evento} (${p.fechaLarga}) NO fue aprobado.`,
    Pendiente: `Su pedido ${p.codigo} para el evento ${p.evento} (${p.fechaLarga}) fue recibido y está en revisión.`,
  };
  const compromisos = p.compromisosLista.filter((c) => c.aplica).map((c) => `${c.titulo}: ${c.texto}`);
  const cuerpo = [
    `Estimado/a ${p.nombre}:`,
    ``,
    estado[p.estado],
    ``,
    p.estado === 'Aprobado' ? `Compromisos del organizador:\n${lista(compromisos)}\n` : '',
    p.actaUrl ? `Acta de compromiso (PDF) para su respaldo, con los datos y compromisos del pedido: ${p.actaUrl}\n` : '',
    FIRMA,
  ].filter((l) => l !== '').join('\n');
  return { para: p.correoSolicitante ? [p.correoSolicitante] : [], asunto: `Pedido ${p.codigo} · ${p.evento} · ${p.estado}`, cuerpo };
}
