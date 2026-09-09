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

export interface EstudianteImportado { nombre: string; correo: string; semestre: Semestre; genero: Genero }
export interface DocenteImportado { nombre: string; correo: string }
export interface ClaseImportada { semestre: Semestre; dia: number; inicio: string; fin: string; materia: string; correoDocente: string }

export function parseEstudiantes(filas: Fila[]): { ok: EstudianteImportado[]; errores: string[] } {
  const ok: EstudianteImportado[] = [], errores: string[] = [];
  filas.forEach((f, i) => {
    const nombre = col(f, 'Nombre', 'Estudiante', 'Nombres', 'Nombre completo');
    const correo = col(f, 'Correo', 'Email', 'Correo electrónico', 'E-mail', 'Correo institucional').toLowerCase();
    const semestre = parseSemestre(col(f, 'Semestre', 'Nivel'));
    const genero = parseGenero(col(f, 'Género', 'Genero', 'Sexo'));
    const faltan = [!nombre && 'nombre', !correo.includes('@') && 'correo', !semestre && 'semestre (1–3)', !genero && 'género (F/M)'].filter(Boolean);
    if (faltan.length) errores.push(`Fila ${i + 2}: falta ${faltan.join(', ')}`);
    else ok.push({ nombre, correo, semestre: semestre!, genero: genero! });
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
  const ok: ClaseImportada[] = [], errores: string[] = [];
  filas.forEach((f, i) => {
    const semestre = parseSemestre(col(f, 'Semestre', 'Nivel'));
    const dia = parseDia(col(f, 'Día', 'Dia'));
    const inicio = parseHora(col(f, 'Inicio', 'Hora inicio', 'Desde'));
    const fin = parseHora(col(f, 'Fin', 'Hora fin', 'Hasta'));
    const materia = col(f, 'Materia', 'Asignatura');
    const correoDocente = col(f, 'Correo docente', 'Docente correo', 'Correo del docente', 'Email docente', 'Correo', 'Docente').toLowerCase();
    const faltan = [!semestre && 'semestre', !dia && 'día (Lunes…Viernes)', !inicio && 'inicio (HH:MM)', !fin && 'fin (HH:MM)', !materia && 'materia'].filter(Boolean);
    if (faltan.length) errores.push(`Fila ${i + 2}: falta ${faltan.join(', ')}`);
    else if (inicio! >= fin!) errores.push(`Fila ${i + 2}: la hora de fin debe ser mayor que la de inicio`);
    else ok.push({ semestre: semestre!, dia: dia!, inicio: inicio!, fin: fin!, materia, correoDocente: correoDocente.includes('@') ? correoDocente : '' });
  });
  return { ok, errores };
}

