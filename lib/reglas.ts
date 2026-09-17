// Reglas de negocio y formato. Solo funciones puras: se usan igual en el
// navegador y en el servidor (validaciones, reporte, correos).
import type {
  CitaUniforme, Clase, DiaEvento, Estado, Genero, RepartoActividad, Semestre, Vestimenta,
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
  if (tarde && e.lejos) return 'Termina después de las 18:00 y el lugar es lejano';
  if (tarde) return 'Termina después de las 18:00';
  if (e.lejos) return 'Lugar lejano';
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

/** Transporte: algún día termina después de las 18:00, o el lugar es lejano. */
export function transporteMotivoDias(e: { dias: DiaEvento[]; lejos: boolean }): string | null {
  const tarde = e.dias.some((d) => !!d.fin && min(d.fin) > 18 * 60);
  if (tarde && e.lejos) return 'Termina después de las 18:00 y el lugar es lejano';
  if (tarde) return 'Termina después de las 18:00';
  if (e.lejos) return 'Lugar lejano';
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

export function plazoTexto(fecha: string, hoy: string): string {
  if (!fecha) return 'Elige la fecha';
  const dias = diasHasta(fecha, hoy);
  if (dias < 0) return 'Fecha pasada';
  if (dias < 3) return `${dias * 24} h · menos de 72 h`;
  return `${dias} días de anticipación`;
}

/** Regla 72 h: el evento debe estar al menos a 3 días de hoy. */
export function cumple72h(fecha: string, hoy: string): boolean {
  return diasHasta(fecha, hoy) >= 3;
}

/** Semana del semestre (1..N) en la que cae una fecha. */
export function semanaDe(fecha: string, inicioSemestre: string): number {
  return Math.floor(diasHasta(fecha, inicioSemestre) / 7) + 1;
}

// ---------------------------------------------------------------- citas de uniformes

export const CITA_VACIA: CitaUniforme = { entregaFecha: '', entregaHora: '', devolucionFecha: '', devolucionHora: '', lugar: '', avisoAt: null };

/** Errores de una cita de uniformes: cada pareja fecha+hora va completa y al menos una de las dos. */
export function faltasCitaUniforme(c: CitaUniforme): string[] {
  const f: string[] = [];
  const entrega = !!(c.entregaFecha || c.entregaHora), devolucion = !!(c.devolucionFecha || c.devolucionHora);
  if (entrega && !(esFechaISO(c.entregaFecha) && esHora(c.entregaHora))) f.push('fecha y hora de entrega');
  if (devolucion && !(esFechaISO(c.devolucionFecha) && esHora(c.devolucionHora))) f.push('fecha y hora de devolución');
  if (!entrega && !devolucion) f.push('al menos la entrega o la devolución');
  if (entrega && devolucion && esFechaISO(c.entregaFecha) && esFechaISO(c.devolucionFecha) && c.devolucionFecha < c.entregaFecha) f.push('la devolución no puede ser antes de la entrega');
  return f;
}

export function citaEntregaTexto(c: CitaUniforme | null): string | null {
  return c?.entregaFecha ? `${fechaLarga(c.entregaFecha)} · ${c.entregaHora}` : null;
}

export function citaDevolucionTexto(c: CitaUniforme | null): string | null {
  return c?.devolucionFecha ? `${fechaLarga(c.devolucionFecha)} · ${c.devolucionHora}` : null;
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
export function claveVigente(p: { dias: DiaEvento[] }, hoy: string, hora: string): boolean {
  const u = ultimoDia(p.dias);
  if (!u) return false;
  if (u.fecha > hoy) return true;
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
export function claseAplica(c: { semestre: number; paralelo: string | null }, e: { semestre: number; paralelo: string | null }): boolean {
  if (c.semestre !== e.semestre) return false;
  const cp = normalizarParalelo(c.paralelo), ep = normalizarParalelo(e.paralelo);
  return !cp || !ep || cp === ep;
}

/** Clases que chocan con el evento ese día de la semana, filtradas a los
 *  estudiantes indicados (semestre y paralelo). Sin estudiantes = todas. */
export function cruceClases(
  e: { dias: DiaEvento[] },
  clases: Clase[],
  estudiantes: { semestre: number; paralelo: string | null }[],
): Clase[] {
  const vistas = new Set<string>();
  const resultado: Clase[] = [];
  for (const d of ordenarDias(e.dias)) {
    if (!d.fecha || !d.inicio || !d.fin) continue;
    const dow = diaSemana(d.fecha);
    for (const c of clases) {
      if (vistas.has(c.id)) continue;
      if (c.activo && c.dia === dow && overlap(d.inicio, d.fin, c.inicio, c.fin) && (!estudiantes.length || estudiantes.some((st) => claseAplica(c, st)))) {
        vistas.add(c.id); resultado.push(c);
      }
    }
  }
  return resultado.sort((a, b) => a.semestre - b.semestre || (a.paralelo || '').localeCompare(b.paralelo || '') || a.dia - b.dia || a.inicio.localeCompare(b.inicio));
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
    tagClass: completo ? 'tag-accent' : n ? 'tag-outline' : 'tag-neutral',
  };
}

export const DEVOLUCION = {
  lavado: { label: 'Devuelto lavado', tag: 'tag-accent' },
  rechazado: { label: 'No recibido · sin lavar', tag: 'tag-outline' },
} as const;

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
  reparto: RepartoActividad[];
  vestimenta: Vestimenta;
  acepta: boolean;
  evidenciaNombre: string;
  evidenciaPath: string;
}

export const DIA_INICIAL: DiaEvento = { fecha: '', inicio: '09:00', fin: '13:00' };

export const FORM_INICIAL: FormPedido = {
  nombre: '', cargo: '', institucion: '', correoSolicitante: '', tipo: 'interno', convenio: 'si',
  evento: '', dias: [{ ...DIA_INICIAL }], lugar: '', lejos: false, responsable: '', responsableTelefono: '',
  cantidad: 4, reparto: [], vestimenta: 'uniforme', acepta: false, evidenciaNombre: '', evidenciaPath: '',
};

/** Al menos 7 dígitos (acepta espacios, guiones, paréntesis y +). */
export function telefonoValido(s: string): boolean {
  return (s || '').replace(/\D/g, '').length >= 7 && /^[\d\s()+\-./ext]+$/i.test(s.trim());
}

export function correoValido(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Problemas de la lista de días (vacío = correcta). `soloFuturo` exige la regla de 72 h. */
export function faltasDias(dias: DiaEvento[], hoy: string, soloFuturo = true): string[] {
  const f: string[] = [];
  if (!dias.length) f.push('al menos un día');
  if (dias.length > MAX_DIAS_EVENTO) f.push(`máximo ${MAX_DIAS_EVENTO} días`);
  if (dias.some((d) => !d.fecha)) f.push('fecha de cada día');
  else if (dias.some((d) => !esFechaISO(d.fecha))) f.push('fecha válida');
  else {
    const fechas = dias.map((d) => d.fecha);
    if (new Set(fechas).size !== fechas.length) f.push('fechas sin repetir');
    const primera = [...fechas].sort()[0];
    if (soloFuturo && !cumple72h(primera, hoy)) f.push('fecha con al menos 72 h');
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
export function faltasPedido(f: FormPedido, hoy: string, cruce: { evento: string } | null): string[][] {
  const f1: string[] = [];
  if (!f.nombre.trim()) f1.push('nombre');
  if (!f.cargo.trim()) f1.push('cargo');
  if (!f.institucion.trim()) f1.push('institución');
  if (!f.correoSolicitante.trim()) f1.push('correo de contacto');
  else if (!correoValido(f.correoSolicitante)) f1.push('correo válido');

  const f2: string[] = [];
  if (!f.evento.trim()) f2.push('nombre del evento');
  if (!f.evidenciaPath) f2.push('evidencia del pedido');
  f2.push(...faltasDias(f.dias, hoy));
  if (cruce && BLOQUEAR_CRUCE_EVENTOS) f2.push('horario sin cruce');
  if (!f.lugar.trim()) f2.push('lugar');
  if (!f.responsable.trim()) f2.push('nombre del responsable');
  if (!telefonoValido(f.responsableTelefono)) f2.push('teléfono del responsable');

  const f3: string[] = [];
  if (!(f.cantidad >= 1 && f.cantidad <= MAX_ESTUDIANTES)) f3.push('número de estudiantes (1–20)');
  f3.push(...faltasReparto(f.reparto, f.cantidad));
  if (!VESTIMENTA[f.vestimenta]) f3.push('vestimenta');

  const f4: string[] = [];
  if (!f.acepta) f4.push('aceptar compromisos');

  return [f1, f2, f3, f4];
}
