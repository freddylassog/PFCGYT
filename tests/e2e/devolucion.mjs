// Devolución del uniforme por evento con plazo: el evento "Feria…" (aprobado, uniforme, 2 confirmadas) se mueve al pasado con psql,
// coordinación registra una devolución, el portal muestra el plazo y el estado, el cron cuenta los avisos y luego el plazo vence.
// Uso: node tests/e2e/devolucion.mjs  (app en local tras flujo.mjs)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots';
const psql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '5433', '-U', 'postgres', '-d', 'protocolo', '-tAc', q], { encoding: 'utf8' }).trim();
const iso = (d) => d.toISOString().slice(0, 10);
const hoy = new Date(); hoy.setHours(12);
const diasAtras = (n) => { const d = new Date(hoy); d.setDate(d.getDate() - n); return iso(d); };
const moverFeria = (fecha) => psql(`update requests set fecha = '${fecha}', dias = jsonb_build_array(jsonb_build_object('fecha', '${fecha}', 'inicio', '09:00', 'fin', '14:30', 'lugar', 'Auditorio Principal', 'lejos', false)), finalizado_at = null where codigo = 'SOL-2026-001'`);
const fechaCorta = (f) => { const [y, m, d] = f.split('-').map(Number); return `${d} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][m - 1]}`; };
const paso = (t) => console.log('·', t);
const errores = [];

// El evento terminó ayer → hoy empieza el plazo de 7 días (vence en 6 días)
const ayer = diasAtras(1), limite = (() => { const d = new Date(hoy); d.setDate(d.getDate() + 6); return iso(d); })();
moverFeria(ayer);
psql(`delete from uniform_event_returns where request_id = (select id from requests where codigo = 'SOL-2026-001')`);
psql(`update settings set ultimo_recordatorio = null`);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');

// Uniformes: la tarjeta del evento lista a las confirmadas con su plazo
await p.goto(base + '/coordinacion?tab=uniformes');
const card = p.locator('.card:has-text("Feria")').first();
await card.waitFor();
const bloque = card.locator('div:has(> div > span:has-text("Devolución · hasta el"))').first();
const cab = (await bloque.textContent()).replace(/\s+/g, ' ');
if (!cab.includes(`Devolución · hasta el ${fechaCorta(limite)}`) || !/0\/2 devueltos/.test(cab) || !/2 por devolver/.test(await card.textContent())) throw new Error('la tarjeta no muestra el plazo y las pendientes: ' + cab.slice(0, 300));
const filaCamila = card.locator('.linea-item:has-text("Camila")').first();
if (!/Pendiente · hasta el/.test(await filaCamila.textContent())) throw new Error('Camila debería estar pendiente: ' + (await filaCamila.textContent()));
paso(`Uniformes: Feria terminó ayer · devolución hasta el ${fechaCorta(limite)} · 2 por devolver`);
await filaCamila.locator('button:has-text("Recibido lavado")').click();
await card.locator('.linea-item:has-text("Camila") .tag:has-text("Devuelto lavado")').waitFor({ timeout: 15000 });
await card.locator('text=1 por devolver').waitFor({ timeout: 15000 });
if ((await card.locator('text=Correo a quienes no han devuelto').count()) !== 1) throw new Error('falta el correo a quienes no han devuelto');
paso('coordinación registró la devolución de Camila · queda 1 por devolver · correo listo');
await p.click('.seg[aria-label="Vista de uniformes"] label:has-text("Por estudiante")');
const tarjetaDaniela = p.locator('.blueprint:has(label.chip):has-text("Daniela Ortiz")').first();
if (!/Pendiente \(1\)/.test(await tarjetaDaniela.textContent())) throw new Error('la tarjeta de Daniela no marca pendiente: ' + (await tarjetaDaniela.textContent()).slice(0, 200));
const tarjetaCamila = p.locator('.blueprint:has(label.chip):has-text("Camila Ríos")').first();
if (!/Al día/.test(await tarjetaCamila.textContent())) throw new Error('la tarjeta de Camila no está al día');
paso('tarjetas por estudiante: Camila al día · Daniela pendiente (1)');
// Recibido lavado: las prendas de Camila (tenía Vestido) vuelven a bodega; Deshacer las restituye
if (!/Sin entregar/.test(await tarjetaCamila.textContent())) throw new Error('al recibir lavado, las prendas de Camila deben volver a bodega: ' + (await tarjetaCamila.textContent()).slice(0, 200));
await tarjetaCamila.locator('button:has-text("Deshacer")').click();
await tarjetaCamila.locator('.tag:has-text("Parcial 1/3")').waitFor({ timeout: 15000 });
await tarjetaCamila.locator('button:has-text("Recibido lavado")').click();
await tarjetaCamila.locator('.tag:has-text("Sin entregar")').waitFor({ timeout: 15000 });
const bodega = (await p.locator('div:has(> strong:has-text("Fuera de bodega:"))').first().textContent()).replace(/\s+/g, ' ');
if (!/ninguna prenda; todo en bodega/.test(bodega)) throw new Error('con el Vestido de Camila de vuelta, no debería haber prendas fuera de bodega: ' + bodega);
paso('recibido lavado: prendas de vuelta a bodega; Deshacer las restituye');
await p.screenshot({ path: shots + '/devolucion-uniformes.png', fullPage: true, caret: 'initial' });

