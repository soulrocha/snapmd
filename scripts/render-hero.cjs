// Renders the README hero and the GitHub social preview from the real extension:
// docs/hero/portal.html is captured by extractor.js, and the real popup shows the result.
// Usage: npm run hero   (needs Playwright and Microsoft Edge, or SNAPMD_BROWSER=chromium)
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const pageUrl = 'https://admin.contoso.example/access-requests/new';
const portal = fs.readFileSync(path.join(root, 'docs/hero/portal.html'), 'utf8');
const extractor = fs.readFileSync(path.join(root, 'extractor.js'), 'utf8');
const dataUri = (type, buffer) => `data:${type};base64,${buffer.toString('base64')}`;
const icon = dataUri('image/png', fs.readFileSync(path.join(root, 'icons/icon-48.png')));

const INSET = 24;
const TOOLBAR = 46;
const POPUP = { width: 400, height: 560 };

async function shoot(browser, width, height) {
  const contentWidth = width - INSET * 2;
  const contentHeight = height - INSET * 2 - TOOLBAR;

  // 1. The page, rendered for real, and what SnapMD extracts from it.
  const page = await browser.newPage({ viewport: { width: contentWidth, height: contentHeight }, deviceScaleFactor: 2 });
  await page.route(pageUrl, route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: portal }));
  await page.goto(pageUrl);
  const result = await page.evaluate(extractor);
  const title = await page.title();
  const pageShot = await page.screenshot();
  await page.close();

  // 2. The real popup, fed with that result through a stubbed chrome.* API.
  const popup = await browser.newPage({ viewport: POPUP, deviceScaleFactor: 2 });
  await popup.addInitScript(({ result, title, url }) => {
    window.chrome = {
      tabs: { query: async () => [{ id: 1, url, title }] },
      scripting: { executeScript: async () => [{ frameId: 0, result }] },
    };
  }, { result, title, url: pageUrl });
  await popup.goto(pathToFileURL(path.join(root, 'popup.html')).href);
  await popup.waitForFunction(() => !document.querySelector('#btnCopy').disabled);
  await popup.waitForFunction(() => document.querySelector('.pet').complete);
  await popup.evaluate(() => {
    const preview = document.getElementById('markdownPreview');
    // Open the preview on the form. Measured with a Range, because long lines wrap.
    const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.textContent.includes('# Access request')) node = walker.nextNode();
    if (!node) throw new Error('heading not found in the preview');
    const start = node.textContent.indexOf('# Access request');
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + 2);
    preview.scrollTop += range.getBoundingClientRect().top - preview.getBoundingClientRect().top - 16;
  });
  await popup.waitForTimeout(300);
  const popupShot = await popup.screenshot();
  await popup.close();

  // 3. Browser frame around both.
  const html = `<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box;margin:0}
    body{width:${width}px;height:${height}px;overflow:hidden;font:13px "Segoe UI",system-ui,sans-serif;
      background:radial-gradient(800px 500px at 85% 0%,#3b2a24 0%,transparent 60%),radial-gradient(700px 500px at 0% 100%,#1d2a3f 0%,transparent 60%),#0f1319}
    .win{position:absolute;inset:${INSET}px;border-radius:12px;overflow:hidden;background:#202124;box-shadow:0 30px 70px #000a;border:1px solid #3a3d42}
    .bar{height:${TOOLBAR}px;display:flex;align-items:center;gap:14px;padding:0 14px;background:#2b2b2e;border-bottom:1px solid #3a3d42;color:#c7c9cc}
    .bar svg{width:18px;height:18px;stroke:#9aa0a6;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    .url{flex:1;height:30px;border-radius:15px;background:#1b1b1d;display:flex;align-items:center;gap:8px;padding:0 14px;color:#e8eaed}
    .url span{color:#9aa0a6}
    .ext{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:#45474c}
    .ext img{width:20px;height:20px;image-rendering:pixelated}
    .content{position:absolute;top:${TOOLBAR}px;left:0}
    .content img{display:block;width:${contentWidth}px;height:${contentHeight}px}
    .popup{position:absolute;top:${INSET + TOOLBAR - 4}px;right:${INSET + 8}px;width:${POPUP.width}px;height:${POPUP.height}px;
      border:1px solid #4a4d52;border-radius:8px;overflow:hidden;box-shadow:0 18px 50px #000c}
    .popup img{display:block;width:100%;height:100%}
  </style>
  <div class="win">
    <div class="bar">
      <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
      <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
      <svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/></svg>
      <div class="url"><svg viewBox="0 0 24 24"><rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/></svg>admin.contoso.example<span>/access-requests/new</span></div>
      <svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.4 9.3l6-.7Z"/></svg>
      <div class="ext"><img src="${icon}" alt=""></div>
    </div>
    <div class="content"><img src="${dataUri('image/png', pageShot)}"></div>
  </div>
  <div class="popup"><img src="${dataUri('image/png', popupShot)}"></div>`;
  const frame = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  await frame.setContent(html);
  await frame.evaluate(() => Promise.all([...document.images].map(i => i.decode())));
  const shot = await frame.screenshot();
  await frame.close();
  return shot;
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.SNAPMD_BROWSER || 'msedge' });
  try {
    for (const [file, width, height] of [['assets/hero.png', 1280, 720], ['assets/social-preview.png', 1280, 640]]) {
      fs.writeFileSync(path.join(root, file), await shoot(browser, width, height));
      console.log(`Wrote ${file}`);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
