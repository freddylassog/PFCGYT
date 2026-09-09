import { hoyISO } from '@/lib/reglas';
import { FormularioPedido } from '@/components/solicitante/FormularioPedido';

export const dynamic = 'force-dynamic';

export default function Page() {
  return <FormularioPedido hoy={hoyISO()} />;
}
