// Calendario suscrito: se crea el enlace en Resumen y la ruta .ics devuelve los eventos. Uso: node tests/e2e/calendario.mjs (tras flujo.mjs)
import { chromium } from '@playwright/test';
const base = process.env.BASE_URL || 'http://localhost:3000';
const shots = process.env.SHOTS || '/tmp/claude-0/-home-user-PFCGYT/5a10c32a-d366-574f-b48c-ac6051283a90/scratchpad/shots';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
const errores = [];
p.on('pageerror', (e) => errores.push('PAGEERROR ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push('CONSOLE ' + m.text()); });
p.on('dialog', (d) => d.accept());
const paso = (t) => console.log('·', t);

await p.goto(base + '/coordinacion');
await p.fill('#password', 'protocolo2026');
await p.click('button:has-text("Ingresar")');
await p.waitForSelector('h1:has-text("Coordinación")');
await p.goto(base + '/coordinacion?tab=resumen');
const crear = p.locator('button:has-text("Crear enlace del calendario")');
if (await crear.count()) { await crear.click(); await p.waitForSelector('text=Enlace:', { timeout: 15000 }); paso('enlace creado'); } else paso('el enlace ya existía');
const texto = await p.locator('text=Enlace:').textContent();
const url = texto.replace('Enlace:', '').trim();
if (!/\/api\/calendario\/[a-f0-9]{32}$/.test(url)) throw new Error('enlace inesperado: ' + url);
const webcal = await p.locator('a:has-text("Agregar al calendario del iPhone")').getAttribute('href');
if (!webcal.startsWith('webcal://')) throw new Error('el botón del iPhone no usa webcal://: ' + webcal);
paso('botón webcal: ' + webcal.replace(/[a-f0-9]{32}$/, '…'));
await p.screenshot({ path: shots + '/resumen-calendario.png', fullPage: true, caret: 'initial' });

const r = await fetch(url);
const ics = await r.text();
if (!r.ok || !/text\/calendar/.test(r.headers.get('content-type') || '')) throw new Error(`la ruta .ics respondió ${r.status} ${r.headers.get('content-type')}`);
const eventos = (ics.match(/BEGIN:VEVENT/g) || []).length;
if (!/BEGIN:VCALENDAR/.test(ics) || !/SUMMARY:Feria de Emprendimiento/.test(ics)) throw new Error('el .ics no trae el evento aprobado:\n' + ics.slice(0, 400));
if (!/SUMMARY:Entrega de uniformes · Feria/.test(ics)) throw new Error('el .ics no trae la entrega de uniformes');
if (!/SUMMARY:\[Por aprobar\] Visita/.test(ics)) throw new Error('el pedido pendiente debería salir como [Por aprobar]');
if (!/DTSTART:20260925T140000Z/.test(ics)) throw new Error('la hora 09:00 de Ecuador debería ser 14:00Z');
if (ics.split('\r\n').some((l) => new TextEncoder().encode(l).length > 75)) throw new Error('hay líneas de más de 75 octetos');
paso(`.ics correcto: ${eventos} eventos, hora en UTC, líneas plegadas`);
const r404 = await fetch(base + '/api/calendario/00000000000000000000000000000000');
if (r404.status !== 404) throw new Error('un token inválido debería dar 404, dio ' + r404.status);
paso('token inválido → 404');

// Regenerar: el anterior deja de funcionar
await p.click('button:has-text("Generar nuevo enlace")');
await p.waitForFunction((viejo) => !document.body.textContent.includes(viejo), url.slice(-32), { timeout: 15000 });
const r2 = await fetch(url);
if (r2.status !== 404) throw new Error('el enlace anterior debería quedar anulado, dio ' + r2.status);
paso('nuevo enlace generado; el anterior ya no funciona');
console.log(errores.length ? errores.join('\n') : 'sin errores de consola');
await b.close();
