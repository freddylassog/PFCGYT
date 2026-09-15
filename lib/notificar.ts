import 'server-only';
import { appUrl } from './datos';
import { mensajeNuevoPedido, mensajePrueba, type Mensaje } from './notificar-texto';
import type { Pedido } from './tipos';

// Canales de aviso a coordinación cuando entra un pedido nuevo. Se activan
// con variables de entorno; si no hay ninguna, la app simplemente no avisa.
//  - Correo (Resend): RESEND_API_KEY + NOTIFICACION_CORREO (la dirección con la
//    que se creó la cuenta de Resend; sin dominio propio solo se puede enviar a ella).
//  - Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID.

export interface CanalEstado { canal: 'correo' | 'telegram'; destino: string }

export function canalesConfigurados(): CanalEstado[] {
  const c: CanalEstado[] = [];
  if (process.env.RESEND_API_KEY && process.env.NOTIFICACION_CORREO) c.push({ canal: 'correo', destino: process.env.NOTIFICACION_CORREO });
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) c.push({ canal: 'telegram', destino: 'Telegram' });
  return c;
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

async function enviarTelegram(m: Mensaje): Promise<void> {
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: `${m.asunto}\n\n${m.texto}`, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) {
    const detalle = await r.text().catch(() => '');
    throw new Error(`Telegram respondió ${r.status}: ${detalle.slice(0, 300)}`);
  }
}

/** Envía por todos los canales configurados. Devuelve los errores (vacío = todo bien). */
export async function enviarNotificacion(m: Mensaje): Promise<string[]> {
  const errores: string[] = [];
  for (const c of canalesConfigurados()) {
    try {
      if (c.canal === 'correo') await enviarCorreo(m);
      else await enviarTelegram(m);
    } catch (e) {
      errores.push(`${c.canal}: ${(e as Error).message}`);
    }
  }
  return errores;
}

/** Aviso de pedido nuevo. Nunca lanza error: un fallo del aviso no debe impedir el registro. */
export async function notificarNuevoPedido(p: Pedido): Promise<void> {
  if (!canalesConfigurados().length) return;
  try {
    const errores = await enviarNotificacion(mensajeNuevoPedido(p, appUrl()));
    for (const e of errores) console.error('[notificaciones]', p.codigo, e);
  } catch (e) {
    console.error('[notificaciones]', p.codigo, (e as Error).message);
  }
}

export async function enviarPrueba(): Promise<string[]> {
  if (!canalesConfigurados().length) return ['No hay ningún canal configurado. Agrega en Vercel RESEND_API_KEY y NOTIFICACION_CORREO (o TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID) y vuelve a desplegar.'];
  return enviarNotificacion(mensajePrueba(appUrl()));
}
