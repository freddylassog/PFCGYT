import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BUCKET = 'evidencias';

function supabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
}

/** Sin claves de Supabase la app guarda las evidencias en disco (solo para
 *  desarrollo local). En Vercel el disco no persiste: allí siempre Supabase. */
export function storageLocal(): boolean {
  return !process.env.SUPABASE_SERVICE_ROLE_KEY || !supabaseUrl();
}

function cliente() {
  return createClient(supabaseUrl()!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function dirLocal(): string {
  return process.env.EVIDENCIAS_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), '.data', 'evidencias');
}

function limpiarNombre(nombre: string): string {
  const base = nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return base.slice(0, 80) || 'archivo';
}

export interface SubidaPreparada {
  path: string;
  url: string;
}

/** Prepara una URL a la que el navegador sube el archivo directamente (PUT). */
export async function prepararSubida(periodo: string, nombre: string): Promise<SubidaPreparada> {
  const ruta = `${periodo}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${limpiarNombre(nombre)}`;
  if (storageLocal()) {
    return { path: ruta, url: `/api/evidencia/local?path=${encodeURIComponent(ruta)}` };
  }
  const { data, error } = await cliente().storage.from(BUCKET).createSignedUploadUrl(ruta);
  if (error || !data) throw new Error('No se pudo preparar la subida: ' + (error?.message ?? 'sin datos'));
  return { path: ruta, url: data.signedUrl };
}

/** URL temporal (1 h) para que coordinación vea la evidencia. */
export async function urlEvidencia(ruta: string): Promise<string | null> {
  if (storageLocal()) return `/api/evidencia/local?path=${encodeURIComponent(ruta)}`;
  const { data, error } = await cliente().storage.from(BUCKET).createSignedUrl(ruta, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

/** ¿Existe el archivo? (se usa para verificar que la subida terminó bien) */
export async function evidenciaExiste(ruta: string): Promise<boolean> {
  if (storageLocal()) {
    try { await readFile(archivoLocal(ruta)); return true; } catch { return false; }
  }
  const carpeta = ruta.split('/').slice(0, -1).join('/');
  const nombre = ruta.split('/').pop()!;
  const { data } = await cliente().storage.from(BUCKET).list(carpeta, { search: nombre, limit: 5 });
  return !!data?.some((f) => f.name === nombre);
}

// ---------------------------------------------------------------- modo local

function archivoLocal(ruta: string): string {
  const seguro = path.normalize(ruta).replace(/^(\.\.[/\\])+/, '');
  const completo = path.join(/*turbopackIgnore: true*/ dirLocal(), seguro);
  if (!completo.startsWith(dirLocal())) throw new Error('Ruta inválida');
  return completo;
}

export async function guardarLocal(ruta: string, contenido: Buffer): Promise<void> {
  const destino = archivoLocal(ruta);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, contenido);
}

export async function leerLocal(ruta: string): Promise<Buffer> {
  return readFile(archivoLocal(ruta));
}
