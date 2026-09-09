// Flujo completo: coordinación importa datos, aprueba, estudiante se inscribe, coordinación confirma, novedades, reporte.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots';
const fx = new URL('../fixtures/', import.meta.url).pathname;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
const paso = (t) => console.log('·', t);
const shot = (n) => p.screenshot({ path: `${shots}/${n}.png`, fullPage: true });

// 1. Login coordinación
await p.goto(base + '/coordinacion');
await shot('login-coord');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
paso('login coordinación ok');

// 2. Importar estudiantes
await p.goto(base + '/coordinacion?tab=estudiantes');
await p.setInputFiles('input[type=file]', fx + 'estudiantes.xlsx');
await p.waitForSelector('text=filas procesadas', { timeout: 20000 });
paso('estudiantes importados: ' + await p.locator('text=filas procesadas').textContent());
await shot('estudiantes');

// 3. Importar docentes y horarios
await p.goto(base + '/horarios');
const inputs = p.locator('input[type=file]');
await inputs.nth(1).setInputFiles(fx + 'docentes.csv');
await p.waitForSelector('text=Activos: 7', { timeout: 20000 });
await inputs.nth(0).setInputFiles(fx + 'horarios.xlsx');
await p.waitForSelector('text=15 clases cargadas', { timeout: 20000 });
paso('docentes y horarios importados');
await p.click('label:has-text("2.º")');
await p.waitForSelector('text=Investigación');
await shot('horarios');

// 4. Pedidos: abrir el primero y aprobar
await p.goto(base + '/coordinacion?tab=pedidos');
await p.click('table tbody tr:has-text("Feria")');
await p.waitForSelector('aside');
await shot('pedido-detalle');
await p.click('button:has-text("Aprobar y convocar estudiantes")');
await p.waitForSelector('text=Convocatoria abierta', { timeout: 20000 });
const claveTxt = await p.locator('aside strong.heading').first().textContent();
const clave = (claveTxt || '').trim();
paso('aprobado, clave ' + clave);
await p.click('aside button:has-text("Ver correo")');
await shot('pedido-aprobado');

// 5. Estudiante: login con correo + clave e inscribirse
const est = await ctx.newPage();
await est.goto(base + '/estudiante?clave=' + clave);
await est.fill('#correo', 'camila.rios@ute.edu.ec');
await est.click('button:has-text("Ingresar")');
await est.waitForSelector('h1:has-text("Mis eventos")', { timeout: 20000 });
await est.click('button:has-text("Inscribirme")');
await est.waitForSelector('text=Inscrita · por confirmar', { timeout: 20000 });
paso('estudiante inscrita');
await est.screenshot({ path: `${shots}/estudiante-inscrita.png`, fullPage: true });

// 6. Coordinación acepta la inscripción y agrega otro directamente
await p.reload();
await p.click('table tbody tr:has-text("Feria")');
await p.waitForSelector('text=Inscritos por revisar');
await p.click('aside button:has-text("Aceptar")');
await p.waitForSelector('aside .card-kicker:has-text("Confirmados")', { timeout: 20000 });
await p.selectOption('aside select[aria-label="Agregar estudiante directamente"]', { label: 'Daniela Ortiz · 2.º' });
await p.click('aside button:has-text("Confirmar")');
await p.waitForSelector('text=Daniela Ortiz', { timeout: 20000 });
paso('confirmados: ' + (await p.locator('aside .linea-item').allTextContents()).filter((t) => t.includes('Quitar')).length);
await shot('pedido-confirmados');

// 7. Novedad y reporte a decanato
await p.selectOption('aside select[aria-label="Estudiante"]', { index: 1 });
await p.selectOption('aside select[aria-label="Tipo de novedad"]', 'Llegó tarde');
await p.fill('aside input[aria-label="Detalle"]', '40 min');
await p.click('aside button:has-text("Registrar novedad")');
await p.waitForSelector('text=Sin reportar', { timeout: 20000 });
await p.click('aside button:has-text("Reportar a decanato")');
await p.waitForSelector('text=Correo a decanato');
await p.click('aside button:has-text("Marcar como reportadas")');
await p.waitForSelector('aside .tag:has-text("Decanato ·")', { timeout: 20000 });
paso('novedad reportada');

// 8. Estudiante ve el evento confirmado
await est.reload();
await est.waitForSelector('text=Confirmado ·', { timeout: 20000 });
await est.screenshot({ path: `${shots}/estudiante-confirmada.png`, fullPage: true });
paso('estudiante ve evento confirmado');

// 9. Uniformes
await p.goto(base + '/coordinacion?tab=uniformes');
const tarjeta = p.locator('.blueprint:has-text("Camila Ríos")').first();
await tarjeta.locator('label.chip:has-text("Vestido")').click();
await tarjeta.locator('text=Parcial 1/3').waitFor({ timeout: 20000 });
await tarjeta.locator('button:has-text("Recibido lavado")').click();
await tarjeta.locator('text=Devuelto lavado').waitFor({ timeout: 20000 });
paso('uniformes ok');
await shot('uniformes');

// 10. Novedades y Resumen
await p.goto(base + '/coordinacion?tab=novedades');
await shot('novedades');
await p.goto(base + '/coordinacion?tab=resumen');
await shot('resumen');
await p.goto(base + '/coordinacion?tab=pedidos');
await p.click('label:has-text("Calendario")');
await p.waitForSelector('.calendario');
await shot('calendario');
await p.click('label:has-text("Tablero")');
await shot('tablero');

// 11. Reporte xlsx
const resp = await ctx.request.get(base + '/api/reporte');
const buf = await resp.body();
writeFileSync('/tmp/reporte.xlsx', buf);
paso('reporte: ' + resp.status() + ' ' + buf.length + ' bytes');
const m = await ctx.request.get(base + '/api/matriz/1');
paso('matriz: ' + m.status() + ' ' + (await m.body()).length + ' bytes');

// 12. Horarios: avisos a docentes preparados
await p.goto(base + '/horarios');
await p.waitForSelector('text=Correos a docentes');
const avisos = await p.locator('h4:has-text("Ausencia justificada")').allTextContents();
paso('avisos a docentes: ' + JSON.stringify(avisos));
await shot('horarios-avisos');

// 13. Móvil
const mov = await ctx.newPage();
await mov.setViewportSize({ width: 400, height: 800 });
await mov.goto(base + '/coordinacion?tab=pedidos');
await mov.evaluate(() => localStorage.setItem('pf_vista', 'tabla'));
await mov.reload();
await mov.click('table tbody tr:has-text("Feria")');
await mov.waitForSelector('aside');
await mov.screenshot({ path: `${shots}/movil-panel.png`, fullPage: true });

console.log(errores.length ? 'ERRORES:\n' + errores.join('\n') : 'sin errores de consola');
await b.close();
