import { cargarDatos } from '@/lib/datos';
import { sesionCoordinacion } from '@/lib/sesion';
import { LoginCoordinacion } from '@/components/coordinacion/LoginCoordinacion';
import { Horarios } from '@/components/horarios/Horarios';

export const dynamic = 'force-dynamic';
// Las importaciones de Excel y los avisos pueden tardar más de los 10 s por defecto de Vercel.
export const maxDuration = 60;

export default async function Page() {
  if (!(await sesionCoordinacion())) return <LoginCoordinacion destino="/horarios" />;
  const datos = await cargarDatos();
  return <Horarios datos={datos} />;
}
