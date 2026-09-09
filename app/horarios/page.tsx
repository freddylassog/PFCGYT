import { cargarDatos } from '@/lib/datos';
import { sesionCoordinacion } from '@/lib/sesion';
import { LoginCoordinacion } from '@/components/coordinacion/LoginCoordinacion';
import { Horarios } from '@/components/horarios/Horarios';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (!(await sesionCoordinacion())) return <LoginCoordinacion destino="/horarios" />;
  const datos = await cargarDatos();
  return <Horarios datos={datos} />;
}