// Cron: Daniela está pendiente y hoy es el día después del evento → 1 aviso de devolución, 0 vencidos
let r = await (await fetch(base + '/api/cron/recordatorios')).json();
if (!r.ok || r.devoluciones !== '1' || r.vencidos !== '0') throw new Error('cron (inicio del plazo): ' + JSON.stringify(r));
paso('cron: 1 aviso de devolución (inicio del plazo), 0 vencidos · ' + JSON.stringify(r));

// Portal de Daniela: plazo pendiente en "Mi uniforme" y en el evento
const est = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
est.on('pageerror', (e) => errores.push('PAGEERROR est ' + e.message));
await est.goto(base + '/estudiante?clave=SOL-2026-001');
await est.fill('#correo', 'daniela.ortiz@ute.edu.ec');
await est.click('button:has-text("Ingresar")');
await est.waitForSelector('text=Mi uniforme', { timeout: 15000 });
const miUniforme = (await est.locator('.blueprint:has-text("Mi uniforme")').first().textContent()).replace(/\s+/g, ' ');
if (!new RegExp(`Por devolver \\(lavado\\): Feria de Emprendimiento Gastronómico hasta el ${fechaCorta(limite)}`).test(miUniforme)) throw new Error('el portal no muestra la devolución pendiente: ' + miUniforme);
const evento = (await est.locator('.blueprint:has(h3:has-text("Feria de Emprendimiento"))').first().textContent()).replace(/\s+/g, ' ');
if (!/Devolución del uniforme \(lavado\)/.test(evento) || !/Pendiente · hasta el/.test(evento)) throw new Error('el evento no muestra el estado de la devolución: ' + evento.slice(0, 400));
paso('portal de Daniela: por devolver hasta el ' + fechaCorta(limite));
await est.screenshot({ path: shots + '/devolucion-portal.png', fullPage: true, caret: 'initial' });

// El plazo vence: el evento fue hace 8 días (plazo hasta ayer) → vencido para Daniela, aviso "vencido" y lista para coordinación
moverFeria(diasAtras(8));
psql(`update settings set ultimo_recordatorio = null`);
r = await (await fetch(base + '/api/cron/recordatorios')).json();
if (!r.ok || r.devoluciones !== '1' || r.vencidos !== '1') throw new Error('cron (vencido): ' + JSON.stringify(r));
paso('cron al vencer: 1 aviso (vencido) y 1 vencido para coordinación · ' + JSON.stringify(r));
await p.reload();
const cardV = p.locator('.card:has-text("Feria")').first();
await cardV.locator('.linea-item:has-text("Daniela") .tag:has-text("Vencido · era hasta el")').waitFor({ timeout: 15000 });
if (!/1 por devolver · 1 vencido/.test(await cardV.textContent())) throw new Error('la tarjeta del evento no marca el vencido: ' + (await cardV.textContent()).slice(0, 200));
await p.click('.seg[aria-label="Vista de uniformes"] label:has-text("Por estudiante")');
if (!/Vencido \(1\)/.test(await p.locator('.blueprint:has(label.chip):has-text("Daniela Ortiz")').first().textContent())) throw new Error('la tarjeta de Daniela no marca vencido');
await est.reload();
await est.waitForSelector('text=plazo vencido', { timeout: 15000 });
paso('vencido: visible para coordinación (tarjeta del evento y de la estudiante) y para Daniela en su portal');

// Limpieza: la Feria vuelve al futuro y sin devoluciones (para los demás flujos)
moverFeria('2026-10-23');
psql(`delete from uniform_event_returns where request_id = (select id from requests where codigo = 'SOL-2026-001')`);
paso('limpieza: Feria devuelta al 23 oct');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
