// Crea un pedido de prueba por el formulario público. Uso: node tests/e2e/crear-pedido.mjs [fecha] [inicio] [fin] [evento] [tipo] [segundoDia] [mismos|distintos] [cantidad]
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const base = process.env.BASE_URL || 'http://localhost:3000';
const hoy = new Date(); hoy.setDate(hoy.getDate() + 10);
const fecha = process.argv[2] || hoy.toISOString().slice(0, 10);
const inicio = process.argv[3] || '09:00', fin = process.argv[4] || '14:30';
const evento = process.argv[5] || 'Evento de prueba ' + Date.now();
const tipo = process.argv[6] || 'interno';
const segundoDia = process.argv[7] || ''; // fecha opcional de un segundo día (mismo horario)
const modo = process.argv[8] || 'mismos'; // 'mismos' estudiantes los dos días o 'distintos' (se reparten)
const cantidad = process.argv[9] || '3'; // número de estudiantes (el modo 'distintos' supone 3)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(base + '/');
const tmp = '/tmp/evidencia-prueba.pdf';
writeFileSync(tmp, '%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
await p.fill('#nombre', 'Carla Espinosa');
await p.fill('#cargo', 'Directora de eventos');
await p.fill('#institucion', tipo === 'interno' ? 'Universidad UTE' : 'Cámara de Comercio de Quito');
await p.fill('#correo', 'carla@ejemplo.com');
if (tipo !== 'interno') { await p.click('button:has-text("Externo")'); if (tipo === 'externo-sin') await p.click('label:has-text("No / no sé")'); }
await p.click('button:has-text("Continuar")');
await p.fill('#evento', evento);
await p.setInputFiles('input[type=file]', tmp);
await p.waitForSelector('.tag-accent', { timeout: 15000 });
await p.fill('#dia-fecha-0', fecha);
await p.fill('#dia-inicio-0', inicio);
await p.fill('#dia-fin-0', fin);
await p.fill('#dia-lugar-0', 'Auditorio Principal, Campus Occidental');
if (segundoDia) {
  await p.click('button:has-text("Agregar otro día")');
  await p.fill('#dia-fecha-1', segundoDia);
  if ((await p.inputValue('#dia-lugar-1')) !== 'Auditorio Principal, Campus Occidental') throw new Error('el lugar no se copió al día 2: ' + (await p.inputValue('#dia-lugar-1')));
  console.log('LUGAR COPIADO al día 2');
}
await p.fill('#responsable', 'Secretaría FCGT');
await p.fill('#telefono', '02 299 0800 ext. 2410');
await p.waitForTimeout(700);
const alerta = await p.locator('.alerta').allTextContents();
if (alerta.length) console.log('ALERTA:', alerta.join(' | '));
if (await p.locator('button:has-text("Continuar")').isDisabled()) {
  console.log('BLOQUEADO: no se puede continuar (' + (await p.locator('text=Falta:').textContent()) + ')');
  await b.close();
  process.exit(0);
}
await p.click('button:has-text("Continuar")');
await p.fill('#cantidad', cantidad);
if (segundoDia && modo === 'distintos') {
  await p.click('label:has-text("Distintos estudiantes cada día")');
  await p.fill('#cant-dia-1', '1'); // día 2 solo necesita 1 estudiante
  await p.keyboard.press('Tab');
  await p.click('label:has(#d0-act-0)'); // día 1 (2 estudiantes): Recepción
  await p.click('label:has(#d1-act-1)'); // día 2 (1 estudiante): Ubicación
  const a0 = await p.locator('p:has-text("Asignados:")').nth(0).textContent();
  const a1 = await p.locator('p:has-text("Asignados:")').nth(1).textContent();
  if (!/Asignados: 2 de 2/.test(a0 || '') || !/Asignados: 1 de 1/.test(a1 || '')) console.log('REPARTO POR DÍA INESPERADO:', a0, a1);
} else if (segundoDia) {
  if ((await p.locator('#cant-dia-1').count()) !== 0) console.log('NO DEBERÍA REPARTIRSE con los mismos estudiantes');
  await p.click('label:has(#d0-act-0)'); // día 1: Recepción (todos)
  await p.click('label:has(#d1-act-5)'); // día 2: Apoyo en mesa de honor (todos)
  const a0 = await p.locator('p:has-text("Asignados:")').nth(0).textContent();
  const a1 = await p.locator('p:has-text("Asignados:")').nth(1).textContent();
  const esperado = new RegExp(`Asignados: ${cantidad} de ${cantidad}`);
  if (!esperado.test(a0 || '') || !esperado.test(a1 || '')) console.log('REPARTO (MISMOS) INESPERADO:', a0, a1);
  console.log(`MISMOS ESTUDIANTES: ${cantidad} y ${cantidad}`);
} else {
  await p.click('label:has-text("Recepción y registro de invitados")');
  if (Number(cantidad) > 1) await p.click('label:has-text("Ubicación de autoridades")');
  const asignados = await p.locator('text=Asignados:').textContent();
  if (!new RegExp(`Asignados: ${cantidad} de ${cantidad}`).test(asignados || '')) { console.log('REPARTO INESPERADO:', asignados); }
}
await p.click('button:has-text("Continuar")');
await p.click('label:has-text("Acepto estos compromisos")');
await p.click('button:has-text("Registrar pedido")');
await p.waitForSelector('text=Pedido registrado', { timeout: 15000 });
const codigo = await p.locator('h2').first().textContent();
console.log('CREADO', codigo, evento, fecha, inicio, fin);
await p.screenshot({ path: '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots/creado.png' });
await b.close();
