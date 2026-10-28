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
const hoyISO = (() => { const d = new Date(); d.setHours(12); return d.toISOString().slice(0, 10); })();
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

// Sin la marca, un solicitante interno respeta la anticipación mínima: un pedido para hoy se bloquea
const conPlazo = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await conPlazo.goto(base + '/');
await conPlazo.fill('#correo', correo);
await conPlazo.waitForSelector('text=Solicitante interno reconocido', { timeout: 15000 });
if ((await conPlazo.locator('text=Sin restricción de fecha').count()) !== 0) throw new Error('sin la marca no debe decir "sin restricción de fecha"');
await conPlazo.click('button:has-text("Continuar")');
await conPlazo.fill('#evento', 'Hoy mismo');
await conPlazo.fill('#dia-fecha-0', hoyISO);
await conPlazo.fill('#dia-lugar-0', 'Aula');
await conPlazo.waitForSelector('text=No se puede registrar el pedido', { timeout: 15000 });
if (!(await conPlazo.locator('button:has-text("Continuar")').isDisabled())) throw new Error('con la anticipación mínima, un pedido para hoy debe bloquearse');
paso('formulario: sin la marca, un pedido para hoy se bloquea por la anticipación mínima');
// Coordinación marca «Sin restricción de fecha» a la solicitante de prueba
await p.click('label:has(#si-libre-0)');
await p.click('button:has-text("Guardar solicitantes")');
await p.waitForSelector('text=Guardado.', { timeout: 15000 });
if (!/"sinAnticipacion": ?true/.test(psql(`select solicitantes_internos::text from settings where actual`))) throw new Error('no se guardó la marca sin anticipación');
paso('Ajustes: marcada «Sin restricción de fecha»');

// 2. Formulario público: con el correo se reconoce, sin tipo ni adjunto
const pub = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
pub.on('pageerror', (e) => errores.push('PAGEERROR pub ' + e.message));
await pub.goto(base + '/');
await pub.fill('#correo', 'Prueba.Interna@ute.edu.ec');
await pub.waitForSelector('text=Solicitante interno reconocido', { timeout: 15000 });
await pub.waitForSelector('text=Sin restricción de fecha: puedes registrar incluso para hoy.', { timeout: 15000 });
if ((await pub.inputValue('#nombre')) !== 'Prueba Interna' || (await pub.inputValue('#cargo')) !== 'Docente de la facultad' || (await pub.inputValue('#institucion')) !== 'Universidad UTE') throw new Error('no se prellenaron nombre, cargo e institución');
if ((await pub.locator('button:has-text("Externo")').count()) !== 0) throw new Error('a un solicitante interno no se le pregunta el tipo de evento');
paso('formulario: reconocida por el correo, datos prellenados, sin pregunta interno/externo');
await pub.click('button:has-text("Continuar")');
if ((await pub.locator('input[type=file]').count()) !== 0) throw new Error('no debería pedir adjunto');
await pub.waitForSelector('text=Sin adjunto: como solicitante interno, este formulario es tu pedido formal.');
await pub.fill('#evento', evento);
await pub.fill('#dia-fecha-0', hoyISO); // para hoy: sin restricción de fecha
await pub.fill('#dia-inicio-0', '10:00');
await pub.fill('#dia-fin-0', '12:00');
await pub.fill('#dia-lugar-0', 'Aula magna');
await pub.fill('#responsable', 'Prueba Interna');
await pub.fill('#telefono', '099 123 4567');
await pub.waitForTimeout(700);
if ((await pub.locator('text=No se puede registrar el pedido').count()) !== 0) throw new Error('con la marca no debe bloquear un pedido para hoy');
if (!/Hoy · sin restricción de fecha/.test(await pub.locator('p:has-text("Plazo:")').textContent())) throw new Error('el plazo debería decir "Hoy · sin restricción de fecha"');
if (await pub.locator('button:has-text("Continuar")').isDisabled()) throw new Error('el paso 2 debería continuar sin adjunto ni anticipación: ' + (await pub.locator('text=Falta:').textContent().catch(() => '')));
await pub.click('button:has-text("Continuar")');
await pub.fill('#cantidad', '2');
await pub.click('label:has-text("Recepción y registro de invitados")');
await pub.click('label:has-text("Ubicación de autoridades")');
// Vestimenta «Otra»: se describe con palabras propias (ya no existe «No aplica · informal» al pedir)
if ((await pub.locator('label:has-text("No aplica")').count()) !== 0) throw new Error('"No aplica · informal" no debe ofrecerse al pedir');
await pub.click('label:has-text("Otra (escríbela)")');
if (await pub.locator('button:has-text("Continuar")').isEnabled()) throw new Error('con «Otra» sin descripción no debe continuar');
await pub.fill('#vest-detalle', 'Camiseta del evento y jean');
await pub.click('button:has-text("Continuar")');
const resumen = (await pub.locator('dl').first().textContent()).replace(/\s+/g, ' ');
if (!/Interno/.test(resumen) || !/No requerida \(solicitante interno\)/.test(resumen) || !/Camiseta del evento y jean/.test(resumen)) throw new Error('el resumen no refleja interno sin evidencia y la vestimenta descrita: ' + resumen.slice(0, 300));
await pub.screenshot({ path: shots + '/solicitante-interno-resumen.png', fullPage: true, caret: 'initial' });
await pub.click('label:has-text("Acepto estos compromisos")');
await pub.click('button:has-text("Registrar pedido")');
await pub.waitForSelector('text=Pedido registrado', { timeout: 15000 });
const codigo = (await pub.locator('h2').first().textContent()).trim();
const fila = psql(`select tipo || '|' || convenio || '|' || coalesce(evidencia_path, '') || '|' || nombre || '|' || correo_solicitante || '|' || vestimenta || '|' || vestimenta_detalle from requests where codigo = '${codigo}'`);
if (fila !== `interno|si||Prueba Interna|${correo}|otra|Camiseta del evento y jean`) throw new Error('el pedido no quedó como interno sin adjunto con vestimenta descrita: ' + fila);
if (psql(`select fecha::text from requests where codigo = '${codigo}'`) !== hoyISO) throw new Error('el pedido debería quedar para hoy');
paso(`pedido ${codigo} registrado como interno, sin adjunto y para hoy (sin restricción de fecha)`);
void fecha;

