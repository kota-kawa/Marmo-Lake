import { chromium } from 'playwright'
const SC = process.argv[2]
const PASS = process.env.MARMO_ADMIN_PASSWORD
if (!PASS) throw new Error('set MARMO_ADMIN_PASSWORD')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' }).catch(() => {})
await page.waitForTimeout(700)
// open admin login
await page.evaluate(() => [...document.querySelectorAll('.dock-item')].find((b) => b.getAttribute('aria-label') === '管理')?.click())
await page.waitForTimeout(400)
await page.fill('.login-card input', PASS)
await page.click('.login-card .primary-button')
await page.waitForTimeout(900)
await page.screenshot({ path: `${SC}/admin.png` })
// click 共有 tab
await page.evaluate(() => [...document.querySelectorAll('.sidebar-row')].find((b) => b.textContent.trim() === '共有')?.click())
await page.waitForTimeout(500)
await page.screenshot({ path: `${SC}/admin-share.png` })
await browser.close()
console.log('done')
