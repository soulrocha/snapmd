/**
 * SnapMD — captura de uma aba: roda o extractor.js em todos os frames, preenche os marcadores
 * de canvas e terminal (page-reader.js) e junta os frames visíveis num Markdown só.
 * Usado pelo popup (captura avulsa) e pelo background.js (captura em sequência).
 * Lança Error com `code`: 'restricted' ou 'empty'. Outros erros vêm do navegador.
 */
function snapmdCaptureError(code) {
    return Object.assign(new Error(code), { code });
}

// Marcadores de canvas e terminal: o page-reader.js lê os dados no world MAIN do frame.
// A resposta vem do JS da página: só string, com tamanho limitado. Sem resposta, fica o texto de sempre.
async function snapmdFillSlots(tabId, r) {
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

const snapmdIsRestricted = url => /^(chrome|edge|about|chrome-extension|moz-extension):/.test(url);

async function snapmdCaptureTab(tabId) {
    // Todos os frames, para alcançar iframes de outra origem (portais Microsoft etc.).
    let results;
    try { results = await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: ['extractor.js'] }); }
    catch { results = await chrome.scripting.executeScript({ target: { tabId }, files: ['extractor.js'] }); }
    await Promise.all((results || []).map(r => snapmdFillSlots(tabId, r)));
    const main = results?.find(r => !r.frameId)?.result;
    if (!main || typeof main.markdown !== 'string' || !main.markdown.trim()) throw snapmdCaptureError('empty');
    // Iframe oculto não vaza: descarta o frame cuja URL (sem hash) só aparece entre os ocultos.
    // Na dúvida (mesma URL visível em outro lugar), mantém o conteúdo.
    const key = url => { try { const u = new URL(url); u.hash = ''; return u.href; } catch { return url || ''; } };
    const shown = new Set(results.flatMap(r => r.result?.shownFrameUrls || []));
    const hidden = new Set(results.flatMap(r => r.result?.hiddenFrameUrls || []));
    const frames = results.filter(r => r.frameId && typeof r.result?.markdown === 'string' && r.result.markdown.trim()
            && !(hidden.has(key(r.result.url)) && !shown.has(key(r.result.url))))
        .map(r => `## Frame: ${r.result.url}\n\n${r.result.markdown.trim()}`);
    return { ...main, markdown: [main.markdown.trimEnd(), ...frames].join('\n\n---\n\n') + '\n' };
}

// Nome de arquivo a partir do título: sem acento, minúsculo, com data e hora.
function snapmdFileName(title, suffix = '') {
    const slug = (title || 'pagina').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'pagina';
    return `${slug}${suffix}-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.md`;
}
