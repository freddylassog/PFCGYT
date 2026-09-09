'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { ajustesActuales } from '@/lib/datos';
import { claveVigente, hhmm, horaAhora, hoyISO, normalizarClave, normalizarCorreo } from '@/lib/reglas';
import { iniciarSesionEstudiante, sesionEstudiante } from '@/lib/sesion';
import type { Resultado } from '@/lib/tipos';

const ERROR_LOGIN = 'Correo o clave incorrectos, o la clave ya venció.';

export async function loginEstudiante(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const correo = normalizarCorreo(String(formData.get('correo') ?? ''));
  const clave = normalizarClave(String(formData.get('clave') ?? ''));
  if (!correo || !clave) return { error: ERROR_LOGIN };
  const sql = db();
  const { periodo } = await ajustesActuales();
  const [st] = await sql`select id from students where periodo = ${periodo} and activo and correo = ${correo}`;
  if (!st) return { error: ERROR_LOGIN };
  const pedidos = await sql`select fecha, fin from requests where periodo = ${periodo} and estado = 'Aprobado' and clave = ${clave}`;
  const hoy = hoyISO(), hora = horaAhora();
  const vigente = pedidos.some((p) => claveVigente({ fecha: String(p.fecha), fin: hhmm(String(p.fin)) }, hoy, hora));
  if (!vigente) return { error: ERROR_LOGIN };
  await iniciarSesionEstudiante(String(st.id));
  redirect('/estudiante');
}

async function exigir(): Promise<string> {
  const s = await sesionEstudiante();
  if (!s) throw new Error('Tu sesión venció. Vuelve a ingresar.');
  return s.studentId;
}

export async function inscribirme(requestId: string): Promise<Resultado> {
  try {
    const studentId = await exigir();
    const sql = db();
    const [p] = await sql`select estado, convocada_at, cantidad, fecha from requests where id = ${requestId}`;
    if (!p || p.estado !== 'Aprobado' || !p.convocada_at) throw new Error('La convocatoria no está abierta.');
    if (String(p.fecha) < hoyISO()) throw new Error('El evento ya pasó.');
    const [c] = await sql`select count(*)::int as n from enrollments where request_id = ${requestId} and estado = 'confirmado'`;
    if (Number(c.n) >= Number(p.cantidad)) throw new Error('Cupos completos.');
    const [ya] = await sql`select estado from enrollments where request_id = ${requestId} and student_id = ${studentId}`;
    if (ya?.estado === 'rechazado') throw new Error('La coordinación no confirmó tu inscripción a este evento.');
    if (ya?.estado === 'confirmado') throw new Error('Ya estás confirmado en este evento.');
    await sql`insert into enrollments (request_id, student_id, estado) values (${requestId}, ${studentId}, 'inscrito') on conflict (request_id, student_id) do nothing`;
    revalidatePath('/estudiante'); revalidatePath('/coordinacion');
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function retirarme(requestId: string): Promise<Resultado> {
  try {
    const studentId = await exigir();
    await db()`delete from enrollments where request_id = ${requestId} and student_id = ${studentId} and estado = 'inscrito'`;
    revalidatePath('/estudiante'); revalidatePath('/coordinacion');
    return { ok: true };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
