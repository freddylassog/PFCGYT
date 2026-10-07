// Reglas de negocio y formato. Solo funciones puras: se usan igual en el
// navegador y en el servidor (validaciones, reporte, correos).
import type {
  CitaUniforme, Clase, DiaEvento, Estado, EstadoDevolucion as EstadoDevolucionRegistro, FranjaUniforme, Genero, RepartoActividad, Semestre, Vestimenta,
} from './tipos';

export const ZONA_HORARIA = 'America/Guayaquil';
export const MINIMO_EVENTOS = 2;
export const HORAS_ANTICIPACION = 72;
export const MAX_ESTUDIANTES = 20;
export const MAX_DIAS_EVENTO = 10;

/** Si es true, un pedido que se cruza con otro no puede registrarse (se
 *  permite otro horario el mismo día). Si es false, solo se muestra el aviso. */
export const BLOQUEAR_CRUCE_EVENTOS = true;

export const ACTIVIDADES = [
  'Recepción y registro de invitados',
  'Ubicación de autoridades',
  'Guía de invitados',
  'Entrega de reconocimientos',
  'Acompañamiento en recorridos',
  'Apoyo en mesa de honor',
  'Apoyo en mesas en general',
];

export const UNIFORME: Record<Genero, string[]> = {
  F: ['Vestido', 'Correa', 'Lazo'],
  M: ['Pantalón', 'Camisa', 'Chaleco', 'Corbatín', 'Chaqueta', 'Pin'],
};

export const VESTIMENTA: Record<Vestimenta, { label: string; corta: string; nota: string; est: string }> = {
  uniforme: {
    label: 'Uniforme institucional',
    corta: 'Uniforme',
    nota: 'Vestido, correa y lazo · pantalón, camisa, chaleco, corbatín, chaqueta y pin.',
    est: 'Usa tu uniforme institucional completo.',
  },
  formal: {
    label: 'Ropa formal blanco y negro',
    corta: 'Formal B/N',
    nota: 'El estudiante trae su ropa; la facultad entrega pañuelo (chicas) o bufanda formal (chicos).',
    est: 'Trae tu ropa formal blanco y negro. Coordinación te entrega pañuelo o bufanda formal.',
  },
  ninguna: {
    label: 'No aplica · informal',
    corta: 'No aplica',
    nota: 'Evento informal (p. ej. open house), sin uniforme.',
    est: 'Evento informal, sin uniforme.',
  },
};

export const TIPOS_NOVEDAD = ['Mal uniformado', 'Llegó tarde', 'No asistió', 'Abandonó antes de la hora', 'Otra'];
export const ESTADOS: Estado[] = ['Pendiente', 'Ajustes', 'Aprobado', 'Rechazado'];
/** Estado tal como se muestra: un aprobado con fin de evento se ve como "Finalizado". */
export type EstadoVisible = Estado | 'Finalizado';
export const ESTADOS_VISIBLES: EstadoVisible[] = ['Pendiente', 'Ajustes', 'Aprobado', 'Finalizado', 'Rechazado'];
export const ESTADO_PLURAL: Record<EstadoVisible, string> = { Pendiente: 'Pendientes', Ajustes: 'En ajustes', Aprobado: 'Aprobados', Finalizado: 'Finalizados', Rechazado: 'Rechazados' };
export function estadoVisible(p: { estado: Estado; finalizadoAt: string | null }): EstadoVisible {
  return p.estado === 'Aprobado' && p.finalizadoAt ? 'Finalizado' : p.estado;
}
export const SEMESTRES: Semestre[] = [1, 2, 3];

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS_CLASE = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// ---------------------------------------------------------------- horas

/** 'HH:MM' → minutos desde medianoche. Texto inválido → NaN. */
export function min(t: string | null | undefined): number {
  if (!t) return NaN;
  const [h, m] = t.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

export function hhmm(t: string | null | undefined): string {
  if (!t) return '';
  return t.slice(0, 5);
}

export function duracionMin(inicio: string, fin: string): number {
  const d = min(fin) - min(inicio);
  return Number.isFinite(d) ? d : 0;
}

export function fmtDur(inicio: string, fin: string): string {
  const d = duracionMin(inicio, fin);
  if (!(d > 0)) return '—';
  const h = Math.floor(d / 60), m = d % 60;
  return h + ' h' + (m ? ' ' + m + ' min' : '');
}

/** Horas de protocolo del evento = salida − inicio, con 1 decimal. */
export function horasDe(inicio: string, fin: string): number {
  const d = duracionMin(inicio, fin);
  return d > 0 ? Math.round((d / 60) * 10) / 10 : 0;
}

export function redondear1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function overlap(a1: string, a2: string, b1: string, b2: string): boolean {
  return min(a1) < min(b2) && min(b1) < min(a2);
}

export function pasa4h(inicio: string, fin: string): boolean {
  return duracionMin(inicio, fin) > 240;
}

export function transporteMotivo(e: { fin: string; lejos: boolean }): string | null {
  const tarde = !!e.fin && min(e.fin) > 18 * 60;
  if (tarde && e.lejos) return 'Termina después de las 18:00 y el lugar está fuera del DMQ o es el aeropuerto';
  if (tarde) return 'Termina después de las 18:00';
  if (e.lejos) return 'Lugar fuera del DMQ o aeropuerto';
  return null;
}

// ---------------------------------------------------------------- días del evento

/** Ordena por fecha y elimina fechas repetidas (se queda con la primera). */
export function ordenarDias(dias: DiaEvento[]): DiaEvento[] {
  const vistos = new Set<string>();
  return [...dias].filter((d) => d.fecha && !vistos.has(d.fecha) && vistos.add(d.fecha)).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Horas de protocolo del evento = suma de todos los días (1 decimal). */
export function horasDias(dias: DiaEvento[]): number {
  return redondear1(dias.reduce((a, d) => a + horasDe(d.inicio, d.fin), 0));
}

/** Alimentación: algún día con más de 4 horas de participación. */
export function pasa4hDias(dias: DiaEvento[]): boolean {
  return dias.some((d) => pasa4h(d.inicio, d.fin));
}

/** Alimentaciones de un día: ninguna hasta 4 h; a partir de ahí una por cada 4 h completas (5 h → 1, 8 h → 2, 12 h → 3). */
export function comidasDia(d: DiaEvento): number {
  if (!esHora(d.inicio) || !esHora(d.fin)) return 0;
  const m = min(d.fin) - min(d.inicio);
  return m > 240 ? Math.floor(m / 240) : 0;
}

/** Alimentaciones por estudiante en todo el evento (suma de los días). */
export function comidasDias(dias: DiaEvento[]): number {
  return dias.reduce((a, d) => a + comidasDia(d), 0);
}

export interface Transporte {
  /** Ida desde la universidad: cuando el lugar está fuera del Distrito Metropolitano de Quito o es el aeropuerto. */
  ida: boolean;
  /** Regreso a casa: cuando el lugar está fuera del DMQ (o aeropuerto) o algún día termina después de las 18:00. */
  regreso: boolean;
  motivos: string[];
}

/** Estudiantes necesarios un día: los suyos o, si no tiene, todos los del pedido. */
export function cantidadDia(p: { cantidad: number; mismosEstudiantes?: boolean }, d: DiaEvento): number {
  const total = Math.round(Number(p.cantidad) || 0);
  if (p.mismosEstudiantes) return total;
  const n = Math.round(Number(d.cantidad) || 0);
  return n > 0 ? Math.min(n, total) : total;
}

/** ¿Algún día necesita menos estudiantes que el total? (solo en eventos de varios días) */
export function cantidadesDistintas(p: { cantidad: number; dias: DiaEvento[]; mismosEstudiantes?: boolean }): boolean {
  return !p.mismosEstudiantes && p.dias.length > 1 && p.dias.some((d) => cantidadDia(p, d) !== Math.round(Number(p.cantidad) || 0));
}

/** '20 estudiantes' o '20 estudiantes (día 1: 14 · día 2: 6)'. */
export function cuposTexto(p: { cantidad: number; dias: DiaEvento[]; mismosEstudiantes?: boolean }): string {
  const n = Math.round(Number(p.cantidad) || 0);
  const base = `${n} estudiante${n === 1 ? '' : 's'}`;
  if (p.mismosEstudiantes && p.dias.length > 1) return `${base} cada día (en lo posible los mismos)`;
  return cantidadesDistintas(p) ? `${base} (${p.dias.map((d, i) => `día ${i + 1}: ${cantidadDia(p, d)}`).join(' · ')})` : base;
}

/** De las fechas pedidas, las que ya tienen el cupo del día completo con los confirmados dados (días de cada uno; null = todos). */
export function diasLlenos(p: { cantidad: number; mismosEstudiantes?: boolean; dias: DiaEvento[] }, confirmados: (string[] | null)[], fechas: string[]): string[] {
  return fechas.filter((f) => {
    const dia = p.dias.find((d) => d.fecha === f);
    if (!dia) return false;
    return confirmados.filter((c) => diasEstudiante(p, c).some((d) => d.fecha === f)).length >= cantidadDia(p, dia);
  });
}

/** 'El día 1 (14 dic)' o 'Los días 1 (14 dic) y 2 (15 dic)' (número según la posición en todas las fechas del evento). */
export function nombrarDias(fechas: string[], todas: string[]): string {
  const n = fechas.map((f) => `${todas.indexOf(f) + 1} (${fechaCorta(f)})`);
  return n.length > 1 ? `Los días ${n.join(' y ')}` : `El día ${n[0] ?? ''}`;
}

/** Reparte el total entre n días lo más parejo posible (4 → 2 y 2; 5 → 3 y 2; 20 en 3 días → 7, 7 y 6). */
export function repartirCantidad(total: number, n: number): number[] {
  const t = Math.max(0, Math.round(Number(total) || 0));
  if (n <= 0) return [];
  const base = Math.floor(t / n), resto = t - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < resto ? 1 : 0));
}

