// Reglas de negocio y formato. Solo funciones puras: se usan igual en el
// navegador y en el servidor (validaciones, reporte, correos).
import type {
  Clase, Estado, Genero, Pedido, Semestre, Vestimenta,
} from './tipos';

export const ZONA_HORARIA = 'America/Guayaquil';
export const MINIMO_EVENTOS = 2;
export const HORAS_ANTICIPACION = 72;
export const MAX_ESTUDIANTES = 20;

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
  return ({ Aprobado: 'tag-accent', Pendiente: 'tag-outline', Ajustes: 'tag-neutral', Rechazado: 'tag-neutral' } as Record<string, string>)[estado] || 'tag-neutral';
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

/** La clave sirve hasta la hora de salida del evento. */
export function claveVigente(p: { fecha: string; fin: string }, hoy: string, hora: string): boolean {
  if (p.fecha > hoy) return true;
  if (p.fecha < hoy) return false;
  return min(hora) <= min(p.fin);
}

// ---------------------------------------------------------------- cruces

/** Otro pedido (no rechazado) el mismo día con horario que se cruza. */
export function cruceEventos<T extends Pick<Pedido, 'id' | 'fecha' | 'inicio' | 'fin' | 'estado' | 'evento'>>(
  f: { fecha: string; inicio: string; fin: string },
  pedidos: T[],
  excluirId?: string,
): T | null {
  if (!f.fecha || !f.inicio || !f.fin) return null;
  return pedidos.find((e) => e.id !== excluirId && e.fecha === f.fecha && e.estado !== 'Rechazado' && overlap(f.inicio, f.fin, e.inicio, e.fin)) || null;
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
  e: { fecha: string; inicio: string; fin: string },
  clases: Clase[],
  estudiantes: { semestre: number; paralelo: string | null }[],
): Clase[] {
  if (!e.fecha || !e.inicio || !e.fin) return [];
  const dia = diaSemana(e.fecha);
  return clases
    .filter((c) => c.activo && c.dia === dia && overlap(e.inicio, e.fin, c.inicio, c.fin) && (!estudiantes.length || estudiantes.some((st) => claseAplica(c, st))))
    .sort((a, b) => a.semestre - b.semestre || (a.paralelo || '').localeCompare(b.paralelo || '') || a.inicio.localeCompare(b.inicio));
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
  fecha: string;
  inicio: string;
  fin: string;
  lugar: string;
  lejos: boolean;
  responsable: string;
  cantidad: number;
  actividades: string[];
  vestimenta: Vestimenta;
  acepta: boolean;
  evidenciaNombre: string;
  evidenciaPath: string;
}

export const FORM_INICIAL: FormPedido = {
  nombre: '', cargo: '', institucion: '', correoSolicitante: '', tipo: 'interno', convenio: 'si',
  evento: '', fecha: '', inicio: '09:00', fin: '13:00', lugar: '', lejos: false, responsable: '',
  cantidad: 4, actividades: [], vestimenta: 'uniforme', acepta: false, evidenciaNombre: '', evidenciaPath: '',
};

export function correoValido(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/** Devuelve, por paso, la lista de lo que falta (vacía = paso completo). */
export function faltasPedido(f: FormPedido, hoy: string, cruce: { evento: string } | null): string[][] {
  const f1: string[] = [];
  if (!f.evidenciaPath) f1.push('evidencia del pedido');
  if (!f.nombre.trim()) f1.push('nombre');
  if (!f.cargo.trim()) f1.push('cargo');
  if (!f.institucion.trim()) f1.push('institución');
  if (!f.correoSolicitante.trim()) f1.push('correo de contacto');
  else if (!correoValido(f.correoSolicitante)) f1.push('correo válido');

  const f2: string[] = [];
  if (!f.evento.trim()) f2.push('nombre del evento');
  if (!f.fecha) f2.push('fecha');
  else if (!esFechaISO(f.fecha)) f2.push('fecha válida');
  else if (!cumple72h(f.fecha, hoy)) f2.push('fecha con al menos 72 h');
  if (!(duracionMin(f.inicio, f.fin) > 0)) f2.push('horario válido');
  if (cruce && BLOQUEAR_CRUCE_EVENTOS) f2.push('horario sin cruce');
  if (!f.lugar.trim()) f2.push('lugar');
  if (!f.responsable.trim()) f2.push('responsable');

  const f3: string[] = [];
  if (!(f.cantidad >= 1 && f.cantidad <= MAX_ESTUDIANTES)) f3.push('número de estudiantes (1–20)');
  if (!f.actividades.length) f3.push('al menos una actividad');
  if (!VESTIMENTA[f.vestimenta]) f3.push('vestimenta');

  const f4: string[] = [];
  if (!f.acepta) f4.push('aceptar compromisos');

  return [f1, f2, f3, f4];
}
