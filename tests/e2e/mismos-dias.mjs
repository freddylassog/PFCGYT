// Evento de dos días con "los mismos estudiantes" (2): el cupo es por día y cada estudiante marca los días que puede.
// Andrés solo el día 1, Camila los dos, Valeria los dos (pero el día 1 se llena → "Sin cupo D1" → coordinación apaga D1 y la acepta),
// Mateo ve el día 1 bloqueado y queda solo al día 2 → cuando se llena, "Sin cupo". Al final 3 personas cubren 2 cupos × 2 días.
// Uso: node tests/e2e/mismos-dias.mjs  (app en local con estudiantes cargados; ver flujo.mjs)
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const base = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots';
const nombre = 'Seminario mismos ' + Date.now();
const salida = execFileSync('node', ['tests/e2e/crear-pedido.mjs', '2026-12-16', '09:00', '13:00', nombre, 'interno', '2026-12-17', 'mismos', '2'], { encoding: 'utf8' });
const codigo = (salida.match(/CREADO (SOL-\d{4}-\d{3})/) || [])[1];
if (!codigo || !/MISMOS ESTUDIANTES: 2 y 2/.test(salida) || /INESPERADO|NO DEBERÍA/.test(salida)) throw new Error('no se creó bien el pedido: ' + salida);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
p.on('dialog', (d) => d.accept(codigo));
const paso = (t) => console.log('·', t);
const abrirPanel = async () => { await p.reload(); await p.click(`table tbody tr:has-text("${codigo}")`); await p.waitForSelector('aside'); };
const fila = (n) => p.locator(`aside .linea-item:has-text("${n}")`).first();

await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
await p.click(`table tbody tr:has-text("${codigo}")`);
await p.waitForSelector('aside');
const panel = (await p.locator('aside').textContent()).replace(/\s+/g, ' ');
if (!/Se necesitan 2 estudiantes cada día, en lo posible los mismos: día 1 \(16 dic\): 0\/2 · día 2 \(17 dic\): 0\/2/.test(panel)) throw new Error('el panel no explica el cupo por día: ' + panel.slice(0, 600));
if (!/D1 · Recepción y registro de invitados · 2/.test(panel) || !/D2 · Apoyo en mesa de honor · 2/.test(panel)) throw new Error('actividades por día: ' + panel.slice(0, 600));
paso('panel: 2 estudiantes cada día (en lo posible los mismos), actividades por día');
await p.click('button:has-text("Aprobar y convocar estudiantes")');
await p.waitForSelector('text=Convocatoria abierta', { timeout: 20000 });

// Portal: cada estudiante marca sus días
const inscribir = async (correo, desmarcar = []) => {
  const est = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); // sesión propia por estudiante
  est.on('pageerror', (e) => errores.push('PAGEERROR est ' + e.message));
  await est.goto(base + '/estudiante?clave=' + codigo);
  await est.fill('#correo', correo);
  await est.click('button:has-text("Ingresar")');
  await est.waitForSelector(`text=${nombre}`, { timeout: 15000 });
  const card = est.locator(`.blueprint:has-text("${nombre}")`).first();
  if ((await card.locator('text=Puedo asistir').count()) !== 1) throw new Error('el portal debe dejar elegir los días también con los mismos estudiantes');
  if ((await card.locator('text=El organizador prefiere que vayan los mismos 2 estudiantes los 2 días').count()) !== 1) throw new Error('falta la nota de los mismos estudiantes');
  for (const d of desmarcar) await card.locator(`label:has-text("Día ${d}")`).click();
  await card.locator('button:has-text("Inscribirme")').click();
  await est.waitForSelector('text=por confirmar', { timeout: 15000 });
  return est;
};
await inscribir('andres.molina@ute.edu.ec', [2]);
paso('Andrés inscrito solo al día 1');
await inscribir('camila.rios@ute.edu.ec');
const valeria = await inscribir('valeria.suarez@ute.edu.ec');
paso('Camila y Valeria inscritas a los dos días');

// Coordinación acepta a Andrés (D1) y a Camila (D1 y D2): el día 1 se llena con 2 confirmados, el día 2 sigue abierto
await abrirPanel();
if ((await fila('Andrés').locator('button[aria-pressed="true"]').allTextContents()).join() !== 'D1') throw new Error('Andrés debería ir solo el día 1');
await fila('Andrés').locator('button:has-text("Aceptar")').click();
await p.waitForSelector('text=/día 1 \\(16 dic\\): 1\\/2 · día 2 \\(17 dic\\): 0\\/2/', { timeout: 15000 });
await fila('Camila').locator('button:has-text("Aceptar")').click();
await p.waitForSelector('text=/día 1 \\(16 dic\\): 2\\/2 · día 2 \\(17 dic\\): 1\\/2/', { timeout: 15000 });
if (!/D1 2\/2 · D2 1\/2/.test((await p.locator('aside').textContent()).replace(/\s+/g, ' '))) throw new Error('el avance del panel no es por día');
paso('aceptados Andrés y Camila: D1 2/2 · D2 1/2 (no está lleno)');

