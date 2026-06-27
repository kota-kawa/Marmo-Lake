import { chromium } from 'playwright';

const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || 'shot.png';
const width = parseInt(process.argv[4] || '1440', 10);
const height = parseInt(process.argv[5] || '900', 10);
// optional: a JS snippet to run after load (e.g. clicks) passed as arg 6
const action = process.argv[6] || '';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(800);
if (action) {
  try { await page.evaluate(action); } catch (e) { console.error('action err', e.message); }
  await page.waitForTimeout(600);
}
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);
