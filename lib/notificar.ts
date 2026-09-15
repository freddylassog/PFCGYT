import 'server-only';
import { appUrl } from './app-url';
import { mensajeNuevoPedido, mensajePrueba, type Mensaje } from './notificar-texto';
import type { Ajustes, EstadoNotificaciones, Pedido } from './tipos';

// Canales de aviso a coordinación cuando entra un pedido nuevo.
//  - Correo (Resend): RESEND_API_KEY + NOTIFICACION_CORREO (la dirección con la
//    que se creó la cuenta de Resend; sin dominio propio solo se puede enviar a ella).
//  - Telegram: TELEGRAM_BOT_TOKEN en Vercel; el chat se detecta desde Resumen → Avisos
//    (o se fija con TELEGRAM_CHAT_ID).

type AjustesTelegram = Pick<Ajustes, 'telegramChatId' | 'telegramChatNombre'>;

function chatTelegram(a?: AjustesTelegram | null): string {
  return process.env.TELEGRAM_CHAT_ID || a?.telegramChatId || '';
}

export function estadoCanales(a?: AjustesTelegram | null): EstadoNotificaciones {
  const canales: EstadoNotificaciones['canales'] = [];
  if (process.env.RESEND_API_KEY && process.env.NOTIFICACION_CORREO) canales.push({ canal: 'correo', destino: process.env.NOTIFICACION_CORREO });
  const token = !!process.env.TELEGRAM_BOT_TOKEN, chat = chatTelegram(a);
  if (token && chat) canales.push({ canal: 'telegram', destino: a?.telegramChatNombre ? `Telegram (${a.telegramChatNombre})` : 'Telegram' });
  return { canales, telegramSinChat: token && !chat };
}

async function enviarCorreo(m: Mensaje): Promise<void> {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.NOTIFICACION_REMITENTE || 'Protocolo FCGT <onboarding@resend.dev>',
      to: [process.env.NOTIFICACION_CORREO],
      subject: m.asunto,
      text: m.texto,
      html: m.html,
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => '');
    throw new Error(`Resend respondió ${r.status}: ${detalle.slice(0, 300)}`);
  }
}

async function enviarTelegram(m: Mensaje, chatId: string): Promise<void> {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: `${m.asunto}\n\n${m.texto}`, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => '');
    throw new Error(`Telegram respondió ${r.status}: ${detalle.slice(0, 300)}`);
  }
}

/** Envía por todos los canales configurados. Devuelve los errores (vacío = todo bien). */
export async function enviarNotificacion(m: Mensaje, a?: AjustesTelegram | null): Promise<string[]> {
  const errores: string[] = [];
  for (const c of estadoCanales(a).canales) {
    try {
      if (c.canal === 'correo') await enviarCorreo(m);
      else await enviarTelegram(m, chatTelegram(a));
    } catch (e) {
      errores.push(`${c.canal}: ${(e as Error).message}`);
    }
  }
  return errores;
}

/** Aviso de pedido nuevo. Nunca lanza error: un fallo del aviso no debe impedir el registro. */
export async function notificarNuevoPedido(p: Pedido, a?: AjustesTelegram | null): Promise<void> {
  if (!estadoCanales(a).canales.length) return;
  try {
    const errores = await enviarNotificacion(mensajeNuevoPedido(p, appUrl()), a);
    for (const e of errores) console.error('[notificaciones]', p.codigo, e);
  } catch (e) {
    console.error('[notificaciones]', p.codigo, (e as Error).message);
  }
}

export async function enviarPrueba(a?: AjustesTelegram | null): Promise<string[]> {
  const estado = estadoCanales(a);
  if (!estado.canales.length) {
    if (estado.telegramSinChat) return ['Telegram: falta detectar tu chat. Escríbele un mensaje a tu bot y pulsa "Detectar mi chat de Telegram".'];
    return ['No hay ningún canal configurado. Agrega en Vercel RESEND_API_KEY y NOTIFICACION_CORREO, o TELEGRAM_BOT_TOKEN, y vuelve a desplegar.'];
  }
  return enviarNotificacion(mensajePrueba(appUrl()), a);
}

/** Busca el último mensaje recibido por el bot y devuelve el chat que lo envió. */
export async function detectarChatTelegram(): Promise<{ id: string; nombre: string }> {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('Falta TELEGRAM_BOT_TOKEN en Vercel.');
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getUpdates`, { signal: AbortSignal.timeout(10000), cache: 'no-store' });
  if (!r.ok) throw new Error(`Telegram respondió ${r.status}. Revisa que el token sea el que te dio @BotFather.`);
  const datos = (await r.json()) as { ok: boolean; result?: { message?: { chat?: { id: number; first_name?: string; last_name?: string; username?: string; title?: string } } }[] };
  const mensajes = (datos.result ?? []).map((u) => u.message?.chat).filter((c): c is NonNullable<typeof c> => !!c);
  const chat = mensajes[mensajes.length - 1];
  if (!chat) throw new Error('Telegram no tiene mensajes tuyos todavía. Abre tu bot en Telegram, pulsa Iniciar, escríbele "hola" y vuelve a pulsar Detectar.');
  const nombre = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || String(chat.id);
  return { id: String(chat.id), nombre };
}
