import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cargarDatos } from '@/lib/datos';
import { avisarCoordinacion, enviarDirecto, publicarEnCanal } from '@/lib/notificar';
import { mensajeRecordatorioCanal, mensajeRecordatorioPersonal } from '@/lib/notificar-texto';
import { sumarDias } from '@/lib/reglas';
import { vistaPedidos } from '@/lib/vista';

export const dynamic = 'force-dynamic';

// Vercel lo llama una vez al día (vercel.json). Publica en el canal de
// estudiantes los eventos que tienen participación mañana. Es idempotente:
// aunque se llame varias veces, solo publica una vez por día.
export async function GET(req: Request) {
  const secreto = process.env.CRON_SECRET;
  if (secreto && req.headers.get('authorization') !== `Bearer ${secreto}`) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  const datos = await cargarDatos();
  if (datos.ajustes.ultimoRecordatorio === datos.hoy) return NextResponse.json({ ok: true, detalle: 'Ya se envió hoy' });
  const manana = sumarDias(datos.hoy, 1);
  const pedidos = vistaPedidos(datos).filter((p) => p.estado === 'Aprobado' && !p.finalizado && p.dias.some((d) => d.fecha === manana));
  const sql = db();
  await sql`update settings set ultimo_recordatorio = ${datos.hoy} where periodo = ${datos.ajustes.periodo}`;
  if (!pedidos.length) return NextResponse.json({ ok: true, detalle: 'Sin eventos mañana' });
  const texto = mensajeRecordatorioCanal(pedidos, manana);
  const resultado: Record<string, string> = {};
  if (texto && datos.notificaciones.canalEstudiantes) {
    try { await publicarEnCanal(texto, datos.ajustes); resultado.canal = 'publicado'; } catch (e) { resultado.canal = (e as Error).message; }
  }
  // Recordatorio personal a cada confirmado que vinculó Telegram.
  let personales = 0;
  for (const p of pedidos) {
    const dia = p.dias.find((d) => d.fecha === manana)!;
    for (const e of p.confirmados) if (e.telegramChatId && (await enviarDirecto(e.telegramChatId, mensajeRecordatorioPersonal(p, dia, e)))) personales++;
  }
  resultado.personales = String(personales);
  await avisarCoordinacion(`Mañana: ${pedidos.map((p) => `${p.evento} (${p.confirmadosN}/${p.cantidad} confirmados)`).join(' · ')}`, datos.ajustes);
  return NextResponse.json({ ok: true, eventos: pedidos.map((p) => p.codigo), ...resultado });
}
