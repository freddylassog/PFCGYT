// Fin de evento: botón en Novedades, evento en verde en tablero y calendario, y "Reabrir".
// Uso: node tests/e2e/fin-evento.mjs  (app en local tras flujo.mjs: pedido "Feria…" aprobado)
import { chromium } from '@playwright/test';
const base = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
const dialogos = [];
p.on('dialog', (d) => { dialogos.push(d.message()); d.accept(); });
const paso = (t) => console.log('·', t);
const shot = (n) => p.screenshot({ path: `${shots}/${n}.png`, fullPage: true, caret: 'initial' });

await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');

// Novedades: lista de eventos aprobados con el botón
await p.goto(base + '/coordinacion?tab=novedades');
const tarjeta = p.locator('.card:has-text("Feria")').first();
await tarjeta.waitFor();
if (!/tipo-interno/.test(await tarjeta.getAttribute('class'))) throw new Error('la tarjeta del evento interno no lleva el color interno');
await shot('novedades-antes');
await tarjeta.locator('button:has-text("Fin de evento")').click();
await p.waitForSelector('.card.finalizado:has-text("Feria")', { timeout: 15000 });
if (!dialogos.length) throw new Error('esperaba la confirmación porque el evento aún no termina');
paso('Novedades: Fin de evento (con confirmación: ' + dialogos[0].slice(0, 40) + '…) → tarjeta en verde');
await shot('novedades-finalizado');

// Tablero: columna Finalizado y tarjeta verde
await p.goto(base + '/coordinacion?tab=pedidos');
await p.click('label:has-text("Tablero")');
const col = p.locator('.columna:has(h6:has-text("Finalizado"))');
await col.locator('.card.finalizado:has-text("Feria")').waitFor({ timeout: 15000 });
paso('Tablero: columna Finalizado con la tarjeta en verde');
await shot('tablero-finalizado');

// Calendario: chip verde en septiembre 2026
await p.click('label:has-text("Calendario")');
await p.waitForSelector('.calendario');
while (!/septiembre 2026/i.test(await p.locator('h4').first().textContent())) await p.click('button:has-text("Mes anterior")');
await p.locator('.calendario .evento.finalizado:has-text("Feria")').waitFor({ timeout: 15000 });
paso('Calendario: evento en verde');
await shot('calendario-finalizado');

// Tabla y panel: estado Finalizado, botón Reabrir
await p.click('label:has-text("Tabla")');
const fila = p.locator('table tbody tr:has-text("Feria")');
if (!/Finalizado/.test(await fila.textContent())) throw new Error('la tabla no muestra Finalizado');
await fila.click();
await p.waitForSelector('aside');
const estadoTag = await p.locator('aside .tag.tag-verde').first().textContent();
paso('Panel: ' + estadoTag.trim());
await p.click('aside button:has-text("Reabrir evento")');
await p.waitForSelector('aside button:has-text("Fin de evento")', { timeout: 15000 });
paso('Panel: reabierto (vuelve el botón Fin de evento)');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
