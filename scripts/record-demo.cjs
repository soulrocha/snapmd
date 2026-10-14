// Records a short demo of the real popup: click the icon, watch the capture, scroll the
// Markdown, copy. The popup is popup.html itself, with chrome.* stubbed to return what
// extractor.js reads from docs/hero/portal.html.
// Usage: npm run demo   (needs Playwright and Microsoft Edge; ffmpeg on PATH or FFMPEG for MP4/GIF)
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.join(__dirname, '..');
const out = path.join(root, 'assets');
const SIZE = { width: 1280, height: 720 };
const pageUrl = 'https://admin.contoso.example/access-requests/new';
const demoOrigin = 'https://demo.snapmd.test';
const portal = fs.readFileSync(path.join(root, 'docs/hero/portal.html'), 'utf8');
const extractor = fs.readFileSync(path.join(root, 'extractor.js'), 'utf8');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png' };

const stage = `<!doctype html><meta charset="utf-8"><style>
  *{box-sizing:border-box;margin:0}
  body{width:${SIZE.width}px;height:${SIZE.height}px;overflow:hidden;font:13px "Segoe UI",system-ui,sans-serif;
    background:radial-gradient(800px 500px at 85% 0%,#3b2a24 0%,transparent 60%),radial-gradient(700px 500px at 0% 100%,#1d2a3f 0%,transparent 60%),#0f1319}
  .win{position:absolute;inset:24px;border-radius:12px;overflow:hidden;background:#202124;box-shadow:0 30px 70px #000a;border:1px solid #3a3d42}
  .bar{height:46px;display:flex;align-items:center;gap:14px;padding:0 14px;background:#2b2b2e;border-bottom:1px solid #3a3d42;color:#c7c9cc}
  .bar svg{width:18px;height:18px;stroke:#9aa0a6;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  .url{flex:1;height:30px;border-radius:15px;background:#1b1b1d;display:flex;align-items:center;gap:8px;padding:0 14px;color:#e8eaed}
  .url span{color:#9aa0a6}
  .ext{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;transition:background .15s}
  .ext.on{background:#45474c}
  .ext img{width:20px;height:20px;image-rendering:pixelated}
  .content{position:absolute;top:46px;left:0;width:100%;height:calc(100% - 46px);border:0}
  .popup{position:absolute;top:66px;right:32px;width:400px;height:560px;border:1px solid #4a4d52;border-radius:8px;overflow:hidden;
    box-shadow:0 18px 50px #000c;background:#171b22;opacity:0;transform:translateY(-6px);transition:opacity .18s,transform .18s}
  .popup.open{opacity:1;transform:none}
  .popup iframe{width:400px;height:560px;border:0;display:block}
  .cursor{position:absolute;left:640px;top:420px;width:22px;height:22px;z-index:9;pointer-events:none;filter:drop-shadow(0 2px 3px #0009)}
  .ripple{position:absolute;width:36px;height:36px;margin:-18px 0 0 -18px;border-radius:50%;border:2px solid #fff;z-index:8;pointer-events:none;opacity:0}
  .toast{position:absolute;left:50%;bottom:44px;transform:translateX(-50%);padding:10px 18px;border-radius:999px;background:#171b22ee;
    border:1px solid #37414e;color:#eef1f4;font-size:15px;opacity:0;transition:opacity .25s;z-index:7}
  .toast b{color:#d97757}
</style>
<div class="win">
  <div class="bar">
    <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>
    <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>
    <svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/></svg>
    <div class="url"><svg viewBox="0 0 24 24"><rect x="6" y="11" width="12" height="9" rx="2"/><path d="M9 11V8a3 3 0 0 1 6 0v3"/></svg>admin.contoso.example<span>/access-requests/new</span></div>
    <svg viewBox="0 0 24 24"><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.4 9.3l6-.7Z"/></svg>
    <div class="ext" id="ext"><img src="icons/icon-48.png" alt=""></div>
  </div>
  <iframe class="content" src="${pageUrl}"></iframe>
</div>
<div class="popup" id="popup"></div>
<div class="ripple" id="ripple"></div>
<div class="toast" id="toast"></div>
<svg class="cursor" id="cursor" viewBox="0 0 24 24"><path d="M4 2l15 11-6.5 1 3.8 7.2-2.8 1.4-3.8-7.3L5 20Z" fill="#fff" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/></svg>
<script>
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const cursor = document.getElementById('cursor');
  const at = { x: 640, y: 420 };
  async function move(x, y, ms = 900) {
    await cursor.animate([{ left: at.x + 'px', top: at.y + 'px' }, { left: x + 'px', top: y + 'px' }],
      { duration: ms, easing: 'cubic-bezier(.45,.05,.25,1)', fill: 'forwards' }).finished;
    at.x = x; at.y = y;
  }
  function click() {
    document.getElementById('ripple').animate([
      { left: at.x + 'px', top: at.y + 'px', opacity: .8, transform: 'scale(.3)' },
      { left: at.x + 'px', top: at.y + 'px', opacity: 0, transform: 'scale(1.3)' }], { duration: 450 });
    return cursor.animate([{ transform: 'scale(1)' }, { transform: 'scale(.85)' }, { transform: 'scale(1)' }], { duration: 180 }).finished;
  }
  function toast(html, ms) {
    const t = document.getElementById('toast');
    t.innerHTML = html; t.style.opacity = 1;
    return wait(ms).then(() => { t.style.opacity = 0; });
  }
  function rect(el) {
    const r = el.getBoundingClientRect();
    const f = document.querySelector('#popup iframe');
    const o = f && el.ownerDocument !== document ? f.getBoundingClientRect() : { left: 0, top: 0 };
    return { x: o.left + r.left + r.width / 2, y: o.top + r.top + r.height / 2 };
  }
  window.runDemo = async () => {
    await wait(700);
    toast('An admin portal with form state, a grid and a log', 1900);
    await wait(500);
    const ext = rect(document.getElementById('ext'));
    await move(ext.x + 2, ext.y + 2, 1300);
    await click();
    document.getElementById('ext').classList.add('on');
    const popup = document.getElementById('popup');
    const frame = document.createElement('iframe');
    frame.src = 'popup.html';
    popup.append(frame);
    await new Promise(r => frame.onload = r);
    popup.classList.add('open');
    const doc = frame.contentDocument;
    await new Promise(r => { const t = setInterval(() => { if (!doc.getElementById('btnCopy').disabled) { clearInterval(t); r(); } }, 50); });
    await wait(700);
    const preview = doc.getElementById('markdownPreview');
    const p = rect(preview);
    await move(p.x - 40, p.y + 40, 900);
    toast('<b>SnapMD</b> keeps what the page is doing: checked boxes, values, tables, logs', 3600);
    const walker = doc.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.textContent.includes('# Access request')) node = walker.nextNode();
    const range = doc.createRange();
    const start = node.textContent.indexOf('# Access request');
    range.setStart(node, start); range.setEnd(node, start + 1);
    const target = preview.scrollTop + range.getBoundingClientRect().top - preview.getBoundingClientRect().top - 12;
    const from = preview.scrollTop;
    const t0 = performance.now();
    await new Promise(r => { (function step(now) {
      const k = Math.min(1, (now - t0) / 1600); const e = k < .5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      preview.scrollTop = from + (target - from) * e; k < 1 ? requestAnimationFrame(step) : r(); })(t0); });
    await wait(2600);
    await move(rect(doc.getElementById('btnCopy')).x - 30, rect(doc.getElementById('btnCopy')).y + 4, 900);
    await click();
    doc.getElementById('btnCopy').click();
    await wait(400);
    await toast('Copied. Paste it into ChatGPT, Claude or any LLM. <b>100% local.</b>', 2800);
    await wait(500);
  };
</script>`;

