document.addEventListener('DOMContentLoaded', () => {
  const popup = document.querySelector('.popup');
  const preview = document.getElementById('markdownPreview');
  const status = document.getElementById('status');
  const copy = document.getElementById('btnCopy');
  const download = document.getElementById('btnDownload');
  const error = document.getElementById('errorState');
  let data = null;
  let busy = false;
  let celebrationTimer;

  function state(name, message) {
    clearTimeout(celebrationTimer);
    popup.className = `popup ${name}`;
    status.textContent = message;
    preview.setAttribute('aria-busy', String(name === 'extracting'));
    error.hidden = name !== 'error';
    preview.hidden = name === 'error';
    copy.disabled = download.disabled = !data || name === 'extracting' || name === 'error';
  }

  function failure(title, description) {
    data = null;
    state('error', 'Captura indisponível');
    document.getElementById('errorTitle').textContent = title;
    document.getElementById('errorDescription').textContent = description;
  }

  // Marcadores de canvas e terminal: o page-reader.js lê os dados no world MAIN do frame.
  // A resposta vem do JS da página: só string, com tamanho limitado. Sem resposta, fica o texto de sempre.
  async function fillSlots(tabId, r) {
    const slots = r?.result?.slots;
    if (!Array.isArray(slots) || !slots.length || typeof r.result.markdown !== 'string') return;
    let read = {};
    try {
      const [main] = await chrome.scripting.executeScript({ target: { tabId, frameIds: [r.frameId || 0] }, world: 'MAIN', func: snapmdReadPage, args: [slots] });
      read = main?.result || {};
    } catch { /* fallback abaixo */ }
    const byToken = new Map(slots.map(s => [s.token, s]));
    // Valor de várias linhas herda o prefixo da linha (citação, recuo de lista). Sozinho na linha,
    // entra no lugar do marcador; no meio do texto (ou de um link), vira bloco logo depois da linha.
    r.result.markdown = r.result.markdown.split('\n').map(line => {
      const structure = line.match(/^(?:[ \t]*(?:>|[-*+]|\d+\.)[ \t])*[ \t]*/)[0];
      const pad = structure.replace(/[^>\s]/g, ' ');
      const blank = pad.trimEnd();
      const indent = value => value.split('\n').map((l, i) => i ? (l ? pad + l : blank) : l).join('\n');
      const blocks = [];
      let alone = false;
      const filled = line.replace(/SNAPMD[0-9a-f]{8}N\d+/g, token => {
        const slot = byToken.get(token);
        if (!slot) return token;
        const value = typeof read[token] === 'string' && read[token].length <= 4e6 ? read[token] : slot.fallback;
        if (!value.includes('\n')) return value;
        if (line === structure + token) { alone = true; return indent(value); }
        blocks.push(indent(value));
        return slot.kind === 'xterm' ? '_[terminal]_' : '_[gráfico]_';
      });
      // Em citação e lista as linhas vizinhas vêm coladas: o bloco precisa da linha em branco do prefixo.
      if (alone && structure) return `${blank}\n${filled}\n${blank}`;
      return [filled, ...blocks.map(b => `${blank}\n${pad}${b}\n${blank}`)].join('\n');
    }).join('\n');
  }

  async function capture() {
    if (busy) return;
    busy = true;
    data = null;
    state('extracting', 'Reunindo o conteúdo da página…');
    preview.textContent = 'Extraindo o conteúdo da página…';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.id == null) {
        failure('Aba não encontrada', 'Abra uma página e tente novamente.');
        return;
      }
      const url = tab.url || tab.pendingUrl || '';
      document.getElementById('pageTitle').textContent = tab.title || 'Página atual';
      document.getElementById('pageTitle').title = tab.title || '';
      try { document.getElementById('source').textContent = new URL(url).hostname || url; }
      catch { document.getElementById('source').textContent = url || 'Página atual'; }
      if (/^(chrome|edge|about|chrome-extension|moz-extension):/.test(url)) {
        failure('Página restrita', 'O navegador não permite capturar páginas internas. Abra uma página web e tente novamente.');
        return;
      }
      // Todos os frames, para alcançar iframes de outra origem (portais Microsoft etc.).
      let results;
      try { results = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['extractor.js'] }); }
      catch { results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['extractor.js'] }); }
      await Promise.all((results || []).map(r => fillSlots(tab.id, r)));
      const main = results?.find(r => !r.frameId)?.result;
      if (!main || typeof main.markdown !== 'string' || !main.markdown.trim()) {
        failure('Nenhum conteúdo encontrado', 'Esta página não apresentou conteúdo capturável. PDFs, imagens e canvas podem não fornecer texto.');
        return;
      }
      // Iframe oculto não vaza: descarta o frame cuja URL (sem hash) só aparece entre os ocultos.
      // Na dúvida (mesma URL visível em outro lugar), mantém o conteúdo.
      const key = url => { try { const u = new URL(url); u.hash = ''; return u.href; } catch { return url || ''; } };
      const shown = new Set(results.flatMap(r => r.result?.shownFrameUrls || []));
      const hidden = new Set(results.flatMap(r => r.result?.hiddenFrameUrls || []));
      const frames = results.filter(r => r.frameId && typeof r.result?.markdown === 'string' && r.result.markdown.trim()
          && !(hidden.has(key(r.result.url)) && !shown.has(key(r.result.url))))
        .map(r => `## Frame: ${r.result.url}\n\n${r.result.markdown.trim()}`);
      const result = { ...main, markdown: [main.markdown.trimEnd(), ...frames].join('\n\n---\n\n') + '\n' };
      data = result;
      document.getElementById('pageTitle').textContent = result.title || tab.title || 'Página atual';
      document.getElementById('pageTitle').title = result.title || tab.title || '';
      preview.textContent = result.markdown;
      state('ready', 'Markdown pronto');
    } catch {
      failure('Não foi possível capturar', 'O navegador recusou a leitura desta página. Confira a permissão da extensão e tente novamente.');
    } finally { busy = false; }
  }

  async function copyMarkdown() {
    if (!data || copy.disabled) return;
    copy.disabled = true;
    try {
      await navigator.clipboard.writeText(data.markdown);
      state('copied', 'Copiado');
      celebrationTimer = setTimeout(() => popup.classList.remove('copied'), 400);
    } catch {
      popup.classList.remove('copied');
      status.textContent = 'Não foi possível copiar. Tente novamente ou baixe o arquivo.';
    } finally { copy.disabled = !data; }
  }

  function downloadMarkdown() {
    if (!data || download.disabled) return;
    const url = URL.createObjectURL(new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    const title = (data.title || 'pagina').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0,100) || 'pagina';
    link.download = `${title}-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = 'Download solicitado';
  }

  copy.addEventListener('click', copyMarkdown);
  download.addEventListener('click', downloadMarkdown);
  document.getElementById('btnRetry').addEventListener('click', capture);
  window.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); copyMarkdown(); }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); downloadMarkdown(); }
    if (event.key === 'Escape') window.close();
  });
  capture();
});
