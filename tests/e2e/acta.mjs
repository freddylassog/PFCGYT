// Acta de compromiso: enlace en la pantalla de pedido registrado, PDF con y sin permiso, compromisos en el panel y acta firmada.
// Uso: node tests/e2e/acta.mjs  (app en local)
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
p.on('dialog', (d) => d.accept());
const paso = (t) => console.log('·', t);
const tmp = '/tmp/evidencia-prueba.pdf'; writeFileSync(tmp, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const evento = 'Cena de gala externa ' + Date.now();

// Pedido de 8 h, lejos, 6 estudiantes → 2 alimentaciones, transporte ida y regreso
await p.goto(base + '/');
await p.fill('#nombre', 'Carla Espinosa'); await p.fill('#cargo', 'Directora de eventos'); await p.fill('#institucion', 'Cámara de Comercio de Quito'); await p.fill('#correo', 'carla@ejemplo.com');
await p.click('button:has-text("Externo")');
await p.click('button:has-text("Continuar")');
await p.fill('#evento', evento); await p.setInputFiles('input[type=file]', tmp); await p.waitForSelector('.tag-accent', { timeout: 15000 });
await p.fill('#dia-fecha-0', '2026-11-27'); await p.fill('#dia-inicio-0', '10:00'); await p.fill('#dia-fin-0', '18:00');
await p.fill('#dia-lugar-0', 'Hacienda La Compañía, Cayambe'); await p.click('label:has-text("fuera del Distrito Metropolitano")');
await p.fill('#responsable', 'María Paz'); await p.fill('#telefono', '0991234567');
await p.waitForTimeout(600); await p.click('button:has-text("Continuar")');
await p.waitForSelector('#cantidad'); await p.fill('#cantidad', '6');
await p.click('label:has-text("Guía de invitados")');
await p.click('button:has-text("Continuar")');
const compromisos = (await p.locator('section:has-text("04 · Compromisos") .stack-3').textContent()).replace(/\s+/g, ' ');
if (!/2 alimentaciones por estudiante.*12 en total para 6 estudiantes/.test(compromisos)) throw new Error('alimentación mal calculada: ' + compromisos);
if (!/Ida y regreso para los 6 estudiantes/.test(compromisos)) throw new Error('transporte mal calculado: ' + compromisos);
if (!/únicamente las actividades marcadas: Guía de invitados \(6\)/.test(compromisos)) throw new Error('actividades: ' + compromisos);
paso('paso 4: 2 alimentaciones (12 en total), transporte ida y regreso, actividades marcadas');
await p.screenshot({ path: shots + '/compromisos-paso4.png', fullPage: true, caret: 'initial' });
await p.click('label:has-text("Acepto estos compromisos")');
await p.click('button:has-text("Registrar pedido")');
await p.waitForSelector('text=Pedido registrado', { timeout: 15000 });
const actaUrl = await p.locator('a:has-text("Descargar acta de compromiso")').getAttribute('href');
const codigo = (await p.locator('h2').first().textContent()).trim();
paso(`registrado ${codigo}; enlace del acta con token: ${/\/api\/acta\/[0-9a-f-]+\?t=[A-Za-z0-9_-]{32}$/.test(actaUrl)}`);
await p.screenshot({ path: shots + '/acta-registrado.png', fullPage: true, caret: 'initial' });

// PDF con token (sin sesión), sin token → 401
const r = await fetch(actaUrl);
const bytes = Buffer.from(await r.arrayBuffer());
if (r.status !== 200 || r.headers.get('content-type') !== 'application/pdf' || bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error(`acta: ${r.status} ${r.headers.get('content-type')}`);
writeFileSync(shots + '/acta.pdf', bytes);
const r401 = await fetch(actaUrl.split('?')[0]);
if (r401.status !== 401) throw new Error('sin token debería ser 401, dio ' + r401.status);
const rMal = await fetch(actaUrl.replace(/t=.*/, 't=' + 'x'.repeat(32)));
if (rMal.status !== 401) throw new Error('token malo debería ser 401, dio ' + rMal.status);
paso(`PDF del acta: ${bytes.length} bytes; sin token y con token malo → 401`);

// Panel: compromisos, botón del acta (con sesión, sin token) y acta firmada
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
await p.click(`table tbody tr:has-text("${codigo}")`);
await p.waitForSelector('aside h6:has-text("Compromisos del organizador")');
const panelTxt = (await p.locator('aside').textContent()).replace(/\s+/g, ' ');
if (!/Alimentación.*2 alimentaciones por estudiante/.test(panelTxt) || !/Transporte.*Ida y regreso/.test(panelTxt)) throw new Error('el panel no muestra los compromisos: ' + panelTxt.slice(0, 300));
const hrefPanel = await p.locator('aside a:has-text("Acta de compromiso (PDF)")').getAttribute('href');
const rSesion = await p.request.get(hrefPanel.split('?')[0]);
if (rSesion.status() !== 200 || !rSesion.headers()['content-type'].includes('application/pdf')) throw new Error('coordinación con sesión debería abrir el acta sin token: ' + rSesion.status());
paso('panel: compromisos con cantidades y acta accesible con sesión');
await p.locator('aside input[type=file]').setInputFiles(tmp);
await p.waitForSelector('aside a:has-text("Acta firmada")', { timeout: 20000 });
paso('acta firmada subida: ' + (await p.locator('aside a:has-text("Acta firmada")').textContent()).trim());
await p.screenshot({ path: shots + '/acta-panel.png', fullPage: false, caret: 'initial' });
await p.click('aside button:has-text("Quitar")');
await p.waitForSelector('aside button:has-text("Subir acta firmada")', { timeout: 15000 });
paso('acta firmada quitada');
// Limpieza: eliminar el pedido de prueba
await p.click('aside button:has-text("Eliminar pedido")');
await p.waitForSelector(`table tbody tr:has-text("${codigo}")`, { state: 'detached', timeout: 15000 });
paso('pedido de prueba eliminado');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
