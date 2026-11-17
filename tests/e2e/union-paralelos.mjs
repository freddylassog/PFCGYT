// Paralelos unidos: en 1.º las materias de aula (≤ 2 h por día) se toman de 1C para todos; los talleres siguen por paralelo.
// Clases de prueba por psql: «Prueba Aula» en 1A (lunes 07–09, NRC 9101) y 1C (miércoles 07–09, NRC 9301);
// «Prueba Taller» en 1A (miércoles 07–12, NRC 9102). Andrés (1.º) tiene los NRC de 1A.
// Uso: node tests/e2e/union-paralelos.mjs  (app en local tras flujo.mjs)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE_URL || 'http://localhost:3000';
const psql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '5433', '-U', 'postgres', '-d', 'protocolo', '-tAc', q], { encoding: 'utf8' }).trim();
const paso = (t) => console.log('·', t);
const errores = [];
const limpiar = () => {
  psql(`delete from student_classes where nrc in ('9101','9102','9301')`);
  psql(`delete from classes where materia in ('Prueba Aula','Prueba Taller')`);
};
limpiar();
psql(`update settings set union_paralelos = '[{"semestre":1,"paralelo":"C","horasMax":2}]'::jsonb where actual`);
psql(`insert into classes (periodo, semestre, paralelo, dia, inicio, fin, materia, nrc, activo) select periodo, 1, v.p, v.d, v.i::time, v.f::time, v.m, v.n, true from settings, (values ('A',1,'07:00','09:00','Prueba Aula','9101'), ('C',3,'07:00','09:00','Prueba Aula','9301'), ('A',3,'07:00','12:00','Prueba Taller','9102')) as v(p,d,i,f,m,n) where actual`);
const andres = psql(`select id from students where nombre = 'Andrés Molina' and activo limit 1`);
if (!andres) throw new Error('falta Andrés Molina (corre flujo.mjs antes)');
psql(`insert into student_classes (student_id, nrc) values ('${andres}','9101'), ('${andres}','9102') on conflict do nothing`);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');

// 1. Horarios → 1.º: «Prueba Aula» solo con la clase de 1C (miércoles), marcada «todos», y la de 1A sin efecto
await p.goto(base + '/horarios');
await p.click('label:has-text("1.º")');
await p.waitForSelector('table tbody tr:has-text("Prueba Aula")');
const filasAula = await p.locator('table tbody tr:has-text("Prueba Aula")').allTextContents();
if (filasAula.length !== 1 || !/Miércoles/.test(filasAula[0]) || !/todos/.test(filasAula[0])) throw new Error('Prueba Aula debería verse solo en 1C (miércoles) con «todos»: ' + JSON.stringify(filasAula));
const matric = (await p.locator('table tbody tr:has-text("Prueba Aula")').first().locator('td').nth(4).textContent()).trim();
if (matric !== '1') throw new Error('Andrés (NRC de 1A) debería contar como matriculado en la clase unida: ' + matric);
const taller = await p.locator('table tbody tr:has-text("Prueba Taller")').allTextContents();
if (taller.length !== 1 || /todos/.test(taller[0])) throw new Error('el taller de 1A debe seguir por paralelo: ' + JSON.stringify(taller));
if (!/Sin efecto 1 clase\(s\) de aula de otros paralelos: Prueba Aula/.test(await p.locator('text=semestre unido').first().textContent())) throw new Error('falta el aviso de la unión');
paso('Horarios: Prueba Aula solo en 1C (todos, 1 matriculado), taller de 1A intacto, aviso de clases sin efecto');

