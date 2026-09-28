import { NextResponse } from 'next/server';
import { generarActa } from '@/lib/acta';
import { cargarDatos } from '@/lib/datos';
import { sesionCoordinacion, tokenActaValido } from '@/lib/sesion';
import { vistaPedido } from '@/lib/vista';

export const dynamic = 'force-dynamic';

/** Acta de compromiso en PDF. La abre coordinación (con sesión) o el solicitante con el enlace firmado (?t=). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = new URL(req.url).searchParams.get('t');
  if (!tokenActaValido(id, t) && !(await sesionCoordinacion())) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const datos = await cargarDatos();
  const p = datos.pedidos.find((x) => x.id === id);
  if (!p) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  const pdf = await generarActa(vistaPedido(datos, p), datos.ajustes.periodo);
  return new NextResponse(new Uint8Array(pdf), {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="acta-${p.codigo}.pdf"`, 'cache-control': 'private, no-store' },
  });
}
