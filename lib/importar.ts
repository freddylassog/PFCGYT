// Lectura de filas ya extraídas de Excel/CSV: funciones puras, sin dependencias
// de servidor, para poder probarlas con node:test.
import type { Genero, Semestre } from './tipos';

export type Fila = Record<string, string>;

export function normalizarClave(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function parsearCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '');
  const primera = t.split(/\r?\n/)[0] ?? '';
  const sep = (primera.match(/;/g)?.length ?? 0) > (primera.match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [], campo = '', enComillas = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (enComillas) {
      if (ch === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += ch;
    } else if (ch === '"') enComillas = true;
    else if (ch === sep) { fila.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo); filas.push(fila); fila = []; campo = '';
    } else campo += ch;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas.filter((f) => f.some((c) => c.trim() !== ''));
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export const CLAVES_HORA = ['inicio', 'fin', 'hora inicio', 'hora fin', 'desde', 'hasta', 'hora'];

export function col(fila: Fila, ...alias: string[]): string {
  for (const a of alias) {
    const k = normalizarClave(a);
    if (fila[k] != null && fila[k] !== '') return fila[k];
  }
  return '';
}

export function parseSemestre(s: string): Semestre | null {
  const n = parseInt(s.replace(/[^\d]/g, ''), 10);
  return n >= 1 && n <= 3 ? (n as Semestre) : null;
}

export function parseGenero(s: string): Genero | null {
  const t = normalizarClave(s);
  if (!t) return null;
  if (['f', 'femenino', 'femenina', 'mujer', 'female'].includes(t)) return 'F';
  if (['m', 'masculino', 'hombre', 'male'].includes(t)) return 'M';
  if (t.startsWith('fem') || t.startsWith('muj')) return 'F';
  if (t.startsWith('mas') || t.startsWith('hom')) return 'M';
  return null;
}

export function parseDia(s: string): number | null {
  const t = normalizarClave(s);
  if (!t) return null;
  if (/^[1-5]$/.test(t)) return Number(t);
  const dias = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
  const i = dias.findIndex((d) => d.startsWith(t.slice(0, 3)));
  return i >= 0 ? i + 1 : null;
}

export function parseHora(s: string): string | null {
  const t = s.trim().toLowerCase().replace(/\s+/g, '');
  const m = t.match(/^(\d{1,2})[:h.]?(\d{2})?(am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const mi = Number(m[2] ?? '0');
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || mi > 59) return null;
  return `${pad2(h)}:${pad2(mi)}`;
}

export interface EstudianteImportado { nombre: string; correo: string; semestre: Semestre; paralelo: string; genero: Genero }
export interface DocenteImportado { nombre: string; correo: string }
export interface ClaseImportada { semestre: Semestre; paralelo: string; dia: number; inicio: string; fin: string; materia: string; correoDocente: string; docenteNombre: string; nrc: string }

/** Extrae todos los rangos de hora de un texto como "9:00-11:00", "07:00 -09:00",
 *  "9:00 10:00" o "7:00-9:00 / 10:00-11:00". */
export function parseRangos(texto: string): { inicio: string; fin: string }[] {
  const horas = [...(texto || '').matchAll(/(\d{1,2})[:h.](\d{2})/g)].map((m) => {
    const h = Number(m[1]), mi = Number(m[2]);
    return h <= 23 && mi <= 59 ? `${pad2(h)}:${pad2(mi)}` : null;
  }).filter((x): x is string => !!x);
  const rangos: { inicio: string; fin: string }[] = [];
  for (let i = 0; i + 1 < horas.length; i += 2) if (horas[i] < horas[i + 1]) rangos.push({ inicio: horas[i], fin: horas[i + 1] });
  return rangos;
}

const DIAS_ANCHO: [string, number][] = [['lunes', 1], ['martes', 2], ['miercoles', 3], ['jueves', 4], ['viernes', 5]];

/** ¿El archivo trae una columna por día (formato de la universidad)? */
export function esFormatoAncho(filas: Fila[]): boolean {
  const f = filas[0];
  return !!f && DIAS_ANCHO.filter(([d]) => d in f).length >= 3;
}

function limpiarTexto(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Formato de la universidad: ASIGNATURA, NIVEL, PARALELO, DOCENTE, LUNES…VIERNES con rangos. */
export function parseHorariosAncho(filas: Fila[]): { ok: ClaseImportada[]; errores: string[] } {
  const ok: ClaseImportada[] = [], errores: string[] = [];
  filas.forEach((f, i) => {
    const materia = limpiarTexto(col(f, 'Asignatura', 'Materia'));
    const semestre = parseSemestre(col(f, 'Nivel', 'Semestre'));
    const paralelo = limpiarTexto(col(f, 'Paralelo')).toUpperCase();
    const docenteNombre = limpiarTexto(col(f, 'Docente', 'Profesor'));
    const correoDocente = col(f, 'Correo docente', 'Correo').toLowerCase();
    const nrc = limpiarTexto(col(f, 'NRC', 'Nrc', 'Código', 'Codigo'));
    if (!materia || !semestre) {
      if (materia || docenteNombre) errores.push(`Fila ${i + 2}: ${!materia ? 'falta asignatura' : 'nivel fuera de 1–3'}`);
      return;
    }
    let alguno = false;
    for (const [dia, n] of DIAS_ANCHO) {
      for (const r of parseRangos(f[dia] ?? '')) {
        alguno = true;
        ok.push({ semestre, paralelo, dia: n, inicio: r.inicio, fin: r.fin, materia, correoDocente: correoDocente.includes('@') ? correoDocente : '', docenteNombre, nrc });
      }
    }
    if (!alguno) errores.push(`Fila ${i + 2}: ${materia} (${paralelo || 'sin paralelo'}) no tiene horas legibles`);
  });
  return { ok, errores };
}

export function parseEstudiantes(filas: Fila[]): { ok: EstudianteImportado[]; errores: string[] } {
  const ok: EstudianteImportado[] = [], errores: string[] = [];
  filas.forEach((f, i) => {
    const nombre = col(f, 'Nombre', 'Estudiante', 'Nombres', 'Nombre completo');
    const correo = col(f, 'Correo', 'Email', 'Correo electrónico', 'E-mail', 'Correo institucional').toLowerCase();
    const semestre = parseSemestre(col(f, 'Semestre', 'Nivel'));
    const genero = parseGenero(col(f, 'Género', 'Genero', 'Sexo'));
    const paralelo = limpiarTexto(col(f, 'Paralelo')).toUpperCase();
    const faltan = [!nombre && 'nombre', !correo.includes('@') && 'correo', !semestre && 'semestre (1–3)', !genero && 'género (F/M)'].filter(Boolean);
    if (faltan.length) errores.push(`Fila ${i + 2}: falta ${faltan.join(', ')}`);
    else ok.push({ nombre, correo, semestre: semestre!, paralelo, genero: genero! });
  });
  return { ok, errores };
}

export function parseDocentes(filas: Fila[]): { ok: DocenteImportado[]; errores: string[] } {
  const ok: DocenteImportado[] = [], errores: string[] = [];
  filas.forEach((f, i) => {
    const nombre = col(f, 'Nombre', 'Docente', 'Nombres');
    const correo = col(f, 'Correo', 'Email', 'Correo electrónico', 'E-mail').toLowerCase();
    if (!nombre || !correo.includes('@')) errores.push(`Fila ${i + 2}: falta ${!nombre ? 'nombre' : 'correo'}`);
    else ok.push({ nombre, correo });
  });
  return { ok, errores };
}

export function parseHorarios(filas: Fila[]): { ok: ClaseImportada[]; errores: string[] } {
  if (esFormatoAncho(filas)) return parseHorariosAncho(filas);
  const ok: ClaseImportada[] = [], errores: string[] = [];
  filas.forEach((f, i) => {
    const semestre = parseSemestre(col(f, 'Semestre', 'Nivel'));
    const dia = parseDia(col(f, 'Día', 'Dia'));
    const inicio = parseHora(col(f, 'Inicio', 'Hora inicio', 'Desde'));
    const fin = parseHora(col(f, 'Fin', 'Hora fin', 'Hasta'));
    const materia = limpiarTexto(col(f, 'Materia', 'Asignatura'));
    const paralelo = limpiarTexto(col(f, 'Paralelo')).toUpperCase();
    const correoDocente = col(f, 'Correo docente', 'Docente correo', 'Correo del docente', 'Email docente', 'Correo').toLowerCase();
    const docenteNombre = limpiarTexto(col(f, 'Docente', 'Profesor', 'Nombre docente'));
    const nrc = limpiarTexto(col(f, 'NRC', 'Nrc'));
    const faltan = [!semestre && 'semestre', !dia && 'día (Lunes…Viernes)', !inicio && 'inicio (HH:MM)', !fin && 'fin (HH:MM)', !materia && 'materia'].filter(Boolean);
    if (faltan.length) errores.push(`Fila ${i + 2}: falta ${faltan.join(', ')}`);
    else if (inicio! >= fin!) errores.push(`Fila ${i + 2}: la hora de fin debe ser mayor que la de inicio`);
    else ok.push({ semestre: semestre!, paralelo, dia: dia!, inicio: inicio!, fin: fin!, materia, correoDocente: correoDocente.includes('@') ? correoDocente : '', docenteNombre: docenteNombre.includes('@') ? '' : docenteNombre, nrc });
  });
  return { ok, errores };
}


// ---------------------------------------------------------------- listados de estudiantes por materia (NRC)

/** Una hoja de Excel tal cual: nombre y filas con sus celdas como texto. */
export interface HojaCruda { nombre: string; filas: string[][] }
export interface EstudianteNrcImportado { clave: string; nombre: string; primerNombre: string; paralelo: string; nrcs: string[] }
export interface MateriaNrc { nrc: string; materia: string; paralelo: string; /** Semestre deducido del nombre de la hoja ("LENGUAJE - 1C" → 1), si se puede. */ semestre: number | null }

/** Semestre a partir del nombre de una hoja del listado por materia: termina en nivel + paralelo ("1C", "2A", "3B1"). */
export function semestreDeHoja(nombreHoja: string): number | null {
  const m = (nombreHoja || '').trim().match(/(\d)\s*[A-Z]\d?$/i);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= 3 ? n : null;
}

/** Clave para comparar nombres de estudiantes entre archivos: sin tildes, en mayúsculas y solo letras. */
export function claveNombreEstudiante(s: string): string {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z\u00d1 ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

const PARTICULAS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'E', 'DA', 'DO', 'DOS', 'VAN', 'VON', 'SAN']);

/** ¿Son la misma persona? Las palabras del nombre más corto deben estar todas en el otro (mínimo dos). */
export function coincideNombre(a: string, b: string): boolean {
  const tokens = (x: string) => claveNombreEstudiante(x).split(' ').filter((t) => t.length > 1 && !PARTICULAS.has(t));
  const ta = tokens(a), tb = tokens(b);
  const [corto, largo] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  return corto.length >= 2 && corto.every((t) => largo.includes(t));
}

/** Estudiantes cuyo nombre coincide con lo escrito (nombre y al menos un apellido); vacío si lo escrito tiene menos de dos palabras. */
export function candidatosPorNombre<T extends { nombre: string }>(lista: T[], texto: string): T[] {
  const sinIniciales = (s: string) => claveNombreEstudiante(s).split(' ').filter((t) => t.length > 1).join(' ');
  const escrito = sinIniciales(texto);
  if (escrito.split(' ').filter(Boolean).length < 2) return [];
  // Nombre completo exacto (sin tildes ni iniciales) → ese; si no, coincidencia por nombre y apellidos.
  const exactos = lista.filter((e) => sinIniciales(e.nombre) === escrito);
  if (exactos.length === 1) return exactos;
  return lista.filter((e) => coincideNombre(e.nombre, texto));
}

/** "CARRIÓN" → "Carrión"; "DE LA TORRE" → "de la Torre" (la primera palabra siempre con mayúscula). */
export function tituloNombre(s: string): string {
  return limpiarTexto(s).toLowerCase().split(' ').map((w, i) => (i > 0 && PARTICULAS.has(w.toUpperCase()) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
}

/** "ANDREI, CARRIÓN/TISCAMA R." → "Andrei R. Carrión Tiscama"; "ANETH, LINCANGO/" → "Aneth Lincango". */
export function formatearNombreNrc(crudo: string): { nombre: string; primerNombre: string } {
  const t = limpiarTexto(crudo);
  const coma = t.indexOf(',');
  const nombresRaw = coma >= 0 ? t.slice(0, coma).trim() : '';
  const apellidosRaw = coma >= 0 ? t.slice(coma + 1).trim() : t;
  const partes = apellidosRaw.split('/').map((x) => x.trim());
  const ap1 = partes[0] ?? '';
  const resto = (partes[1] ?? '').split(/\s+/).filter(Boolean);
  const inicial = resto.find((x) => /^[A-Z\u00c0-\u00dc]\.?$/i.test(x) && x.length <= 2) ?? '';
  const ap2 = resto.filter((x) => x !== inicial).join(' ');
  const nombre = tituloNombre([nombresRaw, inicial ? inicial.toUpperCase().replace(/\.?$/, '.') : '', ap1, ap2].filter(Boolean).join(' '));
  const primerNombre = (nombresRaw || ap1).split(/\s+/)[0] ?? '';
  return { nombre, primerNombre };
}

const FEMENINOS_SIN_A = new Set(['ESTEFANY', 'ESTEFANI', 'LESLY', 'LESLIE', 'EMILY', 'EMILIE', 'ODALIS', 'SKARLETH', 'SCARLETH', 'MELANIE', 'MELANY', 'ZOE', 'BELEN', 'ANETH', 'NICOLE', 'NICOL', 'DENISSE', 'DENISE', 'LISBETH', 'LIZBETH', 'LISSETTE', 'LIZETH', 'ELIZABETH', 'ELIZABET', 'JENNIFER', 'JENIFFER', 'KAREN', 'CAROL', 'NAHOMI', 'NAOMI', 'ASHLEY', 'MISHELL', 'MICHELLE', 'MICHELL', 'SCARLETT', 'GENESIS', 'NAYELI', 'MAYERLI', 'ARLETH', 'JOSELYN', 'JOSSELYN', 'KERLY', 'ANAHI', 'ABIGAIL', 'RAQUEL', 'ISABEL', 'CARMEN', 'MERCEDES', 'DOLORES', 'INES', 'BEATRIZ', 'PILAR', 'ROCIO', 'SOLEDAD', 'EVELYN', 'EVELIN', 'JAZMIN', 'YAZMIN', 'NOEMI', 'RUTH', 'ESTHER', 'MIRIAM', 'LILIAN', 'MARISOL', 'ARACELI', 'ARACELY', 'MARYPAZ', 'DORIS', 'NATHALY', 'NATALY', 'NATHALIE', 'YULEISY', 'KIMBERLY', 'DAYANNE', 'SOLANGE', 'SHIRLEY', 'ANGIE', 'MAITE', 'MAYTE', 'MILAGROS', 'GUADALUPE', 'BRIGITTE', 'DANIELLE', 'VALERIE', 'SHARON', 'CELESTE', 'YADIRA', 'JOHANNA', 'LIZ', 'ANGELES', 'DULCE', 'MARYORI', 'MAYORI', 'YESENIA', 'LUZ', 'NOELY', 'DAYSI', 'DAISY', 'GRACE', 'KATHERINE', 'CATHERINE', 'KATERIN', 'KATHERIN', 'JAEL', 'MELISSA', 'ALEXIS']);
const MASCULINOS_CON_A = new Set(['JOSHUA', 'LUCA', 'JONA', 'NOA', 'AKIRA', 'MUSTAFA', 'DAVID', 'JOSIAS', 'ELIAS', 'ISAIAS', 'JEREMIAS', 'ZACARIAS', 'MATIAS', 'TOBIAS', 'NICOLA', 'JUAN', 'BAUTISTA']);

/** Género estimado por el primer nombre (para el uniforme); se puede corregir en la tabla. */
export function generoPorNombre(primerNombre: string): Genero {
  const n = claveNombreEstudiante(primerNombre).split(' ')[0] ?? '';
  if (!n) return 'F';
  if (MASCULINOS_CON_A.has(n)) return 'M';
  if (FEMENINOS_SIN_A.has(n)) return 'F';
  return n.endsWith('A') ? 'F' : 'M';
}

function moda(valores: string[]): string {
  const c = new Map<string, number>();
  for (const v of valores) if (v) c.set(v, (c.get(v) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? '';
}

/** ¿Es el listado por materia de la universidad? (alguna hoja con columnas NRC y PARALELO) */
export function esFormatoNrc(hojas: HojaCruda[]): boolean {
  return hojas.some((h) => { const enc = (h.filas[0] ?? []).map(normalizarClave); return enc.includes('nrc') && enc.some((x) => x.startsWith('paralelo')); });
}

/** Listado por materia: una hoja por materia-paralelo (fila 1: nombre de la materia, PARALELO, NRC; filas: N.º, "NOMBRE, APELLIDO/APELLIDO I.", paralelo, NRC).
 *  Devuelve cada estudiante una sola vez con todos sus NRC, el paralelo más frecuente y las materias encontradas. */
export function parseEstudiantesNrc(hojas: HojaCruda[]): { ok: EstudianteNrcImportado[]; materias: MateriaNrc[]; errores: string[] } {
  const porClave = new Map<string, { nombre: string; primerNombre: string; paralelos: string[]; nrcs: Set<string> }>();
  const materias: MateriaNrc[] = []; const errores: string[] = [];
  for (const h of hojas) {
    const enc = (h.filas[0] ?? []).map(normalizarClave);
    const iNrc = enc.indexOf('nrc'); const iPar = enc.findIndex((x) => x.startsWith('paralelo'));
    if (iNrc < 0) { if (h.filas.length) errores.push(`Hoja "${h.nombre}": sin columna NRC`); continue; }
    const materia = limpiarTexto((h.filas[0] ?? []).filter((c, i) => i !== iNrc && i !== iPar && /[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]/i.test(c)).sort((a, b) => b.length - a.length)[0] ?? h.nombre);
    let nrcHoja = '', parHoja = '', n = 0;
    for (const f of h.filas.slice(1)) {
      const nrc = limpiarTexto(f[iNrc] ?? '').replace(/\D/g, '');
      const crudo = limpiarTexto(f.find((c, i) => i !== iNrc && i !== iPar && /[a-z\u00e1\u00e9\u00ed\u00f3\u00fa\u00f1]/i.test(c)) ?? '');
      if (!crudo || !nrc) continue;
      const paralelo = limpiarTexto(iPar >= 0 ? f[iPar] ?? '' : '').toUpperCase();
      const clave = claveNombreEstudiante(crudo);
      const nf = formatearNombreNrc(crudo);
      const e = porClave.get(clave) ?? { nombre: nf.nombre, primerNombre: nf.primerNombre, paralelos: [], nrcs: new Set<string>() };
      e.nrcs.add(nrc);
      if (paralelo) e.paralelos.push(paralelo.replace(/\d+$/, '') || paralelo); // C1 → C (subgrupo de laboratorio)
      porClave.set(clave, e); n++; nrcHoja = nrcHoja || nrc; parHoja = parHoja || paralelo;
    }
    if (!n) errores.push(`Hoja "${h.nombre}": sin estudiantes legibles`);
    else if (!materias.some((m) => m.nrc === nrcHoja)) materias.push({ nrc: nrcHoja, materia, paralelo: parHoja, semestre: semestreDeHoja(h.nombre) });
  }
  const ok = [...porClave.entries()].map(([clave, e]) => ({ clave, nombre: e.nombre, primerNombre: e.primerNombre, paralelo: moda(e.paralelos), nrcs: [...e.nrcs].sort() }));
  return { ok, materias, errores };
}
