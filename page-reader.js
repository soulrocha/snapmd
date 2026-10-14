/**
 * SnapMD — roda no world MAIN da página (chrome.scripting, world: 'MAIN'): só ali o JS da página
 * enxerga as instâncias do xterm.js e do Chart.js. Recebe os marcadores do extractor e devolve
 * { marcador: markdown }. Marcador sem resposta fica com o texto de sempre (o popup decide).
 * Autocontida: o navegador serializa a função e perde o escopo deste arquivo.
 */
function snapmdReadPage(slots) {
    const MAX_IMAGE = 2e6;
    const out = {};
    const esc = t => String(t ?? '').replace(/([\\`*_{}\[\]<>|])/g, '\\$1');
    const fenced = (text, lang) => {
        const fence = '`'.repeat(Math.max(3, ...(text.match(/`+/g) || []).map(r => r.length + 1)));
        return `${fence}${lang}\n${text}\n${fence}`;
    };
    const image = (fallback, alt, canvas) => {
        try {
            const url = canvas.toDataURL('image/png'); // canvas contaminado (outra origem) lança erro
            return url.length > 6 && url.length <= MAX_IMAGE ? `${fallback}\n\n![${alt}](${url})` : null;
        } catch (_) { return null; }
    };

    // Objeto da página ligado ao elemento: escopo AngularJS (exige debug info, como no Portainer).
    function inScope(el, test) {
        let scope;
        try { scope = window.angular?.element(el).scope?.(); } catch (_) { return null; }
        for (let s = scope; s; s = s.$parent) {
            for (const k of Object.keys(s)) {
                try { if (s[k] && typeof s[k] === 'object' && test(s[k])) return s[k]; } catch (_) {}
            }
        }
        return null;
    }

    // __webpack_require__ da página, via um chunk vazio no array JSONP do webpack 5.
    let req;
    function webpack() {
        if (req !== undefined) return req;
        req = null;
        const name = Object.keys(window).find(k => k.startsWith('webpackChunk') && Array.isArray(window[k]));
        if (name) {
            const chunks = window[name];
            const length = chunks.length;
            chunks.push([[Symbol('snapmd')], {}, r => { req = r; }]);
            chunks.splice(length); // o webpack só lê o array na carga; a página fica como estava
        }
        return req?.m ? req : (req = null);
    }

    // xterm.js 3 (Portainer 2.33/2.39) guarda o Terminal numa closure. Pega a classe interna pelo
    // webpack e captura o `this` num keyup sintético de Shift: o xterm 3 trata Shift sem focar nem
    // escrever no terminal, e o _keyUp original nem chega a rodar.
    // Limite: só xterm 3 empacotado com webpack 5; xterm 4+ (bundle único) cai no aviso + imagem.
    function xtermCore(el) {
        const r = webpack();
        if (!r) return null;
        for (const id of Object.keys(r.m)) {
            const src = Function.prototype.toString.call(r.m[id]);
            if (!src.includes('xterm-helper-textarea') || !src.includes('_keyUp')) continue;
            // Há um .xterm na página, então o módulo já rodou: o require devolve o cache.
            const proto = r(id)?.Terminal?.prototype;
            if (typeof proto?._keyUp !== 'function') continue;
            const own = Object.prototype.hasOwnProperty.call(proto, '_keyUp');
            const original = proto._keyUp;
            let core = null;
            proto._keyUp = function () { if (this.element === el) core = this; };
            try {
                const ev = new KeyboardEvent('keyup', { key: 'Shift', shiftKey: true });
                Object.defineProperty(ev, 'keyCode', { value: 16 });
                el.dispatchEvent(ev);
            } finally {
                if (own) proto._keyUp = original; else delete proto._keyUp;
            }
            if (core) return core;
        }
        return null;
    }

    function terminal(el, fallback) {
        const lines = [];
        const term = inScope(el, o => o.element === el || o._core?.element === el);
        const pub = term?.buffer?.active || term?.buffer;
        if (typeof pub?.getLine === 'function') {
            for (let i = 0; i < pub.length; i++) lines.push(pub.getLine(i)?.translateToString(true) ?? '');
        } else {
            const core = term?._core || term || xtermCore(el);
            const b = core?.buffer;
            if (typeof b?.translateBufferLineToString === 'function') {
                for (let i = 0; i < b.lines.length; i++) lines.push(b.translateBufferLineToString(i, true));
            }
        }
        const text = lines.join('\n').replace(/^(\s*\n)+/, '').replace(/\s+$/, '');
        if (text) return fenced(text, 'text');
        // Sem buffer: junta as camadas de canvas do xterm numa imagem só.
        const layers = Array.from(el.querySelectorAll('canvas')).filter(c => c.width && c.height);
        if (!layers.length) return null;
        const flat = document.createElement('canvas'); // fora do DOM: a página não muda
        flat.width = layers[0].width;
        flat.height = layers[0].height;
        const ctx = flat.getContext('2d');
        try { layers.forEach(c => ctx.drawImage(c, 0, 0, flat.width, flat.height)); } catch (_) { return null; }
        return image(fallback, 'terminal', flat);
    }

    function chart(canvas, fallback) {
        const isChart = o => o.canvas === canvas && Array.isArray(o.data?.datasets);
        const lib = window.Chart;
        let c = null;
        try { c = lib?.getChart?.(canvas) || Object.values(lib?.instances || {}).find(isChart) || null; } catch (_) {}
        c = c || inScope(canvas, isChart);
        if (!c) return canvas.$chartjs || canvas.classList.contains('chartjs-render-monitor') ? image(fallback, 'gráfico', canvas) : null;

        const labels = Array.isArray(c.data.labels) ? c.data.labels : [];
        const datasets = c.data.datasets;
        const v2 = c.options?.tooltips?.callbacks?.label;
        const v3 = c.options?.plugins?.tooltip?.callbacks?.label;
        const num = p => typeof p === 'number' ? p : typeof p?.y === 'number' ? p.y : NaN;
        // O valor sai como no tooltip do gráfico (com unidade), sem o prefixo "Série: ".
        const fmt = (d, i, v) => {
            let s;
            try {
                s = typeof v2 === 'function' ? v2({ datasetIndex: d, index: i, xLabel: labels[i], label: labels[i], yLabel: v, value: String(v) }, c.data)
                    : typeof v3 === 'function' ? v3.call(c.tooltip, { chart: c, dataset: datasets[d], datasetIndex: d, dataIndex: i, label: labels[i], parsed: { y: v }, raw: v, formattedValue: String(v) })
                    : null;
            } catch (_) {}
            if (Array.isArray(s)) s = s.join(' ');
            return typeof s === 'string' && s.trim() ? s.replace(/^[^:]*:\s+/, '') : String(Math.round(v * 100) / 100);
        };
        const cell = x => esc(String(x ?? '').replace(/\s+/g, ' ').trim());
        const row = cells => `| ${cells.map(x => cell(x) || ' ').join(' | ')} |`;
        const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows].join('\n');

        const series = datasets.map((ds, d) => {
            const points = (Array.isArray(ds?.data) ? ds.data : []).map((p, i) => [num(p), i]).filter(([v]) => Number.isFinite(v));
            const name = ds?.label || `Série ${d + 1}`;
            if (!points.length) return [name, 'sem dados', '', '', '', ''];
            const values = points.map(([v]) => v);
            const [last, at] = points[points.length - 1];
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            const min = values.reduce((a, b) => Math.min(a, b)), max = values.reduce((a, b) => Math.max(a, b));
            return [name, fmt(d, at, last), labels[at] ?? '', fmt(d, at, min), fmt(d, at, max), fmt(d, at, avg)];
        });
        const parts = [];
        if (labels.length) parts.push(`_(gráfico: ${labels.length} pontos, de ${cell(labels[0])} a ${cell(labels[labels.length - 1])})_`);
        parts.push(table(['Série', 'Último valor', 'Horário', 'Mínimo', 'Máximo', 'Médio'], series.map(row)));
        if (labels.length) {
            const recent = labels.slice(-5).map((label, k) => {
                const i = labels.length - Math.min(5, labels.length) + k;
                return row([label, ...datasets.map((ds, d) => Number.isFinite(num(ds?.data?.[i])) ? fmt(d, i, num(ds.data[i])) : '')]);
            });
            parts.push('Últimos valores:', table(['Horário', ...datasets.map((ds, d) => ds?.label || `Série ${d + 1}`)], recent));
        }
        return parts.join('\n\n');
    }

    for (const s of slots) {
        try {
            const el = document.querySelectorAll(s.kind === 'xterm' ? '.xterm' : 'canvas')[s.index];
            const md = !el ? null : s.kind === 'xterm' ? terminal(el, s.fallback) : chart(el, s.fallback);
            if (md) out[s.token] = md;
        } catch (_) {}
    }
    return out;
}
