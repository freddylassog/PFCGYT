// Matrícula por NRC: horario con NRC, listado por materia de 1.º (Camila no cursa Lenguaje), plantilla/listado simple para completar
// correos, y cruce real en el panel: con Camila confirmada no aparece Lenguaje; con Andrés sí, y el aviso lleva solo a Andrés.
// Uso: node tests/e2e/nrc.mjs  (app en local; base limpia o tras flujo.mjs)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
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

await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');

// 1. Listado por materia de 1.º ANTES del horario: el semestre sale del nombre de las hojas ("… - 1A")
await p.goto(base + '/coordinacion?tab=estudiantes');
await p.selectOption('#sem-archivo', '0');
await p.setInputFiles('input[type=file]', fx + 'estudiantes-nrc-1.xlsx');
await p.waitForSelector('text=/estudiantes de .* semestre en/', { timeout: 20000 });
const res = (await p.locator('text=/estudiantes de .* semestre en/').first().textContent()).replace(/\s+/g, ' ');
if (!/estudiantes de 1\.º semestre en 5 materias \(NRC\)/.test(res)) throw new Error('resultado inesperado del listado por materia: ' + res);
paso('listado por materia: ' + res.slice(0, 160));
const filaCamila = p.locator('table tbody tr:has-text("Camila")').first();
const filaAndres = p.locator('table tbody tr:has-text("Andrés")').first();
const materias = async (fila) => (await fila.locator('td').nth(2).textContent()).trim();
if ((await materias(filaCamila)) !== '4' || (await materias(filaAndres)) !== '5') throw new Error(`materias: Camila=${await materias(filaCamila)} Andrés=${await materias(filaAndres)}`);
paso('Camila cursa 4 materias (sin Lenguaje), Andrés 5');

// 3. Listado simple (Nombre, Correo…) completa correos por nombre sin perder las materias
await p.setInputFiles('input[type=file]', fx + 'estudiantes.xlsx');
await p.waitForSelector('text=filas procesadas', { timeout: 20000 });
await p.waitForTimeout(500);
const correoCamila = (await p.locator('table tbody tr:has-text("Camila")').first().locator('td').nth(1).textContent()).trim();
if (correoCamila !== 'camila.rios@ute.edu.ec') throw new Error('el listado simple no completó el correo por nombre: ' + correoCamila);
if ((await materias(p.locator('table tbody tr:has-text("Camila")').first())) !== '4') throw new Error('se perdieron las materias al completar el correo');
if ((await p.locator('text=sin correo').count()) !== 0) throw new Error('quedaron estudiantes sin correo');
const r = await fetch(base + '/api/plantilla-estudiantes', { headers: { cookie: (await ctx.cookies()).map((c) => `${c.name}=${c.value}`).join('; ') } });
if (!r.ok || !/spreadsheetml/.test(r.headers.get('content-type') || '')) throw new Error('la plantilla no se descarga: ' + r.status);
paso('correos completados por nombre; plantilla descargable');

// 3b. Horario con NRC y docentes (después de los estudiantes: el orden no importa)
await p.goto(base + '/horarios');
const inputs = p.locator('input[type=file]');
await inputs.nth(1).setInputFiles(fx + 'docentes.csv');
await p.waitForSelector('text=Activos: 7', { timeout: 20000 });
await inputs.nth(0).setInputFiles(fx + 'horarios.xlsx');
await p.waitForSelector('text=15 clases cargadas', { timeout: 20000 });
await p.click('label:has-text("1.º")');
await p.waitForSelector('text=Lenguaje');
const filaLenguaje = (await p.locator('table tbody tr:has-text("Lenguaje")').first().textContent()).replace(/\s+/g, ' ');
if (!/1002/.test(filaLenguaje)) throw new Error('el horario no muestra el NRC de Lenguaje: ' + filaLenguaje);
paso('horario cargado con NRC (Lenguaje = 1002)');

