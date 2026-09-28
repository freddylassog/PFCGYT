// Comprueba el aviso de anticipación temporal en el paso 2 del pedido. Uso: node tests/e2e/shot-anticipacion.mjs
import { chromium } from '@playwright/test';
const base = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto(base + '/');
await p.fill('#nombre', 'Carla Espinosa'); await p.fill('#cargo', 'Directora'); await p.fill('#institucion', 'Universidad UTE'); await p.fill('#correo', 'carla@ejemplo.com');
await p.click('button:has-text("Continuar")');
const manana = new Date(); manana.setDate(manana.getDate() + 1);
await p.fill('#dia-fecha-0', manana.toISOString().slice(0, 10));
await p.waitForTimeout(300);
const aviso = await p.locator('.aviso-info').first().textContent().catch(() => null);
console.log('aviso:', aviso);
console.log('plazo:', await p.locator('text=Plazo:').first().textContent());
console.log('alerta 72 h presente:', (await p.locator('.alerta:has-text("menos de")').count()) > 0);
await p.screenshot({ path: shots + '/anticipacion-24h.png', fullPage: true, caret: 'initial' });
await b.close();
