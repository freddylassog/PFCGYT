import { NextResponse } from 'next/server';
import { cargarDatos } from '@/lib/datos';
import { generarReporte } from '@/lib/excel';
import { sesionCoordinacion } from '@/lib/sesion';
import type { Semestre } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!(await sesionCoordinacion())) return NextResponse.redirect(new URL('/coordinacion', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  const datos = await cargarDatos();
  const n = Number(new URL(req.url).searchParams.get('sem'));
  const sem = [1, 2, 3].includes(n) ? (n as Semestre) : undefined;
  const buf = await generarReporte(datos, sem);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="reporte-protocolo-${sem ? `${sem}-semestre-` : ''}${datos.ajustes.periodo}.xlsx"`,
    },
  });
}
