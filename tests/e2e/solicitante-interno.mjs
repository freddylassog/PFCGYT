// Solicitantes internos frecuentes: se registran en Resumen → Ajustes; al escribir su correo en el formulario público el pedido
// se reconoce como interno (sin preguntar el tipo), no pide adjunto y prellena nombre, cargo e institución.
// Uso: node tests/e2e/solicitante-interno.mjs  (app en local)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots';
const psql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '5433', '-U', 'postgres', '-d', 'protocolo', '-tAc', q], { encoding: 'utf8' }).trim();
const paso = (t) => console.log('·', t);
const errores = [];
const correo = 'prueba.interna@ute.edu.ec';
const evento = 'Pedido interno ' + Date.now();
const fecha = (() => { const d = new Date(); d.setDate(d.getDate() + 12); while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
psql(`update settings set solicitantes_internos = '[]'::jsonb`);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });

// 1. Coordinación registra a la solicitante interna
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
await p.goto(base + '/coordinacion?tab=resumen');
await p.click('button:has-text("Agregar solicitante")');
await p.fill('#si-nombre-0', 'Prueba Interna');
await p.fill('#si-cargo-0', 'Docente de la facultad');
await p.fill('#si-correo-0', 'PRUEBA.INTERNA@ute.edu.ec');
await p.click('button:has-text("Guardar solicitantes")');
await p.waitForSelector('text=Guardado.', { timeout: 15000 });
const guardado = psql(`select solicitantes_internos::text from settings where actual`);
if (!/"correo": ?"prueba\.interna@ute\.edu\.ec"/.test(guardado) || !/Prueba Interna/.test(guardado)) throw new Error('no se guardó la solicitante interna: ' + guardado);
paso('Ajustes: solicitante interna guardada (correo normalizado en minúsculas)');
// Validación: sin correo válido no se guarda
await p.click('button:has-text("Agregar solicitante")');
await p.fill('#si-nombre-1', 'Sin Correo');
await p.click('button:has-text("Guardar solicitantes")');
await p.waitForSelector('text=necesita nombre y correo válido', { timeout: 15000 });
await p.click('div:has(> #si-nombre-1) button:has-text("Quitar")');
paso('Ajustes: una fila sin correo válido no se guarda');

// 2. Formulario público: con el correo se reconoce, sin tipo ni adjunto
const pub = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
pub.on('pageerror', (e) => errores.push('PAGEERROR pub ' + e.message));
await pub.goto(base + '/');
await pub.fill('#correo', 'Prueba.Interna@ute.edu.ec');
await pub.waitForSelector('text=Solicitante interno reconocido', { timeout: 15000 });
if ((await pub.inputValue('#nombre')) !== 'Prueba Interna' || (await pub.inputValue('#cargo')) !== 'Docente de la facultad' || (await pub.inputValue('#institucion')) !== 'Universidad UTE') throw new Error('no se prellenaron nombre, cargo e institución');
if ((await pub.locator('button:has-text("Externo")').count()) !== 0) throw new Error('a un solicitante interno no se le pregunta el tipo de evento');
paso('formulario: reconocida por el correo, datos prellenados, sin pregunta interno/externo');
await pub.click('button:has-text("Continuar")');
if ((await pub.locator('input[type=file]').count()) !== 0) throw new Error('no debería pedir adjunto');
await pub.waitForSelector('text=Sin adjunto: como solicitante interno, este formulario es tu pedido formal.');
await pub.fill('#evento', evento);
await pub.fill('#dia-fecha-0', fecha);
await pub.fill('#dia-inicio-0', '10:00');
await pub.fill('#dia-fin-0', '12:00');
await pub.fill('#dia-lugar-0', 'Aula magna');
await pub.fill('#responsable', 'Prueba Interna');
await pub.fill('#telefono', '099 123 4567');
await pub.waitForTimeout(700);
if (await pub.locator('button:has-text("Continuar")').isDisabled()) throw new Error('el paso 2 debería continuar sin adjunto: ' + (await pub.locator('text=Falta:').textContent().catch(() => '')));
await pub.click('button:has-text("Continuar")');
await pub.fill('#cantidad', '2');
await pub.click('label:has-text("Recepción y registro de invitados")');
await pub.click('label:has-text("Ubicación de autoridades")');
await pub.click('button:has-text("Continuar")');
const resumen = (await pub.locator('dl').first().textContent()).replace(/\s+/g, ' ');
if (!/Interno/.test(resumen) || !/No requerida \(solicitante interno\)/.test(resumen)) throw new Error('el resumen no refleja interno sin evidencia: ' + resumen.slice(0, 300));
await pub.screenshot({ path: shots + '/solicitante-interno-resumen.png', fullPage: true, caret: 'initial' });
await pub.click('label:has-text("Acepto estos compromisos")');
await pub.click('button:has-text("Registrar pedido")');
await pub.waitForSelector('text=Pedido registrado', { timeout: 15000 });
const codigo = (await pub.locator('h2').first().textContent()).trim();
const fila = psql(`select tipo || '|' || convenio || '|' || coalesce(evidencia_path, '') || '|' || nombre || '|' || correo_solicitante from requests where codigo = '${codigo}'`);
if (fila !== `interno|si||Prueba Interna|${correo}`) throw new Error('el pedido no quedó como interno sin adjunto: ' + fila);
paso(`pedido ${codigo} registrado como interno, sin adjunto, con los datos de la solicitante`);

// 3. Por nombre: al escribir nombre y apellido se completan cargo, institución y correo
const porNombre = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
porNombre.on('pageerror', (e) => errores.push('PAGEERROR nombre ' + e.message));
await porNombre.goto(base + '/');
await porNombre.fill('#nombre', 'prueba interna');
await porNombre.waitForSelector('text=Solicitante interno reconocido', { timeout: 15000 });
if ((await porNombre.inputValue('#correo')) !== correo || (await porNombre.inputValue('#cargo')) !== 'Docente de la facultad' || (await porNombre.inputValue('#institucion')) !== 'Universidad UTE') throw new Error('por nombre no se completaron correo, cargo e institución');
if ((await porNombre.inputValue('#nombre')) !== 'prueba interna') throw new Error('el nombre escrito no debe cambiar');
paso('formulario: con nombre y apellido se completan correo, cargo e institución');
const soloNombre = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await soloNombre.goto(base + '/');
await soloNombre.fill('#nombre', 'Prueba');
await soloNombre.waitForTimeout(900);
if ((await soloNombre.locator('text=Solicitante interno reconocido').count()) !== 0) throw new Error('una sola palabra no debe reconocer a nadie');
paso('formulario: una sola palabra no reconoce a nadie');

// 4. Un correo desconocido sigue con el flujo normal (tipo y adjunto)
const otro = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await otro.goto(base + '/');
await otro.fill('#correo', 'alguien@ejemplo.com');
await otro.waitForTimeout(900);
if ((await otro.locator('button:has-text("Externo")').count()) !== 1 || (await otro.locator('text=Solicitante interno reconocido').count()) !== 0) throw new Error('un correo desconocido debe ver la pregunta del tipo');
paso('un correo desconocido sigue viendo tipo de evento y adjunto');

// Limpieza
psql(`delete from requests where codigo = '${codigo}'`);
psql(`update settings set solicitantes_internos = '[]'::jsonb`);
paso('limpieza: pedido y solicitante de prueba eliminados');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