/** Problemas de las cantidades por día (vacío = correctas). Solo aplica a eventos de varios días: se reparten el total. */
export function faltasCantidadesDias(cantidad: number, dias: DiaEvento[], mismosEstudiantes = false): string[] {
  if (dias.length <= 1 || mismosEstudiantes) return [];
  const total = Math.round(Number(cantidad) || 0);
  const porDia = dias.map((d) => Math.round(Number(d.cantidad) || 0));
  if (porDia.some((n) => !(n >= 1 && n <= total))) return [`estudiantes por día entre 1 y ${total}`];
  const suma = porDia.reduce((a, n) => a + n, 0);
  return suma === total ? [] : [`las cantidades por día deben sumar ${total} (suman ${suma})`];
}

/** Al cambiar el total o los días: si las cantidades ya suman el total se conservan; si no, se reparten parejo. */
export function ajustarCantidadesDias(dias: DiaEvento[], nuevoTotal: number, mismosEstudiantes = false): DiaEvento[] {
  if (dias.length <= 1 || mismosEstudiantes) return dias.map((d) => { const { cantidad: _c, ...resto } = d; void _c; return resto; });
  const total = Math.round(Number(nuevoTotal) || 0);
  const actuales = dias.map((d) => Math.round(Number(d.cantidad) || 0));
  if (actuales.every((n) => n >= 1) && actuales.reduce((a, n) => a + n, 0) === total) return dias;
  const nuevos = repartirCantidad(total, dias.length);
  return dias.map((d, i) => ({ ...d, cantidad: Math.max(1, nuevos[i]) }));
}

/** Actividades de un día: las suyas o, si el pedido es de un solo día o es antiguo, las del pedido. */
export function repartoDia(p: { reparto: RepartoActividad[]; dias: DiaEvento[] }, d: DiaEvento): RepartoActividad[] {
  return d.reparto?.length ? d.reparto : p.reparto;
}

/** ¿El pedido tiene actividades propias en cada día? */
export function tieneRepartoPorDia(p: { dias: DiaEvento[] }): boolean {
  return p.dias.length > 1 && p.dias.every((d) => !!d.reparto?.length);
}

/** Suma los repartos de todos los días por actividad (para el total del pedido y el reporte). */
export function unirRepartos(dias: DiaEvento[]): RepartoActividad[] {
  const suma = new Map<string, number>();
  for (const d of dias) for (const x of d.reparto ?? []) suma.set(x.actividad, (suma.get(x.actividad) ?? 0) + (Number(x.cantidad) || 0));
  return ACTIVIDADES.filter((a) => suma.has(a)).map((a) => ({ actividad: a, cantidad: suma.get(a)! }));
}

/** 'Guía de invitados (4)' o, con actividades por día, 'Día 1: Guía (2) · Día 2: Recepción (1), Ubicación (1)'. */
export function actividadesTextoPedido(p: { reparto: RepartoActividad[]; actividades: string[]; dias: DiaEvento[] }): string {
  if (tieneRepartoPorDia(p)) return p.dias.map((d, i) => `Día ${i + 1}: ${repartoTexto(d.reparto ?? [], [])}`).join(' · ');
  return repartoTexto(p.reparto, p.actividades);
}

/** Etiquetas por actividad; con actividades por día llevan el prefijo D1, D2… */
export function actividadesEtiquetasPedido(p: { reparto: RepartoActividad[]; actividades: string[]; dias: DiaEvento[] }, soloDias?: DiaEvento[]): string[] {
  if (tieneRepartoPorDia(p)) {
    return p.dias.flatMap((d, i) => (soloDias && !soloDias.some((x) => x.fecha === d.fecha) ? [] : (d.reparto ?? []).map((x) => `D${i + 1} · ${x.actividad} · ${x.cantidad}`)));
  }
  return p.reparto.length ? p.reparto.map((x) => `${x.actividad} · ${x.cantidad}`) : p.actividades;
}

