import 'server-only';
import { cookies } from 'next/headers';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_COORD = 'pf_coord';
const COOKIE_EST = 'pf_est';
const HORAS_COORD = 12;
const HORAS_EST = 8;

function secreto(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  // Si no se define SESSION_SECRET, se deriva de la contraseña de coordinación.
  return createHash('sha256').update('protocolo-fcgt:' + (process.env.COORDINACION_PASSWORD ?? '')).digest('hex');
}

function firmar(payload: object): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secreto()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verificar<T extends { exp: number }>(token: string | undefined): T | null {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const esperada = createHmac('sha256', secreto()).update(data).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as T;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

function opciones(maxAgeSeg: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeg,
  };
}

// ---------------------------------------------------------------- coordinación

export interface SesionCoordinacion { rol: 'coordinacion'; exp: number }

export async function sesionCoordinacion(): Promise<SesionCoordinacion | null> {
  const jar = await cookies();
  const s = verificar<SesionCoordinacion>(jar.get(COOKIE_COORD)?.value);
  return s && s.rol === 'coordinacion' ? s : null;
}

export async function iniciarSesionCoordinacion(): Promise<void> {
  const jar = await cookies();
  const exp = Date.now() + HORAS_COORD * 3600 * 1000;
  jar.set(COOKIE_COORD, firmar({ rol: 'coordinacion', exp }), opciones(HORAS_COORD * 3600));
}

export function passwordCoordinacionOk(pass: string): boolean {
  const esperado = process.env.COORDINACION_PASSWORD;
  if (!esperado) return false;
  const a = Buffer.from(pass), b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------- estudiante

export interface SesionEstudiante { rol: 'estudiante'; studentId: string; exp: number }

export async function sesionEstudiante(): Promise<SesionEstudiante | null> {
  const jar = await cookies();
  const s = verificar<SesionEstudiante>(jar.get(COOKIE_EST)?.value);
  return s && s.rol === 'estudiante' && s.studentId ? s : null;
}

export async function iniciarSesionEstudiante(studentId: string): Promise<void> {
  const jar = await cookies();
  const exp = Date.now() + HORAS_EST * 3600 * 1000;
  jar.set(COOKIE_EST, firmar({ rol: 'estudiante', studentId, exp }), opciones(HORAS_EST * 3600));
}

// ---------------------------------------------------------------- salir

export async function cerrarSesiones(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_COORD);
  jar.delete(COOKIE_EST);
}
