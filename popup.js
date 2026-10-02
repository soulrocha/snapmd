document.addEventListener('DOMContentLoaded', async () => {
  const markdownPreview = document.getElementById('markdownPreview');
  const skeletonState = document.getElementById('skeletonState');
  const errorState = document.getElementById('errorState');
  const errorMessageTitle = document.getElementById('errorMessageTitle');
  const errorMessageDesc = document.getElementById('errorMessageDesc');
  const btnReloadTab = document.getElementById('btnReloadTab');

  const statusPill = document.getElementById('statusPill');
  const statusLabel = document.getElementById('statusLabel');

  const contextTag = document.getElementById('contextTag');
  const contextIcon = document.getElementById('contextIcon');
  const contextLabel = document.getElementById('contextLabel');

  const metricLines = document.getElementById('metricLines');
  const metricWords = document.getElementById('metricWords');
  const metricSize = document.getElementById('metricSize');

  const btnCopy = document.getElementById('btnCopy');
  const btnDownload = document.getElementById('btnDownload');
  const toastHud = document.getElementById('toastHud');
  const toastHudText = document.getElementById('toastHudText');

  let extractedData = null;
  let activeTabId = null;

  function setStatus(type, label) {
    statusPill.className = `status-indicator ${type}`;
    statusLabel.textContent = label;
  }

  function showToast(msg = 'Markdown copiado com sucesso') {
    toastHudText.textContent = msg;
    toastHud.classList.add('show');
    setTimeout(() => {
      toastHud.classList.remove('show');
    }, 1800);
  }

  function showError(title, desc) {
    markdownPreview.style.display = 'none';
    skeletonState.style.display = 'none';
    errorState.style.display = 'flex';
    errorMessageTitle.textContent = title;
    errorMessageDesc.textContent = desc;
    setStatus('error', 'Falha');
  }

  const startTime = performance.now();

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs && tabs.length > 0 ? tabs[0] : null;

    if (!tab || !tab.id) {
      showError('Aba Não Encontrada', 'Nenhuma janela ou aba ativa detectada pelo navegador.');
      return;
    }

    activeTabId = tab.id;
    const currentUrl = (tab.url || tab.pendingUrl || '').toString();

    if (currentUrl && (currentUrl.startsWith('chrome://') || currentUrl.startsWith('edge://') || currentUrl.startsWith('about:'))) {
      showError(
        'Página de Sistema Restrita',
        'Por razões de segurança do navegador, extensões não têm permissão para ler abas internas (chrome:// ou edge://). Acesse uma página web e tente novamente.'
      );
      contextLabel.textContent = 'Página Restrita';
      contextIcon.textContent = '🔒';
      return;
    }

    // Exibe Skeleton se o parsing levar mais de 60ms
    const skeletonTimer = setTimeout(() => {
      markdownPreview.style.display = 'none';
      skeletonState.style.display = 'flex';
      setStatus('busy', 'Extraindo...');
    }, 60);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['extractor.js']
    });

    clearTimeout(skeletonTimer);
    skeletonState.style.display = 'none';
    markdownPreview.style.display = 'block';

    if (results && results[0] && results[0].result) {
      extractedData = results[0].result;
      const mdText = (extractedData.markdown || '').toString();
      markdownPreview.querySelector('code').textContent = mdText;

      const durationMs = Math.round(performance.now() - startTime);
      setStatus('ready', `Capturado (${durationMs}ms)`);

      // Telemetria precisa com Tabular Numbers
      const lines = mdText.split('\n').length;
      const words = mdText.trim() ? mdText.trim().split(/\s+/).length : 0;
      const bytes = new Blob([mdText]).size;
      const kb = (bytes / 1024).toFixed(1);

      metricLines.textContent = lines;
      metricWords.textContent = words;
      metricSize.textContent = kb;

      // Badge de Contexto
      if (mdText.includes('Diálogo / Modal Ativo')) {
        contextIcon.textContent = '🪟';
        contextLabel.textContent = 'Modal Priorizado';
      } else if (mdText.includes('Logs, Terminal')) {
        contextIcon.textContent = '📜';
        contextLabel.textContent = 'Terminal / Logs';
      } else if (mdText.includes('Tabelas de Dados')) {
        contextIcon.textContent = '📊';
        contextLabel.textContent = 'Tabela Tabular';
      } else if (mdText.includes('Menu Lateral')) {
        contextIcon.textContent = '🧭';
        contextLabel.textContent = 'Portal / Dashboard';
      } else {
        contextIcon.textContent = '📄';
        contextLabel.textContent = 'Página Web Analisada';
      }
    } else {
      showError('Sem Conteúdo Estruturado', 'Não foi possível extrair dados desta página (pode ser um PDF ou canvas isolado).');
    }
  } catch (err) {
    console.error('SnapMD Error:', err);
    showError(
      'Falha na Injeção de Leitura',
      `O navegador recusou a leitura do DOM nesta aba: ${err?.message || err}. Dica: Se acabou de instalar a extensão, recarregue a aba com F5.`
    );
  }

  // Ação de Cópia Tátil com Morphing de Ícone
  async function triggerCopyAction() {
    if (!extractedData || !extractedData.markdown) return;

    const iconCopy = btnCopy.querySelector('.icon-copy');
    const iconCheck = btnCopy.querySelector('.icon-check');
    const btnText = btnCopy.querySelector('.btn-text');

    try {
      await navigator.clipboard.writeText(extractedData.markdown);
      
      btnCopy.classList.add('copied');
      if (iconCopy) iconCopy.style.display = 'none';
      if (iconCheck) iconCheck.style.display = 'inline-block';
      if (btnText) btnText.textContent = 'Copiado!';

      showToast('Markdown copiado com sucesso');

      setTimeout(() => {
        btnCopy.classList.remove('copied');
        if (iconCopy) iconCopy.style.display = 'inline-block';
        if (iconCheck) iconCheck.style.display = 'none';
        if (btnText) btnText.textContent = 'Copiar Markdown';
      }, 1800);
    } catch (err) {
      console.warn('Clipboard writeText falhou, usando execCommand:', err);
      const ta = document.createElement('textarea');
      ta.value = extractedData.markdown;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Markdown copiado!');
    }
  }

  btnCopy.addEventListener('click', triggerCopyAction);

  // Ação de Download .md
  function triggerDownloadAction() {
    if (!extractedData || !extractedData.markdown) return;
    const blob = new Blob([extractedData.markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = (extractedData.title || 'page-snapshot')
      .toString()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'snapshot';

    a.href = url;
    a.download = `${safeTitle}-${Date.now().toString().slice(-6)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Download do arquivo .md iniciado');
  }

  btnDownload.addEventListener('click', triggerDownloadAction);

  // Recarregar aba em caso de erro
  btnReloadTab.addEventListener('click', () => {
    if (activeTabId) {
      chrome.tabs.reload(activeTabId, () => window.close());
    }
  });

  // Atalhos de Teclado Globais (Linear / Raycast Experience)
  window.addEventListener('keydown', (e) => {
    // Ctrl+Enter ou Cmd+Enter -> Copiar
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      triggerCopyAction();
    }
    // Ctrl+S ou Cmd+S -> Baixar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      triggerDownloadAction();
    }
    // Esc -> Fechar Popup
    if (e.key === 'Escape') {
      window.close();
    }
  });
});
