'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { JSONValue } from 'postgres';
import { db } from '@/lib/db';
import { ajustesActuales, cargarDatos } from '@/lib/datos';
import { asegurarEsquema } from '@/lib/migrar';
import { leerTabla, parseDocentes, parseEstudiantes, parseHorarios } from '@/lib/excel';
import {
  ACTIVIDADES, MAX_ESTUDIANTES, UNIFORME, TIPOS_NOVEDAD, VESTIMENTA, claseAplica, claveNombre, cruceClases, esFechaISO, faltasDias, genClave, hoyISO, normalizarCorreo, normalizarParalelo, ordenarDias, telefonoValido,
} from '@/lib/reglas';
import { iniciarSesionCoordinacion, passwordCoordinacionOk, sesionCoordinacion } from '@/lib/sesion';
import type { DiaEvento, Estado, Resultado, Semestre } from '@/lib/tipos';

async function exigir(): Promise<void> {
  if (!(await sesionCoordinacion())) throw new Error('No autorizado. Vuelve a iniciar sesión.');
  await asegurarEsquema();
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
      // La clave del evento es su propio código (fácil de recordar); "Generar nueva" crea una aleatoria.
      await sql`update requests set estado = 'Aprobado', convocada_at = coalesce(convocada_at, ${hoyISO()}), clave = coalesce(clave, codigo) where id = ${id}`;
    } else {
      await sql`update requests set estado = ${estado} where id = ${id}`;
    }
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export interface CambiosPedido {
  nombre: string; cargo: string; institucion: string; correoSolicitante: string;
  evento: string; dias: DiaEvento[]; lugar: string; lejos: boolean; responsable: string; responsableTelefono: string;
  cantidad: number; vestimenta: string; actividades: string[];
}