/** Mantiene coherentes las cantidades y los repartos por día al cambiar el total o los días. */
export function sincronizarDias(dias: DiaEvento[], total: number, mismosEstudiantes = false): DiaEvento[] {
  const ajustados = ajustarCantidadesDias(dias, total, mismosEstudiantes);
  if (ajustados.length <= 1) return ajustados;
  return ajustados.map((d) => ({ ...d, reparto: ajustarRepartoATotal(d.reparto ?? [], cantidadDia({ cantidad: total, mismosEstudiantes }, d)) }));
}

/** Días a los que asiste un estudiante según su inscripción (null o sin coincidencias = todos). */
export function diasEstudiante(p: { dias: DiaEvento[] }, dias: string[] | null | undefined): DiaEvento[] {
  const sel = dias?.length ? p.dias.filter((d) => dias.includes(d.fecha)) : [];
  return sel.length ? sel : p.dias;
}

export function horasEstudiante(p: { dias: DiaEvento[] }, dias: string[] | null | undefined): number {
  return horasDias(diasEstudiante(p, dias));
}

/** Lugar de un día: el suyo o, si no tiene, el del pedido. */
export function lugarDia(p: { lugar: string }, d: DiaEvento): string {
  return (d.lugar ?? '').trim() || p.lugar;
}

export function lejosDia(p: { lejos: boolean }, d: DiaEvento): boolean {
  return d.lejos == null ? !!p.lejos : !!d.lejos;
}

/** ¿Todos los días son en el mismo lugar? */
export function mismoLugar(p: { lugar: string; lejos: boolean; dias: DiaEvento[] }): boolean {
  return p.dias.every((d) => lugarDia(p, d) === lugarDia(p, p.dias[0]) && lejosDia(p, d) === lejosDia(p, p.dias[0]));
}

/** 'Auditorio' o, si cambia por día, 'Día 1: Auditorio · Día 2: Hacienda X'. */
export function lugaresTexto(p: { lugar: string; lejos: boolean; dias: DiaEvento[] }, conLejos = false): string {
  const marca = (lejos: boolean) => (conLejos && lejos ? ' (fuera del DMQ / aeropuerto)' : '');
  const primero = p.dias[0] ?? { fecha: '', inicio: '', fin: '' };
  if (p.dias.length <= 1 || mismoLugar(p)) return `${lugarDia(p, primero)}${marca(lejosDia(p, primero))}`;
  return p.dias.map((d, i) => `Día ${i + 1}: ${lugarDia(p, d)}${marca(lejosDia(p, d))}`).join(' · ');
}

/** Transporte de un día: ida si ese día es fuera del DMQ / aeropuerto; regreso si es lejos o termina después de las 18:00. */
export function transporteDia(d: DiaEvento, lejosPedido: boolean): Transporte {
  const lejos = lejosDia({ lejos: lejosPedido }, d);
  const tarde = !!d.fin && min(d.fin) > 18 * 60;
  return { ida: lejos, regreso: lejos || tarde, motivos: [lejos ? 'lugar fuera del Distrito Metropolitano de Quito o aeropuerto' : '', tarde ? 'termina después de las 18:00' : ''].filter(Boolean) };
}

export function transporteDias(e: { dias: DiaEvento[]; lejos: boolean }): Transporte {
  const porDia = e.dias.map((d) => transporteDia(d, e.lejos));
  const motivos = [...new Set(porDia.flatMap((t) => t.motivos))];
  return { ida: porDia.some((t) => t.ida), regreso: porDia.some((t) => t.regreso), motivos };
}

/** Detalle por día cuando el transporte cambia entre días: 'día 1: regreso a casa (…); día 2: ida y regreso (…)'. */
export function transporteDetallePorDia(e: { dias: DiaEvento[]; lejos: boolean }): string | null {
  if (e.dias.length <= 1) return null;
  const porDia = e.dias.map((d) => transporteDia(d, e.lejos));
  if (porDia.every((t) => t.ida === porDia[0].ida && t.regreso === porDia[0].regreso)) return null;
  return porDia.map((t, i) => `día ${i + 1}: ${t.regreso ? (t.ida ? 'ida y regreso' : 'regreso a casa') : 'por su cuenta'}${t.motivos.length ? ` (${t.motivos.join(' y ')})` : ''}`).join('; ');
}

/** 'Ida y regreso' · 'Regreso a casa' · null si no aplica. */
export function transporteTexto(t: Transporte): string | null {
  return t.regreso ? (t.ida ? 'Ida y regreso' : 'Regreso a casa') : null;
}

export interface Compromiso {
  clave: 'alimentacion' | 'transporte' | 'actividades' | 'responsable';
  titulo: string;
  aplica: boolean;
  /** Frase completa con las cantidades del pedido. */
  texto: string;
  /** Versión corta para tablas y etiquetas ('Alimentación ×2'). */
  corto: string | null;
}

/** Compromisos del organizador con las cantidades concretas del pedido. */
export function compromisosPedido(p: { dias: DiaEvento[]; lejos: boolean; cantidad: number; mismosEstudiantes?: boolean; reparto: RepartoActividad[]; actividades: string[]; responsable: string; responsableTelefono: string }): Compromiso[] {
  const n = Math.max(0, Math.round(Number(p.cantidad) || 0));
  const comidas = comidasDias(p.dias);
  const porDia = p.dias.length > 1 ? ` (${p.dias.map((d, i) => `día ${i + 1}: ${comidasDia(d)}`).join(', ')})` : '';
  const distintas = cantidadesDistintas(p);
  const totalComidas = p.dias.reduce((a, d) => a + comidasDia(d) * cantidadDia(p, d), 0);
  const paraQuienes = distintas ? `para los estudiantes de cada día (${p.dias.map((d, i) => `día ${i + 1}: ${cantidadDia(p, d)}`).join(' · ')})` : `para los ${n} estudiante${n === 1 ? '' : 's'}`;
  const t = transporteDias(p);
  const motivos = t.motivos.join(' y ');
  const detalle = transporteDetallePorDia(p);
  const porDiaTexto = detalle ? ` Por día: ${detalle}.` : '';
  const tel = (p.responsableTelefono || '').trim();
  return [
    {
      clave: 'alimentacion', titulo: 'Alimentación', aplica: comidas > 0, corto: comidas > 0 ? `Alimentación ×${comidas}` : null,
      texto: comidas > 0
        ? `${comidas} ${comidas > 1 ? 'alimentaciones' : 'alimentación'} por estudiante, una por cada 4 horas de participación${porDia}: ${totalComidas} en total ${distintas ? `(${p.dias.map((d, i) => `día ${i + 1}: ${cantidadDia(p, d)} × ${comidasDia(d)}`).join(', ')})` : `para ${n} estudiante${n === 1 ? '' : 's'}`}.`
        : 'No aplica: ningún día pasa de 4 horas de participación.',
    },
    {
      clave: 'transporte', titulo: 'Transporte', aplica: t.regreso, corto: t.regreso ? `Transporte ${t.ida ? 'ida y regreso' : 'de regreso'}` : null,
      texto: t.regreso
        ? (t.ida
          ? `Ida y regreso ${paraQuienes}: los lleva desde la universidad y los regresa a su casa (${motivos}).${porDiaTexto}`
          : `Regreso a casa ${paraQuienes} (${motivos}).${porDiaTexto}`)
        : 'No aplica: el lugar está dentro de Quito y el evento termina antes de las 18:00; los estudiantes llegan y regresan por su cuenta.',
    },
    {
      clave: 'actividades', titulo: 'Actividades', aplica: true, corto: null,
      texto: `Los ${n} estudiante${n === 1 ? '' : 's'} realizan únicamente las actividades marcadas: ${actividadesTextoPedido(p) || '—'}. Se retiran a la hora de salida indicada, aunque el evento continúe.`,
    },
    {
      clave: 'responsable', titulo: 'Responsable en sitio', aplica: true, corto: null,
      texto: `${(p.responsable || '').trim() || '—'}${tel ? ` · ${tel}` : ''} recibe a los estudiantes, los acompaña durante el evento y es el contacto de la coordinación.`,
    },
  ];
}

