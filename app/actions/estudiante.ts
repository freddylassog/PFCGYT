'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { ajustesActuales, cargarDatos, mapPedido } from '@/lib/datos';
import { appUrl } from '@/lib/app-url';
import { avisarCoordinacion } from '@/lib/notificar';
import { mensajeInscripcionCoordinacion } from '@/lib/notificar-texto';
import { vistaPedido } from '@/lib/vista';
import { claveVigente, diasLlenos, horaAhora, hoyISO, nombrarDias, normalizarClave, normalizarCorreo, ultimoDia } from '@/lib/reglas';
import { iniciarSesionEstudiante, sesionEstudiante } from '@/lib/sesion';
import type { Resultado } from '@/lib/tipos';

const ERROR_LOGIN = 'Correo o clave incorrectos, o la clave ya venció.';

export async function loginEstudiante(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const correo = normalizarCorreo(String(formData.get('correo') ?? ''));
  const clave = normalizarClave(String(formData.get('clave') ?? ''));
  if (!correo || !clave) return { error: ERROR_LOGIN };
  const sql = db();
  const ajustes = await ajustesActuales();
  const periodo = ajustes.periodo;
  const [st] = await sql`select id from students where periodo = ${periodo} and activo and correo = ${correo}`;
  if (!st) return { error: ERROR_LOGIN };
  const pedidos = await sql`select * from requests where periodo = ${periodo} and estado = 'Aprobado' and clave = ${clave}`;
  const hoy = hoyISO(), hora = horaAhora();
  // La clave de un evento con uniforme sigue sirviendo durante el plazo de devolución, para ver el estado en el portal.
  const vigente = pedidos.some((p) => claveVigente(mapPedido(p), hoy, hora, ajustes.uniformeDiasDevolucion));
  if (!vigente) return { error: ERROR_LOGIN };
  await iniciarSesionEstudiante(String(st.id));
  redirect('/estudiante');
}

async function avisarInscripcion(requestId: string, studentId: string, tipo: 'inscripcion' | 'retiro'): Promise<void> {
  try {
    const datos = await cargarDatos();
    if (!datos.notificaciones.canales.some((c) => c.canal === 'telegram')) return;
    const p = datos.pedidos.find((x) => x.id === requestId);
    const e = datos.estudiantes.find((x) => x.id === studentId);
    if (p && e) await avisarCoordinacion(mensajeInscripcionCoordinacion(vistaPedido(datos, p), e, tipo, appUrl()), datos.ajustes);
  } catch (err) { console.error('[aviso inscripción]', (err as Error).message); }
}

async function exigir(): Promise<string> {
  const s = await sesionEstudiante();
  if (!s) throw new Error('Tu sesión venció. Vuelve a ingresar.');
  return s.studentId;
}

export async function inscribirme(requestId: string, dias?: string[] | null): Promise<Resultado> {
  try {
    const studentId = await exigir();
    const sql = db();
    const [fila] = await sql`select * from requests where id = ${requestId}`;
    const p = fila ? mapPedido(fila) : null;
    if (!p || p.estado !== 'Aprobado' || !p.convocadaAt) throw new Error('La convocatoria no está abierta.');
    if (p.finalizadoAt) throw new Error('El evento ya finalizó.');
    if ((ultimoDia(p.dias)?.fecha ?? p.fecha) < hoyISO()) throw new Error('El evento ya pasó.');
    const fechas = p.dias.map((d) => d.fecha);
    const elegidos = (dias ?? []).filter((f) => fechas.includes(f));
    const misDias = elegidos.length && elegidos.length < fechas.length ? elegidos : null;
    if (dias && dias.length && !elegidos.length) throw new Error('Elige al menos un día del evento.');
    const conf = await sql`select dias from enrollments where request_id = ${requestId} and estado = 'confirmado'`;
    // El cupo es por día: si un día ya está lleno, el estudiante debe marcar solo los días con cupo.
    const pedidos = misDias ?? fechas;
    const llenos = diasLlenos(p, conf.map((r) => mapDiasJson(r.dias)), pedidos);
    if (llenos.length === pedidos.length) throw new Error(p.dias.length > 1 ? 'Cupos completos para esos días.' : 'Cupos completos.');
    if (llenos.length) throw new Error(`${nombrarDias(llenos, fechas)} ya ${llenos.length > 1 ? 'tienen' : 'tiene'} los cupos completos. Marca solo los días con cupo.`);
    const [ya] = await sql`select estado from enrollments where request_id = ${requestId} and student_id = ${studentId}`;
    if (ya?.estado === 'rechazado') throw new Error('La coordinación no confirmó tu inscripción a este evento.');
    if (ya?.estado === 'confirmado') throw new Error('Ya estás confirmado en este evento.');
    await sql`insert into enrollments (request_id, student_id, estado, dias) values (${requestId}, ${studentId}, 'inscrito', ${misDias ? sql.json(misDias) : null}) on conflict (request_id, student_id) do nothing`;
    revalidatePath('/estudiante'); revalidatePath('/coordinacion');
    await avisarInscripcion(requestId, studentId, 'inscripcion');
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function retirarme(requestId: string): Promise<Resultado> {
  try {
    const studentId = await exigir();
    const borradas = await db()`delete from enrollments where request_id = ${requestId} and student_id = ${studentId} and estado = 'inscrito' returning id`;
    revalidatePath('/estudiante'); revalidatePath('/coordinacion');
    if (borradas.length) await avisarInscripcion(requestId, studentId, 'retiro');
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** dias de una inscripción tal como viene de la base (jsonb o texto). */
function mapDiasJson(v: unknown): string[] | null {
  let x = v;
  if (typeof x === 'string') { try { x = JSON.parse(x); } catch { return null; } }
  return Array.isArray(x) && x.length ? x.map(String) : null;
}
