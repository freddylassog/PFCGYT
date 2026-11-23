// Protocolos por día e informes por semestre: un evento de 2 días suma 2 protocolos al estudiante que va ambos días;
// el informe de 1.º y el reporte de 1.º traen solo a los de 1.º; el reporte de todos conserva la hoja de horas.
// Uso: node tests/e2e/reportes.mjs  (app en local tras flujo.mjs)
import { chromium } from '@playwright/test';
import ExcelJS from 'exceljs';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE_URL || 'http://localhost:3000';
const paso = (t) => console.log('·', t);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
const libro = async (ruta) => {
  const r = await ctx.request.get(base + ruta);
  if (!r.ok()) throw new Error(ruta + ' → ' + r.status());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await r.body());
  return { wb, nombre: (r.headers()['content-disposition'] || '').match(/filename="([^"]+)"/)?.[1] };
};
const filaDe = (ws, nombre, col) => { let v = null; ws.eachRow((row) => { if (String(row.getCell(col).value ?? '').includes(nombre)) v = row; }); return v; };
const protocolosCamila = async () => { const { wb } = await libro('/api/matriz/1'); const f = filaDe(wb.worksheets[0], 'Camila Ríos', 1); return Number(f.getCell(3).value); };

const antes = await protocolosCamila();
// Evento de 2 días con Camila los dos días
const nombre = 'Congreso informe ' + Date.now();
const out = execFileSync('node', ['tests/e2e/crear-pedido.mjs', '2026-12-16', '09:00', '13:00', nombre, 'interno', '2026-12-17', 'mismos', '2'], { encoding: 'utf8' });
const codigo = (out.match(/CREADO (SOL-\d{4}-\d{3})/) || [])[1];
if (!codigo) throw new Error('no se creó el pedido: ' + out);
p.on('dialog', (d) => d.accept(codigo));
await p.goto(base + '/coordinacion?tab=pedidos');
await p.click(`table tbody tr:has-text("${codigo}")`);
await p.waitForSelector('aside');
await p.click('aside button:has-text("Aprobar y convocar estudiantes")');
await p.waitForSelector('text=Convocatoria abierta', { timeout: 20000 });
const sel = p.locator('aside select[aria-label="Agregar estudiante directamente"]');
await sel.selectOption({ label: (await sel.locator('option').allTextContents()).find((o) => o.includes('Camila Ríos')) });
await p.click('aside button:has-text("Confirmar")');
await p.waitForSelector('aside .linea-item:has-text("Camila") button:has-text("Quitar")', { timeout: 15000 });
const despues = await protocolosCamila();
if (despues !== antes + 2) throw new Error(`un evento de 2 días debería sumar 2 protocolos a Camila: antes ${antes}, después ${despues}`);
paso(`Camila: ${antes} → ${despues} protocolos con un congreso de 2 días`);

// Informe de 1.º: título, columnas y solo estudiantes de 1.º
const inf = await libro('/api/matriz/1');
const ws = inf.wb.worksheets[0];
if (!/Informe de protocolo · 1\.º semestre .*cada día de evento cuenta como un protocolo/.test(String(ws.getRow(1).getCell(1).value))) throw new Error('título del informe: ' + ws.getRow(1).getCell(1).value);
if (String(ws.getRow(2).getCell(3).value) !== 'Protocolos (días)') throw new Error('columna Protocolos (días): ' + ws.getRow(2).values);
if (!/por realizar/.test(String(filaDe(ws, 'Camila Ríos', 1).getCell(6).value))) throw new Error('el detalle debería marcar los días por realizar');
if (filaDe(ws, 'Daniela Ortiz', 1)) throw new Error('el informe de 1.º no debe traer estudiantes de 2.º');
if (!/^informe-protocolo-1-semestre-/.test(inf.nombre || '')) throw new Error('nombre del archivo: ' + inf.nombre);
paso('informe de 1.º: título, columna Protocolos (días), detalle con días por realizar, solo 1.º · ' + inf.nombre);

// Reporte de 1.º: sin hoja de horas y solo 1.º en Estudiantes; reporte de todos: con horas y todos los semestres
const rep1 = await libro('/api/reporte?sem=1');
const hojas1 = rep1.wb.worksheets.map((w) => w.name);
if (hojas1.includes('Horas') || !hojas1.includes('Estudiantes')) throw new Error('hojas del reporte de 1.º: ' + hojas1.join());
const semestres = new Set(); rep1.wb.getWorksheet('Estudiantes').eachRow((row, i) => { if (i > 1) semestres.add(row.getCell(1).value); });
if ([...semestres].join() !== '1') throw new Error('el reporte de 1.º trae otros semestres: ' + [...semestres].join());
if (!filaDe(rep1.wb.getWorksheet('Eventos'), codigo, 1)) throw new Error('el reporte de 1.º debería traer el congreso de Camila');
const todos = await libro('/api/reporte');
if (!todos.wb.worksheets.map((w) => w.name).includes('Horas')) throw new Error('el reporte de todos debe tener la hoja Horas');
paso(`reporte de 1.º (${rep1.nombre}): hojas ${hojas1.join(', ')}; reporte de todos con Horas`);

// Botones visibles
await p.goto(base + '/coordinacion?tab=estudiantes');
if ((await p.locator('a:has-text("Descargar informe 1.º (.xlsx)")').count()) !== 1) throw new Error('falta el botón de informe de 1.º');
await p.goto(base + '/coordinacion?tab=resumen');
if ((await p.locator('a[href="/api/reporte?sem=2"]').count()) !== 1) throw new Error('falta el reporte de 2.º en Resumen');
paso('botones: informe por semestre en Estudiantes y reporte por semestre en Resumen');

// Limpieza
await p.goto(base + '/coordinacion?tab=pedidos');
await p.click(`table tbody tr:has-text("${codigo}")`);
await p.waitForSelector('aside');
await p.click('aside button:has-text("Eliminar pedido")');
await p.waitForSelector(`table tbody tr:has-text("${codigo}")`, { state: 'detached', timeout: 15000 });
paso('pedido de prueba eliminado');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
