// Renders docs/hero/hero.html into the README hero and the GitHub social preview.
// Usage: npm run hero   (needs Playwright and Microsoft Edge or Chromium)
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const icon = fs.readFileSync(path.join(root, 'icons/aperture.svg')).toString('base64');
const html = fs.readFileSync(path.join(root, 'docs/hero/hero.html'), 'utf8')
  .replace('ICON', `data:image/svg+xml;base64,${icon}`);

(async () => {
  const browser = await chromium.launch({ channel: process.env.SNAPMD_BROWSER || 'msedge' });
  try {
    for (const [file, scale] of [['assets/hero.png', 2], ['assets/social-preview.png', 1]]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: scale });
      await page.setContent(html);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(root, file) });
      await page.close();
      console.log(`Wrote ${file}`);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