// 4. Cruce real: evento un martes 10:00–12:00 (Lenguaje 1.º es martes 10:00–13:00)
const martes = new Date(); martes.setDate(martes.getDate() + 5); while (martes.getDay() !== 2) martes.setDate(martes.getDate() + 1);
const fecha = martes.toISOString().slice(0, 10);
const nombre = 'Cruce NRC ' + Date.now();
const salida = execFileSync('node', ['tests/e2e/crear-pedido.mjs', fecha, '10:00', '12:00', nombre, 'interno'], { encoding: 'utf8' });
const codigo = (salida.match(/CREADO (SOL-\d{4}-\d{3})/) || [])[1];
if (!codigo) throw new Error('no se creó el pedido: ' + salida);
p.on('dialog', (d) => d.accept(codigo));
await p.goto(base + '/coordinacion?tab=pedidos');
await p.click(`table tbody tr:has-text("${codigo}")`);
await p.waitForSelector('aside');
const cruceTexto = async () => (await p.locator('aside').textContent()).replace(/\s+/g, ' ');
if (!/Cruce con clases · todos los semestres/.test(await cruceTexto()) || !/Lenguaje/.test(await cruceTexto())) throw new Error('sin confirmados debería listar Lenguaje: ' + (await cruceTexto()).slice(0, 300));
await p.click('button:has-text("Aprobar y convocar estudiantes")');
await p.waitForSelector('text=Convocatoria abierta', { timeout: 20000 });
// Camila (no cursa Lenguaje): el cruce no la incluye
const agregar = async (quien) => {
  const sel = p.locator('aside select[aria-label="Agregar estudiante directamente"]');
  const opciones = await sel.locator('option').allTextContents();
  const op = opciones.find((o) => o.includes(quien));
  await sel.selectOption({ label: op });
  await p.click('aside button:has-text("Confirmar")');
  await p.waitForSelector(`aside .linea-item:has-text("${quien}") button:has-text("Quitar")`, { timeout: 15000 });
};
await agregar('Camila Ríos');
await p.waitForTimeout(500);
let t = await cruceTexto();
if (/Cruce con clases · todos los semestres/.test(t)) throw new Error('con una confirmada ya no debe decir "todos los semestres"');
if (/Lenguaje/.test(t)) throw new Error('Camila no cursa Lenguaje: no debería aparecer el cruce: ' + t.slice(t.indexOf('Cruce'), t.indexOf('Cruce') + 300));
paso('Camila confirmada: sin cruce con Lenguaje (no está matriculada)');
await agregar('Andrés Molina');
await p.waitForSelector('aside :text("Lenguaje")', { timeout: 15000 });
t = await cruceTexto();
const bloque = t.slice(t.indexOf('Cruce con clases'));
if (!/Lenguaje/.test(bloque)) throw new Error('con Andrés confirmado debe aparecer Lenguaje');
paso('Andrés confirmado: aparece el cruce con Lenguaje');
await p.screenshot({ path: shots + '/nrc-cruce.png', fullPage: false, caret: 'initial' });
// El aviso al docente preparado lleva solo a Andrés
await p.goto(base + '/horarios');
await p.waitForSelector('text=Correos a docentes');
const aviso = (await p.locator(`.blueprint:has-text("${nombre}")`).first().textContent().catch(() => '')).replace(/\s+/g, ' ');
if (!/Andrés Molina/.test(aviso) || /Camila/.test(aviso)) throw new Error('el aviso al docente debería llevar solo a Andrés: ' + aviso.slice(0, 300));
paso('aviso al docente de Lenguaje: solo Andrés');

// Limpieza
await p.goto(base + '/coordinacion?tab=pedidos');
await p.click(`table tbody tr:has-text("${codigo}")`);
await p.waitForSelector('aside');
await p.click('aside button:has-text("Eliminar pedido")');
await p.waitForSelector(`table tbody tr:has-text("${codigo}")`, { state: 'detached', timeout: 15000 });
paso('pedido de prueba eliminado');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
