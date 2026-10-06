// Cálculos derivados que comparten el panel, el portal del estudiante, el
// reporte Excel y los correos. Todo puro: entra `Datos`, salen vistas.
import {
  ACTIVIDADES, DEVOLUCION, MINIMO_EVENTOS, VESTIMENTA, convenioLabel, cruceClases, diasHasta, duracionTextoDias, fechaCorta, fechaCortaDias, fechaLargaDias,
  actividadesEtiquetasPedido, actividadesTextoPedido, cantidadDia, cantidadesDistintas, comidasDias, compromisosPedido, cuposTexto, diasEstudiante, estadoVisible, horasEstudiante, lugaresTexto, mismoLugar, repartoDia, tieneRepartoPorDia, horarioTextoDias, horasDias, infoUniforme, pasa4hDias, redondear1, semCorto, semLabel, semanaDe, tagClass, tipoClass, tipoLabel, transporteDias, transporteMotivoDias, transporteTexto, ultimoDia, type Compromiso, type EstadoVisible, type Transporte,
} from './reglas';
import type { Clase, Datos, DiaEvento, Docente, Estudiante, Novedad, Pedido, Semestre } from './tipos';

export interface PedidoVista extends Pedido {
  /** 'Guía de invitados (2), Acompañamiento en recorridos (2)' */
  actividadesTexto: string;
  /** Etiquetas por actividad, con cantidad si el pedido la trae (con prefijo D1, D2… si cambian por día). */
  actividadesEtiquetas: string[];
  repartoPorDia: boolean;
  horas: number;
  duracion: string;
  horarioTexto: string;
  multidia: boolean;
  ultimaFecha: string;
  fechaCorta: string;
  fechaLarga: string;
  fechaPedido: string;
  tipoLabel: string;
  /** 'tipo-interno' | 'tipo-externo' (color en tablero, calendario y novedades). */
  tipoClass: string;
  /** Estado que se muestra: 'Finalizado' si el evento aprobado ya se cerró. */
  estadoLabel: EstadoVisible;
  finalizado: boolean;
  /** El último día del evento ya pasó (o es hoy). */
  terminado: boolean;
  vestLabel: string;
  vestCorta: string;
  vestNotaEst: string;
  pasa4h: boolean;
  transporteMotivo: string | null;
  transporte: boolean;
  /** Alimentaciones por estudiante (una por cada 4 h de participación). */
  comidas: number;
  transporteInfo: Transporte;
  /** 'Ida y regreso' · 'Regreso a casa' · null. */
  transporteTexto: string | null;
  /** Lugar (o 'Día 1: X · Día 2: Y' si cambia por día). */
  lugarTexto: string;
  mismoLugar: boolean;
  /** Compromisos del organizador con cantidades. */
  compromisosLista: Compromiso[];
  /** Resumen corto: 'Alimentación ×2 · Transporte ida y regreso' o '—'. */
  compromisos: string;
  /** Enlace al acta de compromiso (solo en el panel de coordinación). */
  actaUrl: string | null;
  convLabel: string;
  convTag: string;
  tagClass: string;
  bloqueo: string | null;
  confirmados: Estudiante[];
  inscritos: Estudiante[];
  /** Días a los que asiste cada inscrito o confirmado (null = todos). */
  asistencia: Record<string, string[] | null>;
  /** Cupo y confirmados de cada día. */
  cuposDias: { fecha: string; cantidad: number; confirmados: number }[];
  /** '20 estudiantes' o '20 estudiantes (día 1: 14 · día 2: 6)'. */
  cuposTexto: string;
  cantidadesDistintas: boolean;
  /** Avance de cupos: '1/2' o, en varios días, 'D1 1/2 · D2 2/2' (cada día tiene su cupo). */
  progreso: string;
  confirmadosN: number;
  inscritosN: number;
  lleno: boolean;
  cruces: CruceVista[];
  cruceAmbito: string;
  novedades: NovedadVista[];
  novedadesTexto: string;
  evidenciaTexto: string;
}

export interface CruceVista extends Clase {
  docente: Docente | null;
  semLabel: string;
  aviso: Datos['avisos'][number] | null;
}

export interface NovedadVista extends Novedad {
  estudiante: Estudiante | null;
  pendiente: boolean;
}

export function mapaEstudiantes(d: Datos): Map<string, Estudiante> {
  return new Map(d.estudiantes.map((e) => [e.id, e]));
}

