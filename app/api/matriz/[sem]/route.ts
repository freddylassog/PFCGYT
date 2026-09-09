import { NextResponse } from 'next/server';
import { cargarDatos } from '@/lib/datos';
import { generarMatriz } from '@/lib/excel';
import { sesionCoordinacion } from '@/lib/sesion';
import type { Semestre } from '@/lib/tipos';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ sem: string }> }) {
  if (!(await sesionCoordinacion())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const { sem } = await params;
  const n = Number(sem);
  if (![1, 2, 3].includes(n)) return NextResponse.json({ error: 'Semestre inválido' }, { status: 400 });
  const datos = await cargarDatos();
  const buf = await generarMatriz(datos, n as Semestre);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="matriz-protocolo-${n}-semestre-${datos.ajustes.periodo}.xlsx"`,
    },
  });
}
