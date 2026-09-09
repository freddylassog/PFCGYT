// Sube los archivos reales de la universidad (horario ancho + directorio de docentes) por la interfaz.
import { chromium } from '@playwright/test';
const base = process.env.BASE_URL || 'http://localhost:3000';
const [,, horarios, docentes] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
await p.goto(base + '/horarios');
const inputs = p.locator('input[type=file]');
await inputs.nth(0).setInputFiles(horarios);
await p.waitForSelector('text=clases cargadas', { timeout: 30000 });
console.log('HORARIOS:', (await p.locator('text=clases cargadas').textContent())?.trim());
if (docentes) {
  await inputs.nth(1).setInputFiles(docentes);
  await p.waitForSelector('text=filas procesadas', { timeout: 30000 });
  console.log('DOCENTES:', (await p.locator('text=filas procesadas').textContent())?.trim());
}
await p.click('label:has-text("3.º")');
await p.waitForTimeout(500);
await p.screenshot({ path: process.env.SHOT || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots/horarios-reales.png', fullPage: true });
await b.close();