export function docenteDe(d: Datos, teacherId: string | null): Docente | null {
  if (!teacherId) return null;
  return d.docentes.find((t) => t.id === teacherId) ?? null;
}

export function ordenarPedidos(pedidos: Pedido[]): Pedido[] {
  return [...pedidos].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.inicio.localeCompare(b.inicio) || a.numero - b.numero);
}

export function vistaPedido(d: Datos, p: Pedido): PedidoVista {
  const est = mapaEstudiantes(d);
  const ins = d.inscripciones.filter((i) => i.requestId === p.id);
  const confirmados = ins.filter((i) => i.estado === 'confirmado').map((i) => est.get(i.studentId)).filter((x): x is Estudiante => !!x);
  const inscritos = ins.filter((i) => i.estado === 'inscrito').map((i) => est.get(i.studentId)).filter((x): x is Estudiante => !!x);
  const cruces: CruceVista[] = cruceClases(p, d.clases, confirmados).map((c) => ({
    ...c, docente: docenteDe(d, c.teacherId), semLabel: semLabel(c.semestre) + (c.paralelo ? ` · paralelo ${c.paralelo}` : ''),
    aviso: d.avisos.find((a) => a.requestId === p.id && a.classId === c.id) ?? null,
  }));
  const novedades: NovedadVista[] = d.novedades.filter((n) => n.requestId === p.id).map((n) => ({ ...n, estudiante: est.get(n.studentId) ?? null, pendiente: !n.reportadoAt }));
  const asistencia: Record<string, string[] | null> = Object.fromEntries(ins.map((i) => [i.studentId, i.dias]));
  const cuposDias = p.dias.map((dia) => ({ fecha: dia.fecha, cantidad: cantidadDia(p, dia), confirmados: confirmados.filter((e) => diasEstudiante(p, asistencia[e.id]).some((x) => x.fecha === dia.fecha)).length }));
  // Lleno solo cuando todos los días tienen su cupo: con los mismos estudiantes pedidos, uno puede ir un solo día y otro cubrir el otro.
  const lleno = cuposDias.length ? cuposDias.every((c) => c.confirmados >= c.cantidad) : confirmados.length >= p.cantidad;
  const progreso = p.dias.length > 1 ? cuposDias.map((c, i) => `D${i + 1} ${c.confirmados}/${c.cantidad}`).join(' · ') : `${confirmados.length}/${p.cantidad}`;
  const v = VESTIMENTA[p.vestimenta] ?? VESTIMENTA.uniforme;
  const tm = transporteMotivoDias(p);
  const p4 = pasa4hDias(p.dias);
  const compromisos = compromisosPedido(p);
  return {
    ...p,
    actividadesTexto: actividadesTextoPedido(p),
    actividadesEtiquetas: actividadesEtiquetasPedido(p),
    repartoPorDia: tieneRepartoPorDia(p),
    horas: horasDias(p.dias), duracion: duracionTextoDias(p.dias), horarioTexto: horarioTextoDias(p.dias), multidia: p.dias.length > 1,
    ultimaFecha: ultimoDia(p.dias)?.fecha ?? p.fecha,
    fechaCorta: fechaCortaDias(p.dias), fechaLarga: fechaLargaDias(p.dias), fechaPedido: fechaCorta(p.createdAt.slice(0, 10)),
    tipoLabel: tipoLabel(p.tipo), tipoClass: tipoClass(p.tipo), estadoLabel: estadoVisible(p), finalizado: estadoVisible(p) === 'Finalizado', terminado: (ultimoDia(p.dias)?.fecha ?? p.fecha) <= d.hoy,
    vestLabel: v.label, vestCorta: v.corta, vestNotaEst: v.est,
    pasa4h: p4, transporteMotivo: tm, transporte: !!tm,
    comidas: comidasDias(p.dias), transporteInfo: transporteDias(p), transporteTexto: transporteTexto(transporteDias(p)),
    lugarTexto: lugaresTexto(p), mismoLugar: mismoLugar(p),
    compromisosLista: compromisos, compromisos: compromisos.map((c) => c.corto).filter(Boolean).join(' · ') || '—',
    actaUrl: p.actaToken ? `${d.appUrl}/api/acta/${p.id}?t=${p.actaToken}` : null,
    convLabel: convenioLabel(p), convTag: p.tipo === 'externo' && p.convenio === 'no' ? 'tag-alerta' : 'tag-neutral',
    tagClass: tagClass(estadoVisible(p)),
    bloqueo: p.tipo === 'externo' && p.convenio === 'no' ? 'No se puede aprobar: la institución no tiene convenio vigente con la UTE.' : null,
    confirmados, inscritos, confirmadosN: confirmados.length, inscritosN: inscritos.length, lleno,
    asistencia, cuposDias, cuposTexto: cuposTexto(p), cantidadesDistintas: cantidadesDistintas(p), progreso,
    cruces, cruceAmbito: confirmados.length ? 'semestres confirmados' : 'todos los semestres',
    novedades, novedadesTexto: novedades.length ? novedades.map((n) => `${n.estudiante?.nombre ?? ''}: ${n.tipo}`).join(' · ') : '—',
    evidenciaTexto: p.evidenciaNombre || 'sin evidencia',
  };
}

