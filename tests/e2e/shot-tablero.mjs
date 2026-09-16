// Captura tablero y calendario de coordinación (para revisar colores). Uso: node tests/e2e/shot-tablero.mjs [AAAA-MM]
import { chromium } from '@playwright/test';
const base = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots';
const mes = process.argv[2] || '';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
await p.goto(base + '/coordinacion?tab=pedidos');
await p.click('label:has-text("Tablero")');
await p.waitForSelector('.tablero');
await p.screenshot({ path: `${shots}/tablero-colores.png`, fullPage: true, caret: 'initial' });
await p.click('label:has-text("Calendario")');
await p.waitForSelector('.calendario');
if (mes) { for (let i = 0; i < 12 && !(await p.locator('h4').first().textContent()).toLowerCase().includes(mes); i++) await p.click('button:has-text("Mes siguiente")'); }
await p.screenshot({ path: `${shots}/calendario-colores.png`, fullPage: true, caret: 'initial' });
await p.click('label:has-text("Tabla")');
await p.waitForSelector('table');
await p.screenshot({ path: `${shots}/tabla-colores.png`, fullPage: true, caret: 'initial' });
await b.close();
console.log('capturas listas');
