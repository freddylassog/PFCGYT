// Entrega y devolución de uniformes (un día o un periodo con franja horaria): se fijan en Uniformes, se ven en el panel y en el portal del estudiante.
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
const hasta = new Date(); hasta.setDate(hasta.getDate() + 3);
const fEntregaHasta = hasta.toISOString().slice(0, 10);
const dev = new Date(); dev.setDate(dev.getDate() + 12);
const fDev = dev.toISOString().slice(0, 10);

await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');

// Ajustes: lugar y horario fijo del periodo (viene propuesto por la migración; se fija explícito y se cambia el lunes)
await p.goto(base + '/coordinacion?tab=resumen');
await p.fill('input[placeholder="ej. Oficina de coordinación de protocolo"]', 'Oficina de protocolo, bloque B');
const franjas = { 1: ['11:00', '13:00', 'Valeria y Daniela'], 2: ['13:00', '15:00', 'Coordinación'], 3: ['11:00', '13:00', 'Estudiantes de apoyo'], 4: ['13:00', '15:00', 'Coordinación'], 5: ['11:00', '13:00', 'Estudiantes de apoyo'] };
for (const [dia, [ini, fin, quien]] of Object.entries(franjas)) {
  if (!(await p.isChecked(`#hu-${dia}-activo`))) await p.click(`label:has(#hu-${dia}-activo)`);
  await p.fill(`#hu-${dia}-inicio`, ini); await p.fill(`#hu-${dia}-fin`, fin); await p.fill(`#hu-${dia}-atiende`, quien);
}
const previa = (await p.locator('text=Los estudiantes verán:').textContent()).replace(/\s+/g, ' ');
if (!/lunes 11:00–13:00 \(Valeria y Daniela\) · martes y jueves 13:00–15:00 \(Coordinación\) · miércoles y viernes 11:00–13:00 \(Estudiantes de apoyo\)/.test(previa)) throw new Error('vista previa del horario: ' + previa);
await p.click('button:has-text("Guardar ajustes")');
await p.waitForTimeout(1500);
paso('Ajustes: lugar y horario fijo guardados · ' + previa.trim());

// Uniformes: horario fijo arriba y cita del evento (excepción) abajo
await p.goto(base + '/coordinacion?tab=uniformes');
const fijo = (await p.locator('.blueprint:has(h6:has-text("Horario fijo del periodo"))').first().textContent()).replace(/\s+/g, ' ');
if (!/lunes 11:00–13:00 \(Valeria y Daniela\)/.test(fijo) || !/Oficina de protocolo, bloque B/.test(fijo)) throw new Error('la pestaña Uniformes no muestra el horario fijo: ' + fijo);
paso('Uniformes: horario fijo visible');
const card = p.locator('.card:has-text("Feria")').first();
await card.waitFor();
await card.locator('summary:has-text("Entrega o devolución distinta del horario fijo")').click();
if ((await card.locator('text=Rige el horario fijo del periodo').count()) !== 1) throw new Error('la cita por evento no menciona el horario fijo');
const lugar = await card.locator('input[id$="-lugar"]').inputValue();
if (lugar !== 'Oficina de protocolo, bloque B') throw new Error('el lugar habitual no se propuso: ' + lugar);
if (!(await card.locator('button:has-text("Guardar y avisar por Telegram")').isDisabled())) throw new Error('sin Telegram el botón de avisar debería estar apagado');
// Entrega en un periodo de 3 días con franja horaria; devolución en un solo día y hora puntual
await card.locator('input[id$="-ef"]').fill(fEntrega);
await card.locator('input[id$="-efh"]').fill(fEntregaHasta);
await card.locator('input[id$="-eh"]').fill('10:30');
await card.locator('input[id$="-ehf"]').fill('11:30');
await card.locator('input[id$="-df"]').fill(fDev);
await card.locator('input[id$="-dh"]').fill('16:00');
const vista = (await card.locator('text=Se avisará:').first().textContent()).replace(/\s+/g, ' ');
if (!/ a .* · de 10:30 a 11:30/.test(vista)) throw new Error('la vista previa no muestra el periodo: ' + vista);
await card.locator('button:has-text("Guardar")').first().click();
await p.waitForSelector('text=Guardada · sin avisar', { timeout: 15000 });
await p.waitForSelector('text=Correo a los confirmados · uniformes');
paso(`Uniformes: periodo guardado (entrega ${fEntrega} a ${fEntregaHasta} de 10:30 a 11:30, devolución ${fDev} 16:00) · ${vista.trim()}`);
await shot(p, 'uniformes-cita');

// Panel del pedido muestra la sección con los valores
await p.goto(base + '/coordinacion?tab=pedidos');
await p.click('table tbody tr:has-text("Feria")');
await p.waitForSelector('aside h6:has-text("Uniformes · entrega y devolución")');
if ((await p.inputValue('#panel-cita-eh')) !== '10:30' || (await p.inputValue('#panel-cita-efh')) !== fEntregaHasta || (await p.inputValue('#panel-cita-ehf')) !== '11:30') throw new Error('el panel no muestra el periodo guardado');
paso('Panel: sección de uniformes con la cita');

// Portal del estudiante
const est = await ctx.newPage();
est.on('pageerror', (e) => errores.push('PAGEERROR est ' + e.message));
await est.goto(base + '/estudiante?clave=SOL-2026-001');
await est.fill('#correo', 'camila.rios@ute.edu.ec');
await est.click('button:has-text("Ingresar")');
await est.waitForSelector('text=Entrega del uniforme', { timeout: 15000 });
const txt = (await est.locator('text=Entrega del uniforme').locator('..').textContent()).replace(/\s+/g, ' ');
if (!/ a .* · de 10:30 a 11:30/.test(txt) || !/bloque B/.test(txt)) throw new Error('el portal no muestra el periodo: ' + txt);
await est.waitForSelector('text=Devolución del uniforme');
const miUniforme = (await est.locator('p:has-text("Retiro y devolución:")').first().textContent()).replace(/\s+/g, ' ');
if (!/lunes 11:00–13:00 \(Valeria y Daniela\)/.test(miUniforme) || !/bloque B/.test(miUniforme)) throw new Error('el portal no muestra el horario fijo: ' + miUniforme);
paso('Estudiante: ve la cita del evento y el horario fijo del periodo');
await shot(est, 'estudiante-uniforme-cita');

// Cron: mañana hay entrega → responde sin error
const r = await fetch(base + '/api/cron/recordatorios');
const j = await r.json();
if (!r.ok || !j.ok) throw new Error('cron falló: ' + JSON.stringify(j));
paso('Cron: ' + JSON.stringify(j));
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
