import { ajustesActuales } from '@/lib/datos';
import { anticipacionVigente, hoyISO } from '@/lib/reglas';
import { FormularioPedido } from '@/components/solicitante/FormularioPedido';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const hoy = hoyISO();
  const a = await ajustesActuales();
  const horas = anticipacionVigente(a, hoy);
  return <FormularioPedido hoy={hoy} anticipacion={{ horas, hasta: horas !== 72 ? a.anticipacionHasta : '' }} />;
}
