// Eliminar pedido: crea un pedido de prueba, lo borra desde el panel (con confirmación) y comprueba que desaparece.
// Uso: node tests/e2e/eliminar.mjs
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE_URL || 'http://localhost:3000';
const nombre = 'Prueba para borrar ' + Date.now();
const salida = execFileSync('node', ['tests/e2e/crear-pedido.mjs', '2026-11-20', '09:00', '11:00', nombre], { encoding: 'utf8' });
const codigo = (salida.match(/CREADO (SOL-\d{4}-\d{3})/) || [])[1];
if (!codigo) throw new Error('no se pudo crear el pedido de prueba: ' + salida);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
const dialogos = [];
p.on('dialog', (d) => { dialogos.push(d.type() + ': ' + d.message().slice(0, 60)); d.accept(codigo); });
const paso = (t) => console.log('·', t);
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
await p.click(`table tbody tr:has-text("${codigo}")`);
await p.waitForSelector('aside');
// Rechazar NO borra: sigue en la tabla
await p.click('aside button:has-text("Rechazar")');
await p.waitForSelector(`table tbody tr:has-text("${codigo}") .tag:has-text("Rechazado")`, { timeout: 15000 });
paso(`${codigo} rechazado: sigue en la tabla`);
await p.click('aside button:has-text("Eliminar pedido")');
await p.waitForSelector(`table tbody tr:has-text("${codigo}")`, { state: 'detached', timeout: 15000 });
if (await p.locator('aside').count()) throw new Error('el panel debería cerrarse al eliminar');
paso(`${codigo} eliminado tras confirmar (${dialogos.length} diálogo(s): ${dialogos.join(' | ')})`);
// Y en la base ya no está
const [fila] = execFileSync('psql', ['-h', '127.0.0.1', '-p', '5433', '-U', 'postgres', '-d', 'protocolo', '-tAc', `select count(*) from requests where codigo = '${codigo}'`], { encoding: 'utf8' }).trim().split('\n');
if (fila !== '0') throw new Error('el pedido sigue en la base: ' + fila);
paso('la base ya no tiene el pedido');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
