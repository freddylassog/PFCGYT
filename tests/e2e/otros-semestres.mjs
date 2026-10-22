// Estudiantes de otros semestres (4.º en adelante): se agregan a mano, aparecen en "Otros semestres", se confirman en un evento
// y retiran uniforme como cualquiera.
// Uso: node tests/e2e/otros-semestres.mjs  (app en local con la Feria aprobada; ver flujo.mjs)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE_URL || 'http://localhost:3000';
const psql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '5433', '-U', 'postgres', '-d', 'protocolo', '-tAc', q], { encoding: 'utf8' }).trim();
const paso = (t) => console.log('·', t);
const errores = [];
const nombre = 'Quinto Prueba Apoyo';
psql(`delete from students where nombre = '${nombre}'`);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');

// 1. Alta a mano con semestre 5
await p.goto(base + '/coordinacion?tab=estudiantes');
await p.click('button:has-text("Agregar o editar a mano")');
const form = p.locator('form:has(h6:has-text("Nuevo estudiante"))');
await form.locator('input').nth(0).fill(nombre);
const opciones = await form.locator('div.field:has(label:has-text("Semestre")) select option').allTextContents();
if (!opciones.some((o) => /5\.º \(fuera del programa\)/.test(o))) throw new Error('el selector de semestre no ofrece 5.º: ' + opciones.join(' | '));
await form.locator('div.field:has(label:has-text("Semestre")) select').selectOption('5');
await form.locator('div.field:has(label:has-text("Género")) select').selectOption('M');
await form.locator('button:has-text("Guardar")').click();
await p.waitForSelector('h3:has-text("Otros semestres")', { timeout: 15000 });
const fila = (await p.locator(`table tbody tr:has-text("${nombre}")`).first().textContent()).replace(/\s+/g, ' ');
if (!/5\.º/.test(fila)) throw new Error('la fila no muestra 5.º: ' + fila);
if ((await p.locator(`h3:has-text("1.º semestre") ~ * table tbody tr:has-text("${nombre}")`).count()) !== 0) throw new Error('no debe aparecer en la matriz de 1.º');
paso('estudiante de 5.º creado a mano y listado en "Otros semestres"');

// 2. Confirmarlo directamente en la Feria
await p.goto(base + '/coordinacion?tab=pedidos');
await p.click('table tbody tr:has-text("Feria")');
await p.waitForSelector('aside');
const sel = p.locator('aside select[aria-label="Agregar estudiante directamente"]');
const op = (await sel.locator('option').allTextContents()).find((o) => o.includes(nombre));
if (!op) throw new Error('el estudiante de 5.º no está entre los que se pueden agregar');
await sel.selectOption({ label: op });
await p.click('aside button:has-text("Confirmar")');
await p.waitForSelector(`aside .linea-item:has-text("${nombre}") button:has-text("Quitar")`, { timeout: 15000 });
paso('confirmado directamente en la Feria');

// 3. Uniformes: aparece en la tarjeta del evento (En curso) y se le marca una prenda masculina
await p.goto(base + '/coordinacion?tab=uniformes');
const card = p.locator('.card:has-text("Feria")').first();
await card.waitFor({ timeout: 15000 });
const filaU = card.locator(`.linea-item:has-text("${nombre}")`).first();
if ((await filaU.locator('label.chip').count()) !== 6) throw new Error('debería tener las 6 prendas del uniforme masculino: ' + (await filaU.locator('label.chip').count()));
await filaU.locator('label.chip:has-text("Chaqueta")').click();
await filaU.locator('.tag:has-text("1 prenda")').waitFor({ timeout: 15000 });
if (psql(`select count(*) from uniform_items u join students s on s.id = u.student_id where s.nombre = '${nombre}' and u.item = 'Chaqueta'`) !== '1') throw new Error('la prenda no se registró');
paso('uniformes: chaqueta entregada al estudiante de 5.º');

// Limpieza
psql(`delete from students where nombre = '${nombre}'`);
paso('estudiante de prueba eliminado (con su inscripción y prenda)');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
