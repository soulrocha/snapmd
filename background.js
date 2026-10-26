/**
 * SnapMD — service worker da captura em sequência. O laço mora aqui, e não no popup:
 * o popup fecha quando perde o foco e a página pode recarregar a cada clique em "Próximo".
 * Ao terminar, baixa um .md com todas as telas. O selo do ícone mostra quantas já foram.
 */
importScripts('page-reader.js', 'capture.js', 'sequence.js');

let run = null; // { tabId, count, running, stop, result }

function broadcast() {
    const state = run && { tabId: run.tabId, count: run.count, running: run.running, reason: run.reason, file: run.file };
    chrome.runtime.sendMessage({ type: 'sequence-state', state }).catch(() => { /* popup fechado */ });
    chrome.action.setBadgeBackgroundColor({ color: run?.running ? '#fbbf24' : '#4ade80' });
    chrome.action.setBadgeText({ text: run?.count ? String(run.count) : '' });
}

// Service worker não tem URL.createObjectURL: o arquivo sai como data URL em base64 (UTF-8).
function dataUrl(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:text/markdown;charset=utf-8;base64,${btoa(bin)}`;
}

// `ack` responde ao popup assim que a sequência começa (ou o motivo de não começar).
async function start(tabId, ack) {
    if (run?.running) return ack({ ok: false, reason: 'busy' });
    const tab = await chrome.tabs.get(tabId);
    if (snapmdIsRestricted(tab.url || '')) return ack({ ok: false, reason: 'restricted' });
    run = { tabId, count: 0, running: true, stop: false };
    ack({ ok: true });
    broadcast();
    const exec = async func => (await chrome.scripting.executeScript({ target: { tabId }, func }))[0]?.result;
    const current = run;
    const result = await snapmdRunSequence({
        capture: () => snapmdCaptureTab(tabId),
        fingerprint: () => exec(snapmdPageFingerprint),
        clickNext: () => exec(snapmdClickNext),
        progress: ({ count }) => { current.count = count; broadcast(); },
        shouldStop: () => current.stop,
        sleep: ms => new Promise(resolve => setTimeout(resolve, ms))
    });
    current.running = false;
    current.reason = result.reason;
    if (result.steps) {
        current.file = snapmdFileName(result.title || tab.title, '-sequencia');
        await chrome.downloads.download({ url: dataUrl(result.markdown), filename: current.file });
    }
    broadcast();
}

chrome.runtime.onMessage.addListener((message, _sender, reply) => {
    if (message?.type === 'sequence-start') {
        let answered = false;
        const ack = value => { if (!answered) { answered = true; reply(value); } };
        start(message.tabId, ack).catch(() => {
            ack({ ok: false, reason: 'error' });
            if (run?.running) { run.running = false; run.reason = 'error'; broadcast(); }
        });
        return true; // resposta assíncrona
    }
    if (message?.type === 'sequence-stop' && run) run.stop = true;
    if (message?.type === 'sequence-get') reply(run && { tabId: run.tabId, count: run.count, running: run.running, reason: run.reason, file: run.file });
});

chrome.tabs.onRemoved.addListener(tabId => { if (run?.tabId === tabId) run.stop = true; });
