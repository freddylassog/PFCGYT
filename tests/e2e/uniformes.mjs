// Citas de entrega y devolución de uniformes: se fijan en Uniformes, se ven en el panel y en el portal del estudiante.
// Uso: node tests/e2e/uniformes.mjs  (app en local tras flujo.mjs: pedido "Feria…" aprobado con uniforme y 2 confirmados)
import { chromium } from '@playwright/test';
const base = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
const paso = (t) => console.log('·', t);
const shot = (pg, n) => pg.screenshot({ path: `${shots}/${n}.png`, fullPage: true, caret: 'initial' });
const manana = new Date(); manana.setDate(manana.getDate() + 1);
const fEntrega = manana.toISOString().slice(0, 10);
const dev = new Date(); dev.setDate(dev.getDate() + 12);
const fDev = dev.toISOString().slice(0, 10);

await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');

// Ajustes: lugar habitual
await p.goto(base + '/coordinacion?tab=resumen');
await p.fill('input[placeholder="ej. Oficina de coordinación de protocolo"]', 'Oficina de protocolo, bloque B');
await p.click('button:has-text("Guardar ajustes")');
await p.waitForTimeout(1500);
paso('Ajustes: lugar habitual guardado');

// Uniformes: cita del evento
await p.goto(base + '/coordinacion?tab=uniformes');
const card = p.locator('.card:has-text("Feria")').first();
await card.waitFor();
const lugar = await card.locator('input[id$="-lugar"]').inputValue();
if (lugar !== 'Oficina de protocolo, bloque B') throw new Error('el lugar habitual no se propuso: ' + lugar);
if (!(await card.locator('button:has-text("Guardar y avisar por Telegram")').isDisabled())) throw new Error('sin Telegram el botón de avisar debería estar apagado');
await card.locator('input[id$="-ef"]').fill(fEntrega);
await card.locator('input[id$="-eh"]').fill('10:30');
await card.locator('input[id$="-df"]').fill(fDev);
await card.locator('input[id$="-dh"]').fill('16:00');
await card.locator('button:has-text("Guardar")').first().click();
await p.waitForSelector('text=Guardada · sin avisar', { timeout: 15000 });
await p.waitForSelector('text=Correo a los confirmados · uniformes');
paso(`Uniformes: cita guardada (entrega ${fEntrega} 10:30, devolución ${fDev} 16:00) y correo listo`);
await shot(p, 'uniformes-cita');

// Panel del pedido muestra la sección con los valores
await p.goto(base + '/coordinacion?tab=pedidos');
await p.click('table tbody tr:has-text("Feria")');
await p.waitForSelector('aside h6:has-text("Uniformes · entrega y devolución")');
if ((await p.inputValue('#panel-cita-eh')) !== '10:30') throw new Error('el panel no muestra la hora guardada');
paso('Panel: sección de uniformes con la cita');

// Portal del estudiante
const est = await ctx.newPage();
est.on('pageerror', (e) => errores.push('PAGEERROR est ' + e.message));
await est.goto(base + '/estudiante?clave=SOL-2026-001');
await est.fill('#correo', 'camila.rios@ute.edu.ec');
await est.click('button:has-text("Ingresar")');
await est.waitForSelector('text=Entrega del uniforme', { timeout: 15000 });
const txt = (await est.locator('text=Entrega del uniforme').locator('..').textContent()).replace(/\s+/g, ' ');
if (!/10:30/.test(txt) || !/bloque B/.test(txt)) throw new Error('el portal no muestra la cita: ' + txt);
await est.waitForSelector('text=Devolución del uniforme');
paso('Estudiante: ve entrega y devolución del uniforme');
await shot(est, 'estudiante-uniforme-cita');

// Cron: mañana hay entrega → responde sin error
const r = await fetch(base + '/api/cron/recordatorios');
const j = await r.json();
if (!r.ok || !j.ok) throw new Error('cron falló: ' + JSON.stringify(j));
paso('Cron: ' + JSON.stringify(j));
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
