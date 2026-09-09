'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { ajustesActuales, cargarDatos } from '@/lib/datos';
import { leerTabla, parseDocentes, parseEstudiantes, parseHorarios } from '@/lib/excel';
import {
  UNIFORME, TIPOS_NOVEDAD, cruceClases, esFechaISO, genClave, hoyISO, normalizarCorreo,
} from '@/lib/reglas';
import { iniciarSesionCoordinacion, passwordCoordinacionOk, sesionCoordinacion } from '@/lib/sesion';
import type { Estado, Resultado, Semestre } from '@/lib/tipos';

async function exigir(): Promise<void> {
  if (!(await sesionCoordinacion())) throw new Error('No autorizado. Vuelve a iniciar sesión.');
}

function refrescar() {
  revalidatePath('/coordinacion');
  revalidatePath('/horarios');
  revalidatePath('/estudiante');
}

function fallo(e: unknown): Resultado {
  return { ok: false, error: (e as Error).message || 'Error inesperado' };
}

// ---------------------------------------------------------------- login

export async function loginCoordinacion(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const usuario = String(formData.get('usuario') ?? '').trim().toLowerCase();
  const pass = String(formData.get('password') ?? '');
  const usuarioEsperado = (process.env.COORDINACION_USUARIO || 'coordinacion').toLowerCase();
  if (usuario !== usuarioEsperado || !passwordCoordinacionOk(pass)) return { error: 'Usuario o contraseña incorrectos.' };
  await iniciarSesionCoordinacion();
  const destino = String(formData.get('destino') ?? '/coordinacion');
  redirect(destino.startsWith('/') ? destino : '/coordinacion');
}

// ---------------------------------------------------------------- pedidos