/** Confirmados que asisten un día concreto. */
export function confirmadosEnDia(p: PedidoVista, fecha: string): Estudiante[] {
  return p.confirmados.filter((e) => diasEstudiante(p, p.asistencia[e.id]).some((d) => d.fecha === fecha));
}

/** Días (fechas) de un inscrito que ya tienen el cupo completo con los demás confirmados. */
export function diasLlenosDe(p: PedidoVista, studentId: string): string[] {
  return diasDeEstudiante(p, studentId).map((d) => d.fecha).filter((f) => { const c = p.cuposDias.find((x) => x.fecha === f); return !!c && !p.confirmados.some((e) => e.id === studentId) && c.confirmados >= c.cantidad; });
}

/** Etiquetas de actividades solo de los días a los que asiste un estudiante. */
export function actividadesDeEstudiante(p: PedidoVista, studentId: string): string[] {
  return actividadesEtiquetasPedido(p, diasEstudiante(p, p.asistencia[studentId]));
}

export { repartoDia };

/** Días a los que asiste un estudiante en el evento. */
export function diasDeEstudiante(p: PedidoVista, studentId: string): DiaEvento[] {
  return diasEstudiante(p, p.asistencia[studentId]);
}

export function vistaPedidos(d: Datos): PedidoVista[] {
  return ordenarPedidos(d.pedidos).map((p) => vistaPedido(d, p));
}

// ---------------------------------------------------------------- estudiantes

export interface AvanceEstudiante {
  eventosN: number;
  horas: number;
  eventos: PedidoVista[];
  cumple: boolean;
  estado: string;
  tagClass: string;
  novedadesN: number;
}

export function avanceEstudiante(d: Datos, studentId: string, pedidos?: PedidoVista[]): AvanceEstudiante {
  const todos = pedidos ?? vistaPedidos(d);
  const eventos = todos.filter((p) => p.estado === 'Aprobado' && p.confirmados.some((e) => e.id === studentId));
  const k = eventos.length;
  return {
    eventosN: k,
    horas: redondear1(eventos.reduce((a, e) => a + horasEstudiante(e, e.asistencia[studentId]), 0)),
    eventos,
    cumple: k >= MINIMO_EVENTOS,
    estado: k >= MINIMO_EVENTOS ? 'Cumple' : k === 1 ? 'Falta 1 evento' : 'Sin eventos · nota 0',
    tagClass: k >= MINIMO_EVENTOS ? 'tag-accent' : k === 1 ? 'tag-alerta-suave' : 'tag-alerta',
    novedadesN: d.novedades.filter((n) => n.studentId === studentId).length,
  };
}

export interface FilaMatriz extends Estudiante, AvanceEstudiante {
  detalle: string;
}

export interface MatrizSemestre {
  semestre: Semestre;
  semLabel: string;
  materia: string;
  docente: Docente | null;
  filas: FilaMatriz[];
  n: number;
  cumplenN: number;
  enviada: string | null;
}

/** Docente de la materia de nota: el fijado manualmente o, si no, el de la
 *  clase con ese nombre en ese semestre. */
export function docenteMateria(d: Datos, semestre: Semestre): { materia: string; docente: Docente | null } {
  const m = d.materias.find((x) => x.semestre === semestre);
  if (!m) return { materia: '—', docente: null };
  let docente = docenteDe(d, m.teacherId);
  if (!docente) {
    const clase = d.clases.find((c) => c.semestre === semestre && c.activo && c.materia.trim().toLowerCase() === m.materia.trim().toLowerCase());
    docente = clase ? docenteDe(d, clase.teacherId) : null;
  }
  return { materia: m.materia, docente };
}

