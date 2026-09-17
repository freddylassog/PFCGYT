import 'server-only';
import { db } from './db';
import { asegurarEsquema } from './migrar';
import { appUrl } from './app-url';
import { estadoCanales } from './notificar';
export { appUrl };
import { hoyISO, hhmm } from './reglas';
import type {
  Ajustes, Aviso, Clase, Datos, Devolucion, DiaEvento, Docente, Estudiante, Inscripcion,
  MateriaNota, Novedad, Pedido, PrendaEntregada, RepartoActividad, Semestre,
 CitaUniforme } from './tipos';

function mapReparto(r: Fila): RepartoActividad[] {
  let valor: unknown = r.reparto;
  if (typeof valor === 'string') { try { valor = JSON.parse(valor); } catch { valor = []; } }
  if (!Array.isArray(valor)) return [];
  return (valor as { actividad?: unknown; cantidad?: unknown }[]).map((x) => ({ actividad: s(x.actividad), cantidad: Number(x.cantidad) || 0 })).filter((x) => x.actividad);
}

function mapDias(r: Fila): DiaEvento[] {
  let valor: unknown = r.dias;
  if (typeof valor === 'string') { try { valor = JSON.parse(valor); } catch { valor = []; } }
  const crudo = Array.isArray(valor) ? (valor as { fecha?: unknown; inicio?: unknown; fin?: unknown }[]) : [];
  const dias = crudo.map((d) => ({ fecha: s(d.fecha).slice(0, 10), inicio: hhmm(s(d.inicio)), fin: hhmm(s(d.fin)) })).filter((d) => d.fecha).sort((a, b) => a.fecha.localeCompare(b.fecha));
  return dias.length ? dias : [{ fecha: s(r.fecha), inicio: hhmm(s(r.inicio)), fin: hhmm(s(r.fin)) }];
}

type Fila = Record<string, unknown>;
const s = (v: unknown) => (v == null ? '' : String(v));
const sn = (v: unknown) => (v == null ? null : String(v));
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : s(v));

export function mapCita(r: Fila): CitaUniforme | null {
  let c = r.uniforme_cita as unknown;
  if (typeof c === 'string') { try { c = JSON.parse(c); } catch { return null; } }
  if (!c || typeof c !== 'object') return null;
  const o = c as Record<string, unknown>;
  return { entregaFecha: s(o.entregaFecha), entregaHora: s(o.entregaHora), devolucionFecha: s(o.devolucionFecha), devolucionHora: s(o.devolucionHora), lugar: s(o.lugar), avisoAt: sn(o.avisoAt) };
}

export function mapPedido(r: Fila): Pedido {
  return {
    id: s(r.id), periodo: s(r.periodo), numero: Number(r.numero), codigo: s(r.codigo),
    nombre: s(r.nombre), cargo: s(r.cargo), institucion: s(r.institucion), correoSolicitante: sn(r.correo_solicitante),
    tipo: r.tipo as Pedido['tipo'], convenio: r.convenio as Pedido['convenio'], evento: s(r.evento),
    fecha: s(r.fecha), inicio: hhmm(s(r.inicio)), fin: hhmm(s(r.fin)), dias: mapDias(r), lugar: s(r.lugar), lejos: !!r.lejos,
    responsable: s(r.responsable), responsableTelefono: s(r.responsable_telefono), cantidad: Number(r.cantidad), actividades: (r.actividades as string[]) ?? [], reparto: mapReparto(r),
    vestimenta: r.vestimenta as Pedido['vestimenta'], evidenciaPath: sn(r.evidencia_path), evidenciaNombre: sn(r.evidencia_nombre),
    estado: r.estado as Pedido['estado'], convocadaAt: sn(r.convocada_at), clave: sn(r.clave), telegramPostAt: r.telegram_post_at ? iso(r.telegram_post_at) : null, finalizadoAt: sn(r.finalizado_at), uniformeCita: mapCita(r), createdAt: iso(r.created_at),
  };
}

export function mapEstudiante(r: Fila): Estudiante {
  return { id: s(r.id), nombre: s(r.nombre), correo: s(r.correo), semestre: Number(r.semestre) as Semestre, paralelo: sn(r.paralelo), genero: r.genero as Estudiante['genero'], activo: !!r.activo, telegramChatId: sn(r.telegram_chat_id) };
}

function mapDocente(r: Fila): Docente {
  return { id: s(r.id), nombre: s(r.nombre), correo: sn(r.correo), activo: !!r.activo };
}

function mapClase(r: Fila): Clase {
  return { id: s(r.id), semestre: Number(r.semestre) as Semestre, paralelo: sn(r.paralelo), dia: Number(r.dia), inicio: hhmm(s(r.inicio)), fin: hhmm(s(r.fin)), materia: s(r.materia), teacherId: sn(r.teacher_id), activo: !!r.activo };
}

