// Próximos 7 días: la tira arriba de Coordinación, el botón de resumen en Resumen y el cron muestran, por evento aprobado,
// cupos y cuántos faltan, inscripciones por revisar y uniformes retirados.
// Uso: node tests/e2e/proximos.mjs  (app en local con la Feria aprobada a pocos días; ver flujo.mjs)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE_URL || 'http://localhost:3000';
const psql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '5433', '-U', 'postgres', '-d', 'protocolo', '-tAc', q], { encoding: 'utf8' }).trim();
const paso = (t) => console.log('·', t);
const errores = [];
// La Feria queda en 3 días (para que entre en la ventana de 7 días sin depender de la fecha real)
const iso = (d) => d.toISOString().slice(0, 10);
const hoy = new Date(); hoy.setHours(12);
const enTres = (() => { const d = new Date(hoy); d.setDate(d.getDate() + 3); return iso(d); })();
psql(`update requests set fecha = '${enTres}', dias = jsonb_build_array(jsonb_build_object('fecha', '${enTres}', 'inicio', '09:00', 'fin', '14:30', 'lugar', 'Auditorio Principal', 'lejos', false)), finalizado_at = null where codigo = 'SOL-2026-001'`);
const [confirmados, cantidad, conPrendas, inscritos] = [
  psql(`select count(*) from enrollments e join requests r on r.id = e.request_id where r.codigo = 'SOL-2026-001' and e.estado = 'confirmado'`),
  psql(`select cantidad from requests where codigo = 'SOL-2026-001'`),
  psql(`select count(distinct e.student_id) from enrollments e join requests r on r.id = e.request_id join uniform_items u on u.student_id = e.student_id where r.codigo = 'SOL-2026-001' and e.estado = 'confirmado'`),
  psql(`select count(*) from enrollments e join requests r on r.id = e.request_id where r.codigo = 'SOL-2026-001' and e.estado = 'inscrito'`),
].map(Number);
const faltan = Math.max(0, cantidad - confirmados);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');

// 1. Tira "Próximos 7 días" en todas las pestañas
const tira = p.locator('.blueprint[aria-label="Próximos eventos"]');
await tira.waitFor({ timeout: 15000 });
const t = (await tira.textContent()).replace(/\s+/g, ' ');
const esperado = [`Feria de Emprendimiento Gastronómico`, `${confirmados}/${cantidad} confirmados`, faltan ? `faltan ${faltan}` : 'completo', `uniformes ${conPrendas}/${confirmados} retirados`];
for (const e of esperado) if (!t.includes(e)) throw new Error(`la tira no muestra "${e}": ` + t);
if (inscritos && !t.includes(`${inscritos} por revisar`)) throw new Error('la tira no muestra las inscripciones por revisar: ' + t);
paso(`tira: ${confirmados}/${cantidad} confirmados · faltan ${faltan} · uniformes ${conPrendas}/${confirmados} retirados${inscritos ? ` · ${inscritos} por revisar` : ''}`);
await p.goto(base + '/coordinacion?tab=uniformes');
await tira.waitFor({ timeout: 15000 });
paso('la tira también se ve en otras pestañas');
// Clic abre el pedido
await p.click('.blueprint[aria-label="Próximos eventos"] a:has-text("Feria")');
await p.waitForSelector('aside:has-text("Feria de Emprendimiento Gastronómico")', { timeout: 15000 });
paso('clic en la tira: abre el panel del pedido');

// 2. Resumen → botón "Enviar resumen de próximos eventos" (sin Telegram: muestra el texto)
await p.goto(base + '/coordinacion?tab=resumen');
await p.click('button:has-text("Enviar resumen de próximos eventos")');
await p.waitForSelector('text=Sin Telegram configurado: aquí está el resumen.', { timeout: 15000 });
const texto = (await p.locator('pre:has-text("Próximos 7 días")').textContent()).replace(/\s+/g, ' ');
if (!texto.includes('Feria de Emprendimiento Gastronómico (SOL-2026-001)') || !texto.includes(`${confirmados}/${cantidad} confirmados`) || !texto.includes(faltan ? `faltan ${faltan}` : 'cupo completo')) throw new Error('el resumen no trae los datos: ' + texto);
if (conPrendas < confirmados && !/uniformes: \d+ de \d+ retiraron \(sin retirar: /.test(texto)) throw new Error('el resumen debería nombrar a quienes no retiraron: ' + texto);
paso('resumen en Resumen: ' + texto.slice(0, 160));

// 3. Cron diario: cuenta los próximos y los manda a coordinación (sin Telegram local solo se cuenta)
psql(`update settings set ultimo_recordatorio = null`);
const r = await (await fetch(base + '/api/cron/recordatorios')).json();
if (!r.ok || Number(r.proximos) < 1) throw new Error('el cron no cuenta los próximos eventos: ' + JSON.stringify(r));
paso('cron: ' + JSON.stringify(r));

// Limpieza: la Feria vuelve al 23 oct
psql(`update requests set fecha = '2026-10-23', dias = jsonb_build_array(jsonb_build_object('fecha', '2026-10-23', 'inicio', '09:00', 'fin', '14:30', 'lugar', 'Auditorio Principal', 'lejos', false)) where codigo = 'SOL-2026-001'`);
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
