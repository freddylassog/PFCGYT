// Textos de los correos. La app NO envía correos: los genera listos para
// copiar o abrir en Outlook (mailto:), y coordinación los manda desde su cuenta.
import { fechaLarga, semLabel } from './reglas';
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
    `Horario de participación: ${p.inicio}–${p.fin} (${p.duracion})`,
    `Horas de protocolo: ${p.horas} h`,
    `Lugar: ${p.lugar}`,
    `Cupos: ${p.cantidad} estudiantes`,
    `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
    `Actividades:`,
    lista(p.actividades),
    p.pasa4h ? `Alimentación: el organizador cubre la alimentación (más de 4 h).` : '',
    p.transporte ? `Transporte: el organizador garantiza el transporte de regreso (${p.transporteMotivo?.toLowerCase()}).` : '',
    ``,
    `Para inscribirte entra a ${link}`,
    `con tu correo institucional y la clave provisional del evento: ${p.clave ?? '—'}`,
    `La clave sirve solo para inscribirse y vence al terminar el evento. Coordinación confirma quién entra.`,
    ``,
    `Recuerda: cada estudiante debe cumplir al menos 2 eventos en el semestre para la nota de la materia asignada.`,
    ``,
    FIRMA,
  ].filter((l) => l !== '').join('\n');
  return {
    para: grupo ? [grupo] : [],
    cco: grupo ? undefined : activos.map((e) => e.correo),
    asunto: `Convocatoria de apoyo protocolario · ${p.evento} · ${p.fechaLarga}`,
    cuerpo,
  };
}

// ---------------------------------------------------------------- 2. aviso a docente

export function correoAvisoDocente(p: PedidoVista, c: CruceVista, estudiantes: Estudiante[]): Correo {
  const cuerpo = [
    `Estimado/a docente:`,
    ``,
    `Los siguientes estudiantes participarán en el evento ${p.evento} (${p.inicio}–${p.fin}) el ${p.fechaLarga} como apoyo protocolario de la facultad, por lo que no asistirán a su clase de ${c.materia} de ${c.inicio}–${c.fin}.`,
    ``,
    lista(estudiantes.map((e) => `${e.nombre} · ${e.correo}`)),
    ``,
    `Agradecemos considerar la ausencia como justificada.`,
    ``,
    FIRMA,
  ].join('\n');
  return {
    para: c.docente ? [c.docente.correo] : [],
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
        `Tu horario: ${p.inicio}–${p.fin} (${p.duracion})`,
        `Lugar: ${p.lugar}`,
        `Responsable en sitio: ${p.responsable}`,
        `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
        `Tus actividades:`,
        lista(p.actividades),
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
    `Adjunto la matriz de participación en eventos de protocolo de ${m.semLabel} (periodo ${d.ajustes.periodo}) para la nota de ${m.materia}.`,
    `Cada estudiante debe cumplir al menos 2 eventos; quien no cumpla puede recibir 0 en esa materia.`,
    ``,
    `Cumplen: ${m.cumplenN} de ${m.n}.`,
    ``,
    lista(filas),
    ``,
    `(La matriz completa en Excel se adjunta a este correo.)`,
    ``,
    FIRMA,
  ].join('\n');
  return { para: m.docente ? [m.docente.correo] : [], asunto: `Matriz de protocolo · ${m.semLabel} · ${m.materia} · ${d.ajustes.periodo}`, cuerpo };
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
    `Tu horario: ${p.inicio}–${p.fin}`,
    `Lugar: ${p.lugar}`,
    `Responsable en sitio: ${p.responsable}`,
    `Vestimenta: ${p.vestLabel}. ${p.vestNotaEst}`,
    ``,
    `Llega 15 minutos antes. Realiza únicamente las actividades asignadas y retírate a la hora de salida.`,
    ``,
    FIRMA,
  ].join('\n');
  return { para: [], cco: p.confirmados.map((e) => e.correo), asunto: `Recordatorio · ${p.evento} · ${p.fechaLarga}`, cuerpo };
}

// ---------------------------------------------------------------- 7. respuesta al solicitante

export function correoSolicitante(p: PedidoVista): Correo {
  const estado: Record<string, string> = {
    Aprobado: `Su pedido ${p.codigo} fue APROBADO. La facultad convocará a ${p.cantidad} estudiante(s) para el evento ${p.evento} el ${p.fechaLarga}, de ${p.inicio} a ${p.fin}.`,
    Ajustes: `Su pedido ${p.codigo} para el evento ${p.evento} (${p.fechaLarga}) requiere AJUSTES antes de aprobarse. Por favor responda a este correo para coordinar los cambios.`,
    Rechazado: `Lamentamos informar que su pedido ${p.codigo} para el evento ${p.evento} (${p.fechaLarga}) NO fue aprobado.`,
    Pendiente: `Su pedido ${p.codigo} para el evento ${p.evento} (${p.fechaLarga}) fue recibido y está en revisión.`,
  };
  const compromisos = [
    p.pasa4h ? 'Alimentación: pasadas las 4 horas de participación el organizador contempla la alimentación de los estudiantes.' : '',
    p.transporte ? 'Transporte: el organizador garantiza el transporte de regreso de cada estudiante hasta su casa.' : '',
    'Los estudiantes realizan únicamente las actividades marcadas y se retiran a la hora de salida indicada.',
  ].filter(Boolean);
  const cuerpo = [
    `Estimado/a ${p.nombre}:`,
    ``,
    estado[p.estado],
    ``,
    p.estado === 'Aprobado' ? `Compromisos del organizador:\n${lista(compromisos)}\n` : '',
    FIRMA,
  ].filter((l) => l !== '').join('\n');
  return { para: p.correoSolicitante ? [p.correoSolicitante] : [], asunto: `Pedido ${p.codigo} · ${p.evento} · ${p.estado}`, cuerpo };
}