function mapAjustes(r: Fila): Ajustes {
  return {
    periodo: s(r.periodo), inicioSemestre: s(r.inicio_semestre), semanas: Number(r.semanas), horasSemana: Number(r.horas_semana),
    correoDecanato: s(r.correo_decanato), correoGrupoEstudiantes: s(r.correo_grupo_estudiantes), correoCoordinacion: s(r.correo_coordinacion),
    matrizEnviada: (r.matriz_enviada as Record<string, string>) ?? {}, archivos: (r.archivos as Ajustes['archivos']) ?? {},
    telegramChatId: s(r.telegram_chat_id), telegramChatNombre: s(r.telegram_chat_nombre),
    telegramCanalId: s(r.telegram_canal_id), telegramCanalNombre: s(r.telegram_canal_nombre), ultimoRecordatorio: s(r.ultimo_recordatorio),
    telegramBotUsername: s(r.telegram_bot_username), telegramWebhookUrl: s(r.telegram_webhook_url), uniformeLugar: s(r.uniforme_lugar), calendarioToken: s(r.calendario_token),
  };
}

/** Periodo (semestre) actual. */
export async function ajustesActuales(): Promise<Ajustes> {
  await asegurarEsquema();
  const sql = db();
  const filas = await sql`select * from settings where actual limit 1`;
  if (!filas.length) throw new Error('No hay un periodo activo en la tabla settings. Ejecuta la migración inicial.');
  return mapAjustes(filas[0]);
}

/** Carga todo el estado del periodo actual en una pasada. */
export async function cargarDatos(): Promise<Datos> {
  const sql = db();
  const ajustes = await ajustesActuales();
  const p = ajustes.periodo;
  const [pedidos, estudiantes, docentes, clases, materias, inscripciones, avisos, prendas, devoluciones, novedades] = await Promise.all([
    sql`select * from requests where periodo = ${p} order by fecha, inicio, numero`,
    sql`select st.*, t.chat_id as telegram_chat_id from students st left join telegram_estudiantes t on t.correo = st.correo where st.periodo = ${p} order by st.semestre, st.nombre`,
    sql`select * from teachers where periodo = ${p} order by nombre`,
    sql`select * from classes where periodo = ${p} order by semestre, dia, inicio`,
    sql`select * from grade_subjects where periodo = ${p} order by semestre`,
    sql`select e.* from enrollments e join requests r on r.id = e.request_id where r.periodo = ${p} order by e.created_at`,
    sql`select t.* from teacher_notices t join requests r on r.id = t.request_id where r.periodo = ${p} order by t.created_at desc`,
    sql`select u.* from uniform_items u join students st on st.id = u.student_id where st.periodo = ${p}`,
    sql`select u.* from uniform_returns u join students st on st.id = u.student_id where st.periodo = ${p}`,
    sql`select i.* from incidents i join requests r on r.id = i.request_id where r.periodo = ${p} order by i.created_at`,
  ]);
  return {
    hoy: hoyISO(),
    appUrl: appUrl(),
    notificaciones: estadoCanales(ajustes),
    ajustes,
    pedidos: pedidos.map(mapPedido),
    estudiantes: estudiantes.map(mapEstudiante),
    docentes: docentes.map(mapDocente),
    clases: clases.map(mapClase),
    materias: materias.map((r): MateriaNota => ({ semestre: Number(r.semestre) as Semestre, materia: s(r.materia), teacherId: sn(r.teacher_id) })),
    inscripciones: inscripciones.map((r): Inscripcion => ({ id: s(r.id), requestId: s(r.request_id), studentId: s(r.student_id), estado: r.estado as Inscripcion['estado'], createdAt: iso(r.created_at) })),
    avisos: avisos.map((r): Aviso => ({ id: s(r.id), requestId: s(r.request_id), classId: s(r.class_id), studentIds: (r.student_ids as string[]) ?? [], sentAt: sn(r.sent_at), createdAt: iso(r.created_at) })),
    prendas: prendas.map((r): PrendaEntregada => ({ studentId: s(r.student_id), item: s(r.item), entregadoAt: s(r.entregado_at) })),
    devoluciones: devoluciones.map((r): Devolucion => ({ studentId: s(r.student_id), estado: r.estado as Devolucion['estado'], at: s(r.at) })),
    novedades: novedades.map((r): Novedad => ({ id: s(r.id), requestId: s(r.request_id), studentId: s(r.student_id), tipo: s(r.tipo), nota: s(r.nota), fecha: s(r.fecha), reportadoAt: sn(r.reportado_at) })),
  };
}

/** Pedidos del periodo actual (para verificar cruces desde el formulario público). */
export async function pedidosDelPeriodo(): Promise<Pedido[]> {
  const sql = db();
  const ajustes = await ajustesActuales();
  const filas = await sql`select * from requests where periodo = ${ajustes.periodo} order by fecha, inicio`;
  return filas.map(mapPedido);
}
