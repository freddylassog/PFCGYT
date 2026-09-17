import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cargarDatos } from '@/lib/datos';
import { avisarCoordinacion, enviarDirecto, publicarEnCanal } from '@/lib/notificar';
import { mensajeRecordatorioCanal, mensajeRecordatorioPersonal, mensajeUniformesRecordatorioCanal, mensajeUniformesRecordatorioPersonal, type TipoCita } from '@/lib/notificar-texto';
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
  const todos = vistaPedidos(datos);
  const pedidos = todos.filter((p) => p.estado === 'Aprobado' && !p.finalizado && p.dias.some((d) => d.fecha === manana));
  // Entregas y devoluciones de uniformes de mañana (también de eventos ya finalizados: la devolución suele ser después).
  const citas = todos.flatMap((p) => {
    const c = p.uniformeCita;
    if (p.estado !== 'Aprobado' || !c || !p.confirmadosN) return [];
    const items: { p: typeof p; c: typeof c; tipo: TipoCita }[] = [];
    if (c.entregaFecha === manana) items.push({ p, c, tipo: 'entrega' });
    if (c.devolucionFecha === manana) items.push({ p, c, tipo: 'devolucion' });
    return items;
  });
  const sql = db();
  await sql`update settings set ultimo_recordatorio = ${datos.hoy} where periodo = ${datos.ajustes.periodo}`;
  if (!pedidos.length && !citas.length) return NextResponse.json({ ok: true, detalle: 'Sin eventos ni citas de uniformes mañana' });
  const texto = mensajeRecordatorioCanal(pedidos, manana);
  const textoUniformes = mensajeUniformesRecordatorioCanal(citas, manana);
  const resultado: Record<string, string> = {};
  if (datos.notificaciones.canalEstudiantes) {
    for (const t of [texto, textoUniformes]) if (t) { try { await publicarEnCanal(t, datos.ajustes); resultado.canal = 'publicado'; } catch (e) { resultado.canal = (e as Error).message; } }
  }
  // Recordatorio personal a cada confirmado que vinculó Telegram.
  let personales = 0;
  for (const p of pedidos) {
    const dia = p.dias.find((d) => d.fecha === manana)!;
    for (const e of p.confirmados) if (e.telegramChatId && (await enviarDirecto(e.telegramChatId, mensajeRecordatorioPersonal(p, dia, e)))) personales++;
  }
  for (const { p, c, tipo } of citas) for (const e of p.confirmados) if (e.telegramChatId && (await enviarDirecto(e.telegramChatId, mensajeUniformesRecordatorioPersonal(p, c, tipo, e)))) personales++;
  resultado.personales = String(personales);
  const resumen = [...pedidos.map((p) => `${p.evento} (${p.confirmadosN}/${p.cantidad} confirmados)`), ...citas.map(({ p, tipo }) => `${tipo === 'entrega' ? 'entrega' : 'devolución'} de uniformes · ${p.evento}`)];
  await avisarCoordinacion(`Mañana: ${resumen.join(' · ')}`, datos.ajustes);
  return NextResponse.json({ ok: true, eventos: pedidos.map((p) => p.codigo), ...resultado });
}
