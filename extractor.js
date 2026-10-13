/**
 * SnapMD — serializa a página inteira em Markdown, em ordem de documento,
 * com o estado de cada controle. Passivo: não muta o DOM nem rola a página.
 */
(() => {
    // Frame filho de mesma origem: o pai já o percorre inline.
    // Frame sem área (anúncio, analytics, captcha) não é conteúdo.
    if (window !== window.top && (window.frameElement || !innerWidth || !innerHeight)) return null;

    const SKIP = new Set(['script', 'style', 'noscript', 'template', 'head', 'title', 'desc', 'defs', 'symbol', 'clippath', 'mask', 'option', 'datalist']);
    const INLINE = new Set(['span', 'a', 'b', 'strong', 'i', 'em', 'u', 's', 'del', 'small', 'label', 'abbr', 'sup', 'sub', 'mark', 'time', 'font', 'cite', 'q', 'bdi', 'bdo', 'var', 'data', 'output', 'img']);
    const ICON = '.material-icons, .material-icons-outlined, [class*="material-symbols"], .codicon, .fa, [class^="fa-"], .glyphicon, .pi:empty';
    const CHOICE_ROLES = new Set(['checkbox', 'radio', 'switch', 'menuitemcheckbox', 'menuitemradio']);
    const VALUE_ROLES = new Set(['combobox', 'textbox', 'searchbox', 'spinbutton', 'slider', 'progressbar', 'meter']);
    const TABLE = 'table, [role="table"], [role="grid"], [role="treegrid"]';
    const ROW = 'tr, [role="row"]';
    const CELL = 'td, th, [role="cell"], [role="gridcell"], [role="columnheader"], [role="rowheader"]';
    const STRUCTURE = 'a[href], button, input, select, textarea, table, h1, h2, h3, h4, h5, h6, ul, ol, li, img, p, b, strong, em, blockquote';
    const SECRET = /(^|\s)(cc-|one-time-code|current-password|new-password)/;
    const SECRET_NAME = /(^|[^a-z])(cvv|cvc|csc|otp|pin|senha|password|passwd|secret)([^a-z]|$)/i;
    // "txtSenha" e "userPassword" viram "txt Senha" e "user Password" antes do teste.
    const isSecretName = text => SECRET_NAME.test(String(text).replace(/([a-z])([A-Z])/g, '$1 $2'));
    // Cartão: prefixo e tamanho de bandeira + Luhn. Sem a bandeira, IMEI (15 dígitos, Luhn) seria ocultado.
    function isCardNumber(value) {
        const digits = String(value).replace(/[\s.-]/g, '');
        const n = digits.length;
        const brand = /^4/.test(digits) ? [13, 16, 19].includes(n)
            : /^(5[1-5]|2[2-7])/.test(digits) ? n === 16
            : /^3[47]/.test(digits) ? n === 15
            : /^3[068]/.test(digits) ? n === 14
            : /^(6|35)/.test(digits) ? n >= 16 && n <= 19 : false;
        if (!/^\d+$/.test(digits) || !brand) return false;
        let sum = 0;
        for (let i = 0; i < digits.length; i++) {
            let d = +digits[digits.length - 1 - i];
            if (i % 2) { d *= 2; if (d > 9) d -= 9; }
            sum += d;
        }
        return sum % 10 === 0;
    }

    let out = [];          // blocos prontos: { text, tight }
    let buf = '';          // texto inline do bloco corrente
    let indent = '';       // recuo de continuação dentro de listas
    let pending = null;    // marcador do próximo bloco (item de lista)
    let quote = '';
    let cell = false;      // renderizando dentro de célula de tabela
    let resets = 0;        // quantas vezes buf foi esvaziado (wrap usa para achar seu início)
    const counters = new WeakMap(); // numeração corrente de cada <ol>
    const dialogs = [];
    // Iframes que a caminhada alcançou (renderizados). O popup descarta o frame filho cuja URL
    // só aparece entre os ocultos. Chrome e Edge não têm runtime.getFrameId; a chave é a URL sem hash.
    const reachedFrames = new WeakSet();
    const frameKey = url => {
        if (url === 'about:srcdoc') return url;
        try {
            const u = new URL(url);
            if (!/^https?:$/.test(u.protocol)) return '';
            u.hash = '';
            return u.href;
        } catch (_) { return ''; }
    };
    const elementKey = el => el.hasAttribute('srcdoc') ? 'about:srcdoc' : frameKey(el.src);
    const emitted = new WeakSet(); // checkbox/radio já emitido (pelo rótulo ou pelo próprio input)

    let focused = document.activeElement;
    while (focused?.shadowRoot?.activeElement) focused = focused.shadowRoot.activeElement;

    const styleOf = el => (el.ownerDocument.defaultView || window).getComputedStyle(el);
    const attr = (el, name) => el.getAttribute(name);
    const clean = t => String(t ?? '').replace(/\s+/g, ' ').trim();
    const esc = t => String(t ?? '').replace(/([\\`*_{}\[\]<>|])/g, '\\$1');

    function push(text) {
        const lead = pending ?? indent;
        pending = null;
        const pad = quote + indent;
        const [first, ...rest] = text.split('\n');
        out.push({ text: quote + lead + first + rest.map(l => '\n' + pad + l).join(''), tight: !!(lead || quote) });
    }
    function flush(prefix = '') {
        let text = buf.replace(/[ \t]*\n[ \t]*/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
        buf = '';
        resets++;
        // Texto da página que começa como "# x" ou "1. x" não pode virar título ou lista.
        if (!prefix) text = text.replace(/^(#{1,6}\s|[-+]\s)/, '\\$1').replace(/^(\d+)\.\s/, '$1\\. ');
        if (text) push(prefix + text);
    }
    function inlineCode(t) {
        const ticks = '`'.repeat(Math.max(1, ...(t.match(/`+/g) || []).map(r => r.length + 1)));
        return ticks.length > 1 ? `${ticks} ${t} ${ticks}` : `\`${t}\``;
    }
    // Acrescenta ao fim do bloco corrente, ou do último bloco emitido.
    function tail(text) {
        if (buf.trim() || !out.length) buf += text;
        else out[out.length - 1].text += text;
    }
    function capture(fn) {
        const saved = [out, buf, indent, pending, quote, cell];
        out = []; buf = ''; indent = ''; pending = null; quote = ''; cell = true;
        fn(); flush();
        const text = out.map(o => o.text).join('\n');
        [out, buf, indent, pending, quote, cell] = saved;
        return text;
    }

    function rendered(el, style = styleOf(el)) {
        if (style.display === 'none') return false;
        if (style.display === 'contents') return true;
        if (style.contentVisibility === 'hidden') return false; // hidden="until-found"
        const rects = el.getClientRects();
        if (!rects.length) return false;
        // Acordeão fechado: caixa de altura zero que corta o conteúdo.
        if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
            const r = el.getBoundingClientRect();
            if ((r.width === 0 && style.overflowX !== 'visible') || (r.height === 0 && style.overflowY !== 'visible')) return false;
        }
        return true;
    }

    function states(el) {
        const s = [];
        const current = attr(el, 'aria-current');
        const cls = typeof el.className === 'string' ? el.className : '';
        if (current && current !== 'false') s.push('ativo');
        else if (/^(a|li|button)$/.test(el.localName) || /^(tab|menuitem|treeitem|option|row|link)$/.test(attr(el, 'role') || '')) {
            if (attr(el, 'aria-selected') !== 'true' && /(^|[\s_-])(active|selected|current)(?=$|[\s_-])/i.test(cls)) s.push('ativo');
        }
        if (attr(el, 'aria-selected') === 'true') s.push('selecionado');
        if (attr(el, 'aria-expanded')) s.push(attr(el, 'aria-expanded') === 'true' ? 'expandido' : 'recolhido');
        if (attr(el, 'aria-pressed')) s.push(attr(el, 'aria-pressed') === 'true' ? 'pressionado' : 'não pressionado');
        if (el.disabled || el.matches(':disabled') || attr(el, 'aria-disabled') === 'true') s.push('desabilitado');
        if (attr(el, 'aria-invalid') === 'true') s.push('inválido');
        if (el === focused) s.push('em foco');
        return s.length ? ` _(${s.join(', ')})_` : '';
    }

    // Texto de um rótulo sem o conteúdo dos controles que ele envolve.
    // A raiz pode estar oculta (aria-labelledby aponta para rótulo invisível); descendentes ocultos não contam.
    function labelText(node, root = true) {
        if (node.nodeType === 3) return node.nodeValue;
        if (node.nodeType !== 1 || /^(select|textarea|script|style)$/.test(node.localName)) return '';
        if (!root) {
            const style = styleOf(node);
            if (style.display === 'none' || style.visibility !== 'visible') return '';
        }
        return Array.from(node.childNodes, child => labelText(child, false)).join('');
    }
    function labelOf(el) {
        const root = el.getRootNode();
        const refs = (attr(el, 'aria-labelledby') || '').split(/\s+/).filter(Boolean)
            .map(id => root.getElementById?.(id) || document.getElementById(id)).filter(Boolean);
        if (refs.length) return clean(refs.map(n => labelText(n)).join(' ')).replace(/\s*[:：]$/, '');
        const labels = Array.from(el.labels || []);
        if (labels.length) return clean(labels.map(n => labelText(n)).join(' ')).replace(/\s*[:：]$/, '');
        return clean(attr(el, 'aria-label') || (el.localName === 'input' || el.localName === 'select' || el.localName === 'textarea' ? '' : labelText(el))
            || el.placeholder || el.title || el.name || '') || 'Campo sem rótulo';
    }

    function choice(el, label = labelOf(el)) {
        if (emitted.has(el)) return;
        emitted.add(el);
        const native = el.localName === 'input';
        const inner = !native && !['aria-checked', 'aria-pressed', 'aria-selected'].some(a => el.hasAttribute(a)) && el.querySelector('input[type="checkbox"], input[type="radio"]');
        const mark = native ? (el.indeterminate ? '-' : el.checked ? 'x' : ' ')
            : inner ? (inner.checked ? 'x' : ' ')
            : attr(el, 'aria-checked') === 'mixed' ? '-' : (attr(el, 'aria-checked') === 'true' || attr(el, 'aria-pressed') === 'true' || attr(el, 'aria-selected') === 'true') ? 'x' : ' ';
        const kind = attr(el, 'role') === 'switch' ? ' _(switch)_' : '';
        flush();
        if (pending === null && !cell) pending = indent ? indent.slice(0, -2) + '- ' : '- ';
        push(`[${mark}] ${esc(label)}${kind}${states(el)}`);
    }

    function field(el) {
        const type = (el.type || '').toLowerCase();
        const label = esc(labelOf(el));
        const notes = [];
        if (el.required || attr(el, 'aria-required') === 'true') notes.push('obrigatório');
        if (el.readOnly) notes.push('somente leitura');
        if (el.maxLength > 0) notes.push(`máx. ${el.maxLength} caracteres`);
        let value;
        if (el.localName === 'select') {
            const options = Array.from(el.options).map(o => clean(o.text));
            const selected = Array.from(el.selectedOptions).map(o => clean(o.text));
            if (el.multiple || el.size > 1) {
                flush();
                push(`**${label}:**${states(el)}`);
                Array.from(el.options).forEach(o => { pending = indent + '- '; push(`[${o.selected ? 'x' : ' '}] ${esc(clean(o.text))}`); });
                return;
            }
            value = esc(selected.join(', ')) || '_Não preenchido_';
            if (options.length) notes.push(options.length <= 30 ? `opções: ${options.map(esc).join(' / ')}` : `${options.length} opções`);
        } else if (type === 'password' || SECRET.test(attr(el, 'autocomplete') || '')
            || isSecretName([el.name, el.id, labelOf(el)].join(' ')) || isCardNumber(el.value || '')) {
            value = el.value ? '_(oculto)_' : '_Não preenchido_';
        } else if (type === 'file') {
            value = Array.from(el.files || [], f => esc(f.name)).join(', ') || '_Nenhum arquivo_';
        } else if (el.localName === 'input' || el.localName === 'textarea') {
            value = el.value ? esc(el.value) : '_Não preenchido_';
            if (type === 'range') notes.push(`de ${el.min || 0} a ${el.max || 100}`);
        } else {
            const now = attr(el, 'aria-valuetext') || attr(el, 'aria-valuenow') || (el.value != null && el.localName !== 'li' ? String(el.value) : '') || clean(el.textContent);
            value = now ? esc(now) : '_Não preenchido_';
            if (attr(el, 'aria-valuemax')) notes.push(`de ${attr(el, 'aria-valuemin') || 0} a ${attr(el, 'aria-valuemax')}`);
        }
        if (attr(el, 'aria-invalid') === 'true') {
            const root = el.getRootNode();
            const own = attr(el, 'aria-errormessage');
            const ids = (own || attr(el, 'aria-describedby') || '').split(/\s+/).filter(Boolean);
            const error = clean(ids.map(id => root.getElementById?.(id) || document.getElementById(id)).filter(n => n && rendered(n)).map(n => n.textContent).join(' ')).slice(0, 200);
            // aria-describedby também serve para dica; só aria-errormessage é erro por definição.
            if (error) notes.push(`${own ? 'erro' : 'mensagem'}: ${esc(error)}`);
        }
        const extra = notes.length ? ` _(${notes.join(', ')})_` : '';
        flush();
        if (cell) { buf += `${label}: ${value}${extra}${states(el)}`; return; }
        push(`**${label}:** ${value}${extra}${states(el)}`);
    }

    // Retorna true se tratou o elemento como controle.
    function control(el) {
        const tag = el.localName;
        const role = attr(el, 'role');
        if (el.matches('.inputarea, .xterm-helper-textarea')) return true;
        if (tag === 'input') {
            const type = (el.type || '').toLowerCase();
            if (type === 'hidden') return true;
            if (type === 'checkbox' || type === 'radio') { choice(el); return true; }
            if (/^(submit|button|reset|image)$/.test(type)) { buf += ` [botão: ${esc(el.value || el.alt || type)}]${states(el)} `; return true; }
            field(el); return true;
        }
        if (tag === 'textarea' || tag === 'select' || tag === 'progress' || tag === 'meter') { field(el); return true; }
        if (CHOICE_ROLES.has(role)) { choice(el); return true; }
        if (VALUE_ROLES.has(role) && !el.isContentEditable) { field(el); return true; }
        return false;
    }

    function codeSource(el, style) {
        if (el.matches('.monaco-editor')) return el.querySelector('.view-lines') || el;
        if (el.matches('.xterm')) return el.querySelector('.xterm-rows') || el;
        if (el.matches('.ace_editor')) return el.querySelector('.ace_text-layer') || el;
        if (el.matches('.CodeMirror')) return el.querySelector('.CodeMirror-code') || el;
        if (el.localName === 'pre' || el.matches('.cm-content')) return el;
        const preformatted = (style.whiteSpaceCollapse || '').startsWith('preserve') || /^(pre|break)/.test(style.whiteSpace);
        if ((attr(el, 'role') === 'log' || preformatted) && !/^inline/.test(style.display) && !el.querySelector(STRUCTURE)) return el;
        return null;
    }
    function code(el, src) {
        let lines;
        if (src.matches('.view-lines')) {
            // Monaco reaproveita linhas fora de ordem; a ordem visual vem do top.
            lines = Array.from(src.children).sort((a, b) => parseFloat(a.style.top) - parseFloat(b.style.top)).map(l => l.textContent);
        } else {
            // Log com um bloco por linha (Portainer: <pre><div class="line"><p>): innerText poria linha em branco entre elas.
            const kids = Array.from(src.children).filter(c => rendered(c));
            const perLine = src.localName === 'pre' && kids.length > 1
                && !Array.from(src.childNodes).some(n => n.nodeType === 3 && n.nodeValue.trim())
                && kids.every(c => !/^inline/.test(styleOf(c).display));
            lines = perLine ? kids.map(c => c.innerText.replace(/^\n+|\s+$/g, '')) : [src.innerText];
        }
        const text = lines.join('\n').replace(/\u00a0/g, ' ').replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').replace(/\s+$/, '');
        if (cell) { if (text.trim()) buf += inlineCode(text.replace(/\n/g, ' ↵ ')); return; }
        flush();
        if (!text.trim()) {
            if (el.matches('.xterm')) push('_(terminal sem texto no DOM: renderizado em canvas)_');
            return;
        }
        const fence = '`'.repeat(Math.max(3, ...(text.match(/`+/g) || []).map(r => r.length + 1)));
        const lang = ((el.className + ' ' + (el.querySelector('code')?.className || '')).match(/(?:language|lang)-([\w+#-]+)/) || [])[1] || '';
        push(`${fence}${lang}\n${text}\n${fence}`);
    }

    function table(el) {
        const rows = Array.from(el.querySelectorAll(ROW)).filter(r => r.closest(TABLE) === el && rendered(r));
        // Grids com colunas fixadas repetem a mesma linha lógica em vários contêineres.
        const merged = new Map();
        rows.forEach((r, i) => {
            const key = attr(r, 'aria-rowindex') ?? `#${i}`;
            let cells = Array.from(r.querySelectorAll(CELL)).filter(c => c.closest(ROW) === r && rendered(c));
            if (!r.querySelector(CELL)) cells = [r]; // linha sem célula: o conteúdo inteiro vira uma célula
            const entry = merged.get(key) || { row: r, cells: [] };
            entry.cells.push(...cells);
            merged.set(key, entry);
        });
        // Só colunas que têm alguma célula, em ordem: aria-colindex alto ou colunas virtualizadas não alargam a tabela.
        const indexes = [...new Set(Array.from(merged.values()).flatMap(e => e.cells.map(c => +attr(c, 'aria-colindex')).filter(n => n > 0)))].sort((a, b) => a - b);
        const position = new Map(indexes.map((col, i) => [col, i]));
        const grid = Array.from(merged.values()).map(({ row, cells }) => {
            if (cells.some(c => attr(c, 'aria-colindex'))) cells.sort((a, b) => attr(a, 'aria-colindex') - attr(b, 'aria-colindex'));
            const header = cells.length > 0 && (row.closest('thead') || cells.every(c => c.localName === 'th' || attr(c, 'role') === 'columnheader'));
            const values = [];
            cells.forEach((c, i) => {
                // Grid esparso: coluna ausente vira célula vazia, sem deslocar as seguintes.
                const col = +attr(c, 'aria-colindex');
                while (col > 0 && values.length < position.get(col)) values.push(' ');
                let text = capture(() => walkChildren(c, styleOf(c))).replace(/\n+/g, ' <br> ').replace(/(?<!\\)\|/g, '\\|');
                if (i === 0) text = (states(row).trim() + ' ' + text).trim();
                const sort = attr(c, 'aria-sort');
                if (sort === 'ascending' || sort === 'descending') text += sort === 'ascending' ? ' ↑' : ' ↓';
                values.push(text || ' ');
                for (let n = 1; n < (c.colSpan || +attr(c, 'aria-colspan') || 1); n++) values.push(' ');
            });
            return { header, values };
        }).filter(r => r.values.length);
        if (!grid.length || grid.every(r => r.values.every(v => !v.trim()))) return false;
        const width = Math.max(...grid.map(r => r.values.length));
        const pad = v => v.concat(Array(width - v.length).fill(' '));
        const headIndex = grid.findIndex(r => r.header);
        const head = headIndex >= 0 ? grid.splice(headIndex, 1)[0].values : Array.from({ length: width }, (_, i) => `Coluna ${i + 1}`);
        const lines = [pad(head), Array(width).fill('---'), ...grid.map(r => pad(r.values))].map(v => `| ${v.join(' | ')} |`);
        const caption = el.querySelector(':scope > caption');
        const total = +attr(el, 'aria-rowcount');
        flush();
        if (caption) push(`**${esc(clean(caption.textContent))}**`);
        push(lines.join('\n'));
        if (total > 0 && total > merged.size) push(`_(${merged.size} de ${total} linhas renderizadas; o restante não está carregado na página)_`);
    }
    function isLayoutTable(el) {
        if (/^(presentation|none)$/.test(attr(el, 'role') || '')) return true;
        if (el.querySelector(TABLE)) return true;
        return el.localName === 'table' && !el.querySelector('th, [role="columnheader"]') && !!el.querySelector('td div, td p, td ul, td form, td h1, td h2, td h3');
    }

    function frame(el) {
        reachedFrames.add(el);
        let doc = null;
        try { doc = el.contentDocument; } catch (_) {}
        const src = el.src || attr(el, 'src') || 'about:blank';
        flush();
        if (doc?.body) {
            push(`**[iframe: ${esc(src)}]**`);
            walk(doc.body);
            flush();
            push(`**[fim do iframe]**`);
        } else push(`_[iframe de outra origem: ${esc(src)}; conteúdo anexado ao final, se o navegador permitir]_`);
    }

    function wrap(el, style, format) {
        const before0 = resets;
        const blocks = out.length;
        let start = buf.length;
        walkChildren(el, style);
        if (out.length === blocks) {
            // Um flush vazio dentro do elemento zerou buf: o conteúdo inline começa em 0.
            if (resets !== before0) start = 0;
            const [, before, inner, after] = buf.slice(start).match(/^(\s*)([\s\S]*?)(\s*)$/);
            buf = buf.slice(0, start) + before + format(inner) + after;
        } else tail(format(null));
    }

    function shadowOf(el) {
        let root = el.shadowRoot;
        if (!root) try { root = globalThis.chrome?.dom?.openOrClosedShadowRoot?.(el); } catch (_) {}
        return root || null;
    }
    function children(el) {
        if (el.localName === 'slot') return el.assignedNodes({ flatten: true });
        const root = shadowOf(el);
        return root ? root.childNodes : el.childNodes;
    }
    // Todos os iframes, inclusive em shadow DOM e em iframes de mesma origem que a caminhada pulou.
    function allFrames(root, found = []) {
        for (const el of root.querySelectorAll('*')) {
            if (el.localName === 'iframe' || el.localName === 'frame') {
                found.push(el);
                try { if (el.contentDocument) allFrames(el.contentDocument, found); } catch (_) {}
            }
            const shadow = shadowOf(el);
            if (shadow) allFrames(shadow, found);
        }
        return found;
    }
    function walkChildren(el, style) {
        const showText = style.visibility === 'visible';
        const preserve = (style.whiteSpaceCollapse || '').startsWith('preserve') || /^(pre|break)/.test(style.whiteSpace);
        for (const node of children(el)) {
            if (node.nodeType === 3) {
                if (showText && node.nodeValue) buf += esc(preserve ? node.nodeValue.replace(/[ \t]+/g, ' ') : node.nodeValue.replace(/\s+/g, ' '));
            } else if (node.nodeType === 1) walk(node);
        }
    }

    function walk(el) {
        const tag = el.localName;
        if (SKIP.has(tag)) return;
        if (tag === 'br') { buf += '\n'; return; }
        const style = styleOf(el);
        const role = attr(el, 'role');
        if (style.display === 'none') {
            // Checkbox/radio escondido com visual próprio (PrimeNG etc.): o estado ainda vale.
            if (tag === 'input' && /^(checkbox|radio)$/.test(el.type) && style.visibility === 'visible') {
                const label = labelOf(el);
                choice(el, label === 'Campo sem rótulo' ? clean(labelText(el.parentElement)) || label : label);
            }
            return;
        }
        if (!rendered(el, style)) return;
        if (attr(el, 'aria-hidden') === 'true' && clean(el.textContent).length <= 2 && !el.querySelector('input, select, textarea')) return;
        if (el.matches(ICON)) return;
        // Invisível, mas um filho com visibility:visible ainda reaparece na tela.
        if (style.visibility !== 'visible') return walkChildren(el, style);

        if (tag === 'label' && el.control) {
            const target = el.control;
            // O controle sai com o texto deste rótulo; o rótulo não se repete no fluxo.
            if (el.contains(target) && (rendered(target) || /^(checkbox|radio)$/.test(target.type))) {
                walk(target);
                const links = Array.from(el.querySelectorAll('a[href]')).filter(a => !/^(#(?![!/])|javascript:|data:)/i.test(attr(a, 'href')));
                if (links.length) tail(' ' + links.map(a => `[${esc(clean(a.textContent)) || 'link'}](${a.href})`).join(' '));
                return;
            }
            if (emitted.has(target)) return;
            if (/^(checkbox|radio)$/.test(target.type)) return choice(target);
            if (rendered(target)) return;
        }
        if (tag === 'iframe' || tag === 'frame') return frame(el);
        if (control(el)) return;

        const src = codeSource(el, style);
        if (src) return code(el, src);
        if (/^(code|kbd|samp|tt)$/.test(tag)) {
            const t = clean(el.textContent);
            if (t) buf += inlineCode(t);
            return;
        }
        if (el.matches(TABLE)) {
            if (!isLayoutTable(el) && table(el) !== false) return;
        }
        if (tag === 'img' || role === 'img' || tag === 'svg' && (attr(el, 'aria-label') || attr(el, 'aria-labelledby'))) {
            const alt = clean(tag === 'img' ? el.alt : attr(el, 'aria-label') || labelOf(el));
            if (tag !== 'img' && !alt) return walkChildren(el, style);
            if (alt) buf += tag === 'img' && /^https?:/.test(el.currentSrc || el.src) && (el.currentSrc || el.src).length < 200 ? ` ![${esc(alt)}](${el.currentSrc || el.src}) ` : ` [imagem: ${esc(alt)}] `;
            return;
        }
        if (tag === 'canvas' || tag === 'video' || tag === 'audio') {
            const name = { canvas: 'canvas', video: 'vídeo', audio: 'áudio' }[tag];
            const label = clean(attr(el, 'aria-label') || el.title || '');
            buf += ` _[${name}${label ? `: ${esc(label)}` : ' sem texto acessível'}]_ `;
            return;
        }

        const level = /^h[1-6]$/.test(tag) ? +tag[1] : role === 'heading' ? +(attr(el, 'aria-level') || 2) : 0;
        if (level) { flush(); walkChildren(el, style); flush('#'.repeat(Math.min(level, 6)) + ' '); return; }

        if (tag === 'li' || role === 'listitem') {
            const parent = el.parentElement;
            let marker = '- ';
            if (parent?.localName === 'ol') {
                const step = parent.reversed ? -1 : 1;
                const first = attr(parent, 'start') != null ? +attr(parent, 'start') : parent.reversed ? parent.querySelectorAll(':scope > li').length : 1;
                const n = attr(el, 'value') != null ? +attr(el, 'value') : counters.has(parent) ? counters.get(parent) + step : first;
                counters.set(parent, n);
                marker = `${n}. `;
            }
            flush();
            const saved = indent;
            pending = cell ? '' : saved + marker;
            indent = cell ? saved : saved + ' '.repeat(marker.length);
            buf = states(el).trim() ? states(el).trim() + ' ' : '';
            walkChildren(el, style);
            flush();
            pending = null;
            indent = saved;
            return;
        }
        if (tag === 'details' && !el.open) {
            // Fechado: só o summary aparece; texto solto do corpo não tem caixa própria para checar.
            const summary = el.querySelector(':scope > summary');
            if (summary) walk(summary);
            return;
        }
        if (tag === 'summary') {
            const open = el.parentElement?.localName === 'details' && el.parentElement.open;
            flush();
            buf = open ? '▾ ' : '▸ ';
            walkChildren(el, style);
            buf += open ? ' _(aberto)_' : ' _(fechado)_';
            flush();
            return;
        }
        if (tag === 'hr') { flush(); push('---'); return; }

        const isDialog = tag === 'dialog' || role === 'dialog' || role === 'alertdialog' || attr(el, 'aria-modal') === 'true';
        if (isDialog) {
            const title = clean(attr(el, 'aria-label') || (attr(el, 'aria-labelledby') ? labelOf(el) : '') || el.querySelector('h1, h2, h3, h4, [role="heading"]')?.textContent) || 'Diálogo';
            dialogs.push(title);
            flush(); push(`**[Diálogo aberto: ${esc(title)}]**`);
            walkChildren(el, style);
            flush(); push(`**[Fim do diálogo: ${esc(title)}]**`);
            return;
        }
        // Toast/aviso: região viva pequena, com caixa real (anunciador só para leitor de tela fica de fora).
        const live = (role === 'status' || (attr(el, 'aria-live') || 'off') !== 'off') && !cell && pending === null && !indent && !quote && (() => {
            const text = clean(el.textContent);
            const r = el.getBoundingClientRect();
            return text && text.length < 300 && r.width > 1 && r.height > 1;
        })();
        if (tag === 'blockquote' || role === 'alert' || live) {
            const callout = role === 'alert' ? '[!WARNING]' : live ? '[!NOTE]' : '';
            flush();
            const saved = quote;
            quote += '> ';
            const mark = out.length;
            if (callout) push(callout);
            walkChildren(el, style);
            flush();
            if (callout && out.length === mark + 1) out.pop();
            quote = saved;
            return;
        }

        const href = tag === 'a' ? (attr(el, 'href') || '') : '';
        if (tag === 'a' && !(href && !/^(#(?![!/])|javascript:|data:)/i.test(href)) && states(el)) {
            const st = states(el);
            return wrap(el, style, inner => (inner || '') + st);
        }
        if (href && !/^(#(?![!/])|javascript:|data:)/i.test(href)) {
            const url = typeof el.href === 'string' ? el.href : href;
            const st = states(el) + truncated(el);
            return wrap(el, style, inner => inner
                ? `[${inner}](${url})${st}`
                : inner === '' ? (attr(el, 'aria-label') || el.title ? `[${esc(attr(el, 'aria-label') || el.title)}](${url})${st}` : '')
                : ` _(link: ${url})_${st}`);
        }
        if (tag === 'button' || role === 'button' || role === 'tab') {
            const kind = role === 'tab' ? 'aba' : 'botão';
            const st = states(el);
            const fallback = clean(attr(el, 'aria-label') || el.title || '');
            buf += ' ';
            wrap(el, style, inner => inner ? `[${kind}: ${inner}]${st}` : inner === '' ? (fallback ? `[${kind}: ${esc(fallback)}]${st}` : '') : ` _(${kind})_${st}`);
            buf += ' ';
            return;
        }
        const mark = { strong: '**', b: '**', em: '_', i: '_', s: '~~', del: '~~' }[tag];
        if (mark && /^inline/.test(style.display)) return wrap(el, style, inner => inner ? mark + inner + mark : '');
        if (tag === 'legend') { flush(); walkChildren(el, style); buf = buf.trim() ? `**${buf.trim()}**` : ''; flush(); return; }

        const d = style.display;
        const flow = d !== 'contents' && !d.startsWith('inline');
        const block = flow && !INLINE.has(tag);
        if (block) flush(); else if (flow) buf += ' ';
        // Região da página (como no snapshot ARIA do Playwright), delimitada para a LLM.
        const region = !cell && pending === null && !indent && !quote && landmark(el, tag, role);
        if (region) flush();
        const regionStart = out.length;
        if (region) push(`_[${region}]_`);
        const st = states(el);
        if (st && (role || attr(el, 'aria-expanded'))) buf += st.trim() + ' ';
        walkChildren(el, style);
        const full = truncated(el);
        if (full) tail(full);
        if (region) {
            flush();
            if (out.length === regionStart + 1) out.pop(); // região vazia: sem marcadores
            else push(`_[fim: ${region.split(':')[0]}]_`);
        }
        if (block) flush(); else if (flow) buf += ' ';
    }

    function landmark(el, tag, role) {
        const name = clean(attr(el, 'aria-label') || (attr(el, 'aria-labelledby') ? labelOf(el) : ''));
        const kind = (tag === 'nav' || role === 'navigation') ? 'navegação'
            : (tag === 'aside' || role === 'complementary') ? 'lateral'
            : (tag === 'main' || role === 'main') ? 'conteúdo principal'
            : role === 'search' || tag === 'search' ? 'busca'
            : name && (role === 'region' || (tag === 'section' && attr(el, 'aria-label'))) ? 'região'
            : name && (role === 'form' || tag === 'form') ? 'formulário' : '';
        return kind && (name ? `${kind}: ${esc(name)}` : kind);
    }

    // Texto cortado por JS ("Nome muito lo…") com o texto inteiro no title/tooltip.
    function truncated(el) {
        const full = attr(el, 'title') || attr(el, 'data-original-title') || attr(el, 'uib-tooltip');
        // Só o elemento mais interno anota; o contêiner com o mesmo title não repete.
        if (!full || el.querySelector('[title], [data-original-title], [uib-tooltip]')) return '';
        const visible = clean(el.textContent);
        const stem = visible.replace(/(…|\.\.\.)$/, '').trim();
        return stem && stem !== visible && full.length > visible.length && clean(full).startsWith(stem) ? ` _(completo: ${esc(clean(full))})_` : '';
    }

    const isTop = window === window.top;
    walk(document.body || document.documentElement);
    flush();
    const body = out.reduce((acc, o, i) => acc + (i ? (o.tight && out[i - 1].tight ? '\n' : '\n\n') : '') + o.text, '');

    const frames = allFrames(document);
    const frameLists = {
        shownFrameUrls: [...new Set(frames.filter(f => reachedFrames.has(f)).map(elementKey).filter(Boolean))],
        hiddenFrameUrls: [...new Set(frames.filter(f => !reachedFrames.has(f)).map(elementKey).filter(Boolean))]
    };
    const title = clean(document.title) || clean(document.querySelector('h1')?.textContent) || 'Página sem título';
    if (!isTop) return { title, url: location.href, markdown: body, ...frameLists };

    const now = new Date().toLocaleString('pt-BR');
    let header = `---\ntitle: "${title.replace(/["\\]/g, '\\$&')}"\nsource: "${location.href}"\ndate: "${now}"\ntags:\n  - snapmd\n---\n\n`;
    header += `> **Fonte:** [${esc(title)}](${location.href})\n> **Capturado em:** ${now}\n`;
    if (focused && focused !== document.body && focused !== document.documentElement) {
        const name = /^(input|select|textarea)$/.test(focused.localName) || attr(focused, 'role') ? labelOf(focused) : clean(focused.textContent).slice(0, 80);
        header += `> **Foco atual:** ${esc(name || focused.localName)}\n`;
    }
    dialogs.forEach(d => { header += `> **Diálogo aberto:** ${esc(d)}\n`; });
    const selected = clean(getSelection()?.toString());
    if (selected) header += `\n**Texto selecionado na página:**\n\n> ${esc(selected)}\n`;
    return { title, url: location.href, markdown: `${header}\n${body}\n`, ...frameLists };
})();