// Mateo entra cuando el día 1 ya está lleno: lo ve bloqueado y queda solo al día 2
const mateo = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
await mateo.goto(base + '/estudiante?clave=' + codigo);
await mateo.fill('#correo', 'mateo.castro@ute.edu.ec');
await mateo.click('button:has-text("Ingresar")');
await mateo.waitForSelector(`text=${nombre}`, { timeout: 15000 });
const cardM = mateo.locator(`.blueprint:has-text("${nombre}")`).first();
const dia1 = cardM.locator('label:has-text("Día 1")');
if (!/cupos completos/.test(await dia1.textContent()) || !(await dia1.locator('input').isDisabled())) throw new Error('el día 1 lleno debería estar bloqueado en el portal');
if (!(await cardM.locator('label:has-text("Día 2") input').isChecked())) throw new Error('el día 2 con cupo debería venir marcado');
if (!/cupos por día: día 1: 2\/2 · día 2: 1\/2/.test((await cardM.textContent()).replace(/\s+/g, ' '))) throw new Error('el portal no muestra los cupos por día');
await cardM.locator('button:has-text("Inscribirme")').click();
await mateo.waitForSelector('text=por confirmar', { timeout: 15000 });
paso('Mateo: día 1 bloqueado (cupos completos), inscrito solo al día 2');

// Valeria pidió los dos días pero el día 1 está lleno: "Sin cupo D1" y no se puede aceptar hasta apagar D1
await abrirPanel();
const fv = fila('Valeria');
if ((await fv.locator('.tag:has-text("Sin cupo D1")').count()) !== 1 || !(await fv.locator('button:has-text("Aceptar")').isDisabled())) throw new Error('Valeria debería mostrar "Sin cupo D1" con Aceptar deshabilitado: ' + (await fv.textContent()));
await p.screenshot({ path: shots + '/mismos-sin-cupo.png', fullPage: false, caret: 'initial' });
await fv.locator('button:has-text("D1")').click();
await fv.locator('.tag:has-text("Sin cupo")').waitFor({ state: 'detached', timeout: 15000 });
await fila('Valeria').locator('button:has-text("Aceptar")').click();
await p.waitForSelector('text=/día 1 \\(16 dic\\): 2\\/2 · día 2 \\(17 dic\\): 2\\/2/', { timeout: 15000 });
paso('Valeria: se apaga D1 y queda confirmada solo al día 2 → D1 2/2 · D2 2/2');
const fm = fila('Mateo');
if ((await fm.locator('.tag:has-text("Sin cupo")').count()) !== 1 || !(await fm.locator('button:has-text("Aceptar")').isDisabled())) throw new Error('Mateo (solo día 2, ya lleno) debería mostrar "Sin cupo": ' + (await fm.textContent()));
if ((await p.locator('aside select[aria-label="Agregar estudiante directamente"]').count()) !== 0) throw new Error('con todos los días llenos no debe ofrecer agregar estudiantes');
const confirmados = (await p.locator('aside .linea-item').allTextContents()).filter((t) => t.includes('Quitar')).length;
if (confirmados !== 3) throw new Error('deberían ser 3 confirmados (2 cupos × 2 días): ' + confirmados);
paso('lleno con 3 personas: Andrés (D1), Camila (D1 y D2), Valeria (D2); Mateo sin cupo');
await p.screenshot({ path: shots + '/mismos-lleno.png', fullPage: false, caret: 'initial' });

// Portal de Valeria: solo su día
await valeria.reload();
await valeria.waitForSelector('text=Tus días');
const horario = (await valeria.locator(`.blueprint:has-text("${nombre}")`).first().locator('text=Tu horario').locator('..').textContent()).replace(/\s+/g, ' ');
if (!/Tus días: 17 dic/.test(horario) || /16 dic/.test(horario) || !/4 h/.test(horario)) throw new Error('el portal de Valeria no muestra solo el día 2: ' + horario);
paso('portal de Valeria: ' + horario.trim());

// Limpieza
await p.click('aside button:has-text("Eliminar pedido")');
await p.waitForSelector(`table tbody tr:has-text("${codigo}")`, { state: 'detached', timeout: 15000 });
paso('pedido de prueba eliminado');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