/** Transporte: algún día termina después de las 18:00, o el lugar está fuera del DMQ / aeropuerto. */
export function transporteMotivoDias(e: { dias: DiaEvento[]; lejos: boolean }): string | null {
  const tarde = e.dias.some((d) => !!d.fin && min(d.fin) > 18 * 60);
  if (tarde && e.lejos) return 'Termina después de las 18:00 y el lugar está fuera del DMQ o es el aeropuerto';
  if (tarde) return 'Termina después de las 18:00';
  if (e.lejos) return 'Lugar fuera del DMQ o aeropuerto';
  return null;
}

export function primerDia(dias: DiaEvento[]): DiaEvento | null {
  return ordenarDias(dias)[0] ?? null;
}

export function ultimoDia(dias: DiaEvento[]): DiaEvento | null {
  const o = ordenarDias(dias);
  return o[o.length - 1] ?? null;
}

/** '22, 23 y 24 sep 2026' · un solo día: 'martes 22 sep 2026'. */
export function fechaLargaDias(dias: DiaEvento[]): string {
  const o = ordenarDias(dias);
  if (!o.length) return '—';
  if (o.length === 1) return fechaLarga(o[0].fecha);
  const partes = o.map((d) => toDate(d.fecha));
  const mismoMes = partes.every((d) => d.getMonth() === partes[0].getMonth() && d.getFullYear() === partes[0].getFullYear());
  if (mismoMes) {
    const nums = partes.map((d) => String(d.getDate()));
    return `${nums.slice(0, -1).join(', ')} y ${nums[nums.length - 1]} ${MESES[partes[0].getMonth()]} ${partes[0].getFullYear()}`;
  }
  return o.map((d) => fechaCorta(d.fecha)).join(', ') + ' ' + partes[partes.length - 1].getFullYear();
}

