// Evento de dos días con cantidades por día: la estudiante se inscribe solo al día 2, coordinación ve los cupos por día y la confirma.
// Uso: node tests/e2e/dos-dias.mjs  (app en local con estudiantes cargados; ver flujo.mjs)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots';
const nombre = 'Congreso dos días ' + Date.now();
const salida = execFileSync('node', ['tests/e2e/crear-pedido.mjs', '2026-12-14', '09:00', '13:00', nombre, 'interno', '2026-12-15'], { encoding: 'utf8' });
const codigo = (salida.match(/CREADO (SOL-\d{4}-\d{3})/) || [])[1];
if (!codigo || !/LUGAR COPIADO/.test(salida)) throw new Error('no se creó el pedido de dos días: ' + salida);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
p.on('dialog', (d) => d.accept(codigo));
const paso = (t) => console.log('·', t);

await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
await p.click(`table tbody tr:has-text("${codigo}")`);
await p.waitForSelector('aside');
const panel = (await p.locator('aside').textContent()).replace(/\s+/g, ' ');
if (!/Por día: día 1 \(14 dic\): 0\/2 · día 2 \(15 dic\): 0\/1/.test(panel)) throw new Error('el panel no muestra los cupos por día: ' + panel.slice(0, 400));
if (!/D1 · Recepción y registro de invitados · 2/.test(panel) || !/D2 · Ubicación de autoridades · 1/.test(panel)) throw new Error('el panel no muestra las actividades por día: ' + panel.slice(0, 400));
paso('panel: cupos por día 2 y 1, actividades por día');
await p.click('button:has-text("Aprobar y convocar estudiantes")');
await p.waitForSelector('text=Convocatoria abierta', { timeout: 20000 });

// Estudiante: solo puede el día 2
const est = await ctx.newPage();
est.on('pageerror', (e) => errores.push('PAGEERROR est ' + e.message));
await est.goto(base + '/estudiante?clave=' + codigo);
await est.fill('#correo', 'camila.rios@ute.edu.ec');
await est.click('button:has-text("Ingresar")');
await est.waitForSelector(`text=${nombre}`, { timeout: 15000 });
const card = est.locator(`.blueprint:has-text("${nombre}")`).first();
await card.locator('label:has-text("Día 1")').click(); // desmarca el día 1
await card.locator('button:has-text("Inscribirme")').click();
await est.waitForSelector('text=por confirmar', { timeout: 15000 });
paso('estudiante inscrita solo al día 2');

// Coordinación: chips D1 apagado / D2 encendido, acepta, cupos por día
await p.reload();
await p.click(`table tbody tr:has-text("${codigo}")`);
await p.waitForSelector('aside button:has-text("Aceptar")');
const fila = p.locator('aside .linea-item:has-text("Camila")').first();
if ((await fila.locator('button[aria-pressed="true"]').allTextContents()).join() !== 'D2') throw new Error('los chips no muestran solo D2: ' + (await fila.textContent()));
await fila.locator('button:has-text("Aceptar")').click();
await p.waitForSelector('text=/día 1 \\(14 dic\\): 0\\/2 · día 2 \\(15 dic\\): 1\\/1/', { timeout: 15000 });
paso('confirmada: día 1 0/2 · día 2 1/1');
// La coordinación le agrega el día 1 con el chip
await p.locator('aside .linea-item:has-text("Camila") button:has-text("D1")').first().click();
await p.waitForSelector('text=/día 1 \\(14 dic\\): 1\\/2 · día 2 \\(15 dic\\): 1\\/1/', { timeout: 15000 });
paso('chip D1: ahora va los dos días (1/2 · 1/1)');
await p.screenshot({ path: shots + '/dos-dias-panel.png', fullPage: false, caret: 'initial' });
// Portal: sus días y horas
await est.reload();
await est.waitForSelector('text=Tus días');
const horario = (await est.locator(`.blueprint:has-text("${nombre}")`).first().locator('text=Tu horario').locator('..').textContent()).replace(/\s+/g, ' ');
if (!/Tus días: 14 dic, 15 dic/.test(horario) || !/8 h/.test(horario)) throw new Error('el portal no muestra sus días: ' + horario);
paso('portal: ' + horario.trim());
// Limpieza
await p.click('aside button:has-text("Eliminar pedido")');
await p.waitForSelector(`table tbody tr:has-text("${codigo}")`, { state: 'detached', timeout: 15000 });
paso('pedido de prueba eliminado');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
