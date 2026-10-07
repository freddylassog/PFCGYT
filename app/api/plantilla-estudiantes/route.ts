import { NextResponse } from 'next/server';
import { cargarDatos } from '@/lib/datos';
import { generarPlantillaEstudiantes } from '@/lib/excel';
import { sesionCoordinacion } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

/** Plantilla (Nombre, Correo, Semestre, Paralelo, Género) con los estudiantes activos, para completar correos y género y volver a cargarla. */
export async function GET() {
  if (!(await sesionCoordinacion())) return NextResponse.redirect(new URL('/coordinacion', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  const datos = await cargarDatos();
  const buf = await generarPlantillaEstudiantes(datos);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="estudiantes-${datos.ajustes.periodo}-completar.xlsx"`,
    },
  });
}
