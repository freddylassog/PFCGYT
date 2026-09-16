import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ajustesActuales, cargarDatos } from '@/lib/datos';
import { enviarDirecto, secretoWebhook } from '@/lib/notificar';
import { mensajeBienvenidaBot, mensajeCorreoNoEncontrado, mensajeNoEntendido, mensajeVinculado } from '@/lib/notificar-texto';
import { normalizarCorreo } from '@/lib/reglas';
import { avanceEstudiante } from '@/lib/vista';

export const dynamic = 'force-dynamic';

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
    const correo = normalizarCorreo((texto.match(/[^\s@]+@[^\s@]+\.[^\s@]+/) || [''])[0]);
    if (!correo) {
      await enviarDirecto(chatId, mensajeNoEntendido());
      return NextResponse.json({ ok: true });
    }
    const [st] = await sql`select id, nombre from students where periodo = ${ajustes.periodo} and activo and correo = ${correo}`;
    if (!st) {
      await enviarDirecto(chatId, mensajeCorreoNoEncontrado(correo));
      return NextResponse.json({ ok: true });
    }
    const nombreTg = [m.from?.first_name, m.from?.last_name].filter(Boolean).join(' ') || m.from?.username || null;
    await sql`insert into telegram_estudiantes (correo, chat_id, nombre) values (${correo}, ${chatId}, ${nombreTg})
      on conflict (correo) do update set chat_id = excluded.chat_id, nombre = excluded.nombre`;
    const datos = await cargarDatos();
    const e = datos.estudiantes.find((x) => x.id === String(st.id));
    if (e) await enviarDirecto(chatId, mensajeVinculado(e, avanceEstudiante(datos, e.id).eventosN));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[telegram webhook]', (e as Error).message);
    return NextResponse.json({ ok: true });
  }
}
