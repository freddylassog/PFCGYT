import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { appUrl } from '@/lib/app-url';
import { cargarDatos } from '@/lib/datos';
import { calendarioICS } from '@/lib/ics';
import { asegurarEsquema } from '@/lib/migrar';

export const dynamic = 'force-dynamic';

/** Calendario suscrito (.ics) de coordinación. El token es el enlace privado creado en Resumen. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const limpio = (token || '').replace(/\.ics$/i, '');
  if (!/^[a-f0-9]{32}$/.test(limpio)) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  await asegurarEsquema();
  const [fila] = await db()`select periodo from settings where calendario_token = ${limpio} limit 1`;
  if (!fila) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  const datos = await cargarDatos();
  return new NextResponse(calendarioICS(datos, appUrl()), {
    headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="protocolo-fcgt.ics"', 'cache-control': 'private, max-age=300' },
  });
}