async function convert(webm) {
  const ffmpeg = process.env.FFMPEG || 'ffmpeg';
  const mp4 = path.join(out, 'demo.mp4');
  const gif = path.join(out, 'demo.gif');
  try {
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', mp4]);
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', webm, '-vf',
      'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle', gif]);
    console.log('Wrote assets/demo.mp4 and assets/demo.gif');
  } catch (error) {
    fs.copyFileSync(webm, path.join(out, 'demo.webm'));
    console.log(`ffmpeg not available (${error.message.split('\n')[0]}); wrote assets/demo.webm only`);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.SNAPMD_BROWSER || 'msedge' });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snapmd-demo-'));
  try {
    // What the extension reads from the sample page.
    const reader = await browser.newPage();
    await reader.route(pageUrl, route => route.fulfill({ contentType: types['.html'], body: portal }));
    await reader.goto(pageUrl);
    const result = await reader.evaluate(extractor);
    const title = await reader.title();
    await reader.close();

    const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: tmp, size: SIZE } });
    await context.route(pageUrl, route => route.fulfill({ contentType: types['.html'], body: portal }));
    await context.route(`${demoOrigin}/**`, route => {
      const file = new URL(route.request().url()).pathname.slice(1);
      if (file === 'stage.html') return route.fulfill({ contentType: types['.html'], body: stage });
      const full = path.join(root, file);
      if (!full.startsWith(root) || !fs.existsSync(full)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ contentType: types[path.extname(full)] || 'application/octet-stream', body: fs.readFileSync(full) });
    });
    await context.addInitScript(({ result, title, url }) => {
      if (!location.pathname.endsWith('/popup.html')) return;
      window.chrome = {
        tabs: { query: async () => [{ id: 1, url, title }] },
        scripting: { executeScript: () => new Promise(r => setTimeout(() => r([{ frameId: 0, result }]), 1400)) },
      };
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => {} } });
    }, { result, title, url: pageUrl });
    const page = await context.newPage();
    await page.goto(`${demoOrigin}/stage.html`);
    await page.frameLocator('iframe.content').locator('h1').waitFor();
    await page.evaluate(() => window.runDemo());
    const video = page.video();
    await context.close();
    await convert(await video.path());
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
