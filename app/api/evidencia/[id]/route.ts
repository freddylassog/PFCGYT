import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sesionCoordinacion } from '@/lib/sesion';
import { urlEvidencia } from '@/lib/storage';

export const dynamic = 'force-dynamic';

/** Redirige a una URL temporal de la evidencia del pedido (solo coordinación). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await sesionCoordinacion())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { id } = await params;
  const sql = db();
  const filas = await sql`select evidencia_path from requests where id = ${id}`;
  const path = filas[0]?.evidencia_path as string | null | undefined;
  if (!path) return NextResponse.json({ error: 'Sin evidencia' }, { status: 404 });
  const url = await urlEvidencia(path);
  if (!url) return NextResponse.json({ error: 'No se pudo generar el enlace' }, { status: 500 });
  return NextResponse.redirect(url);
}
