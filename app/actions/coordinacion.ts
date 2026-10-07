'use server';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { JSONValue } from 'postgres';
import { db } from '@/lib/db';
import { ajustesActuales, cargarDatos, mapCita, mapPedido } from '@/lib/datos';
import { asegurarEsquema } from '@/lib/migrar';
import { activarWebhook, avisarCoordinacion, desactivarWebhook, detectarCanalTelegram, detectarChatTelegram, enviarDirecto, enviarPrueba, publicarEnCanal } from '@/lib/notificar';
import { mensajeConvocatoriaCanal, mensajeEstudianteConfirmado, mensajeEstudianteNoConfirmado, mensajeEstudianteRetirado, mensajeUniformesCanal, mensajeUniformesPersonal } from '@/lib/notificar-texto';
import { appUrl } from '@/lib/app-url';
import { avanceEstudiante, vistaPedido } from '@/lib/vista';
import { coincideNombre, esFormatoNrc, generoPorNombre, leerHojas, leerTabla, parseDocentes, parseEstudiantes, parseEstudiantesNrc, parseHorarios, type HojaCruda } from '@/lib/excel';
import { borrarEvidencia, evidenciaExiste, prepararSubida } from '@/lib/storage';
import { ACTIVIDADES, cantidadDia, claseAplica, claveDocente, cruceClases, diasEstudiante, diasLlenos, esFechaISO, faltasCantidadesDias, faltasCitaUniforme, faltasDias, faltasHorarioUniforme, faltasReparto, genClave, hoyISO, MAX_ESTUDIANTES, nombrarDias, normalizarCorreo, normalizarParalelo, ordenarDias, telefonoValido, TIPOS_NOVEDAD, UNIFORME, unirRepartos, VESTIMENTA } from '@/lib/reglas';
import { iniciarSesionCoordinacion, passwordCoordinacionOk, sesionCoordinacion } from '@/lib/sesion';
import type { CitaUniforme, DiaEvento, Estado, FranjaUniforme, RepartoActividad, Resultado, Semestre } from '@/lib/tipos';

async function exigir(): Promise<void> {
  if (!(await sesionCoordinacion())) throw new Error('No autorizado. Vuelve a iniciar sesión.');
  await asegurarEsquema();
}

function refrescar() {
  revalidatePath('/coordinacion');
  revalidatePath('/horarios');
  revalidatePath('/estudiante');
}

function fallo<T = undefined>(e: unknown): Resultado<T> {
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
      // Convocatoria automática en el canal de Telegram de estudiantes (si está configurado).
      const datos = await cargarDatos();
      if (datos.notificaciones.canalEstudiantes) {
        const pv = datos.pedidos.find((x) => x.id === id);
        if (pv) {
          try {
            await publicarEnCanal(mensajeConvocatoriaCanal(vistaPedido(datos, pv), appUrl()), datos.ajustes);
            await sql`update requests set telegram_post_at = now() where id = ${id}`;
          } catch (e) {
            console.error('[telegram canal]', (e as Error).message);
            await avisarCoordinacion(`No se pudo publicar la convocatoria de ${pv.codigo} en el canal: ${(e as Error).message}`, datos.ajustes);
          }
        }
      }
    } else {
      await sql`update requests set estado = ${estado} where id = ${id}`;
    }
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

/** Elimina un pedido para siempre, con sus inscripciones, novedades, avisos a docentes y evidencia. */
export async function eliminarPedido(id: string): Promise<Resultado<{ codigo: string }>> {
  try {
    await exigir();
    const sql = db();
    const [p] = await sql`select codigo, evidencia_path, acta_firmada_path from requests where id = ${id}`;
    if (!p) throw new Error('Pedido no encontrado');
    await sql`delete from requests where id = ${id}`; // inscripciones, novedades y avisos se borran en cascada
    for (const ruta of [p.evidencia_path, p.acta_firmada_path]) if (ruta) await borrarEvidencia(String(ruta)).catch((e) => console.error('[archivo] no se pudo borrar', (e as Error).message));
    refrescar();
    return { ok: true, datos: { codigo: String(p.codigo) } };
  } catch (e) { return fallo(e); }
}

/** Prepara la subida del acta firmada (PDF o imagen) de un pedido. */
export async function prepararActaFirmada(id: string, nombre: string, tipo: string, tamano: number): Promise<Resultado<{ path: string; url: string }>> {
  try {
    await exigir();
    if (!nombre) throw new Error('Archivo sin nombre.');
    if (tamano > 15 * 1024 * 1024) throw new Error('El archivo supera 15 MB.');
    if (!/\.pdf$/i.test(nombre) && !tipo.startsWith('image/') && tipo !== 'application/pdf') throw new Error('Solo se acepta PDF o imagen.');
    const [p] = await db()`select periodo from requests where id = ${id}`;
    if (!p) throw new Error('Pedido no encontrado');
    return { ok: true, datos: await prepararSubida(`${String(p.periodo)}/actas`, nombre) };
  } catch (e) { return fallo(e); }
}