/** Coordinación corrige los datos de un pedido (por ejemplo, la cantidad de estudiantes). */
export async function editarPedido(id: string, c: CambiosPedido): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const [actual] = await sql`select dias from requests where id = ${id}`;
    if (!actual) throw new Error('Pedido no encontrado');
    if (!c.evento.trim()) throw new Error('Escribe el nombre del evento');
    if (!c.nombre.trim() || !c.cargo.trim() || !c.institucion.trim()) throw new Error('Nombre, cargo e institución son obligatorios');
    const dias = ordenarDias(c.dias || []);
    const malDias = faltasDias(dias, hoyISO(), false);
    if (malDias.length) throw new Error('Revisa los días: ' + malDias.join(', '));
    if (!c.lugar.trim() || !c.responsable.trim()) throw new Error('Lugar y responsable son obligatorios');
    if (!telefonoValido(c.responsableTelefono)) throw new Error('Escribe un teléfono válido del responsable');
    const cantidad = Math.round(Number(c.cantidad));
    if (!(cantidad >= 1 && cantidad <= MAX_ESTUDIANTES)) throw new Error(`La cantidad debe estar entre 1 y ${MAX_ESTUDIANTES}`);
    const [conf] = await sql`select count(*)::int as n from enrollments where request_id = ${id} and estado = 'confirmado'`;
    if (cantidad < Number(conf.n)) throw new Error(`Ya hay ${conf.n} estudiantes confirmados; quita alguno antes de bajar la cantidad.`);
    if (!(c.vestimenta in VESTIMENTA)) throw new Error('Vestimenta inválida');
    const actividades = c.actividades.filter((a) => ACTIVIDADES.includes(a));
    if (!actividades.length) throw new Error('Elige al menos una actividad');
    const correo = normalizarCorreo(c.correoSolicitante) || null;
    await sql`update requests set nombre = ${c.nombre.trim()}, cargo = ${c.cargo.trim()}, institucion = ${c.institucion.trim()}, correo_solicitante = ${correo},
      evento = ${c.evento.trim()}, fecha = ${dias[0].fecha}, inicio = ${dias[0].inicio}, fin = ${dias[0].fin}, dias = ${sql.json(dias as unknown as JSONValue)},
      lugar = ${c.lugar.trim()}, lejos = ${!!c.lejos}, responsable = ${c.responsable.trim()}, responsable_telefono = ${c.responsableTelefono.trim()},
      cantidad = ${cantidad}, vestimenta = ${c.vestimenta}, actividades = ${actividades} where id = ${id}`;
    // Si cambiaron los días u horarios, los avisos a docentes pendientes se recalculan.
    const antes = JSON.stringify(ordenarDias((Array.isArray(actual.dias) ? actual.dias : []) as DiaEvento[]).map((d) => [d.fecha, String(d.inicio).slice(0, 5), String(d.fin).slice(0, 5)]));
    const cambioHorario = antes !== JSON.stringify(dias.map((d) => [d.fecha, d.inicio, d.fin]));
    if (cambioHorario) {
      await sql`delete from teacher_notices where request_id = ${id} and sent_at is null`;
      const sems = await sql`select distinct s.semestre from enrollments e join students s on s.id = e.student_id where e.request_id = ${id} and e.estado = 'confirmado'`;
      for (const r of sems) await prepararAvisos(id, Number(r.semestre));
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

/** Crea o actualiza los avisos pendientes a docentes para las clases que
 *  chocan con el evento y aplican a los estudiantes confirmados del semestre. */
async function prepararAvisos(requestId: string, semestre: number): Promise<void> {
  const sql = db();
  const datos = await cargarDatos();
  const p = datos.pedidos.find((x) => x.id === requestId);
  if (!p) return;
  const confirmados = datos.inscripciones.filter((i) => i.requestId === requestId && i.estado === 'confirmado').map((i) => datos.estudiantes.find((e) => e.id === i.studentId)).filter((e): e is NonNullable<typeof e> => !!e);
  const delSemestre = confirmados.filter((e) => e.semestre === semestre);
  for (const c of cruceClases(p, datos.clases, delSemestre)) {
    const ids = delSemestre.filter((e) => claseAplica(c, e)).map((e) => e.id);
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
      if (st) await prepararAvisos(requestId, Number(st.semestre));
    } else if (decision === 'rechazar') {
      await sql`update enrollments set estado = 'rechazado', updated_at = now() where request_id = ${requestId} and student_id = ${studentId}`;
    } else {
      await sql`delete from enrollments where request_id = ${requestId} and student_id = ${studentId}`;
      const [st] = await sql`select semestre from students where id = ${studentId}`;
      if (st) {
        // Los avisos pendientes de ese semestre se recalculan; si ya no queda nadie, se eliminan.
        await sql`delete from teacher_notices t using classes c where t.class_id = c.id and t.request_id = ${requestId} and t.sent_at is null and c.semestre = ${Number(st.semestre)}`;
        await prepararAvisos(requestId, Number(st.semestre));
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
    const [c] = await sql`select semestre, paralelo from classes where id = ${classId}`;
    if (!c) throw new Error('Clase no encontrada');
    const filas = await sql`select e.student_id, s.semestre, s.paralelo from enrollments e join students s on s.id = e.student_id where e.request_id = ${requestId} and e.estado = 'confirmado' and s.semestre = ${Number(c.semestre)}`;
    const clase = { semestre: Number(c.semestre), paralelo: (c.paralelo as string | null) ?? null };
    let ids = filas.filter((f) => claseAplica(clase, { semestre: Number(f.semestre), paralelo: (f.paralelo as string | null) ?? null })).map((f) => String(f.student_id));
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

export async function guardarEstudiante(e: { id?: string; nombre: string; correo: string; semestre: number; paralelo?: string | null; genero: 'F' | 'M'; activo: boolean }): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const { periodo } = await ajustesActuales();
    const correo = normalizarCorreo(e.correo);
    if (!e.nombre.trim() || !correo.includes('@')) throw new Error('Nombre y correo son obligatorios');
    if (![1, 2, 3].includes(e.semestre)) throw new Error('Semestre inválido');
    const paralelo = normalizarParalelo(e.paralelo) || null;
    if (e.id) {
      await sql`update students set nombre = ${e.nombre.trim()}, correo = ${correo}, semestre = ${e.semestre}, paralelo = ${paralelo}, genero = ${e.genero}, activo = ${e.activo} where id = ${e.id}`;
    } else {
      await sql`insert into students (periodo, nombre, correo, semestre, paralelo, genero, activo) values (${periodo}, ${e.nombre.trim()}, ${correo}, ${e.semestre}, ${paralelo}, ${e.genero}, ${e.activo})
        on conflict (periodo, correo) do update set nombre = excluded.nombre, semestre = excluded.semestre, paralelo = excluded.paralelo, genero = excluded.genero, activo = excluded.activo`;
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
    const correo = normalizarCorreo(d.correo) || null;
    if (!d.nombre.trim()) throw new Error('El nombre es obligatorio');
    if (correo && !correo.includes('@')) throw new Error('Correo inválido');
    if (d.id) await sql`update teachers set nombre = ${d.nombre.trim()}, correo = ${correo}, activo = ${d.activo} where id = ${d.id}`;
    else await sql`insert into teachers (periodo, nombre, correo, activo) values (${periodo}, ${d.nombre.trim()}, ${correo}, ${d.activo}) on conflict (periodo, correo) do update set nombre = excluded.nombre, activo = excluded.activo`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function guardarClase(c: { id?: string; semestre: number; paralelo?: string | null; dia: number; inicio: string; fin: string; materia: string; teacherId: string | null; activo: boolean }): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const { periodo } = await ajustesActuales();
    if (!c.materia.trim()) throw new Error('Escribe la materia');
    if (c.inicio >= c.fin) throw new Error('La hora de fin debe ser mayor que la de inicio');
    const paralelo = normalizarParalelo(c.paralelo) || null;
    if (c.id) await sql`update classes set semestre = ${c.semestre}, paralelo = ${paralelo}, dia = ${c.dia}, inicio = ${c.inicio}, fin = ${c.fin}, materia = ${c.materia.trim()}, teacher_id = ${c.teacherId || null}, activo = ${c.activo} where id = ${c.id}`;
    else await sql`insert into classes (periodo, semestre, paralelo, dia, inicio, fin, materia, teacher_id, activo) values (${periodo}, ${c.semestre}, ${paralelo}, ${c.dia}, ${c.inicio}, ${c.fin}, ${c.materia.trim()}, ${c.teacherId || null}, ${c.activo})
      on conflict (periodo, semestre, dia, inicio, materia, coalesce(paralelo, '')) do update set fin = excluded.fin, teacher_id = excluded.teacher_id, activo = excluded.activo`;
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
        await tx`insert into students (periodo, nombre, correo, semestre, paralelo, genero, activo) values (${periodo}, ${e.nombre}, ${e.correo}, ${e.semestre}, ${e.paralelo || null}, ${e.genero}, true)
          on conflict (periodo, correo) do update set nombre = excluded.nombre, semestre = excluded.semestre, paralelo = excluded.paralelo, genero = excluded.genero, activo = true`;
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
    const existentes = await sql`select id, nombre, correo from teachers where periodo = ${periodo}`;
    await sql.begin(async (tx) => {
      for (const d of ok) {
        // Si el docente ya existe (creado desde el horario, sin correo), se completa su correo.
        const porNombre = existentes.find((t) => claveNombre(String(t.nombre)) === claveNombre(d.nombre) && String(t.correo ?? '') !== d.correo);
        const porCorreo = existentes.find((t) => String(t.correo ?? '') === d.correo);
        if (porNombre && !porCorreo) await tx`update teachers set correo = ${d.correo}, nombre = ${d.nombre}, activo = true where id = ${porNombre.id}`;
        else await tx`insert into teachers (periodo, nombre, correo, activo) values (${periodo}, ${d.nombre}, ${d.correo}, true)
          on conflict (periodo, correo) do update set nombre = excluded.nombre, activo = true`;
      }
      await tx`update teachers set activo = false where periodo = ${periodo} and correo is not null and correo <> all(${correos})`;
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
    if (!ok.length) throw new Error('No se encontraron filas válidas. Se acepta el horario de la universidad (ASIGNATURA, NIVEL, PARALELO, DOCENTE, LUNES…VIERNES) o columnas Semestre, Paralelo, Día, Inicio, Fin, Materia, Docente, Correo docente.' + (errores.length ? ' ' + errores[0] : ''));
    const sql = db();
    const { periodo } = await ajustesActuales();
    const docentes = await sql`select id, nombre, correo from teachers where periodo = ${periodo}`;
    const idPorCorreo = new Map(docentes.filter((t) => t.correo).map((t) => [String(t.correo), String(t.id)]));
    const idPorNombre = new Map(docentes.map((t) => [claveNombre(String(t.nombre)), String(t.id)]));
    await sql.begin(async (tx) => {
      // Docentes que vienen en el horario y aún no existen (por correo o por nombre).
      for (const c of ok) {
        if (c.correoDocente && !idPorCorreo.has(c.correoDocente)) {
          const [t] = await tx`insert into teachers (periodo, nombre, correo, activo) values (${periodo}, ${c.docenteNombre || c.correoDocente.split('@')[0]}, ${c.correoDocente}, true)
            on conflict (periodo, correo) do update set activo = true returning id`;
          idPorCorreo.set(c.correoDocente, String(t.id));
          if (c.docenteNombre) idPorNombre.set(claveNombre(c.docenteNombre), String(t.id));
        } else if (!c.correoDocente && c.docenteNombre && !idPorNombre.has(claveNombre(c.docenteNombre))) {
          const [t] = await tx`insert into teachers (periodo, nombre, correo, activo) values (${periodo}, ${c.docenteNombre}, null, true) returning id`;
          idPorNombre.set(claveNombre(c.docenteNombre), String(t.id));
        }
      }
      await tx`update classes set activo = false where periodo = ${periodo}`;
      for (const c of ok) {
        const teacherId = (c.correoDocente && idPorCorreo.get(c.correoDocente)) || (c.docenteNombre && idPorNombre.get(claveNombre(c.docenteNombre))) || null;
        await tx`insert into classes (periodo, semestre, paralelo, dia, inicio, fin, materia, teacher_id, activo)
          values (${periodo}, ${c.semestre}, ${c.paralelo || null}, ${c.dia}, ${c.inicio}, ${c.fin}, ${c.materia}, ${teacherId}, true)
          on conflict (periodo, semestre, dia, inicio, materia, coalesce(paralelo, '')) do update set fin = excluded.fin, teacher_id = coalesce(excluded.teacher_id, classes.teacher_id), activo = true`;
      }
    });
    const [n] = await sql`select count(distinct semestre)::int as s, count(distinct materia)::int as m from classes where periodo = ${periodo} and activo`;
    const resumen = `${n.s} semestres · ${n.m} materias`;
    await registrarArchivo('horarios', nombre, resumen);
    refrescar();
    return { ok: true, datos: { resumen: `${ok.length} clases cargadas.`, errores } };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