export async function cambiarEstado(id: string, estado: Estado): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    if (estado === 'Aprobado') {
      const [p] = await sql`select tipo, convenio from requests where id = ${id}`;
      if (!p) throw new Error('Pedido no encontrado');
      if (p.tipo === 'externo' && p.convenio === 'no') throw new Error('No se puede aprobar: la institución no tiene convenio vigente con la UTE.');
      await sql`update requests set estado = 'Aprobado', convocada_at = coalesce(convocada_at, ${hoyISO()}), clave = coalesce(clave, ${genClave()}) where id = ${id}`;
    } else {
      await sql`update requests set estado = ${estado} where id = ${id}`;
    }
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function regenerarClave(id: string): Promise<Resultado> {
  try {
    await exigir();
    await db()`update requests set clave = ${genClave()} where id = ${id}`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function marcarConvenio(id: string, convenio: 'si' | 'no'): Promise<Resultado> {
  try {
    await exigir();
    await db()`update requests set convenio = ${convenio} where id = ${id}`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

/** Crea o actualiza los avisos pendientes a docentes para las clases del
 *  semestre indicado que chocan con el evento. */
async function prepararAvisos(requestId: string, semestres: number[]): Promise<void> {
  const sql = db();
  const datos = await cargarDatos();
  const p = datos.pedidos.find((x) => x.id === requestId);
  if (!p) return;
  const confirmados = datos.inscripciones.filter((i) => i.requestId === requestId && i.estado === 'confirmado').map((i) => datos.estudiantes.find((e) => e.id === i.studentId)).filter((e): e is NonNullable<typeof e> => !!e);
  for (const c of cruceClases(p, datos.clases, semestres)) {
    const ids = confirmados.filter((e) => e.semestre === c.semestre).map((e) => e.id);
    if (!ids.length) continue;
    await sql`insert into teacher_notices (request_id, class_id, student_ids) values (${requestId}, ${c.id}, ${ids})
      on conflict (request_id, class_id) do update set student_ids = excluded.student_ids where teacher_notices.sent_at is null`;
  }
}

export async function decidirInscripcion(requestId: string, studentId: string, decision: 'aceptar' | 'rechazar' | 'quitar'): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    if (decision === 'aceptar') {
      const [p] = await sql`select cantidad, estado from requests where id = ${requestId}`;
      if (!p || p.estado !== 'Aprobado') throw new Error('El pedido debe estar aprobado.');
      const [c] = await sql`select count(*)::int as n from enrollments where request_id = ${requestId} and estado = 'confirmado'`;
      if (Number(c.n) >= Number(p.cantidad)) throw new Error('Cupos completos.');
      await sql`insert into enrollments (request_id, student_id, estado) values (${requestId}, ${studentId}, 'confirmado')
        on conflict (request_id, student_id) do update set estado = 'confirmado', updated_at = now()`;
      const [st] = await sql`select semestre from students where id = ${studentId}`;
      if (st) await prepararAvisos(requestId, [Number(st.semestre)]);
    } else if (decision === 'rechazar') {
      await sql`update enrollments set estado = 'rechazado', updated_at = now() where request_id = ${requestId} and student_id = ${studentId}`;
    } else {
      await sql`delete from enrollments where request_id = ${requestId} and student_id = ${studentId}`;
      const [st] = await sql`select semestre from students where id = ${studentId}`;
      if (st) {
        // Los avisos pendientes de ese semestre se recalculan; si ya no queda nadie, se eliminan.
        await sql`delete from teacher_notices t using classes c where t.class_id = c.id and t.request_id = ${requestId} and t.sent_at is null and c.semestre = ${Number(st.semestre)}`;
        await prepararAvisos(requestId, [Number(st.semestre)]);
      }
    }
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

/** Coordinación agrega directamente a un estudiante como confirmado. */
export async function confirmarDirecto(requestId: string, studentId: string): Promise<Resultado> {
  return decidirInscripcion(requestId, studentId, 'aceptar');
}

// ---------------------------------------------------------------- avisos a docentes

export async function crearAviso(requestId: string, classId: string): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const [c] = await sql`select semestre from classes where id = ${classId}`;
    if (!c) throw new Error('Clase no encontrada');
    const filas = await sql`select e.student_id from enrollments e join students s on s.id = e.student_id where e.request_id = ${requestId} and e.estado = 'confirmado' and s.semestre = ${Number(c.semestre)}`;
    let ids = filas.map((f) => String(f.student_id));
    if (!ids.length) {
      const todos = await sql`select student_id from enrollments where request_id = ${requestId} and estado = 'confirmado'`;
      ids = todos.map((f) => String(f.student_id));
    }
    await sql`insert into teacher_notices (request_id, class_id, student_ids) values (${requestId}, ${classId}, ${ids})
      on conflict (request_id, class_id) do update set student_ids = excluded.student_ids where teacher_notices.sent_at is null`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function marcarAviso(noticeId: string, enviado: boolean): Promise<Resultado> {
  try {
    await exigir();
    if (enviado) await db()`update teacher_notices set sent_at = ${hoyISO()} where id = ${noticeId}`;
    else await db()`update teacher_notices set sent_at = null where id = ${noticeId}`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

// ---------------------------------------------------------------- novedades

export async function registrarNovedad(requestId: string, studentId: string, tipo: string, nota: string): Promise<Resultado> {
  try {
    await exigir();
    if (!TIPOS_NOVEDAD.includes(tipo)) throw new Error('Tipo de novedad inválido');
    const sql = db();
    const [e] = await sql`select 1 from enrollments where request_id = ${requestId} and student_id = ${studentId} and estado = 'confirmado'`;
    if (!e) throw new Error('Solo se registran novedades de estudiantes confirmados en el evento.');
    await sql`insert into incidents (request_id, student_id, tipo, nota, fecha) values (${requestId}, ${studentId}, ${tipo}, ${nota.trim().slice(0, 500)}, ${hoyISO()})`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function quitarNovedad(id: string): Promise<Resultado> {
  try {
    await exigir();
    await db()`delete from incidents where id = ${id} and reportado_at is null`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function reportarNovedades(ids: string[]): Promise<Resultado> {
  try {
    await exigir();
    if (ids.length) await db()`update incidents set reportado_at = ${hoyISO()} where id = any(${ids}) and reportado_at is null`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

// ---------------------------------------------------------------- uniformes

export async function alternarPrenda(studentId: string, item: string): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const [st] = await sql`select genero from students where id = ${studentId}`;
    if (!st || !UNIFORME[st.genero as 'F' | 'M'].includes(item)) throw new Error('Prenda inválida');
    const [ya] = await sql`select 1 from uniform_items where student_id = ${studentId} and item = ${item}`;
    if (ya) await sql`delete from uniform_items where student_id = ${studentId} and item = ${item}`;
    else await sql`insert into uniform_items (student_id, item, entregado_at) values (${studentId}, ${item}, ${hoyISO()})`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function fijarDevolucion(studentId: string, estado: 'lavado' | 'rechazado' | null): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    if (!estado) await sql`delete from uniform_returns where student_id = ${studentId}`;
    else await sql`insert into uniform_returns (student_id, estado, at) values (${studentId}, ${estado}, ${hoyISO()}) on conflict (student_id) do update set estado = excluded.estado, at = excluded.at`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

// ---------------------------------------------------------------- ajustes

export async function guardarAjustes(a: { horasSemana?: number; inicioSemestre?: string; correoDecanato?: string; correoGrupoEstudiantes?: string; correoCoordinacion?: string }): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const { periodo } = await ajustesActuales();
    if (a.horasSemana != null) await sql`update settings set horas_semana = ${Math.max(0, Math.min(80, Math.round(a.horasSemana)))} where periodo = ${periodo}`;
    if (a.inicioSemestre != null) {
      if (!esFechaISO(a.inicioSemestre)) throw new Error('Fecha de inicio inválida');
      await sql`update settings set inicio_semestre = ${a.inicioSemestre} where periodo = ${periodo}`;
    }
    if (a.correoDecanato != null) await sql`update settings set correo_decanato = ${a.correoDecanato.trim()} where periodo = ${periodo}`;
    if (a.correoGrupoEstudiantes != null) await sql`update settings set correo_grupo_estudiantes = ${a.correoGrupoEstudiantes.trim()} where periodo = ${periodo}`;
    if (a.correoCoordinacion != null) await sql`update settings set correo_coordinacion = ${a.correoCoordinacion.trim()} where periodo = ${periodo}`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function marcarMatriz(semestre: Semestre, enviada: boolean): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const { periodo } = await ajustesActuales();
    if (enviada) await sql`update settings set matriz_enviada = matriz_enviada || ${sql.json({ [String(semestre)]: hoyISO() })} where periodo = ${periodo}`;
    else await sql`update settings set matriz_enviada = matriz_enviada - ${String(semestre)} where periodo = ${periodo}`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function guardarMateriaNota(semestre: Semestre, materia: string, teacherId: string | null): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const { periodo } = await ajustesActuales();
    if (!materia.trim()) throw new Error('Escribe la materia');
    await sql`insert into grade_subjects (periodo, semestre, materia, teacher_id) values (${periodo}, ${semestre}, ${materia.trim()}, ${teacherId || null})
      on conflict (periodo, semestre) do update set materia = excluded.materia, teacher_id = excluded.teacher_id`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function nuevoPeriodo(periodo: string, inicioSemestre: string): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const p = periodo.trim();
    if (!/^\d{4}-[12]$/.test(p)) throw new Error('El periodo debe tener el formato AAAA-1 o AAAA-2');
    if (!esFechaISO(inicioSemestre)) throw new Error('Fecha de inicio inválida');
    const actual = await ajustesActuales();
    await sql.begin(async (tx) => {
      await tx`update settings set actual = false where actual`;
      await tx`insert into settings (periodo, actual, inicio_semestre, semanas, horas_semana, correo_decanato, correo_grupo_estudiantes, correo_coordinacion)
        values (${p}, true, ${inicioSemestre}, ${actual.semanas}, ${actual.horasSemana}, ${actual.correoDecanato}, ${actual.correoGrupoEstudiantes}, ${actual.correoCoordinacion})
        on conflict (periodo) do update set actual = true, inicio_semestre = excluded.inicio_semestre`;
      await tx`insert into grade_subjects (periodo, semestre, materia) select ${p}, semestre, materia from grade_subjects where periodo = ${actual.periodo} on conflict do nothing`;
    });
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

// ---------------------------------------------------------------- estudiantes / docentes (edición manual)

export async function guardarEstudiante(e: { id?: string; nombre: string; correo: string; semestre: number; genero: 'F' | 'M'; activo: boolean }): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const { periodo } = await ajustesActuales();
    const correo = normalizarCorreo(e.correo);
    if (!e.nombre.trim() || !correo.includes('@')) throw new Error('Nombre y correo son obligatorios');
    if (![1, 2, 3].includes(e.semestre)) throw new Error('Semestre inválido');
    if (e.id) {
      await sql`update students set nombre = ${e.nombre.trim()}, correo = ${correo}, semestre = ${e.semestre}, genero = ${e.genero}, activo = ${e.activo} where id = ${e.id}`;
    } else {
      await sql`insert into students (periodo, nombre, correo, semestre, genero, activo) values (${periodo}, ${e.nombre.trim()}, ${correo}, ${e.semestre}, ${e.genero}, ${e.activo})
        on conflict (periodo, correo) do update set nombre = excluded.nombre, semestre = excluded.semestre, genero = excluded.genero, activo = excluded.activo`;
    }
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function guardarDocente(d: { id?: string; nombre: string; correo: string; activo: boolean }): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const { periodo } = await ajustesActuales();
    const correo = normalizarCorreo(d.correo);
    if (!d.nombre.trim() || !correo.includes('@')) throw new Error('Nombre y correo son obligatorios');
    if (d.id) await sql`update teachers set nombre = ${d.nombre.trim()}, correo = ${correo}, activo = ${d.activo} where id = ${d.id}`;
    else await sql`insert into teachers (periodo, nombre, correo, activo) values (${periodo}, ${d.nombre.trim()}, ${correo}, ${d.activo}) on conflict (periodo, correo) do update set nombre = excluded.nombre, activo = excluded.activo`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function guardarClase(c: { id?: string; semestre: number; dia: number; inicio: string; fin: string; materia: string; teacherId: string | null; activo: boolean }): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const { periodo } = await ajustesActuales();
    if (!c.materia.trim()) throw new Error('Escribe la materia');
    if (c.inicio >= c.fin) throw new Error('La hora de fin debe ser mayor que la de inicio');
    if (c.id) await sql`update classes set semestre = ${c.semestre}, dia = ${c.dia}, inicio = ${c.inicio}, fin = ${c.fin}, materia = ${c.materia.trim()}, teacher_id = ${c.teacherId || null}, activo = ${c.activo} where id = ${c.id}`;
    else await sql`insert into classes (periodo, semestre, dia, inicio, fin, materia, teacher_id, activo) values (${periodo}, ${c.semestre}, ${c.dia}, ${c.inicio}, ${c.fin}, ${c.materia.trim()}, ${c.teacherId || null}, ${c.activo})
      on conflict (periodo, semestre, dia, inicio, materia) do update set fin = excluded.fin, teacher_id = excluded.teacher_id, activo = excluded.activo`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function eliminarClase(id: string): Promise<Resultado> {
  try {
    await exigir();
    await db()`delete from classes where id = ${id}`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

// ---------------------------------------------------------------- importación de Excel

async function archivoDe(formData: FormData): Promise<{ nombre: string; buffer: Buffer }> {
  const f = formData.get('archivo');
  if (!(f instanceof File) || !f.size) throw new Error('Elige un archivo .xlsx o .csv');
  if (f.size > 4 * 1024 * 1024) throw new Error('El archivo supera 4 MB');
  return { nombre: f.name, buffer: Buffer.from(await f.arrayBuffer()) };
}

async function registrarArchivo(clave: string, nombre: string, info: string) {
  const sql = db();
  const { periodo } = await ajustesActuales();
  await sql`update settings set archivos = archivos || ${sql.json({ [clave]: { nombre, fecha: hoyISO(), info } })} where periodo = ${periodo}`;
}

export async function importarEstudiantes(formData: FormData): Promise<Resultado<{ resumen: string; errores: string[] }>> {
  try {
    await exigir();
    const { nombre, buffer } = await archivoDe(formData);
    const filas = await leerTabla(buffer, nombre);
    const { ok, errores } = parseEstudiantes(filas);
    if (!ok.length) throw new Error('No se encontraron filas válidas. Columnas esperadas: Nombre, Correo, Semestre, Género.' + (errores.length ? ' ' + errores[0] : ''));
    const sql = db();
    const { periodo } = await ajustesActuales();
    const correos = [...new Set(ok.map((e) => e.correo))];
    await sql.begin(async (tx) => {
      for (const e of ok) {
        await tx`insert into students (periodo, nombre, correo, semestre, genero, activo) values (${periodo}, ${e.nombre}, ${e.correo}, ${e.semestre}, ${e.genero}, true)
          on conflict (periodo, correo) do update set nombre = excluded.nombre, semestre = excluded.semestre, genero = excluded.genero, activo = true`;
      }
      await tx`update students set activo = false where periodo = ${periodo} and correo <> all(${correos})`;
    });
    const [n] = await sql`select count(*)::int as n from students where periodo = ${periodo} and activo`;
    const resumen = `${n.n} estudiantes · 1.º a 3.º semestre`;
    await registrarArchivo('estudiantes', nombre, resumen);
    refrescar();
    return { ok: true, datos: { resumen: `${ok.length} filas procesadas. Activos: ${n.n}.`, errores } };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function importarDocentes(formData: FormData): Promise<Resultado<{ resumen: string; errores: string[] }>> {
  try {
    await exigir();
    const { nombre, buffer } = await archivoDe(formData);
    const filas = await leerTabla(buffer, nombre);
    const { ok, errores } = parseDocentes(filas);
    if (!ok.length) throw new Error('No se encontraron filas válidas. Columnas esperadas: Nombre, Correo.' + (errores.length ? ' ' + errores[0] : ''));
    const sql = db();
    const { periodo } = await ajustesActuales();
    const correos = [...new Set(ok.map((d) => d.correo))];
    await sql.begin(async (tx) => {
      for (const d of ok) {
        await tx`insert into teachers (periodo, nombre, correo, activo) values (${periodo}, ${d.nombre}, ${d.correo}, true)
          on conflict (periodo, correo) do update set nombre = excluded.nombre, activo = true`;
      }
      await tx`update teachers set activo = false where periodo = ${periodo} and correo <> all(${correos})`;
    });
    const [n] = await sql`select count(*)::int as n from teachers where periodo = ${periodo} and activo`;
    const resumen = `${n.n} docentes con correo institucional`;
    await registrarArchivo('docentes', nombre, resumen);
    refrescar();
    return { ok: true, datos: { resumen: `${ok.length} filas procesadas. Activos: ${n.n}.`, errores } };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

export async function importarHorarios(formData: FormData): Promise<Resultado<{ resumen: string; errores: string[] }>> {
  try {
    await exigir();
    const { nombre, buffer } = await archivoDe(formData);
    const filas = await leerTabla(buffer, nombre);
    const { ok, errores } = parseHorarios(filas);
    if (!ok.length) throw new Error('No se encontraron filas válidas. Columnas esperadas: Semestre, Día, Inicio, Fin, Materia, Correo docente.' + (errores.length ? ' ' + errores[0] : ''));
    const sql = db();
    const { periodo } = await ajustesActuales();
    await sql.begin(async (tx) => {
      // Docentes nuevos que vienen solo con correo en el horario
      for (const c of ok) {
        if (c.correoDocente) {
          await tx`insert into teachers (periodo, nombre, correo, activo) values (${periodo}, ${c.correoDocente.split('@')[0]}, ${c.correoDocente}, true) on conflict (periodo, correo) do update set activo = true`;
        }
      }
      await tx`update classes set activo = false where periodo = ${periodo}`;
      for (const c of ok) {
        await tx`insert into classes (periodo, semestre, dia, inicio, fin, materia, teacher_id, activo)
          values (${periodo}, ${c.semestre}, ${c.dia}, ${c.inicio}, ${c.fin}, ${c.materia}, ${c.correoDocente ? tx`(select id from teachers where periodo = ${periodo} and correo = ${c.correoDocente})` : null}, true)
          on conflict (periodo, semestre, dia, inicio, materia) do update set fin = excluded.fin, teacher_id = coalesce(excluded.teacher_id, classes.teacher_id), activo = true`;
      }
    });
    const [n] = await sql`select count(distinct semestre)::int as s, count(distinct materia)::int as m from classes where periodo = ${periodo} and activo`;
    const resumen = `${n.s} semestres · ${n.m} materias`;
    await registrarArchivo('horarios', nombre, resumen);
    refrescar();
    return { ok: true, datos: { resumen: `${ok.length} clases cargadas.`, errores } };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
