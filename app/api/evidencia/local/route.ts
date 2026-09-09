import { NextResponse } from 'next/server';
import { guardarLocal, leerLocal, storageLocal } from '@/lib/storage';
import { sesionCoordinacion } from '@/lib/sesion';

// Solo para desarrollo local sin Supabase: guarda y sirve evidencias desde disco.
export const dynamic = 'force-dynamic';

function ruta(req: Request): string | null {
  const p = new URL(req.url).searchParams.get('path');
  return p && !p.includes('..') ? p : null;
}

export async function PUT(req: Request) {
  if (!storageLocal()) return NextResponse.json({ error: 'No disponible' }, { status: 404 });
  const p = ruta(req);
  if (!p) return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
  const buf = Buffer.from(await req.arrayBuffer());
  await guardarLocal(p, buf);
  return NextResponse.json({ ok: true });
}

export async function GET(req: Request) {
  if (!storageLocal()) return NextResponse.json({ error: 'No disponible' }, { status: 404 });
  if (!(await sesionCoordinacion())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const p = ruta(req);
  if (!p) return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
  try {
    const buf = await leerLocal(p);
    const tipo = /\.pdf$/i.test(p) ? 'application/pdf' : /\.(png)$/i.test(p) ? 'image/png' : /\.(jpe?g)$/i.test(p) ? 'image/jpeg' : 'application/octet-stream';
    return new NextResponse(new Uint8Array(buf), { headers: { 'content-type': tipo, 'content-disposition': 'inline' } });
  } catch {
    return NextResponse.json({ error: 'No existe' }, { status: 404 });
  }
}
