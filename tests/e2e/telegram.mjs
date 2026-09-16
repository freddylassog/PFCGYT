// Mensajes personales del bot: simula el webhook de Telegram (vínculo por correo, canal) y revisa la interfaz.
// Uso: node tests/e2e/telegram.mjs  (app corriendo en local tras flujo.mjs: estudiante camila.rios@ute.edu.ec y pedido SOL-2026-001 aprobado;
// la tarjeta del portal del estudiante solo se revisa si hay TELEGRAM_BOT_TOKEN y el bot está activado).
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
const base = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots';
const secreto = createHash('sha256').update('telegram-webhook:' + (process.env.SESSION_SECRET || 'secreto-local-de-pruebas')).digest('hex').slice(0, 48);
const paso = (t) => console.log('·', t);
const webhook = async (cuerpo, conSecreto = true) => {
  const r = await fetch(base + '/api/telegram/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(conSecreto ? { 'x-telegram-bot-api-secret-token': secreto } : {}) }, body: JSON.stringify(cuerpo) });
  return r.status;
};
if ((await webhook({ message: { chat: { id: 1, type: 'private' }, text: '/start' } }, false)) !== 401) throw new Error('el webhook aceptó una llamada sin secreto');
paso('webhook rechaza llamadas sin secreto');
for (const texto of ['/start', 'hola', 'Camila.Rios@ute.edu.ec']) {
  const s = await webhook({ message: { chat: { id: 555, type: 'private' }, text: texto, from: { first_name: 'Camila', last_name: 'Ríos' } } });
  if (s !== 200) throw new Error(`webhook devolvió ${s} para "${texto}"`);
}
paso('estudiante vinculada por correo');

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
const shot = (pg, n) => pg.screenshot({ path: `${shots}/${n}.png`, fullPage: true, caret: 'initial' });

await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
await p.goto(base + '/coordinacion?tab=estudiantes');
const conTg = await p.locator('text=/\\d+ con Telegram/').first().textContent();
const fila = (await p.locator('tr:has-text("Camila")').first().textContent()).replace(/\s+/g, ' ');
if (!/1 con Telegram/.test(conTg) || !/Telegram/.test(fila)) throw new Error(`la pestaña Estudiantes no muestra el vínculo: "${conTg}" / "${fila}"`);
paso('Estudiantes: ' + conTg.trim());
await shot(p, 'estudiantes-telegram');
await p.goto(base + '/coordinacion?tab=resumen');
await p.waitForSelector('h6:has-text("Avisos de pedidos nuevos")');
if (await p.locator('text=Mensajes personales del bot').count()) paso('Resumen: tarjeta de mensajes personales visible');
else paso('Resumen: la tarjeta de mensajes personales solo aparece con TELEGRAM_BOT_TOKEN (no configurado en local)');
await shot(p, 'resumen-bot');

const est = await ctx.newPage();
est.on('pageerror', (e) => errores.push('PAGEERROR est ' + e.message));
await est.goto(base + '/estudiante?clave=SOL-2026-001');
await est.fill('#correo', 'camila.rios@ute.edu.ec');
await est.click('button:has-text("Ingresar")');
await est.waitForSelector('h1, h2', { timeout: 15000 });
const tarjeta = est.locator('xpath=//h6[contains(., "Avisos en tu celular")]/../..').first();
if (await tarjeta.count()) {
  const card = (await tarjeta.textContent()).replace(/\s+/g, ' ');
  if (!/Telegram conectado/.test(card)) throw new Error('el portal del estudiante no muestra "Telegram conectado": ' + card);
  paso('Estudiante: ' + card.slice(0, 200));
} else paso('Estudiante: la tarjeta "Avisos en tu celular" solo aparece con TELEGRAM_BOT_TOKEN y el bot activado (no configurado en local)');
await shot(est, 'estudiante-avisos');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