/** '22 sep' · varios: '22–24 sep' (o '30 sep–2 oct'). */
export function fechaCortaDias(dias: DiaEvento[]): string {
  const o = ordenarDias(dias);
  if (!o.length) return '—';
  if (o.length === 1) return fechaCorta(o[0].fecha);
  const a = toDate(o[0].fecha), b = toDate(o[o.length - 1].fecha);
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MESES[a.getMonth()]}`;
  return `${fechaCorta(o[0].fecha)}–${fechaCorta(o[o.length - 1].fecha)}`;
}

/** '08:00–12:00' si todos los días tienen el mismo horario; si no, uno por día. */
export function horarioTextoDias(dias: DiaEvento[]): string {
  const o = ordenarDias(dias);
  if (!o.length) return '—';
  const mismo = o.every((d) => d.inicio === o[0].inicio && d.fin === o[0].fin);
  if (mismo) return `${o[0].inicio}–${o[0].fin}`;
  return o.map((d) => `${fechaCorta(d.fecha)} ${d.inicio}–${d.fin}`).join(' · ');
}

/** 'Duración: 4 h' o '3 días · 11 h en total'. */
export function duracionTextoDias(dias: DiaEvento[]): string {
  const o = ordenarDias(dias);
  if (!o.length) return '—';
  if (o.length === 1) return fmtDur(o[0].inicio, o[0].fin);
  return `${o.length} días · ${horasDias(o)} h en total`;
}

// ---------------------------------------------------------------- fechas

export function toDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function fechaISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fecha de hoy en Ecuador, sin importar dónde corra el servidor. */
export function hoyISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** Hora actual en Ecuador, 'HH:MM'. */
export function horaAhora(): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: ZONA_HORARIA, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
}

export function esFechaISO(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toDate(s).getTime());
}

export function esHora(s: unknown): s is string {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function fechaLarga(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = toDate(iso);
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = toDate(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

export function fechaMedia(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = toDate(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** 0 = domingo … 6 = sábado */
export function diaSemana(iso: string): number {
  return toDate(iso).getDay();
}

export function sumarDias(iso: string, n: number): string {
  const d = toDate(iso);
  d.setDate(d.getDate() + n);
  return fechaISO(d);
}

export function diasHasta(fecha: string, hoy: string): number {
  return Math.round((toDate(fecha).getTime() - toDate(hoy).getTime()) / 86400000);
}

export function plazoTexto(fecha: string, hoy: string, horas = HORAS_ANTICIPACION): string {
  if (!fecha) return 'Elige la fecha';
  const dias = diasHasta(fecha, hoy);
  if (dias < 0) return 'Fecha pasada';
  if (dias < diasMinimos(horas)) return `${dias * 24} h · menos de ${horas} h`;
  return `${dias} día${dias === 1 ? '' : 's'} de anticipación`;
}

/** Días completos que exige una anticipación en horas (72 h → 3 días, 24 h → 1 día). */
export function diasMinimos(horas: number): number {
  return Math.max(0, Math.ceil((Number(horas) || HORAS_ANTICIPACION) / 24));
}

/** Regla de anticipación (72 h normalmente): el evento debe estar al menos a esos días de hoy. */
export function cumple72h(fecha: string, hoy: string, horas = HORAS_ANTICIPACION): boolean {
  return diasHasta(fecha, hoy) >= diasMinimos(horas);
}

/** Anticipación que rige hoy: la configurada, salvo que su fecha límite ya pasó (entonces vuelve a 72 h). */
export function anticipacionVigente(a: { anticipacionHoras: number; anticipacionHasta: string }, hoy: string): number {
  if (a.anticipacionHasta && hoy > a.anticipacionHasta) return HORAS_ANTICIPACION;
  return Math.max(1, Number(a.anticipacionHoras) || HORAS_ANTICIPACION);
}

/** Semana del semestre (1..N) en la que cae una fecha. */
export function semanaDe(fecha: string, inicioSemestre: string): number {
  return Math.floor(diasHasta(fecha, inicioSemestre) / 7) + 1;
}

// ---------------------------------------------------------------- citas de uniformes

export const CITA_VACIA: CitaUniforme = { entregaFecha: '', entregaHora: '', entregaHasta: '', entregaHoraFin: '', devolucionFecha: '', devolucionHora: '', devolucionHasta: '', devolucionHoraFin: '', lugar: '', avisoAt: null };

/** Errores de un periodo (entrega o devolución): fecha y hora de inicio obligatorias; "hasta" y hora final opcionales pero coherentes. */
function faltasPeriodoCita(p: { fecha: string; hora: string; hasta: string; horaFin: string }, nombre: string): string[] {
  const f: string[] = [];
  if (!(esFechaISO(p.fecha) && esHora(p.hora))) f.push(`fecha y hora de ${nombre}`);
  if (p.hasta && (!esFechaISO(p.hasta) || (esFechaISO(p.fecha) && p.hasta < p.fecha))) f.push(`el último día de ${nombre} no puede ser antes del primero`);
  if (p.horaFin && (!esHora(p.horaFin) || (esHora(p.hora) && p.horaFin <= p.hora))) f.push(`la hora final de ${nombre} debe ser después de la inicial`);
  return f;
}

/** Errores de una cita de uniformes: cada periodo va completo (fecha y hora de inicio) y al menos uno de los dos. */
export function faltasCitaUniforme(c: CitaUniforme): string[] {
  const f: string[] = [];
  const entrega = !!(c.entregaFecha || c.entregaHora || c.entregaHasta || c.entregaHoraFin);
  const devolucion = !!(c.devolucionFecha || c.devolucionHora || c.devolucionHasta || c.devolucionHoraFin);
  if (entrega) f.push(...faltasPeriodoCita({ fecha: c.entregaFecha, hora: c.entregaHora, hasta: c.entregaHasta, horaFin: c.entregaHoraFin }, 'entrega'));
  if (devolucion) f.push(...faltasPeriodoCita({ fecha: c.devolucionFecha, hora: c.devolucionHora, hasta: c.devolucionHasta, horaFin: c.devolucionHoraFin }, 'devolución'));
  if (!entrega && !devolucion) f.push('al menos la entrega o la devolución');
  if (entrega && devolucion && esFechaISO(c.entregaFecha) && esFechaISO(c.devolucionFecha) && c.devolucionFecha < c.entregaFecha) f.push('la devolución no puede ser antes de la entrega');
  return f;
}

/** 'jueves 24 sep 2026', 'lunes 12 a miércoles 14 oct 2026' o 'lunes 28 sep a jueves 1 oct 2026'. */
export function periodoTexto(desde: string, hasta?: string | null): string {
  if (!hasta || hasta === desde) return fechaLarga(desde);
  const a = toDate(desde), b = toDate(hasta);
  const dia = (d: Date) => `${DIAS[d.getDay()]} ${d.getDate()}`;
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) return `${dia(a)} a ${dia(b)} ${MESES[b.getMonth()]} ${b.getFullYear()}`;
  if (a.getFullYear() === b.getFullYear()) return `${dia(a)} ${MESES[a.getMonth()]} a ${dia(b)} ${MESES[b.getMonth()]} ${b.getFullYear()}`;
  return `${fechaLarga(desde)} a ${fechaLarga(hasta)}`;
}

/** '10:30' o 'de 10:00 a 11:00'. */
export function horarioCitaTexto(hora: string, horaFin?: string | null): string {
  return horaFin ? `de ${hora} a ${horaFin}` : hora;
}

/** Fechas de un periodo de cita, de 'desde' a 'hasta' (máx. 31 días; sin 'hasta' → solo 'desde'). */
export function fechasCita(desde: string, hasta?: string | null): string[] {
  if (!esFechaISO(desde)) return [];
  const fin = hasta && esFechaISO(hasta) && hasta > desde ? hasta : desde;
  const fechas: string[] = [];
  for (let f = desde; f <= fin && fechas.length < 31; f = sumarDias(f, 1)) fechas.push(f);
  return fechas;
}

/** ¿La entrega o la devolución abarca más de un día? */
export function citaEsPeriodo(c: CitaUniforme | null): boolean {
  return !!c && ((!!c.entregaHasta && c.entregaHasta !== c.entregaFecha) || (!!c.devolucionHasta && c.devolucionHasta !== c.devolucionFecha));
}

/** 'jueves 24 sep 2026 · 10:30' o 'lunes 12 a miércoles 14 oct 2026 · de 10:00 a 11:00'. */
export function citaEntregaTexto(c: CitaUniforme | null): string | null {
  return c?.entregaFecha ? `${periodoTexto(c.entregaFecha, c.entregaHasta)} · ${horarioCitaTexto(c.entregaHora, c.entregaHoraFin)}` : null;
}

export function citaDevolucionTexto(c: CitaUniforme | null): string | null {
  return c?.devolucionFecha ? `${periodoTexto(c.devolucionFecha, c.devolucionHasta)} · ${horarioCitaTexto(c.devolucionHora, c.devolucionHoraFin)}` : null;
}

// ---------------------------------------------------------------- horario fijo de uniformes (todo el periodo)

/** Errores del horario fijo: día de lunes a viernes sin repetir, horas válidas y fin después del inicio. */
export function faltasHorarioUniforme(h: FranjaUniforme[]): string[] {
  const f: string[] = [];
  const vistos = new Set<number>();
  for (const x of h) {
    const nombre = DIAS_CLASE[x.dia] ? DIAS_CLASE[x.dia].toLowerCase() : `día ${x.dia}`;
    if (!(x.dia >= 1 && x.dia <= 5)) { f.push(`${nombre}: solo de lunes a viernes`); continue; }
    if (vistos.has(x.dia)) f.push(`${nombre}: repetido`);
    vistos.add(x.dia);
    if (!esHora(x.inicio) || !esHora(x.fin)) f.push(`${nombre}: hora de inicio y fin`);
    else if (x.fin <= x.inicio) f.push(`${nombre}: la hora final debe ser después de la inicial`);
  }
  return f;
}

/** 'lunes, miércoles y viernes' */
function listaDiasSemana(dias: number[]): string {
  const n = dias.map((d) => DIAS_CLASE[d].toLowerCase());
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : (n[0] ?? '');
}

/** 'lunes, miércoles y viernes 11:00–13:00 (Estudiantes de apoyo) · martes y jueves 13:00–15:00 (Coordinación)' (días con la misma franja y responsable se agrupan). */
export function horarioUniformeTexto(h: FranjaUniforme[]): string {
  const grupos: { clave: string; dias: number[]; f: FranjaUniforme }[] = [];
  for (const f of [...h].filter((x) => x.dia >= 1 && x.dia <= 5).sort((a, b) => a.dia - b.dia)) {
    const clave = `${f.inicio}-${f.fin}-${f.atiende.trim().toLowerCase()}`;
    const g = grupos.find((x) => x.clave === clave);
    if (g) g.dias.push(f.dia); else grupos.push({ clave, dias: [f.dia], f });
  }
  return grupos.map((g) => `${listaDiasSemana(g.dias)} ${g.f.inicio}–${g.f.fin}${g.f.atiende.trim() ? ` (${g.f.atiende.trim()})` : ''}`).join(' · ');
}

/** Horario fijo de uniformes tal como viene de settings (jsonb o texto); descarta franjas inválidas y ordena por día. */
export function mapHorarioUniforme(v: unknown): FranjaUniforme[] {
  let x = v;
  if (typeof x === 'string') { try { x = JSON.parse(x); } catch { return []; } }
  if (!Array.isArray(x)) return [];
  return x.map((o) => { const r = (o ?? {}) as Record<string, unknown>; const t = (v: unknown) => (typeof v === 'string' ? v : ''); return { dia: Number(r.dia), inicio: t(r.inicio), fin: t(r.fin), atiende: t(r.atiende) }; })
    .filter((f) => f.dia >= 1 && f.dia <= 5 && esHora(f.inicio) && esHora(f.fin) && f.fin > f.inicio)
    .sort((a, b) => a.dia - b.dia);
}

/** Primera fecha (ISO) a partir de 'desde' que cae en ese día de la semana (0 = domingo … 6 = sábado). */
export function primeraFechaDia(desde: string, dia: number): string {
  const dow = toDate(desde).getDay();
  return sumarDias(desde, (dia - dow + 7) % 7);
}

// ---------------------------------------------------------------- etiquetas

export function semLabel(n: number): string {
  return `${n}.º semestre`;
}

export function semCorto(n: number): string {
  return `${n}.º`;
}

export function tipoLabel(t: string): string {
  return t === 'interno' ? 'Interno' : 'Externo';
}

export function tagClass(estado: string): string {
  return ({ Aprobado: 'tag-accent', Finalizado: 'tag-verde', Pendiente: 'tag-outline', Ajustes: 'tag-neutral', Rechazado: 'tag-neutral' } as Record<string, string>)[estado] || 'tag-neutral';
}

/** Clase de color por tipo de evento: interno (azul UTE) o externo (naranja). */
export function tipoClass(t: string): string {
  return t === 'interno' ? 'tipo-interno' : 'tipo-externo';
}

export function convenioLabel(p: { tipo: string; convenio: string }): string {
  return p.tipo === 'interno' ? 'UTE' : p.convenio === 'si' ? 'Convenio vigente' : 'Sin convenio';
}

export function codigoPedido(periodo: string, numero: number): string {
  return `SOL-${periodo.slice(0, 4)}-${String(numero).padStart(3, '0')}`;
}

export function normalizarCorreo(s: string): string {
  return (s || '').trim().toLowerCase();
}

/** La clave de un evento es su código (SOL-2026-003). Acepta variantes:
 *  'sol 2026 3', 'SOL-2026-003', '2026-003'; y también claves 'UTE-XXXX'. */
export function normalizarClave(s: string): string {
  const c = (s || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!c) return '';
  const m = c.match(/^(?:SOL-?)?(\d{4})-?(\d{1,3})$/);
  if (m) return `SOL-${m[1]}-${m[2].padStart(3, '0')}`;
  if (c.startsWith('UTE-')) return c;
  if (c.startsWith('UTE')) return 'UTE-' + c.slice(3);
  return 'UTE-' + c;
}

const ALFABETO_CLAVE = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function genClave(random: () => number = Math.random): string {
  let s = 'UTE-';
  for (let i = 0; i < 4; i++) s += ALFABETO_CLAVE[Math.floor(random() * ALFABETO_CLAVE.length)];
  return s;
}

/** La clave sirve hasta la hora de salida del último día del evento. */
/** La clave sirve hasta que termina el último día; en eventos con uniforme sigue sirviendo durante el plazo de devolución (para ver el estado en el portal). */
export function claveVigente(p: { dias: DiaEvento[]; vestimenta?: string }, hoy: string, hora: string, diasDevolucion = 0): boolean {
  const u = ultimoDia(p.dias);
  if (!u) return false;
  if (u.fecha > hoy) return true;
  if (p.vestimenta === 'uniforme' && diasDevolucion > 0 && hoy <= limiteDevolucion(u.fecha, diasDevolucion)) return true;
  if (u.fecha < hoy) return false;
  return min(hora) <= min(u.fin);
}

// ---------------------------------------------------------------- cruces

export interface CruceEvento<T> { pedido: T; dia: DiaEvento; diaPropio: DiaEvento }

/** Otro pedido (no rechazado) con un día y horario que se cruzan con alguno
 *  de los días indicados. Eventos distintos el mismo día en horas distintas
 *  no se cruzan. */
export function cruceEventos<T extends { id: string; estado: string; dias: DiaEvento[] }>(
  f: { dias: DiaEvento[] },
  pedidos: T[],
  excluirId?: string,
): CruceEvento<T> | null {
  for (const propio of f.dias) {
    if (!propio.fecha || !propio.inicio || !propio.fin) continue;
    for (const e of pedidos) {
      if (e.id === excluirId || e.estado === 'Rechazado') continue;
      const dia = e.dias.find((d) => d.fecha === propio.fecha && overlap(propio.inicio, propio.fin, d.inicio, d.fin));
      if (dia) return { pedido: e, dia, diaPropio: propio };
    }
  }
  return null;
}

export function normalizarParalelo(p: string | null | undefined): string {
  return (p || '').trim().toUpperCase();
}

/** ¿La clase aplica a este estudiante? Mismo semestre y, si ambos tienen
 *  paralelo, el mismo paralelo. Sin paralelo en alguno de los dos = aplica. */
export function claseAplica(c: { semestre: number; paralelo: string | null; nrc?: string | null }, e: { semestre: number; paralelo: string | null; nrcs?: string[] }): boolean {
  // Con matrícula por NRC (listado por materia) la clase aplica solo si el estudiante cursa ese NRC.
  if (c.nrc && e.nrcs && e.nrcs.length) return e.nrcs.includes(c.nrc);
  if (c.semestre !== e.semestre) return false;
  const cp = normalizarParalelo(c.paralelo), ep = normalizarParalelo(e.paralelo);
  return !cp || !ep || cp === ep;
}

/** Clases que chocan con el evento ese día de la semana, filtradas a los
 *  estudiantes indicados (por NRC si lo tienen; si no, semestre y paralelo). Sin estudiantes = todas. */
export function cruceClases(
  e: { dias: DiaEvento[] },
  clases: Clase[],
  estudiantes: { semestre: number; paralelo: string | null; nrcs?: string[]; dias?: DiaEvento[] }[],
): Clase[] {
  const vistas = new Set<string>();
  const resultado: Clase[] = [];
  for (const d of ordenarDias(e.dias)) {
    if (!d.fecha || !d.inicio || !d.fin) continue;
    const dow = diaSemana(d.fecha);
    // En eventos de varios días, un estudiante cuenta solo en los días a los que va (st.dias); sin dias = todos.
    const asiste = (st: { dias?: DiaEvento[] }) => !st.dias || st.dias.some((x) => x.fecha === d.fecha);
    for (const c of clases) {
      if (vistas.has(c.id)) continue;
      if (c.activo && c.dia === dow && overlap(d.inicio, d.fin, c.inicio, c.fin) && (!estudiantes.length || estudiantes.some((st) => claseAplica(c, st) && asiste(st)))) {
        vistas.add(c.id); resultado.push(c);
      }
    }
  }
  return resultado.sort((a, b) => a.semestre - b.semestre || (a.paralelo || '').localeCompare(b.paralelo || '') || a.dia - b.dia || a.inicio.localeCompare(b.inicio));
}

/** Días del evento en que esa clase se cruza (mismo día de la semana y horas que se solapan). */
export function fechasCruce(dias: DiaEvento[], c: { dia: number; inicio: string; fin: string }): DiaEvento[] {
  return ordenarDias(dias).filter((d) => !!d.fecha && !!d.inicio && !!d.fin && diaSemana(d.fecha) === c.dia && overlap(d.inicio, d.fin, c.inicio, c.fin));
}

/** 'miércoles 14 oct · 07:00–11:00' (la clase, con la fecha o fechas del evento en que choca). */
export function cruceTexto(dias: DiaEvento[], c: { dia: number; inicio: string; fin: string }): string {
  const f = fechasCruce(dias, c).map((d) => fechaCorta(d.fecha));
  return `${DIAS[c.dia] ?? ''}${f.length ? ` ${f.join(' y ')}` : ''} · ${c.inicio}–${c.fin}`;
}

/** Estudiantes a los que les choca esa clase: cursan la materia (NRC o semestre/paralelo) y van a un día del evento en que se cruza. */
export function estudiantesAfectados<T extends { semestre: number; paralelo: string | null; nrcs?: string[]; dias?: DiaEvento[] }>(e: { dias: DiaEvento[] }, c: Clase, estudiantes: T[]): T[] {
  return estudiantes.filter((st) => claseAplica(c, st) && fechasCruce(st.dias ?? e.dias, c).length > 0);
}

/** Como claveNombre pero sin importar el orden de las palabras (APELLIDOS NOMBRES o NOMBRES APELLIDOS). */
export function claveDocente(s: string): string {
  return claveNombre(s).split(' ').filter(Boolean).sort().join(' ');
}

/** Nombre normalizado para comparar docentes entre archivos. */
export function claveNombre(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

// ---------------------------------------------------------------- uniforme

export interface InfoUniforme {
  items: string[];
  tiene: string[];
  faltan: string[];
  n: number;
  completo: boolean;
  estado: string;
  tagClass: string;
}

export function infoUniforme(genero: Genero, entregadas: string[]): InfoUniforme {
  const items = UNIFORME[genero] || [];
  const tiene = items.filter((i) => entregadas.includes(i));
  const n = tiene.length;
  const completo = n === items.length && items.length > 0;
  return {
    items, tiene, n, completo,
    faltan: items.filter((i) => !tiene.includes(i)),
    estado: completo ? 'Completo' : n ? `Parcial ${n}/${items.length}` : 'Sin entregar',
    tagClass: completo ? 'tag-accent' : n ? 'tag-alerta-suave' : 'tag-neutral',
  };
}

export const DEVOLUCION = {
  lavado: { label: 'Devuelto lavado', tag: 'tag-verde' },
  rechazado: { label: 'No recibido · sin lavar', tag: 'tag-alerta' },
} as const;

// ---------------------------------------------------------------- devolución del uniforme por evento (plazo)

/** Último día para devolver el uniforme lavado: N días después del último día del estudiante en el evento. */
export function limiteDevolucion(ultimoDia: string, dias: number): string {
  return sumarDias(ultimoDia, Math.max(1, Math.round(dias) || 7));
}

export type ClaveDevolucion = 'en-curso' | 'pendiente' | 'vencido' | 'devuelto' | 'rechazado';
export interface EstadoDevolucion { clave: ClaveDevolucion; label: string; tag: string }

/** Estado de la devolución de un estudiante en un evento, según el registro, el plazo y la fecha de hoy. */
export function estadoDevolucion(dev: { estado: EstadoDevolucionRegistro; at: string } | null | undefined, ultimoDia: string, limite: string, hoy: string): EstadoDevolucion {
  if (dev?.estado === 'lavado') return { clave: 'devuelto', label: `Devuelto lavado${dev.at ? ` · ${fechaCorta(dev.at)}` : ''}`, tag: 'tag-verde' };
  if (dev?.estado === 'rechazado') return { clave: 'rechazado', label: 'No recibido · sin lavar', tag: 'tag-alerta' };
  if (ultimoDia > hoy) return { clave: 'en-curso', label: `Devolver hasta el ${fechaCorta(limite)}`, tag: 'tag-neutral' };
  if (hoy > limite) return { clave: 'vencido', label: `Vencido · era hasta el ${fechaCorta(limite)}`, tag: 'tag-alerta' };
  return { clave: 'pendiente', label: `Pendiente · hasta el ${fechaCorta(limite)}`, tag: 'tag-outline' };
}

export type FaseDevolucion = 'inicio' | 'recordatorio' | 'vence' | 'vencido';

/** Qué aviso toca hoy para una devolución pendiente: el día después del evento, 2 días antes del plazo, el día del plazo y el día después (vencido). */
export function faseDevolucion(ultimoDia: string, limite: string, hoy: string): FaseDevolucion | null {
  if (hoy === sumarDias(ultimoDia, 1)) return 'inicio';
  if (hoy === limite) return 'vence';
  if (hoy === sumarDias(limite, 1)) return 'vencido';
  if (hoy === sumarDias(limite, -2) && hoy > ultimoDia) return 'recordatorio';
  return null;
}

// ---------------------------------------------------------------- validación del pedido

export interface FormPedido {
  nombre: string;
  cargo: string;
  institucion: string;
  correoSolicitante: string;
  tipo: 'interno' | 'externo';
  convenio: 'si' | 'no';
  evento: string;
  dias: DiaEvento[];
  lugar: string;
  lejos: boolean;
  responsable: string;
  responsableTelefono: string;
  cantidad: number;
  /** Varios días: los mismos estudiantes todos los días (true) o se reparte el total (false). */
  mismosEstudiantes: boolean;
  reparto: RepartoActividad[];
  vestimenta: Vestimenta;
  acepta: boolean;
  evidenciaNombre: string;
  evidenciaPath: string;
}

export const DIA_INICIAL: DiaEvento = { fecha: '', inicio: '09:00', fin: '13:00', lugar: '', lejos: false };

export const FORM_INICIAL: FormPedido = {
  nombre: '', cargo: '', institucion: '', correoSolicitante: '', tipo: 'interno', convenio: 'si',
  evento: '', dias: [{ ...DIA_INICIAL }], lugar: '', lejos: false, responsable: '', responsableTelefono: '',
  cantidad: 4, mismosEstudiantes: true, reparto: [], vestimenta: 'uniforme', acepta: false, evidenciaNombre: '', evidenciaPath: '',
};

/** Al menos 7 dígitos (acepta espacios, guiones, paréntesis y +). */
export function telefonoValido(s: string): boolean {
  return (s || '').replace(/\D/g, '').length >= 7 && /^[\d\s()+\-./ext]+$/i.test(s.trim());
}

export function correoValido(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Problemas de la lista de días (vacío = correcta). `soloFuturo` exige la regla de 72 h. */
export function faltasDias(dias: DiaEvento[], hoy: string, soloFuturo = true, horas = HORAS_ANTICIPACION): string[] {
  const f: string[] = [];
  if (!dias.length) f.push('al menos un día');
  if (dias.length > MAX_DIAS_EVENTO) f.push(`máximo ${MAX_DIAS_EVENTO} días`);
  if (dias.some((d) => !d.fecha)) f.push('fecha de cada día');
  else if (dias.some((d) => !esFechaISO(d.fecha))) f.push('fecha válida');
  else {
    const fechas = dias.map((d) => d.fecha);
    if (new Set(fechas).size !== fechas.length) f.push('fechas sin repetir');
    const primera = [...fechas].sort()[0];
    if (soloFuturo && !cumple72h(primera, hoy, horas)) f.push(`fecha con al menos ${horas} h`);
  }
  if (dias.some((d) => !(duracionMin(d.inicio, d.fin) > 0))) f.push('horario válido en cada día');
  return f;
}

// ---------------------------------------------------------------- reparto por actividad

export function sumaReparto(r: RepartoActividad[]): number {
  return r.reduce((a, x) => a + (Number(x.cantidad) || 0), 0);
}

/** Problemas del reparto (vacío = correcto): al menos una actividad, cada una
 *  con al menos 1 estudiante, y la suma igual al total pedido. */
export function faltasReparto(r: RepartoActividad[], cantidad: number): string[] {
  const f: string[] = [];
  const valido = r.filter((x) => ACTIVIDADES.includes(x.actividad));
  if (!valido.length) { f.push('al menos una actividad'); return f; }
  if (valido.some((x) => !(Number(x.cantidad) >= 1))) f.push('al menos 1 estudiante en cada actividad marcada');
  const suma = sumaReparto(valido);
  if (suma !== cantidad) f.push(`repartir los ${cantidad} estudiantes entre las actividades (asignados: ${suma})`);
  return f;
}

/** Marca o desmarca una actividad manteniendo la suma igual al total. */
export function alternarActividad(r: RepartoActividad[], actividad: string, cantidad: number): RepartoActividad[] {
  if (r.some((x) => x.actividad === actividad)) {
    const resto = r.filter((x) => x.actividad !== actividad);
    if (!resto.length) return [];
    const faltan = cantidad - sumaReparto(resto);
    return resto.map((x, i) => (i === 0 ? { ...x, cantidad: Math.max(1, x.cantidad + faltan) } : x));
  }
  const libres = cantidad - sumaReparto(r);
  if (libres >= 1) return [...r, { actividad, cantidad: libres }];
  // No queda cupo: se toma 1 de la actividad con más estudiantes.
  const mayor = r.reduce((m, x) => (x.cantidad > m.cantidad ? x : m), r[0]);
  const ajustado = r.map((x) => (x === mayor && x.cantidad > 1 ? { ...x, cantidad: x.cantidad - 1 } : x));
  return [...ajustado, { actividad, cantidad: 1 }];
}

/** Al cambiar el total, ajusta la primera actividad para que la suma cuadre. */
export function ajustarRepartoATotal(r: RepartoActividad[], cantidad: number): RepartoActividad[] {
  if (!r.length) return r;
  const delta = cantidad - sumaReparto(r);
  if (!delta) return r;
  return r.map((x, i) => (i === 0 ? { ...x, cantidad: Math.max(1, x.cantidad + delta) } : x));
}

/** 'Guía de invitados (2), Acompañamiento en recorridos (2)'. */
export function repartoTexto(reparto: RepartoActividad[], actividades: string[]): string {
  if (reparto.length) return reparto.map((x) => `${x.actividad} (${x.cantidad})`).join(', ');
  return actividades.join(', ');
}

/** Devuelve, por paso, la lista de lo que falta (vacía = paso completo). */
export function faltasPedido(f: FormPedido, hoy: string, cruce: { evento: string } | null, horas = HORAS_ANTICIPACION): string[][] {
  const f1: string[] = [];
  if (!f.nombre.trim()) f1.push('nombre');
  if (!f.cargo.trim()) f1.push('cargo');
  if (!f.institucion.trim()) f1.push('institución');
  if (!f.correoSolicitante.trim()) f1.push('correo de contacto');
  else if (!correoValido(f.correoSolicitante)) f1.push('correo válido');

  const f2: string[] = [];
  if (!f.evento.trim()) f2.push('nombre del evento');
  if (!f.evidenciaPath) f2.push('evidencia del pedido');
  f2.push(...faltasDias(f.dias, hoy, true, horas));
  if (cruce && BLOQUEAR_CRUCE_EVENTOS) f2.push('horario sin cruce');
  if (f.dias.some((d) => !(d.lugar ?? '').trim())) f2.push(f.dias.length > 1 ? 'lugar de cada día' : 'lugar');
  if (!f.responsable.trim()) f2.push('nombre del responsable');
  if (!telefonoValido(f.responsableTelefono)) f2.push('teléfono del responsable');

  const f3: string[] = [];
  if (!(f.cantidad >= 1 && f.cantidad <= MAX_ESTUDIANTES)) f3.push('número de estudiantes (1–20)');
  if (f.dias.length > 1) {
    f3.push(...faltasCantidadesDias(f.cantidad, f.dias, f.mismosEstudiantes));
    f.dias.forEach((d, i) => f3.push(...faltasReparto(d.reparto ?? [], cantidadDia(f, d)).map((m) => `día ${i + 1}: ${m}`)));
  } else f3.push(...faltasReparto(f.reparto, f.cantidad));
  if (!VESTIMENTA[f.vestimenta]) f3.push('vestimenta');

  const f4: string[] = [];
  if (!f.acepta) f4.push('aceptar compromisos');

  return [f1, f2, f3, f4];
}
