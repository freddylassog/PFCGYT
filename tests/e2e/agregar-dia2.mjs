// Evento de dos días con el día 1 lleno y cupo en el día 2: coordinación debe poder sumar estudiantes al día 2.
// - Valeria pidió solo el día 1 y fue rechazada; luego se la agrega directamente → queda en el día 2.
// - Mateo pidió solo el día 1 (lleno) → botón «Aceptar en D2».
// Uso: node tests/e2e/agregar-dia2.mjs  (app en local con estudiantes cargados; ver flujo.mjs)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE_URL || 'http://localhost:3000';
const psql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '5433', '-U', 'postgres', '-d', 'protocolo', '-tAc', q], { encoding: 'utf8' }).trim();
const paso = (t) => console.log('·', t);
const nombre = 'Congreso dos dias ' + Date.now();
// Día 1: 2 estudiantes · día 2: 1 estudiante (modo «distintos»)
const salida = execFileSync('node', ['tests/e2e/crear-pedido.mjs', '2026-12-16', '09:00', '13:00', nombre, 'interno', '2026-12-17', 'distintos'], { encoding: 'utf8' });
const codigo = (salida.match(/CREADO (SOL-\d{4}-\d{3})/) || [])[1];
if (!codigo) throw new Error('no se creó el pedido: ' + salida);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('dialog', (d) => d.accept(codigo));
const abrir = async () => { await p.goto(base + '/coordinacion?tab=pedidos'); await p.click(`table tbody tr:has-text("${codigo}")`); await p.waitForSelector('aside'); };
const fila = (n) => p.locator(`aside .linea-item:has-text("${n}")`).first();
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
await abrir();
await p.click('button:has-text("Aprobar y convocar estudiantes")');
await p.waitForSelector('text=Convocatoria abierta', { timeout: 20000 });

// Inscripciones por el portal: Andrés, Camila, Valeria y Mateo, todos solo al día 1
const inscribir = async (correo) => {
  const est = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await est.goto(base + '/estudiante?clave=' + codigo);
  await est.fill('#correo', correo);
  await est.click('button:has-text("Ingresar")');
  await est.waitForSelector(`text=${nombre}`, { timeout: 15000 });
  const card = est.locator(`.blueprint:has-text("${nombre}")`).first();
  const dia2 = card.locator('label:has-text("Día 2") input');
  if (await dia2.isChecked()) await card.locator('label:has-text("Día 2")').click();
  await card.locator('button:has-text("Inscribirme")').click();
  await est.waitForSelector('text=por confirmar', { timeout: 15000 });
  await est.context().close();
};
for (const c of ['andres.molina@ute.edu.ec', 'camila.rios@ute.edu.ec', 'valeria.suarez@ute.edu.ec']) await inscribir(c);
paso('Andrés, Camila y Valeria inscritos solo al día 1');
await abrir();
await fila('Andrés').locator('button:has-text("Aceptar")').click();
await p.waitForSelector('aside .linea-item:has-text("Andrés") button:has-text("Quitar")', { timeout: 15000 });
await fila('Camila').locator('button:has-text("Aceptar")').click();
await p.waitForSelector('aside .linea-item:has-text("Camila") button:has-text("Quitar")', { timeout: 15000 });
await fila('Valeria').locator('button:has-text("Rechazar")').click();
await p.waitForSelector('aside .linea-item:has-text("Valeria")', { state: 'detached', timeout: 15000 });
paso('día 1 lleno (Andrés y Camila); Valeria rechazada');
// Mateo pide el día 1 cuando ya está lleno: el portal no lo deja, así que se simula una inscripción antigua solo al día 1
const mateo = psql(`select id from students where nombre = 'Mateo Castro' and activo limit 1`);
psql(`insert into enrollments (request_id, student_id, estado, dias) select id, '${mateo}', 'inscrito', '["2026-12-16"]'::jsonb from requests where codigo = '${codigo}'`);

// 1. Valeria (rechazada al día 1) se agrega directamente → queda en el día 2
await abrir();
const sel = p.locator('aside select[aria-label="Agregar estudiante directamente"]');
const op = (await sel.locator('option').allTextContents()).find((o) => o.includes('Valeria Suárez'));
if (!op) throw new Error('Valeria debería poder agregarse');
await sel.selectOption({ label: op });
await p.click('aside button:has-text("Confirmar")');
await p.waitForSelector('aside .linea-item:has-text("Valeria") button:has-text("Quitar")', { timeout: 15000 }).catch(async () => {
  throw new Error('no se pudo agregar a Valeria al día 2: ' + ((await p.locator('aside [role=alert]').allTextContents()).join(' | ') || 'sin mensaje'));
});
const diasValeria = await fila('Valeria').locator('button[aria-pressed="true"]').allTextContents();
if (diasValeria.join() !== 'D2') throw new Error('Valeria debería quedar solo en el día 2: ' + diasValeria.join());
paso('Valeria (rechazada antes) agregada directamente: queda en el día 2');
// Ahora el día 2 también está lleno: Mateo (pidió el día 1) no se puede aceptar y lo dice junto a su fila
const fm = fila('Mateo');
if (!(await fm.locator('button:has-text("Aceptar")').first().isDisabled())) throw new Error('con los dos días llenos, Mateo no debería poder aceptarse');
paso('con los dos días llenos, Mateo queda sin cupo');

// 2. Se quita a Valeria: Mateo (pidió el día 1, lleno) tiene el botón «Aceptar en D2»
await fila('Valeria').locator('button:has-text("Quitar")').click();
await p.waitForSelector('aside .linea-item:has-text("Valeria")', { state: 'detached', timeout: 15000 });
await fm.locator('button:has-text("Aceptar en D2")').click();
await p.waitForSelector('aside .linea-item:has-text("Mateo") button:has-text("Quitar")', { timeout: 15000 });
if ((await fila('Mateo').locator('button[aria-pressed="true"]').allTextContents()).join() !== 'D2') throw new Error('Mateo debería quedar en el día 2');
paso('Mateo (pidió el día 1 lleno) aceptado con «Aceptar en D2»');

// 3. Un error al agregar se ve junto a la sección de estudiantes (no al fondo del panel)
const otroSel = p.locator('aside select[aria-label="Agregar estudiante directamente"]');
if ((await otroSel.count()) !== 0) throw new Error('con los dos días llenos no debe ofrecer agregar');
paso('con todo lleno ya no ofrece agregar');

// Limpieza
await p.click('aside button:has-text("Eliminar pedido")');
await p.waitForSelector(`table tbody tr:has-text("${codigo}")`, { state: 'detached', timeout: 15000 });
paso('pedido de prueba eliminado');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
