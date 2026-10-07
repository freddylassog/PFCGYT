import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ajustesActuales, cargarDatos } from '@/lib/datos';
import { enviarDirecto, secretoWebhook } from '@/lib/notificar';
import { mensajeBienvenidaBot, mensajeCorreoEnUso, mensajeCorreoGuardado, mensajeCorreoNoEncontrado, mensajeNoEntendido, mensajeVariosNombres, mensajeVinculado } from '@/lib/notificar-texto';
import { candidatosPorNombre } from '@/lib/importar';
import { normalizarCorreo } from '@/lib/reglas';
import { avanceEstudiante } from '@/lib/vista';

export const dynamic = 'force-dynamic';
// Las importaciones de Excel y los avisos pueden tardar más de los 10 s por defecto de Vercel.
export const maxDuration = 60;

interface Chat { id: number; type: string; title?: string; first_name?: string; last_name?: string; username?: string }
interface Update {
  message?: { chat: Chat; text?: string; from?: { first_name?: string; last_name?: string; username?: string } };
  channel_post?: { chat: Chat };
  my_chat_member?: { chat: Chat; new_chat_member?: { status?: string } };
}

// Telegram llama aquí con cada mensaje que recibe el bot. Responde siempre 200
// para que Telegram no reintente.
export async function POST(req: Request) {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== secretoWebhook()) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  let u: Update;
  try { u = (await req.json()) as Update; } catch { return NextResponse.json({ ok: true }); }
  try {
    const sql = db();
    const ajustes = await ajustesActuales();

    // Canal o grupo donde el bot fue agregado como administrador: se guarda si aún no hay canal.
    const canal = u.channel_post?.chat ?? (u.my_chat_member?.new_chat_member?.status === 'administrator' ? u.my_chat_member.chat : undefined);
    if (canal && ['channel', 'supergroup', 'group'].includes(canal.type) && !ajustes.telegramCanalId) {
      await sql`update settings set telegram_canal_id = ${String(canal.id)}, telegram_canal_nombre = ${canal.title || canal.username || String(canal.id)} where periodo = ${ajustes.periodo}`;
      return NextResponse.json({ ok: true });
    }

    const m = u.message;
    if (!m || m.chat.type !== 'private') return NextResponse.json({ ok: true });
    const chatId = String(m.chat.id);
    const texto = (m.text || '').trim();
    if (chatId === ajustes.telegramChatId) return NextResponse.json({ ok: true }); // coordinación: no se responde

    if (/^\/start/i.test(texto) || !texto) {
      await enviarDirecto(chatId, mensajeBienvenidaBot());
      return NextResponse.json({ ok: true });
    }
    const nombreTg = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') || m.from?.username || null;
    const vincular = async (studentId: string) => {
      await sql`insert into telegram_vinculos (chat_id, student_id, nombre) values (${chatId}, ${studentId}, ${nombreTg})
        on conflict (chat_id) do update set student_id = excluded.student_id, nombre = excluded.nombre, at = now()`;
      const datos = await cargarDatos();
      const e = datos.estudiantes.find((x) => x.id === studentId);
      if (e) await enviarDirecto(chatId, mensajeVinculado(e, avanceEstudiante(datos, e.id).eventosN));
    };
    const correo = normalizarCorreo((texto.match(/[^\s@]+@[^\s@]+\.[^\s@]+/) || [''])[0]);
    if (correo) {
      const [st] = await sql`select id from students where periodo = ${ajustes.periodo} and activo and correo = ${correo}`;
      if (st) { await vincular(String(st.id)); return NextResponse.json({ ok: true }); }
      // El chat ya está vinculado por nombre y la ficha no tiene correo: se guarda para que pueda entrar al portal.
      const [v] = await sql`select v.student_id, s.nombre, s.correo from telegram_vinculos v join students s on s.id = v.student_id where v.chat_id = ${chatId}`;
      if (v) {
        const [otro] = await sql`select id from students where periodo = ${ajustes.periodo} and correo = ${correo} and id <> ${v.student_id}`;
        if (otro) { await enviarDirecto(chatId, mensajeCorreoEnUso(correo)); return NextResponse.json({ ok: true }); }
        if (v.correo && String(v.correo) !== correo) { await enviarDirecto(chatId, `Tu ficha ya tiene el correo ${v.correo}. Si está mal, avisa a coordinación.`); return NextResponse.json({ ok: true }); }
        await sql`update students set correo = ${correo} where id = ${v.student_id}`;
        await enviarDirecto(chatId, mensajeCorreoGuardado(String(v.nombre), correo));
        return NextResponse.json({ ok: true });
      }
      await enviarDirecto(chatId, mensajeCorreoNoEncontrado(correo));
      return NextResponse.json({ ok: true });
    }
    // Nombre completo tal como está en la lista (los listados de la universidad no traen correo).
    const activos = await sql`select id, nombre, semestre from students where periodo = ${ajustes.periodo} and activo`;
    const candidatos = candidatosPorNombre(activos.map((r) => ({ id: String(r.id), nombre: String(r.nombre), semestre: Number(r.semestre) })), texto);
    if (candidatos.length === 1) { await vincular(candidatos[0].id); return NextResponse.json({ ok: true }); }
    if (candidatos.length > 1) { await enviarDirecto(chatId, mensajeVariosNombres(candidatos.map((c) => `${c.nombre} (${c.semestre}.º)`))); return NextResponse.json({ ok: true }); }
    await enviarDirecto(chatId, mensajeNoEntendido());
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[telegram webhook]', (e as Error).message);
    return NextResponse.json({ ok: true });
  }
}
