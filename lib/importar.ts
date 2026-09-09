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
export interface ClaseImportada { semestre: Semestre; paralelo: string; dia: number; inicio: string; fin: string; materia: string; correoDocente: string; docenteNombre: string }

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
    if (!materia || !semestre) {
      if (materia || docenteNombre) errores.push(`Fila ${i + 2}: ${!materia ? 'falta asignatura' : 'nivel fuera de 1–3'}`);
      return;
    }
    let alguno = false;
    for (const [dia, n] of DIAS_ANCHO) {
      for (const r of parseRangos(f[dia] ?? '')) {
        alguno = true;
        ok.push({ semestre, paralelo, dia: n, inicio: r.inicio, fin: r.fin, materia, correoDocente: correoDocente.includes('@') ? correoDocente : '', docenteNombre });
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
    const faltan = [!semestre && 'semestre', !dia && 'día (Lunes…Viernes)', !inicio && 'inicio (HH:MM)', !fin && 'fin (HH:MM)', !materia && 'materia'].filter(Boolean);
    if (faltan.length) errores.push(`Fila ${i + 2}: falta ${faltan.join(', ')}`);
    else if (inicio! >= fin!) errores.push(`Fila ${i + 2}: la hora de fin debe ser mayor que la de inicio`);
    else ok.push({ semestre: semestre!, paralelo, dia: dia!, inicio: inicio!, fin: fin!, materia, correoDocente: correoDocente.includes('@') ? correoDocente : '', docenteNombre: docenteNombre.includes('@') ? '' : docenteNombre });
  });
  return { ok, errores };
}

