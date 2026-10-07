// Estudiantes sin correo: vínculo con el bot por nombre (y correo guardado después) y registro en el portal con nombre + correo + clave.
// Uso: node tests/e2e/registro.mjs  (app en local tras flujo.mjs: pedido SOL-2026-001 aprobado)
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE_URL || 'http://localhost:3000';
const psql = (q) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '5433', '-U', 'postgres', '-d', 'protocolo', '-tAc', q], { encoding: 'utf8' }).trim();
const secreto = createHash('sha256').update('telegram-webhook:' + (process.env.SESSION_SECRET || 'secreto-local-de-pruebas')).digest('hex').slice(0, 48);
const webhook = async (chatId, texto) => (await fetch(base + '/api/telegram/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': secreto }, body: JSON.stringify({ message: { chat: { id: chatId, type: 'private' }, text: texto, from: { first_name: 'Prueba' } } }) })).status;
const paso = (t) => console.log('·', t);
const errores = [];
psql(`delete from students where nombre like 'Prueba Registro%'`);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');

// Dos estudiantes sin correo, agregados a mano (como quedan tras el listado por materia)
await p.goto(base + '/coordinacion?tab=estudiantes');
for (const nombre of ['Prueba Registro Uno', 'Prueba Registro Dos']) {
  await p.click('button:has-text("Agregar o editar a mano")');
  const form = p.locator('form:has(h6:has-text("Nuevo estudiante"))');
  await form.locator('input').nth(0).fill(nombre);
  await form.locator('button:has-text("Guardar")').click();
  await p.waitForSelector(`table tbody tr:has-text("${nombre}")`, { timeout: 15000 });
}
if ((await p.locator('table tbody tr:has-text("Prueba Registro Uno") .tag:has-text("sin correo")').count()) !== 1) throw new Error('la estudiante sin correo debería marcarse');
paso('dos estudiantes sin correo creados a mano');

// Bot: vínculo por nombre y luego el correo se guarda en la ficha
if ((await webhook(777, '/start')) !== 200) throw new Error('webhook /start');
if ((await webhook(777, 'Prueba Registro')) !== 200) throw new Error('webhook nombre ambiguo'); // dos coinciden → pide apellidos
if (psql(`select count(*) from telegram_vinculos where chat_id = '777'`) !== '0') throw new Error('un nombre ambiguo no debe vincular');
if ((await webhook(777, 'prueba registro uno')) !== 200) throw new Error('webhook nombre');
if (psql(`select s.nombre from telegram_vinculos v join students s on s.id = v.student_id where v.chat_id = '777'`) !== 'Prueba Registro Uno') throw new Error('no se vinculó por nombre');
if ((await webhook(777, 'prueba.uno@ute.edu.ec')) !== 200) throw new Error('webhook correo');
if (psql(`select correo from students where nombre = 'Prueba Registro Uno'`) !== 'prueba.uno@ute.edu.ec') throw new Error('el correo no se guardó en la ficha');
if ((await webhook(777, 'otro.correo@ute.edu.ec')) !== 200) throw new Error('webhook segundo correo');
if (psql(`select correo from students where nombre = 'Prueba Registro Uno'`) !== 'prueba.uno@ute.edu.ec') throw new Error('no debe cambiar un correo ya guardado');
await p.reload();
const fila = (await p.locator('table tbody tr:has-text("Prueba Registro Uno")').first().textContent()).replace(/\s+/g, ' ');
if (!/Telegram/.test(fila) || !/prueba\.uno@ute\.edu\.ec/.test(fila)) throw new Error('la tabla no muestra el vínculo y el correo: ' + fila);
paso('bot: vinculada por nombre, correo guardado y visible en Estudiantes');

// Portal: registro con nombre + correo + clave
const est = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
est.on('pageerror', (e) => errores.push('PAGEERROR est ' + e.message));
await est.goto(base + '/estudiante?clave=SOL-2026-001');
await est.click('button:has-text("Primera vez")');
await est.fill('#nombre', 'Prueba Registro Dos');
await est.fill('#correo-reg', 'prueba.dos@ute.edu.ec');
await est.click('button:has-text("Registrarme e ingresar")');
await est.waitForTimeout(4000);
if ((await est.locator('h1:has-text("Mis eventos")').count()) !== 1) throw new Error('el registro no entró al portal: ' + (await est.locator('body').textContent()).replace(/\s+/g, ' ').slice(0, 400));
if (!/Prueba Registro Dos/.test(await est.locator('body').textContent())) throw new Error('el portal no abrió con la estudiante registrada');
if (psql(`select correo from students where nombre = 'Prueba Registro Dos'`) !== 'prueba.dos@ute.edu.ec') throw new Error('el registro no guardó el correo');
paso('portal: registrada con nombre + correo + clave y dentro de Mis eventos');
// Un segundo intento con otro correo no puede suplantar
const est2 = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await est2.goto(base + '/estudiante?clave=SOL-2026-001');
await est2.click('button:has-text("Primera vez")');
await est2.fill('#nombre', 'Prueba Registro Dos');
await est2.fill('#correo-reg', 'impostor@ute.edu.ec');
await est2.click('button:has-text("Registrarme e ingresar")');
await est2.waitForSelector('text=Ya tienes un correo registrado', { timeout: 15000 });
await est2.fill('#nombre', 'Nadie Conocido');
await est2.click('button:has-text("Registrarme e ingresar")');
await est2.waitForTimeout(4000);
if ((await est2.locator('text=No encontramos ese nombre').count()) !== 1) throw new Error('nombre desconocido: ' + (await est2.locator('body').textContent()).replace(/\s+/g, ' ').slice(0, 500));
paso('portal: no deja registrar otro correo ni un nombre que no está en la lista');

// Limpieza
psql(`delete from students where nombre like 'Prueba Registro%'`);
paso('estudiantes de prueba eliminados');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