// 2. Cruce: un evento el miércoles 07–10 cruza con la clase unida (1C) y con su taller (1A); uno el lunes ya no cruza con 1A
const crear = async (fecha, inicio, fin, nombre) => {
  const out = execFileSync('node', ['tests/e2e/crear-pedido.mjs', fecha, inicio, fin, nombre, 'interno'], { encoding: 'utf8' });
  const c = (out.match(/CREADO (SOL-\d{4}-\d{3})/) || [])[1];
  if (!c) throw new Error('no se creó el pedido: ' + out);
  return c;
};
const proximo = (dow) => { const d = new Date(); d.setDate(d.getDate() + 5); while (d.getDay() !== dow) d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const codigoMie = await crear(proximo(3), '07:00', '10:00', 'Union miercoles ' + Date.now());
const codigoLun = await crear(proximo(1), '07:00', '09:00', 'Union lunes ' + Date.now());
p.on('dialog', (d) => d.accept(d.message().match(/SOL-\d{4}-\d{3}/)?.[0] ?? ''));
const confirmarAndres = async (codigo) => {
  await p.goto(base + '/coordinacion?tab=pedidos');
  await p.click(`table tbody tr:has-text("${codigo}")`);
  await p.waitForSelector('aside');
  await p.click('aside button:has-text("Aprobar y convocar estudiantes")');
  await p.waitForSelector('text=Convocatoria abierta', { timeout: 20000 });
  const sel = p.locator('aside select[aria-label="Agregar estudiante directamente"]');
  const op = (await sel.locator('option').allTextContents()).find((o) => o.includes('Andrés Molina'));
  await sel.selectOption({ label: op });
  await p.click('aside button:has-text("Confirmar")');
  await p.waitForSelector('aside .linea-item:has-text("Andrés Molina") button:has-text("Quitar")', { timeout: 15000 });
  await p.waitForTimeout(400);
  const t = (await p.locator('aside').textContent()).replace(/\s+/g, ' ');
  return t.slice(t.indexOf('Cruce con clases'), t.indexOf('Cruce con clases') + 900);
};
const mie = await confirmarAndres(codigoMie);
if (!/Prueba Aula · 1\.º semestre · paralelo C · miércoles/.test(mie) || !/Prueba Taller · 1\.º semestre · paralelo A · miércoles/.test(mie)) throw new Error('miércoles: debería cruzar con Prueba Aula (1C) y Prueba Taller (1A): ' + mie);
paso('evento el miércoles: cruza con la clase de aula de 1C y con su taller de 1A');
const lun = await confirmarAndres(codigoLun);
if (/Prueba Aula/.test(lun)) throw new Error('lunes: la Prueba Aula de 1A ya no se dicta: ' + lun);
paso('evento el lunes: la clase de aula de 1A ya no cuenta');

// 3. Quitar la unión desde Horarios: vuelve la clase de 1A
await p.goto(base + '/horarios');
await p.click('form:has(h6:has-text("Paralelos unidos")) button:has-text("Quitar")');
await p.click('form:has(h6:has-text("Paralelos unidos")) button:has-text("Guardar")');
await p.waitForSelector('form:has(h6:has-text("Paralelos unidos")) >> text=Guardado.', { timeout: 15000 });
await p.reload();
await p.click('label:has-text("1.º")');
await p.waitForSelector('table tbody tr:has-text("Prueba Aula")');
if ((await p.locator('table tbody tr:has-text("Prueba Aula")').count()) !== 2) throw new Error('sin unión deberían verse las dos clases de Prueba Aula');
paso('sin unión: vuelven las clases de aula de cada paralelo');
// Volver a unir desde el formulario
await p.click('form:has(h6:has-text("Paralelos unidos")) button:has-text("Agregar unión")');
await p.click('form:has(h6:has-text("Paralelos unidos")) button:has-text("Guardar")');
await p.waitForSelector('form:has(h6:has-text("Paralelos unidos")) >> text=Guardado.', { timeout: 15000 });
if (psql(`select union_paralelos = '[{"semestre":1,"paralelo":"C","horasMax":2}]'::jsonb from settings where actual`) !== 't') throw new Error('no se guardó la unión: ' + psql(`select union_paralelos::text from settings where actual`));
paso('unión 1.º con 1C (talleres > 2 h) guardada desde Horarios');

// Limpieza
for (const c of [codigoMie, codigoLun]) psql(`delete from requests where codigo = '${c}'`);
limpiar();
paso('limpieza: pedidos y clases de prueba eliminados');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
