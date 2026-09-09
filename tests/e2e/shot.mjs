import { chromium } from '@playwright/test';
const [,, url, out, width] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: Number(width || 1280), height: 900 } });
p.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text()); });
p.on('pageerror', e => console.log('PAGEERROR', e.message));
await p.goto(url, { waitUntil: 'networkidle' });
await p.screenshot({ path: out, fullPage: true });
await b.close();
