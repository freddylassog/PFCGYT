// Cálculos derivados que comparten el panel, el portal del estudiante, el
// reporte Excel y los correos. Todo puro: entra `Datos`, salen vistas.
import {
  ACTIVIDADES, DEVOLUCION, MINIMO_EVENTOS, VESTIMENTA, convenioLabel, cruceClases, diasHasta, fechaCorta, fechaLarga,
  fmtDur, horasDe, infoUniforme, pasa4h, redondear1, semCorto, semLabel, semanaDe, tagClass, tipoLabel, transporteMotivo,
} from './reglas';
import type { Clase, Datos, Docente, Estudiante, Novedad, Pedido, Semestre } from './tipos';

export interface PedidoVista extends Pedido {
  horas: number;
  duracion: string;
  fechaCorta: string;
  fechaLarga: string;
  fechaPedido: string;
  tipoLabel: string;
  vestLabel: string;
  vestCorta: string;
  vestNotaEst: string;
  pasa4h: boolean;
  transporteMotivo: string | null;
  transporte: boolean;
  compromisos: string;
  convLabel: string;
  convTag: string;
  tagClass: string;
  bloqueo: string | null;
  confirmados: Estudiante[];
  inscritos: Estudiante[];
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
  const v = VESTIMENTA[p.vestimenta] ?? VESTIMENTA.uniforme;
  const tm = transporteMotivo(p);
  const p4 = pasa4h(p.inicio, p.fin);
  return {
    ...p,
    horas: horasDe(p.inicio, p.fin), duracion: fmtDur(p.inicio, p.fin),
    fechaCorta: fechaCorta(p.fecha), fechaLarga: fechaLarga(p.fecha), fechaPedido: fechaCorta(p.createdAt.slice(0, 10)),
    tipoLabel: tipoLabel(p.tipo), vestLabel: v.label, vestCorta: v.corta, vestNotaEst: v.est,
    pasa4h: p4, transporteMotivo: tm, transporte: !!tm,
    compromisos: [p4 ? 'Alimentación' : null, tm ? 'Transporte' : null].filter(Boolean).join(' · ') || '—',
    convLabel: convenioLabel(p), convTag: p.tipo === 'externo' && p.convenio === 'no' ? 'tag-outline' : 'tag-neutral',
    tagClass: tagClass(p.estado),
    bloqueo: p.tipo === 'externo' && p.convenio === 'no' ? 'No se puede aprobar: la institución no tiene convenio vigente con la UTE.' : null,
    confirmados, inscritos, confirmadosN: confirmados.length, inscritosN: inscritos.length, lleno: confirmados.length >= p.cantidad,
    cruces, cruceAmbito: confirmados.length ? 'semestres confirmados' : 'todos los semestres',
    novedades, novedadesTexto: novedades.length ? novedades.map((n) => `${n.estudiante?.nombre ?? ''}: ${n.tipo}`).join(' · ') : '—',
    evidenciaTexto: p.evidenciaNombre || 'sin evidencia',
  };
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
    horas: redondear1(eventos.reduce((a, e) => a + e.horas, 0)),
    eventos,
    cumple: k >= MINIMO_EVENTOS,
    estado: k >= MINIMO_EVENTOS ? 'Cumple' : k === 1 ? 'Falta 1 evento' : 'Sin eventos · nota 0',
    tagClass: k >= MINIMO_EVENTOS ? 'tag-accent' : k === 1 ? 'tag-outline' : 'tag-neutral',
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
  semLabel: string;
  generoLabel: string;
  detalle: string;
  devolucion: Datos['devoluciones'][number] | null;
  devLabel: string;
  devTag: string;
}

export function vistaUniformes(d: Datos): UniformeVista[] {
  return d.estudiantes.filter((e) => e.activo).map((e) => {
    const info = infoUniforme(e.genero, d.prendas.filter((p) => p.studentId === e.id).map((p) => p.item));
    const dev = d.devoluciones.find((x) => x.studentId === e.id) ?? null;
    return {
      ...e, info, semLabel: semLabel(e.semestre), generoLabel: e.genero === 'F' ? 'femenino' : 'masculino',
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