export function matrizSemestres(d: Datos, pedidos?: PedidoVista[]): MatrizSemestre[] {
  const todos = pedidos ?? vistaPedidos(d);
  return ([1, 2, 3] as Semestre[]).map((n) => {
    const { materia, docente } = docenteMateria(d, n);
    const filas: FilaMatriz[] = d.estudiantes.filter((e) => e.activo && e.semestre === n).map((e) => {
      const av = avanceEstudiante(d, e.id, todos);
      return { ...e, ...av, detalle: av.eventos.map((x) => x.evento).join('; ') || '—' };
    });
    return {
      semestre: n, semLabel: semLabel(n), materia, docente, filas, n: filas.length,
      cumplenN: filas.filter((f) => f.cumple).length, enviada: d.ajustes.matrizEnviada[String(n)] ?? null,
    };
  });
}

// ---------------------------------------------------------------- uniformes

export interface UniformeVista extends Estudiante {
  info: ReturnType<typeof infoUniforme>;
  eventosUniforme: PedidoVista[];
  requiere: boolean;
  semLabel: string;
  generoLabel: string;
  detalle: string;
  devolucion: Datos['devoluciones'][number] | null;
  devLabel: string;
  devTag: string;
}

export function vistaUniformes(d: Datos, pedidos?: PedidoVista[]): UniformeVista[] {
  const todos = pedidos ?? vistaPedidos(d);
  const conUniforme = todos.filter((p) => p.estado === 'Aprobado' && p.vestimenta === 'uniforme');
  return d.estudiantes.filter((e) => e.activo).map((e) => {
    const info = infoUniforme(e.genero, d.prendas.filter((p) => p.studentId === e.id).map((p) => p.item));
    const dev = d.devoluciones.find((x) => x.studentId === e.id) ?? null;
    const eventosUniforme = conUniforme.filter((p) => p.confirmados.some((c) => c.id === e.id));
    return {
      ...e, info, eventosUniforme, requiere: eventosUniforme.length > 0 || info.n > 0,
      semLabel: semLabel(e.semestre), generoLabel: e.genero === 'F' ? 'femenino' : 'masculino',
      detalle: info.completo ? 'Uniforme completo entregado.' : info.n ? 'Falta: ' + info.faltan.join(', ') : 'Ninguna prenda entregada.',
      devolucion: dev, devLabel: dev ? DEVOLUCION[dev.estado].label : info.n ? 'En uso' : '—', devTag: dev ? DEVOLUCION[dev.estado].tag : 'tag-neutral',
    };
  });
}

// ---------------------------------------------------------------- resumen de horas

export interface ResumenHoras {
  horasSemana: number;
  semanas: number;
  total: number;
  usadas: number;
  restantes: number;
  pct: number;
  semanaN: number;
  usadasSemana: number;
  antesDeInicio: boolean;
  diasParaInicio: number;
}

export function resumenHoras(d: Datos, pedidos?: PedidoVista[]): ResumenHoras {
  const todos = pedidos ?? vistaPedidos(d);
  const aprobados = todos.filter((p) => p.estado === 'Aprobado');
  const total = d.ajustes.horasSemana * d.ajustes.semanas;
  const usadas = redondear1(aprobados.reduce((a, e) => a + e.horas, 0));
  const semanaN = Math.min(Math.max(semanaDe(d.hoy, d.ajustes.inicioSemestre), 1), d.ajustes.semanas);
  const usadasSemana = redondear1(aprobados.filter((e) => semanaDe(e.fecha, d.ajustes.inicioSemestre) === semanaN).reduce((a, e) => a + e.horas, 0));
  const diasParaInicio = diasHasta(d.ajustes.inicioSemestre, d.hoy);
  return {
    horasSemana: d.ajustes.horasSemana, semanas: d.ajustes.semanas, total, usadas, restantes: redondear1(total - usadas),
    pct: total ? Math.min(100, (usadas / total) * 100) : 0, semanaN, usadasSemana,
    antesDeInicio: diasParaInicio > 0, diasParaInicio,
  };
}

// ---------------------------------------------------------------- resumen de cabecera

export function resumenCabecera(d: Datos, pedidos?: PedidoVista[]): string {
  const todos = pedidos ?? vistaPedidos(d);
  const nPend = todos.filter((e) => e.estado === 'Pendiente').length;
  const nInsc = todos.reduce((a, e) => a + e.inscritosN, 0);
  return `${todos.length} pedidos en el periodo ${d.ajustes.periodo} · ${nPend} pendientes de revisión · ${nInsc} inscripciones por confirmar`;
}

export function nombreActividad(i: number): string {
  return ACTIVIDADES[i] ?? '';
}

export { semCorto };
