// Crea un pedido de prueba por el formulario público. Uso: node tests/e2e/crear-pedido.mjs [fecha] [inicio] [fin] [evento]
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://localhost:3000';
const hoy = new Date(); hoy.setDate(hoy.getDate() + 10);
const fecha = process.argv[2] || hoy.toISOString().slice(0, 10);
const inicio = process.argv[3] || '09:00', fin = process.argv[4] || '14:30';
const evento = process.argv[5] || 'Evento de prueba ' + Date.now();
const tipo = process.argv[6] || 'interno';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(base + '/');
const tmp = '/tmp/evidencia-prueba.pdf';
writeFileSync(tmp, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
await p.setInputFiles('input[type=file]', tmp);
await p.waitForSelector('.tag-accent', { timeout: 15000 });
await p.fill('#nombre', 'Carla Espinosa');
await p.fill('#cargo', 'Directora de eventos');
await p.fill('#institucion', tipo === 'interno' ? 'Universidad UTE' : 'Cámara de Comercio de Quito');
await p.fill('#correo', 'carla@ejemplo.com');
if (tipo !== 'interno') { await p.click('button:has-text("Externo")'); if (tipo === 'externo-sin') await p.click('label:has-text("No / no sé")'); }
await p.click('button:has-text("Continuar")');
await p.fill('#evento', evento);
await p.fill('#fecha', fecha);
await p.fill('#inicio', inicio);
await p.fill('#fin', fin);
await p.fill('#lugar', 'Auditorio Principal, Campus Occidental');
await p.fill('#responsable', 'Secretaría FCGT · ext. 2410');
await p.waitForTimeout(700);
const alerta = await p.locator('.alerta').allTextContents();
if (alerta.length) console.log('ALERTA:', alerta.join(' | '));
if (await p.locator('button:has-text("Continuar")').isDisabled()) {
  console.log('BLOQUEADO: no se puede continuar (' + (await p.locator('text=Falta:').textContent()) + ')');
  await b.close();
  process.exit(0);
}
await p.click('button:has-text("Continuar")');
await p.fill('#cantidad', '3');
await p.click('label:has-text("Recepción y registro de invitados")');
await p.click('label:has-text("Ubicación de autoridades")');
await p.click('button:has-text("Continuar")');
await p.click('label:has-text("Acepto estos compromisos")');
await p.click('button:has-text("Registrar pedido")');
await p.waitForSelector('text=Pedido registrado', { timeout: 15000 });
const codigo = await p.locator('h2').first().textContent();
console.log('CREADO', codigo, evento, fecha, inicio, fin);
await p.screenshot({ path: '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots/creado.png' });
await b.close();
