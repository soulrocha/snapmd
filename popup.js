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
      const main = results?.find(r => !r.frameId)?.result;
      if (!main || typeof main.markdown !== 'string' || !main.markdown.trim()) {
        failure('Nenhum conteúdo encontrado', 'Esta página não apresentou conteúdo capturável. PDFs, imagens e canvas podem não fornecer texto.');
        return;
      }
      // Só frames que um frame já aceito encontrou renderizados, a partir do principal:
      // iframe oculto não vaza conteúdo, nem o dos frames dentro dele.
      const shown = new Set([0]);
      for (let grew = true; grew;) {
        grew = false;
        results.forEach(r => (shown.has(r.frameId || 0) ? r.result?.shownFrameIds || [] : []).forEach(id => {
          if (!shown.has(id)) { shown.add(id); grew = true; }
        }));
      }
      const frames = results.filter(r => r.frameId && shown.has(r.frameId) && typeof r.result?.markdown === 'string' && r.result.markdown.trim())
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
