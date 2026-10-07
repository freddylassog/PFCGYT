import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cargarDatos } from '@/lib/datos';
import { avisarCoordinacion, enviarDirecto, publicarEnCanal } from '@/lib/notificar';
import { mensajeDevolucionCanal, mensajeDevolucionCoordinacion, mensajeDevolucionPersonal, mensajeRecordatorioCanal, mensajeRecordatorioPersonal, mensajeUniformesRecordatorioCanal, mensajeUniformesRecordatorioPersonal, type TipoCita } from '@/lib/notificar-texto';
import { faseDevolucion, sumarDias } from '@/lib/reglas';
import { confirmadosEnDia, pendientesDevolucion, ultimoDiaDe, vistaPedidos } from '@/lib/vista';

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
  // Devoluciones de uniformes pendientes: aviso el día después del evento, 2 días antes del plazo, el día del plazo y al vencer.
  const devoluciones = todos.flatMap((p) => pendientesDevolucion(p, datos.hoy).map(({ e, estado, limite }) => ({ p, e, estado, limite, fase: estado.clave === 'rechazado' ? null : faseDevolucion(ultimoDiaDe(p, e.id), limite, datos.hoy) })));
  const avisosDevolucion = devoluciones.filter((x) => x.fase);
  const vencidos = devoluciones.filter((x) => x.estado.clave === 'vencido' || x.estado.clave === 'rechazado');
  const sql = db();
  await sql`update settings set ultimo_recordatorio = ${datos.hoy} where periodo = ${datos.ajustes.periodo}`;
  if (!pedidos.length && !citas.length && !avisosDevolucion.length && !vencidos.length) return NextResponse.json({ ok: true, detalle: 'Sin eventos, citas de uniformes ni devoluciones que avisar' });
  const texto = mensajeRecordatorioCanal(pedidos, manana);
  const textoUniformes = mensajeUniformesRecordatorioCanal(citas, manana);
  // En el canal solo un aviso por evento (sin nombres), el día después del evento y 2 días antes del plazo.
  const porEvento = new Map<string, { p: (typeof avisosDevolucion)[number]['p']; fase: NonNullable<(typeof avisosDevolucion)[number]['fase']> }>();
  for (const x of avisosDevolucion) if (x.fase && (x.fase === 'inicio' || x.fase === 'recordatorio') && !porEvento.has(p0(x.p.id, x.fase))) porEvento.set(p0(x.p.id, x.fase), { p: x.p, fase: x.fase });
  const textoDevolucion = mensajeDevolucionCanal([...porEvento.values()]);
  const resultado: Record<string, string> = {};
  if (datos.notificaciones.canalEstudiantes) {
    for (const t of [texto, textoUniformes, textoDevolucion]) if (t) { try { await publicarEnCanal(t, datos.ajustes); resultado.canal = 'publicado'; } catch (e) { resultado.canal = (e as Error).message; } }
  }
  // Recordatorio personal a cada confirmado que vinculó Telegram.
  let personales = 0;
  for (const p of pedidos) {
    const dia = p.dias.find((d) => d.fecha === manana)!;
    for (const e of confirmadosEnDia(p, manana)) if (e.telegramChatId && (await enviarDirecto(e.telegramChatId, mensajeRecordatorioPersonal(p, dia, e)))) personales++;
  }
  for (const { p, c, tipo } of citas) for (const e of p.confirmados) if (e.telegramChatId && (await enviarDirecto(e.telegramChatId, mensajeUniformesRecordatorioPersonal(p, c, tipo, e)))) personales++;
  // Devolución del uniforme: mensaje personal a cada pendiente que vinculó Telegram, según la fase del plazo.
  for (const { p, e, limite, fase } of avisosDevolucion) if (fase && e.telegramChatId && (await enviarDirecto(e.telegramChatId, mensajeDevolucionPersonal(p, e, limite, fase)))) personales++;
  resultado.personales = String(personales);
  resultado.devoluciones = String(avisosDevolucion.length);
  resultado.vencidos = String(vencidos.length);
  const resumen = [...pedidos.map((p) => `${p.evento} (${p.confirmadosN}/${p.cantidad} confirmados)`), ...citas.map(({ p, tipo }) => `${tipo === 'entrega' ? 'entrega' : 'devolución'} de uniformes · ${p.evento}`)];
  const lineas = [resumen.length ? `Mañana: ${resumen.join(' · ')}` : '', mensajeDevolucionCoordinacion(vencidos.map(({ p, e, limite }) => ({ p, e, limite })), devoluciones.length - vencidos.length) ?? ''].filter(Boolean);
  if (lineas.length) await avisarCoordinacion(lineas.join('\n'), datos.ajustes);
  return NextResponse.json({ ok: true, eventos: pedidos.map((p) => p.codigo), ...resultado });
}

function p0(id: string, fase: string): string { return `${id}:${fase}`; }