// 3. Por nombre: al escribir nombre y apellido se completan cargo, institución y correo
const porNombre = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
porNombre.on('pageerror', (e) => errores.push('PAGEERROR nombre ' + e.message));
await porNombre.goto(base + '/');
await porNombre.fill('#nombre', 'prueba interna');
await porNombre.waitForSelector('text=Solicitante interno reconocido', { timeout: 15000 });
if ((await porNombre.inputValue('#correo')) !== correo || (await porNombre.inputValue('#cargo')) !== 'Docente de la facultad' || (await porNombre.inputValue('#institucion')) !== 'Universidad UTE') throw new Error('por nombre no se completaron correo, cargo e institución');
if ((await porNombre.inputValue('#nombre')) !== 'prueba interna') throw new Error('el nombre escrito no debe cambiar');
paso('formulario: con nombre y apellido se completan correo, cargo e institución');
// Al borrar el nombre y escribir otro, lo completado automáticamente se borra (no se quedan los datos de la persona anterior)
await porNombre.fill('#nombre', '');
await porNombre.waitForSelector('text=Solicitante interno reconocido', { state: 'detached', timeout: 15000 });
await porNombre.fill('#nombre', 'Otra Persona');
await porNombre.waitForTimeout(900);
if ((await porNombre.inputValue('#correo')) !== '' || (await porNombre.inputValue('#cargo')) !== '' || (await porNombre.inputValue('#institucion')) !== '') throw new Error('al cambiar de nombre deben borrarse los datos completados: ' + JSON.stringify([await porNombre.inputValue('#correo'), await porNombre.inputValue('#cargo'), await porNombre.inputValue('#institucion')]));
if ((await porNombre.locator('button:has-text("Externo")').count()) !== 1) throw new Error('con otro nombre debe volver la pregunta del tipo');
// Lo escrito a mano no se toca: cargo propio + nombre reconocido → se completan solo correo e institución
await porNombre.fill('#cargo', 'Mi cargo');
await porNombre.fill('#nombre', 'Prueba Interna');
await porNombre.waitForSelector('text=Solicitante interno reconocido', { timeout: 15000 });
if ((await porNombre.inputValue('#cargo')) !== 'Mi cargo' || (await porNombre.inputValue('#correo')) !== correo) throw new Error('el cargo escrito a mano no debe cambiar y el correo sí completarse');
paso('formulario: al cambiar de nombre se borra lo completado; lo escrito a mano se respeta');
// Por correo: se completa el nombre; al borrar el correo se borra todo lo completado
const porCorreo = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await porCorreo.goto(base + '/');
await porCorreo.fill('#correo', correo);
await porCorreo.waitForSelector('text=Solicitante interno reconocido', { timeout: 15000 });
if ((await porCorreo.inputValue('#nombre')) !== 'Prueba Interna') throw new Error('por correo debe completarse el nombre');
await porCorreo.fill('#correo', '');
await porCorreo.waitForSelector('text=Solicitante interno reconocido', { state: 'detached', timeout: 15000 });
if ((await porCorreo.inputValue('#nombre')) !== '' || (await porCorreo.inputValue('#cargo')) !== '') throw new Error('al borrar el correo deben borrarse nombre y cargo completados');
paso('formulario: por correo se completa el nombre y al borrarlo se limpia todo');
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
