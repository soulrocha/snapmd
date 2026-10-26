document.addEventListener('DOMContentLoaded', () => {
  const popup = document.querySelector('.popup');
  const petStage = document.querySelector('.pet-stage');
  const preview = document.getElementById('markdownPreview');
  const status = document.getElementById('status');
  const copy = document.getElementById('btnCopy');
  const download = document.getElementById('btnDownload');
  const sequence = document.getElementById('btnSequence');
  const error = document.getElementById('errorState');
  let data = null;
  let busy = false;
  let celebrationTimer;
  let collectTimer;
  let tabId = null;
  let sequenceState = null;

  function state(name, message) {
    clearTimeout(celebrationTimer);
    if (name === 'copied' || name === 'error') {
      clearTimeout(collectTimer);
      petStage?.classList.remove('collecting');
    }
    popup.className = `popup ${name}`;
    status.textContent = message;
    status.title = message || '';
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
    const startTime = Date.now();
    petStage?.classList.add('collecting');
    state('extracting', 'Extraindo…');
    preview.textContent = 'Extraindo o conteúdo da página…';
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || tab.id == null) {
        failure('Aba não encontrada', 'Abra uma página e tente novamente.');
        return;
      }
      tabId = tab.id;
      const url = tab.url || tab.pendingUrl || '';
      document.getElementById('pageTitle').textContent = tab.title || 'Página atual';
      document.getElementById('pageTitle').title = tab.title || '';
      try { document.getElementById('source').textContent = new URL(url).hostname || url; }
      catch { document.getElementById('source').textContent = url || 'Página atual'; }
      if (snapmdIsRestricted(url)) {
        failure('Página restrita', 'O navegador não permite capturar páginas internas. Abra uma página web e tente novamente.');
        return;
      }
      let result;
      try { result = await snapmdCaptureTab(tab.id); }
      catch (e) {
        if (e?.code !== 'empty') throw e;
        failure('Nenhum conteúdo encontrado', 'Esta página não apresentou conteúdo capturável. PDFs, imagens e canvas podem não fornecer texto.');
        return;
      }
      data = result;
      document.getElementById('pageTitle').textContent = result.title || tab.title || 'Página atual';
      document.getElementById('pageTitle').title = result.title || tab.title || '';
      preview.textContent = result.markdown;
      state('ready', 'Markdown pronto');

      const minDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1000;
      const remaining = Math.max(0, minDuration - (Date.now() - startTime));
      clearTimeout(collectTimer);
      if (remaining > 0) {
        collectTimer = setTimeout(() => {
          petStage?.classList.remove('collecting');
        }, remaining);
      } else {
        petStage?.classList.remove('collecting');
      }
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
      status.textContent = status.title = 'Não foi possível copiar. Tente novamente ou baixe o arquivo.';
    } finally { copy.disabled = !data; }
  }

  function downloadMarkdown() {
    if (!data || download.disabled) return;
    const url = URL.createObjectURL(new Blob([data.markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = snapmdFileName(data.title);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = status.title = 'Download solicitado';
  }

  // Captura em sequência: o laço roda no background.js, que segue vivo com o popup fechado.
  function showSequence(next) {
    sequenceState = next;
    const running = !!next?.running;
    sequence.classList.toggle('running', running);
    sequence.setAttribute('aria-label', running ? 'Parar sequência' : 'Capturar sequência');
    sequence.title = running ? 'Parar a sequência e baixar o que já foi capturado' : 'Capturar sequência: clica em Próximo e junta todas as telas num .md';
    if (!next) return;
    const telas = `${next.count} ${next.count === 1 ? 'tela' : 'telas'}`;
    const message = running ? `Sequência: ${telas}…`
      : next.file ? `Sequência: ${telas} baixadas (${SNAPMD_SEQUENCE_REASONS[next.reason] || next.reason})`
      : `Sequência sem telas (${SNAPMD_SEQUENCE_REASONS[next.reason] || next.reason})`;
    status.textContent = status.title = message;
  }

  if (chrome.runtime?.sendMessage) {
    sequence.hidden = false;
    chrome.runtime.onMessage.addListener(message => { if (message?.type === 'sequence-state') showSequence(message.state); });
    chrome.runtime.sendMessage({ type: 'sequence-get' }).then(showSequence).catch(() => {});
    sequence.addEventListener('click', () => {
      if (sequenceState?.running) chrome.runtime.sendMessage({ type: 'sequence-stop' }).catch(() => {});
      else if (tabId != null) chrome.runtime.sendMessage({ type: 'sequence-start', tabId }).catch(() => {});
    });
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
