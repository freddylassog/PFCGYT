// Abre varias páginas como coordinación y reporta errores/advertencias de consola.
import { chromium } from '@playwright/test';
const base = process.env.BASE_URL || 'http://localhost:3000';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
const msgs = [];
p.on('pageerror', (e) => msgs.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) msgs.push(m.type().toUpperCase() + ' ' + m.text().slice(0, 300)); });
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
for (const u of ['/coordinacion?tab=pedidos', '/coordinacion?tab=estudiantes', '/coordinacion?tab=uniformes', '/coordinacion?tab=novedades', '/coordinacion?tab=resumen', '/horarios', '/', '/estudiante']) {
  msgs.push('--- ' + u);
  await p.goto(base + u, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
}
await p.goto(base + '/coordinacion?tab=pedidos');
await p.click('table tbody tr:has-text("Feria")');
await p.waitForSelector('aside');
await p.waitForTimeout(800);
const mov = await ctx.newPage();
await mov.setViewportSize({ width: 400, height: 800 });
await mov.goto(base + '/coordinacion?tab=pedidos');
await mov.evaluate(() => localStorage.setItem('pf_vista', 'tabla'));
await mov.reload();
await mov.click('table tbody tr:has-text("Feria")');
await mov.waitForSelector('aside');
await mov.screenshot({ path: process.env.SHOTS_DIR + '/movil-panel.png', fullPage: true });
await mov.goto(base + '/estudiante');
await mov.screenshot({ path: process.env.SHOTS_DIR + '/movil-estudiante-login.png', fullPage: true });
console.log(msgs.join('\n'));
await b.close();
