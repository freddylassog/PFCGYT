import { cargarDatos } from '@/lib/datos';
import { sesionEstudiante } from '@/lib/sesion';
import { LoginEstudiante } from '@/components/estudiante/LoginEstudiante';
import { MisEventos } from '@/components/estudiante/MisEventos';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const clave = (Array.isArray(sp.clave) ? sp.clave[0] : sp.clave) ?? '';
  const sesion = await sesionEstudiante();
  if (!sesion) return <LoginEstudiante clave={clave} />;
  const datos = await cargarDatos();
  const yo = datos.estudiantes.find((e) => e.id === sesion.studentId && e.activo);
  if (!yo) return <LoginEstudiante clave={clave} />;
  return <MisEventos datos={datos} yo={yo} />;
}
