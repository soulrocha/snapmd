/**
 * SnapMD — captura em sequência: captura a tela, clica em "Próximo", espera a tela mudar e repete.
 * As funções snapmdPageFingerprint e snapmdClickNext rodam na página (chrome.scripting, func):
 * são autocontidas, porque o navegador serializa a função e perde o escopo deste arquivo.
 */

// Assinatura do conteúdo visível. Relógio (00:29:12) sai da conta: cronômetro não é tela nova.
function snapmdPageFingerprint() {
    const text = `${location.href}\n${document.body?.innerText || ''}`.replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, '');
    let h = 0x811c9dc5; // FNV-1a
    for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return `${text.length}:${(h >>> 0).toString(16)}`;
}

// Acha o controle de avançar (inclusive dentro de shadow DOM, como o <ion-button> do Ionic) e clica.
// Nunca clica em finalizar, enviar ou pagar. Devolve { clicked, label } ou { clicked: false, reason }.
function snapmdClickNext() {
    const NEXT = /^(next|next page|next question|próximo|próxima|próxima página|próxima questão|avançar|seguinte|continuar|continue|siguiente|suivant|weiter|›|»|>|→|>>)$/i;
    const NEXT_ATTR = /(^|[-_\s])next([-_\s]|$)|^next|next$/i;
    const STOP = /(finish|submit|send|end test|finalizar|enviar|concluir|terminar|entregar|encerrar|pagar|pay|buy|comprar|checkout|delete|excluir|logout|sair)/i;
    const CLICKABLE = 'a[href], a[rel], button, input[type="button"], input[type="submit"], [role="button"], [role="link"]';
    const found = [];
    const walk = root => {
        for (const el of root.querySelectorAll('*')) {
            // Componente com botão na sombra (ion-button, mwc-button): o rótulo e o clique ficam no host.
            if (el.matches(CLICKABLE) || (el.localName.includes('-') && el.shadowRoot?.querySelector('button, a[href]'))) found.push(el);
            if (el.shadowRoot) walk(el.shadowRoot);
        }
    };
    walk(document);
    const visible = el => {
        if (!el.getClientRects().length || el.closest('[aria-hidden="true"], [inert]')) return false;
        const s = getComputedStyle(el);
        return s.visibility !== 'hidden' && s.display !== 'none';
    };
    const clean = t => String(t || '').replace(/\s+/g, ' ').trim();
    const labelOf = el => clean(el.getAttribute('aria-label') || el.innerText || el.textContent || el.value || el.title);
    let best = null;
    for (const el of found) {
        // Botão interno de um host já listado: o host responde pelo clique.
        const host = el.getRootNode().host;
        if (host && found.includes(host)) continue;
        if (!visible(el)) continue;
        const label = labelOf(el);
        const attrs = ['id', 'class', 'data-cy', 'data-testid', 'data-test', 'name'].map(a => el.getAttribute(a) || '').join(' ');
        if (STOP.test(label) || STOP.test(attrs)) continue;
        const bare = label.replace(/^[\s‹«<←]+|[\s›»>→]+$/g, '') || label;
        const score = /(^|\s)next(\s|$)/i.test(el.getAttribute('rel') || '') ? 3 : NEXT.test(bare) || NEXT.test(label) ? 2 : attrs.split(/\s+/).some(a => NEXT_ATTR.test(a)) ? 1 : 0;
        if (score && (!best || score > best.score)) best = { el, label: label || attrs.trim(), score };
    }
    if (!best) return { clicked: false, reason: 'missing' };
    const el = best.el;
    const disabled = el.disabled || el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled')
        || /(^|\s)(disabled|button-disabled)(\s|$)/.test(el.className?.baseVal ?? el.className ?? '');
    if (disabled) return { clicked: false, reason: 'disabled', label: best.label };
    el.click();
    return { clicked: true, label: best.label };
}

/**
 * Laço da sequência. Recebe as operações por injeção (no background, chrome.scripting na aba;
 * no teste, a própria página):
 *   capture() → { markdown, title }    fingerprint() → string    clickNext() → resultado de snapmdClickNext
 *   progress(estado)                   shouldStop() → boolean     sleep(ms)
 * Para quando o "Próximo" some ou desabilita, quando a tela não muda, quando uma tela se repete,
 * no limite de telas ou a pedido. Devolve { title, steps, markdown, reason }.
 */
async function snapmdRunSequence(ops, { maxSteps = 300, changeTimeout = 15000, poll = 100, settle = 250 } = {}) {
    const steps = [];
    const seen = new Set();
    let title = '';
    let reason = 'limit';
    const safeFingerprint = async () => { try { return await ops.fingerprint(); } catch { return null; } };
    // Espera a assinatura mudar e depois ficar estável por `settle` ms (página que carrega aos poucos).
    async function waitChange(before) {
        const deadline = Date.now() + changeTimeout;
        let last = null, since = 0;
        while (Date.now() < deadline) {
            if (ops.shouldStop()) return 'stopped';
            await ops.sleep(poll);
            const now = await safeFingerprint(); // durante a navegação a aba não responde
            if (!now || now === before) { last = null; continue; }
            if (now !== last) { last = now; since = Date.now(); continue; }
            if (Date.now() - since >= settle) return 'changed';
        }
        return last ? 'changed' : 'unchanged';
    }
    for (let i = 0; i < maxSteps; i++) {
        if (ops.shouldStop()) { reason = 'stopped'; break; }
        const fp = await safeFingerprint();
        if (fp && seen.has(fp)) { reason = 'repeated'; break; }
        if (fp) seen.add(fp);
        let shot, click;
        try { shot = await ops.capture(); } catch { reason = 'error'; break; }
        title = title || shot.title || '';
        steps.push(shot.markdown.trim());
        ops.progress({ count: steps.length, running: true });
        try { click = await ops.clickNext(); } catch { reason = 'error'; break; }
        if (!click?.clicked) { reason = click?.reason === 'disabled' ? 'disabled' : 'missing'; break; }
        const change = await waitChange(fp);
        if (change !== 'changed') { reason = change; break; }
    }
    // O cabeçalho do extractor (frontmatter, fonte e data) entra uma vez só, o da primeira tela, no topo.
    const HEADER = /^---\n[\s\S]*?\n---\n\s*(?:> \*\*(?:Fonte|Capturado em):\*\*.*\n)*\s*/;
    const header = steps[0]?.match(HEADER)?.[0].trimEnd() || '';
    const body = steps.map((md, i) => `<!-- SnapMD: tela ${i + 1} de ${steps.length} -->\n\n${md.replace(HEADER, '')}`).join('\n\n---\n\n');
    const markdown = (header ? `${header}\n\n${body}` : body) + '\n';
    return { title, steps: steps.length, markdown, reason };
}

const SNAPMD_SEQUENCE_REASONS = {
    missing: 'não há mais botão de avançar',
    disabled: 'o botão de avançar está desabilitado',
    unchanged: 'a tela não mudou depois do clique',
    repeated: 'a tela se repetiu',
    stopped: 'parada a pedido',
    limit: 'limite de telas atingido',
    error: 'a página recusou a leitura'
};