export async function guardarActaFirmada(id: string, ruta: string, nombre: string): Promise<Resultado> {
  try {
    await exigir();
    if (!(await evidenciaExiste(ruta))) throw new Error('El archivo no terminó de subirse. Intenta de nuevo.');
    const sql = db();
    const [ant] = await sql`select acta_firmada_path from requests where id = ${id}`;
    await sql`update requests set acta_firmada_path = ${ruta}, acta_firmada_nombre = ${nombre.slice(0, 200)}, acta_firmada_at = now() where id = ${id}`;
    if (ant?.acta_firmada_path && ant.acta_firmada_path !== ruta) await borrarEvidencia(String(ant.acta_firmada_path)).catch(() => undefined);
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

export async function quitarActaFirmada(id: string): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const [p] = await sql`select acta_firmada_path from requests where id = ${id}`;
    await sql`update requests set acta_firmada_path = null, acta_firmada_nombre = null, acta_firmada_at = null where id = ${id}`;
    if (p?.acta_firmada_path) await borrarEvidencia(String(p.acta_firmada_path)).catch(() => undefined);
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

/** Marca (o desmarca) un evento aprobado como finalizado. */
export async function finalizarEvento(id: string, fin: boolean): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const [p] = await sql`select estado from requests where id = ${id}`;
    if (!p) throw new Error('Pedido no encontrado');
    if (p.estado !== 'Aprobado') throw new Error('Solo se puede finalizar un evento aprobado.');
    await sql`update requests set finalizado_at = ${fin ? hoyISO() : null} where id = ${id}`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

/** Fija la cita de entrega y devolución de uniformes de un evento; con `avisar`, la publica en el canal y por mensaje personal. */
export async function guardarCitaUniforme(id: string, c: CitaUniforme, avisar: boolean): Promise<Resultado<{ canal: boolean; personales: number; sinCanal: boolean }>> {
  try {
    await exigir();
    const sql = db();
    const t = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    const cita: CitaUniforme = {
      entregaFecha: t(c.entregaFecha), entregaHora: t(c.entregaHora), entregaHasta: t(c.entregaHasta), entregaHoraFin: t(c.entregaHoraFin),
      devolucionFecha: t(c.devolucionFecha), devolucionHora: t(c.devolucionHora), devolucionHasta: t(c.devolucionHasta), devolucionHoraFin: t(c.devolucionHoraFin),
      lugar: t(c.lugar).slice(0, 200), avisoAt: null,
    };
    // Un 'hasta' igual al primer día no es un periodo.
    if (cita.entregaHasta === cita.entregaFecha) cita.entregaHasta = '';
    if (cita.devolucionHasta === cita.devolucionFecha) cita.devolucionHasta = '';
    const faltas = faltasCitaUniforme(cita);
    if (faltas.length) throw new Error('Revisa: ' + faltas.join(', '));
    const [p] = await sql`select estado, vestimenta, uniforme_cita from requests where id = ${id}`;
    if (!p) throw new Error('Pedido no encontrado');
    if (p.estado !== 'Aprobado') throw new Error('El evento debe estar aprobado.');
    cita.avisoAt = mapCita(p)?.avisoAt ?? null;
    let canal = false, personales = 0, sinCanal = false;
    if (avisar) {
      await sql`update requests set uniforme_cita = ${sql.json(cita as unknown as JSONValue)} where id = ${id}`;
      const datos = await cargarDatos();
      const pv = vistaPedido(datos, datos.pedidos.find((x) => x.id === id)!);
      if (!pv.confirmadosN) throw new Error('Aún no hay estudiantes confirmados a quienes avisar. La cita quedó guardada.');
      if (datos.notificaciones.canalEstudiantes) {
        await publicarEnCanal(mensajeUniformesCanal(pv, cita), datos.ajustes);
        canal = true;
      } else sinCanal = true;
      for (const e of pv.confirmados) if (e.telegramChatId && (await enviarDirecto(e.telegramChatId, mensajeUniformesPersonal(pv, cita, e)))) personales++;
      if (canal || personales) cita.avisoAt = new Date().toISOString();
    }
    await sql`update requests set uniforme_cita = ${sql.json(cita as unknown as JSONValue)} where id = ${id}`;
    refrescar();
    return { ok: true, datos: { canal, personales, sinCanal } };
  } catch (e) { return fallo(e); }
}

/** Crea (o reemplaza) el enlace privado del calendario suscrito. El anterior deja de funcionar. */
export async function crearEnlaceCalendario(): Promise<Resultado<{ token: string }>> {
  try {
    await exigir();
    const token = randomBytes(16).toString('hex');
    const { periodo } = await ajustesActuales();
    await db()`update settings set calendario_token = ${token} where periodo = ${periodo}`;
    refrescar();
    return { ok: true, datos: { token } };
  } catch (e) { return fallo(e); }
}

export interface CambiosPedido {
  nombre: string; cargo: string; institucion: string; correoSolicitante: string;
  evento: string; dias: DiaEvento[]; lugar: string; lejos: boolean; responsable: string; responsableTelefono: string;
  cantidad: number; mismosEstudiantes: boolean; vestimenta: string; reparto: RepartoActividad[];
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
    const dias = ordenarDias(c.dias || []).map((d) => ({ fecha: d.fecha, inicio: d.inicio, fin: d.fin, lugar: (d.lugar ?? '').trim().slice(0, 300), lejos: !!d.lejos, ...(!c.mismosEstudiantes && Number(d.cantidad) > 0 ? { cantidad: Math.round(Number(d.cantidad)) } : {}), ...(d.reparto?.length ? { reparto: (d.reparto || []).filter((x) => ACTIVIDADES.includes(x.actividad)).map((x) => ({ actividad: x.actividad, cantidad: Math.round(Number(x.cantidad)) })) } : {}) }));
    const lugar = dias[0]?.lugar || (c.lugar || '').trim();
    const lejos = dias.some((d) => d.lejos);
    const malDias = faltasDias(dias, hoyISO(), false);
    const malCantidades = faltasCantidadesDias(Math.round(Number(c.cantidad)), dias, !!c.mismosEstudiantes);
    if (malCantidades.length) throw new Error('Estudiantes por día: ' + malCantidades.join(', '));
    if (malDias.length) throw new Error('Revisa los días: ' + malDias.join(', '));
    if (dias.some((d) => !d.lugar) || !c.responsable.trim()) throw new Error('Lugar de cada día y responsable son obligatorios');
    if (!telefonoValido(c.responsableTelefono)) throw new Error('Escribe un teléfono válido del responsable');
    const cantidad = Math.round(Number(c.cantidad));
    if (!(cantidad >= 1 && cantidad <= MAX_ESTUDIANTES)) throw new Error(`La cantidad debe estar entre 1 y ${MAX_ESTUDIANTES}`);
    const [conf] = await sql`select count(*)::int as n from enrollments where request_id = ${id} and estado = 'confirmado'`;
    if (cantidad < Number(conf.n)) throw new Error(`Ya hay ${conf.n} estudiantes confirmados; quita alguno antes de bajar la cantidad.`);
    if (!(c.vestimenta in VESTIMENTA)) throw new Error('Vestimenta inválida');
    let reparto: RepartoActividad[];
    if (dias.length > 1) {
      const malPorDia = dias.flatMap((d, i) => faltasReparto(d.reparto ?? [], cantidadDia({ cantidad, mismosEstudiantes: !!c.mismosEstudiantes }, d)).map((x) => `día ${i + 1}: ${x}`));
      if (malPorDia.length) throw new Error('Actividades: ' + malPorDia.join(', '));
      reparto = unirRepartos(dias);
    } else {
      reparto = (c.reparto || []).filter((x) => ACTIVIDADES.includes(x.actividad)).map((x) => ({ actividad: x.actividad, cantidad: Math.round(Number(x.cantidad)) }));
      const malReparto = faltasReparto(reparto, cantidad);
      if (malReparto.length) throw new Error('Actividades: ' + malReparto.join(', '));
    }
    const actividades = reparto.map((x) => x.actividad);
    const correo = normalizarCorreo(c.correoSolicitante) || null;
    await sql`update requests set nombre = ${c.nombre.trim()}, cargo = ${c.cargo.trim()}, institucion = ${c.institucion.trim()}, correo_solicitante = ${correo},
      evento = ${c.evento.trim()}, fecha = ${dias[0].fecha}, inicio = ${dias[0].inicio}, fin = ${dias[0].fin}, dias = ${sql.json(dias as unknown as JSONValue)},
      lugar = ${lugar}, lejos = ${lejos}, responsable = ${c.responsable.trim()}, responsable_telefono = ${c.responsableTelefono.trim()},
      cantidad = ${cantidad}, mismos_estudiantes = ${!!c.mismosEstudiantes}, vestimenta = ${c.vestimenta}, actividades = ${actividades}, reparto = ${sql.json(reparto as unknown as JSONValue)} where id = ${id}`;
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
      const [fila] = await sql`select * from requests where id = ${requestId}`;
      if (!fila || fila.estado !== 'Aprobado') throw new Error('El pedido debe estar aprobado.');
      const p = mapPedido(fila);
      const conf = await sql`select student_id, dias from enrollments where request_id = ${requestId} and estado = 'confirmado'`;
      const [propia] = await sql`select dias from enrollments where request_id = ${requestId} and student_id = ${studentId}`;
      const otros = conf.filter((r) => String(r.student_id) !== studentId).map((r) => mapDiasJson(r.dias));
      const fechas = p.dias.map((d) => d.fecha);
      let valorDias: string[] | null = propia ? mapDiasJson(propia.dias) : null;
      const mios = diasEstudiante(p, valorDias).map((d) => d.fecha);
      // El cupo es por día. Un inscrito con algún día lleno no se acepta hasta apagar ese día (D1, D2…) o quitar a otro;
      // un estudiante agregado directamente por coordinación queda solo en los días con cupo.
      const llenos = diasLlenos(p, otros, mios);
      if (llenos.length === mios.length) throw new Error(p.dias.length > 1 ? 'Cupos completos para los días de este estudiante. Cambia sus días (D1, D2…) o quita a otro confirmado.' : 'Cupos completos.');
      if (llenos.length) {
        if (propia) throw new Error(`${nombrarDias(llenos, fechas)} ya ${llenos.length > 1 ? 'tienen' : 'tiene'} los cupos completos. Apaga ${llenos.map((f) => `D${fechas.indexOf(f) + 1}`).join(' y ')} junto al estudiante antes de aceptarlo, o quita a otro confirmado.`);
        valorDias = mios.filter((f) => !llenos.includes(f));
      }
      await sql`insert into enrollments (request_id, student_id, estado, dias) values (${requestId}, ${studentId}, 'confirmado', ${valorDias ? sql.json(valorDias) : null})
        on conflict (request_id, student_id) do update set estado = 'confirmado', dias = excluded.dias, updated_at = now()`;
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
    // Mensaje personal de Telegram al estudiante (si vinculó su cuenta).
    const datos = await cargarDatos();
    const e = datos.estudiantes.find((x) => x.id === studentId);
    const p = datos.pedidos.find((x) => x.id === requestId);
    if (e?.telegramChatId && p) {
      const pv = vistaPedido(datos, p);
      const texto = decision === 'aceptar' ? mensajeEstudianteConfirmado(pv, e, avanceEstudiante(datos, e.id).eventosN) : decision === 'rechazar' ? mensajeEstudianteNoConfirmado(pv, e) : mensajeEstudianteRetirado(pv, e);
      await enviarDirecto(e.telegramChatId, texto);
    }
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

/** Coordinación agrega directamente a un estudiante como confirmado. */
export async function confirmarDirecto(requestId: string, studentId: string): Promise<Resultado> {
  return decidirInscripcion(requestId, studentId, 'aceptar');
}

/** Días a los que asiste un estudiante (inscrito o confirmado) en un evento de varios días; null = todos. */
export async function fijarDiasEstudiante(requestId: string, studentId: string, dias: string[] | null): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const [fila] = await sql`select * from requests where id = ${requestId}`;
    if (!fila) throw new Error('Pedido no encontrado');
    const p = mapPedido(fila);
    const fechas = p.dias.map((d) => d.fecha);
    const elegidos = (dias ?? []).filter((f) => fechas.includes(f));
    if (dias && !elegidos.length) throw new Error('El estudiante debe asistir al menos un día.');
    const valor = elegidos.length && elegidos.length < fechas.length ? elegidos : null;
    await sql`update enrollments set dias = ${valor ? sql.json(valor) : null}, updated_at = now() where request_id = ${requestId} and student_id = ${studentId}`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

/** dias de una inscripción tal como viene de la base (jsonb o texto). */
function mapDiasJson(v: unknown): string[] | null {
  let x = v;
  if (typeof x === 'string') { try { x = JSON.parse(x); } catch { return null; } }
  return Array.isArray(x) && x.length ? x.map(String) : null;
}

// ---------------------------------------------------------------- avisos a docentes

export async function crearAviso(requestId: string, classId: string): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const datos = await cargarDatos();
    const clase = datos.clases.find((x) => x.id === classId);
    if (!clase) throw new Error('Clase no encontrada');
    const confirmados = datos.inscripciones.filter((i) => i.requestId === requestId && i.estado === 'confirmado').map((i) => datos.estudiantes.find((e) => e.id === i.studentId)).filter((e): e is NonNullable<typeof e> => !!e);
    // Por matrícula real (NRC) cuando existe; si no, por semestre y paralelo. Sin coincidencias: todos los confirmados.
    let ids = confirmados.filter((e) => claseAplica(clase, e)).map((e) => e.id);
    if (!ids.length) ids = confirmados.map((e) => e.id);
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

/** Devolución del uniforme de un estudiante en un evento: recibido lavado, no recibido (sin lavar) o sin registro (pendiente). */
export async function fijarDevolucion(requestId: string, studentId: string, estado: 'lavado' | 'rechazado' | null): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    if (!estado) await sql`delete from uniform_event_returns where request_id = ${requestId} and student_id = ${studentId}`;
    else await sql`insert into uniform_event_returns (request_id, student_id, estado, at) values (${requestId}, ${studentId}, ${estado}, ${hoyISO()}) on conflict (request_id, student_id) do update set estado = excluded.estado, at = excluded.at`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

// ---------------------------------------------------------------- ajustes

export async function guardarAjustes(a: { horasSemana?: number; inicioSemestre?: string; correoDecanato?: string; correoGrupoEstudiantes?: string; correoCoordinacion?: string; uniformeLugar?: string; anticipacionHoras?: number; anticipacionHasta?: string; uniformeHorario?: FranjaUniforme[]; uniformeDiasDevolucion?: number }): Promise<Resultado> {
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
    if (a.uniformeLugar != null) await sql`update settings set uniforme_lugar = ${a.uniformeLugar.trim().slice(0, 200)} where periodo = ${periodo}`;
    if (a.anticipacionHoras != null) {
      const h = Math.round(Number(a.anticipacionHoras));
      if (!(h >= 1 && h <= 720)) throw new Error('La anticipación debe estar entre 1 y 720 horas');
      await sql`update settings set anticipacion_horas = ${h} where periodo = ${periodo}`;
    }
    if (a.anticipacionHasta != null) {
      if (a.anticipacionHasta && !esFechaISO(a.anticipacionHasta)) throw new Error('Fecha límite de la anticipación inválida');
      await sql`update settings set anticipacion_hasta = ${a.anticipacionHasta || null} where periodo = ${periodo}`;
    }
    if (a.uniformeDiasDevolucion != null) {
      const n = Math.round(Number(a.uniformeDiasDevolucion));
      if (!(n >= 1 && n <= 60)) throw new Error('El plazo para devolver el uniforme debe estar entre 1 y 60 días');
      await sql`update settings set uniforme_dias_devolucion = ${n} where periodo = ${periodo}`;
    }
    if (a.uniformeHorario != null) {
      const h: FranjaUniforme[] = (Array.isArray(a.uniformeHorario) ? a.uniformeHorario : []).map((f) => ({ dia: Math.round(Number(f.dia)), inicio: String(f.inicio ?? '').trim(), fin: String(f.fin ?? '').trim(), atiende: String(f.atiende ?? '').trim().slice(0, 120) }));
      const faltas = faltasHorarioUniforme(h);
      if (faltas.length) throw new Error('Horario de uniformes: ' + faltas.join('; '));
      await sql`update settings set uniforme_horario = ${sql.json(h as unknown as JSONValue)} where periodo = ${periodo}`;
    }
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

// ---------------------------------------------------------------- notificaciones

export async function probarNotificacion(): Promise<Resultado> {
  try {
    await exigir();
    const errores = await enviarPrueba(await ajustesActuales());
    if (errores.length) return { ok: false, error: errores.join(' · ') };
    return { ok: true };
  } catch (e) { return fallo(e); }
}

/** Publica (o vuelve a publicar) la convocatoria de un pedido aprobado en el canal. */
export async function publicarConvocatoriaCanal(id: string): Promise<Resultado> {
  try {
    await exigir();
    const datos = await cargarDatos();
    const p = datos.pedidos.find((x) => x.id === id);
    if (!p || p.estado !== 'Aprobado') throw new Error('Solo se publican pedidos aprobados.');
    await publicarEnCanal(mensajeConvocatoriaCanal(vistaPedido(datos, p), appUrl()), datos.ajustes);
    await db()`update requests set telegram_post_at = now() where id = ${id}`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

/** Detecta el canal de estudiantes (el bot debe ser administrador y debe haber un mensaje publicado). */
export async function detectarCanal(): Promise<Resultado<{ nombre: string }>> {
  try {
    await exigir();
    const canal = await detectarCanalTelegram();
    const { periodo } = await ajustesActuales();
    await db()`update settings set telegram_canal_id = ${canal.id}, telegram_canal_nombre = ${canal.nombre} where periodo = ${periodo}`;
    refrescar();
    return { ok: true, datos: { nombre: canal.nombre } };
  } catch (e) { return fallo(e); }
}

/** Activa los mensajes personales del bot (Telegram envía a la app lo que le escriben). */
export async function activarMensajesPersonales(): Promise<Resultado<{ bot: string }>> {
  try {
    await exigir();
    const url = `${appUrl()}/api/telegram/webhook`;
    const bot = await activarWebhook(url);
    const { periodo } = await ajustesActuales();
    await db()`update settings set telegram_bot_username = ${bot}, telegram_webhook_url = ${url} where periodo = ${periodo}`;
    refrescar();
    return { ok: true, datos: { bot } };
  } catch (e) { return fallo(e); }
}

export async function desactivarMensajesPersonales(): Promise<Resultado> {
  try {
    await exigir();
    await desactivarWebhook();
    const { periodo } = await ajustesActuales();
    await db()`update settings set telegram_webhook_url = null where periodo = ${periodo}`;
    refrescar();
    return { ok: true };
  } catch (e) { return fallo(e); }
}

/** Envía un mensaje de prueba al canal de estudiantes. */
export async function probarCanal(): Promise<Resultado> {
  try {
    await exigir();
    const a = await ajustesActuales();
    await publicarEnCanal(`Prueba del canal de Protocolo FCGT. Aquí se publicarán las convocatorias de eventos y los recordatorios.\n${appUrl()}/estudiante`, a);
    return { ok: true };
  } catch (e) { return fallo(e); }
}

/** Detecta el chat de Telegram de coordinación y lo guarda. */
export async function detectarTelegram(): Promise<Resultado<{ nombre: string }>> {
  try {
    await exigir();
    const chat = await detectarChatTelegram();
    const { periodo } = await ajustesActuales();
    await db()`update settings set telegram_chat_id = ${chat.id}, telegram_chat_nombre = ${chat.nombre} where periodo = ${periodo}`;
    refrescar();
    return { ok: true, datos: { nombre: chat.nombre } };
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
      await tx`insert into settings (periodo, actual, inicio_semestre, semanas, horas_semana, correo_decanato, correo_grupo_estudiantes, correo_coordinacion, telegram_chat_id, telegram_chat_nombre, telegram_canal_id, telegram_canal_nombre, telegram_bot_username, telegram_webhook_url, uniforme_lugar, calendario_token, uniforme_horario, uniforme_dias_devolucion)
        values (${p}, true, ${inicioSemestre}, ${actual.semanas}, ${actual.horasSemana}, ${actual.correoDecanato}, ${actual.correoGrupoEstudiantes}, ${actual.correoCoordinacion}, ${actual.telegramChatId || null}, ${actual.telegramChatNombre || null}, ${actual.telegramCanalId || null}, ${actual.telegramCanalNombre || null}, ${actual.telegramBotUsername || null}, ${actual.telegramWebhookUrl || null}, ${actual.uniformeLugar || ''}, ${actual.calendarioToken || null}, ${actual.uniformeHorario.length ? tx.json(actual.uniformeHorario as unknown as JSONValue) : null}, ${actual.uniformeDiasDevolucion || 7})
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
    const correo = normalizarCorreo(e.correo || '');
    if (!e.nombre.trim()) throw new Error('El nombre es obligatorio');
    if (correo && !correo.includes('@')) throw new Error('Correo inválido');
    if (![1, 2, 3].includes(e.semestre)) throw new Error('Semestre inválido');
    const paralelo = normalizarParalelo(e.paralelo) || null;
    if (e.id) {
      await sql`update students set nombre = ${e.nombre.trim()}, correo = ${correo || null}, semestre = ${e.semestre}, paralelo = ${paralelo}, genero = ${e.genero}, activo = ${e.activo} where id = ${e.id}`;
    } else if (!correo) {
      await sql`insert into students (periodo, nombre, correo, semestre, paralelo, genero, activo) values (${periodo}, ${e.nombre.trim()}, null, ${e.semestre}, ${paralelo}, ${e.genero}, ${e.activo})`;
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

export async function guardarClase(c: { id?: string; semestre: number; paralelo?: string | null; dia: number; inicio: string; fin: string; materia: string; teacherId: string | null; nrc?: string | null; activo: boolean }): Promise<Resultado> {
  try {
    await exigir();
    const sql = db();
    const { periodo } = await ajustesActuales();
    if (!c.materia.trim()) throw new Error('Escribe la materia');
    if (c.inicio >= c.fin) throw new Error('La hora de fin debe ser mayor que la de inicio');
    const paralelo = normalizarParalelo(c.paralelo) || null;
    const nrc = (c.nrc ?? '').trim() || null;
    if (c.id) await sql`update classes set semestre = ${c.semestre}, paralelo = ${paralelo}, dia = ${c.dia}, inicio = ${c.inicio}, fin = ${c.fin}, materia = ${c.materia.trim()}, teacher_id = ${c.teacherId || null}, nrc = ${nrc}, activo = ${c.activo} where id = ${c.id}`;
    else await sql`insert into classes (periodo, semestre, paralelo, dia, inicio, fin, materia, teacher_id, nrc, activo) values (${periodo}, ${c.semestre}, ${paralelo}, ${c.dia}, ${c.inicio}, ${c.fin}, ${c.materia.trim()}, ${c.teacherId || null}, ${nrc}, ${c.activo})
      on conflict (periodo, semestre, dia, inicio, materia, coalesce(paralelo, '')) do update set fin = excluded.fin, teacher_id = excluded.teacher_id, nrc = coalesce(excluded.nrc, classes.nrc), activo = excluded.activo`;
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
    const semForm = parseInt(String(formData.get('semestre') ?? ''), 10);
    const semArchivo = [1, 2, 3].includes(semForm) ? (semForm as Semestre) : null;
    // Listado por materia de la universidad (una hoja por materia con NRC) o listado simple (Nombre, Correo, Semestre, Paralelo, Género).
    const hojas = /\.csv$/i.test(nombre) ? [] : await leerHojas(buffer);
    if (hojas.length && esFormatoNrc(hojas)) return await importarEstudiantesNrc(nombre, hojas, semArchivo);
    const filas = await leerTabla(buffer, nombre);
    const { ok, errores } = parseEstudiantes(filas);
    if (!ok.length) throw new Error('No se encontraron filas válidas. Se acepta el listado por materia (hojas con NRC) o columnas Nombre, Correo, Semestre, Género.' + (errores.length ? ' ' + errores[0] : ''));
    const sql = db();
    const { periodo } = await ajustesActuales();
    const existentes = await sql`select id, nombre, correo from students where periodo = ${periodo}`;
    const semestres = new Set<number>();
    // Quien vino del listado por materia (sin correo) se completa por nombre; el resto se inserta o actualiza por correo en una sola consulta.
    const porNombre: { id: string; e: (typeof ok)[number] }[] = [];
    const porCorreo = new Map<string, (typeof ok)[number]>();
    for (const e of ok) {
      semestres.add(e.semestre);
      const conCorreo = existentes.find((x) => String(x.correo ?? '') === e.correo);
      const sinCorreo = !conCorreo ? existentes.find((x) => !x.correo && !porNombre.some((u) => u.id === String(x.id)) && coincideNombre(String(x.nombre), e.nombre)) : null;
      if (sinCorreo) porNombre.push({ id: String(sinCorreo.id), e });
      else porCorreo.set(e.correo, e);
    }
    const tocados: string[] = [];
    await sql.begin(async (tx) => {
      for (const { id, e } of porNombre) {
        await tx`update students set correo = ${e.correo}, nombre = ${e.nombre}, semestre = ${e.semestre}, paralelo = ${e.paralelo || null}, genero = ${e.genero}, activo = true where id = ${id}`;
        tocados.push(id);
      }
      const lote = [...porCorreo.values()].map((e) => ({ periodo, nombre: e.nombre, correo: e.correo, semestre: e.semestre, paralelo: e.paralelo || null, genero: e.genero, activo: true }));
      if (lote.length) {
        const r = await tx`insert into students ${tx(lote, 'periodo', 'nombre', 'correo', 'semestre', 'paralelo', 'genero', 'activo')}
          on conflict (periodo, correo) do update set nombre = excluded.nombre, semestre = excluded.semestre, paralelo = excluded.paralelo, genero = excluded.genero, activo = true returning id`;
        for (const x of r) tocados.push(String(x.id));
      }
      // Reemplaza el listado de los semestres que trae el archivo: quien no aparece queda inactivo (nunca se borra historial).
      const sems = [...semestres];
      await tx`update students set activo = false where periodo = ${periodo} and semestre = any(${sems}::int[]) and id <> all(${tocados}::uuid[])`;
    });
    const [n] = await sql`select count(*)::int as n, count(*) filter (where correo is null or correo = '')::int as sin from students where periodo = ${periodo} and activo`;
    const resumen = `${n.n} estudiantes · 1.º a 3.º semestre`;
    await registrarArchivo('estudiantes', nombre, resumen);
    refrescar();
    return { ok: true, datos: { resumen: `${ok.length} filas procesadas. Activos: ${n.n}${n.sin ? ` (${n.sin} sin correo)` : ''}.`, errores } };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

/** Listado por materia (NRC): crea o actualiza cada estudiante una sola vez (por nombre), guarda sus NRC y desactiva a quienes ya no aparecen en ese semestre.
 *  Todo en pocas consultas masivas: en Vercel cada función tiene pocos segundos y la base está en otro servidor. */
async function importarEstudiantesNrc(nombreArchivo: string, hojas: HojaCruda[], semArchivo: Semestre | null): Promise<Resultado<{ resumen: string; errores: string[] }>> {
  const { ok, materias, errores } = parseEstudiantesNrc(hojas);
  if (!ok.length) throw new Error('No se encontraron estudiantes. Cada hoja debe tener la columna NRC y los nombres.' + (errores.length ? ' ' + errores[0] : ''));
  const sql = db();
  const { periodo } = await ajustesActuales();
  const clasesNrc = await sql`select distinct nrc, semestre from classes where periodo = ${periodo} and activo and nrc is not null`;
  const semPorNrc = new Map(clasesNrc.map((c) => [String(c.nrc), Number(c.semestre)]));
  // Si el horario cargado no tiene ese NRC, vale el semestre que dice el nombre de la hoja ("LENGUAJE - 1C" → 1.º).
  const semPorHoja = new Map(materias.filter((m) => m.semestre).map((m) => [m.nrc, m.semestre as number]));
  const existentes = await sql`select id, nombre, correo, semestre, activo from students where periodo = ${periodo}`;
  const semestres = new Set<number>(); const sinSemestre: string[] = []; const usados = new Set<string>();
  const plan: { e: (typeof ok)[number]; sem: number; id: string | null; nuevo: boolean }[] = [];
  for (const e of ok) {
    const porNrc = e.nrcs.map((x) => semPorNrc.get(x) ?? semPorHoja.get(x)).filter((x): x is number => !!x);
    const sem = semArchivo ?? (porNrc.length ? Number([...porNrc].sort((a, b) => porNrc.filter((v) => v === b).length - porNrc.filter((v) => v === a).length || a - b)[0]) : 0);
    if (!sem) { sinSemestre.push(e.nombre); continue; }
    semestres.add(sem);
    const match = existentes.find((x) => !usados.has(String(x.id)) && coincideNombre(String(x.nombre), e.nombre));
    if (match) usados.add(String(match.id));
    plan.push({ e, sem, id: match ? String(match.id) : null, nuevo: !match });
  }
  if (!plan.length) throw new Error(`No se importó ningún estudiante porque no se pudo saber su semestre (el horario cargado no tiene estos NRC y las hojas no indican el nivel). Elige 1.º, 2.º o 3.º en el selector y vuelve a cargar el archivo. Ejemplos: ${sinSemestre.slice(0, 3).join(', ')}.`);
  let desactivados = 0;
  await sql.begin(async (tx) => {
    // Nuevos: una inserción masiva (sin correo, género estimado por el nombre); los id se recuperan por nombre.
    const aInsertar = plan.filter((p) => p.nuevo).map((p) => ({ periodo, nombre: p.e.nombre, correo: null as string | null, semestre: p.sem, paralelo: p.e.paralelo || null, genero: generoPorNombre(p.e.primerNombre), activo: true }));
    if (aInsertar.length) {
      const r = await tx`insert into students ${tx(aInsertar, 'periodo', 'nombre', 'correo', 'semestre', 'paralelo', 'genero', 'activo')} returning id, nombre`;
      const idPorNombre = new Map(r.map((x) => [String(x.nombre), String(x.id)]));
      for (const p of plan) if (p.nuevo) p.id = idPorNombre.get(p.e.nombre) ?? null;
    }
    // Ya existentes: una sola actualización (semestre, paralelo, activo); se conservan correo y género.
    const upd = plan.filter((p) => !p.nuevo && p.id);
    if (upd.length) await tx`update students s set semestre = v.semestre, paralelo = nullif(v.paralelo, ''), activo = true
      from unnest(${upd.map((p) => p.id)}::uuid[], ${upd.map((p) => p.sem)}::int[], ${upd.map((p) => p.e.paralelo || '')}::text[]) as v(id, semestre, paralelo) where s.id = v.id`;
    const ids = plan.map((p) => p.id).filter((x): x is string => !!x);
    // Se reemplazan solo las materias de los semestres del archivo; las de otro nivel se conservan.
    const aBorrar = [...new Set([...clasesNrc.filter((c) => semestres.has(Number(c.semestre))).map((c) => String(c.nrc)), ...materias.map((m) => m.nrc)])];
    if (ids.length && aBorrar.length) await tx`delete from student_classes where student_id = any(${ids}::uuid[]) and nrc = any(${aBorrar}::text[])`;
    const pares = plan.flatMap((p) => (p.id ? p.e.nrcs.map((nrc) => ({ student_id: p.id as string, nrc })) : []));
    if (pares.length) await tx`insert into student_classes ${tx(pares, 'student_id', 'nrc')} on conflict do nothing`;
    // Quien cursa materias de dos niveles queda en el semestre donde tiene más materias (empate: el del archivo).
    if (ids.length) {
      const todas = await tx`select student_id, nrc from student_classes where student_id = any(${ids}::uuid[])`;
      const conteo = new Map<string, Map<number, number>>();
      for (const r of todas) {
        const s2 = semPorNrc.get(String(r.nrc)); if (!s2) continue;
        const m = conteo.get(String(r.student_id)) ?? new Map<number, number>(); m.set(s2, (m.get(s2) ?? 0) + 1); conteo.set(String(r.student_id), m);
      }
      const cambios: { id: string; sem: number }[] = [];
      for (const p of plan) {
        const m = p.id ? conteo.get(p.id) : null; if (!m) continue;
        const mejor = [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] === p.sem ? -1 : b[0] === p.sem ? 1 : 0))[0]?.[0];
        if (mejor && mejor !== p.sem) cambios.push({ id: p.id as string, sem: mejor });
      }
      if (cambios.length) await tx`update students s set semestre = v.semestre from unnest(${cambios.map((c) => c.id)}::uuid[], ${cambios.map((c) => c.sem)}::int[]) as v(id, semestre) where s.id = v.id`;
    }
    const sems = [...semestres];
    if (sems.length) {
      const r = await tx`update students set activo = false where periodo = ${periodo} and activo and semestre = any(${sems}::int[]) and id <> all(${ids}::uuid[]) returning id`;
      desactivados = r.length;
    }
  });
  if (sinSemestre.length) errores.push(`Sin semestre (elige 1.º, 2.º o 3.º al cargar, o carga antes el horario con NRC): ${sinSemestre.slice(0, 5).join(', ')}${sinSemestre.length > 5 ? '…' : ''}`);
  const sems = [...semestres];
  const [n] = await sql`select count(*)::int as n, count(*) filter (where correo is null or correo = '')::int as sin from students where periodo = ${periodo} and activo`;
  const nrcSinHorario = materias.filter((m) => !semPorNrc.has(m.nrc)).length;
  if (nrcSinHorario) errores.push(`${nrcSinHorario} materia(s) del listado no están en el horario cargado: vuelve a cargar en Horarios el archivo de la universidad (trae la columna NRC) para que el cruce con clases sea por matrícula`);
  await registrarArchivo('estudiantes', nombreArchivo, `${n.n} estudiantes activos · matrícula por NRC`);
  refrescar();
  const nuevos = plan.filter((p) => p.nuevo).length, actualizados = plan.length - nuevos;
  const semTexto = sems.length ? sems.sort().map((x) => `${x}.º`).join(' y ') : '—';
  return { ok: true, datos: { resumen: `${ok.length} estudiantes de ${semTexto} semestre en ${materias.length} materias (NRC): ${nuevos} nuevos, ${actualizados} ya existentes, ${desactivados} inactivos por no estar en el archivo. Activos ahora: ${n.n}${n.sin ? ` (${n.sin} sin correo: descarga la plantilla, completa correos y género y vuelve a cargarla)` : ''}.`, errores } };
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
        const porNombre = existentes.find((t) => claveDocente(String(t.nombre)) === claveDocente(d.nombre) && String(t.correo ?? '') !== d.correo);
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
    const idPorNombre = new Map(docentes.map((t) => [claveDocente(String(t.nombre)), String(t.id)]));
    await sql.begin(async (tx) => {
      // Docentes que vienen en el horario y aún no existen (por correo o por nombre).
      for (const c of ok) {
        if (c.correoDocente && !idPorCorreo.has(c.correoDocente)) {
          const [t] = await tx`insert into teachers (periodo, nombre, correo, activo) values (${periodo}, ${c.docenteNombre || c.correoDocente.split('@')[0]}, ${c.correoDocente}, true)
            on conflict (periodo, correo) do update set activo = true returning id`;
          idPorCorreo.set(c.correoDocente, String(t.id));
          if (c.docenteNombre) idPorNombre.set(claveDocente(c.docenteNombre), String(t.id));
        } else if (!c.correoDocente && c.docenteNombre && !idPorNombre.has(claveDocente(c.docenteNombre))) {
          const [t] = await tx`insert into teachers (periodo, nombre, correo, activo) values (${periodo}, ${c.docenteNombre}, null, true) returning id`;
          idPorNombre.set(claveDocente(c.docenteNombre), String(t.id));
        }
      }
      await tx`update classes set activo = false where periodo = ${periodo}`;
      // Una sola inserción masiva (sin repetir la misma clave) para no agotar el tiempo de la función en Vercel.
      const filas = new Map<string, { periodo: string; semestre: number; paralelo: string | null; dia: number; inicio: string; fin: string; materia: string; teacher_id: string | null; nrc: string | null; activo: boolean }>();
      for (const c of ok) {
        const teacherId = (c.correoDocente && idPorCorreo.get(c.correoDocente)) || (c.docenteNombre && idPorNombre.get(claveDocente(c.docenteNombre))) || null;
        filas.set(`${c.semestre}|${c.dia}|${c.inicio}|${c.materia}|${c.paralelo || ''}`, { periodo, semestre: c.semestre, paralelo: c.paralelo || null, dia: c.dia, inicio: c.inicio, fin: c.fin, materia: c.materia, teacher_id: teacherId, nrc: c.nrc || null, activo: true });
      }
      const lote = [...filas.values()];
      if (lote.length) await tx`insert into classes ${tx(lote, 'periodo', 'semestre', 'paralelo', 'dia', 'inicio', 'fin', 'materia', 'teacher_id', 'nrc', 'activo')}
        on conflict (periodo, semestre, dia, inicio, materia, coalesce(paralelo, '')) do update set fin = excluded.fin, teacher_id = coalesce(excluded.teacher_id, classes.teacher_id), nrc = coalesce(excluded.nrc, classes.nrc), activo = true`;
    });
    const [n] = await sql`select count(distinct semestre)::int as s, count(distinct materia)::int as m, count(distinct nrc)::int as nrc from classes where periodo = ${periodo} and activo`;
    const resumen = `${n.s} semestres · ${n.m} materias${n.nrc ? ` · ${n.nrc} NRC` : ''}`;
    await registrarArchivo('horarios', nombre, resumen);
    refrescar();
    return { ok: true, datos: { resumen: `${ok.length} clases cargadas.`, errores } };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}
