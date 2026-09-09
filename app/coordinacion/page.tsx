import { cargarDatos } from '@/lib/datos';
import { sesionCoordinacion } from '@/lib/sesion';
import { LoginCoordinacion } from '@/components/coordinacion/LoginCoordinacion';
import { Panel } from '@/components/coordinacion/Panel';

export const dynamic = 'force-dynamic';

type Params = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: Params }) {
  const sp = await searchParams;
  const uno = (k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : sp[k]) as string | undefined;
  const sesion = await sesionCoordinacion();
  if (!sesion) {
    const q = new URLSearchParams();
    if (uno('tab')) q.set('tab', uno('tab')!);
    if (uno('sel')) q.set('sel', uno('sel')!);
    return <LoginCoordinacion destino={'/coordinacion' + (q.size ? '?' + q.toString() : '')} />;
  }
  const datos = await cargarDatos();
  return <Panel datos={datos} tab={uno('tab') ?? 'pedidos'} selInicial={uno('sel') ?? null} />;
}
