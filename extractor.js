/**
 * SnapMD — Universal Web & Portal Markdown Extractor Engine
 * Arquitetura Pipes & Filters com DOM Node Claiming Registry (Resolução Definitiva)
 */
(async () => {
    // ------------------------------------------------------------------
    // REGISTRY: Controle de Reivindicação de Nós com Blindagem Semântica
    // ------------------------------------------------------------------
    class DOMNodeRegistry {
        constructor() {
            this.claimedNodes = new WeakSet();
            this.claimMap = new WeakMap();
            // Elementos de alto valor que NUNCA devem ser silenciados por reivindicação ancestral
            this.shieldedSelectors = [
                'table',
                '[role="grid"]',
                '.fxc-grid',
                '.azc-grid',
                '[role="alert"]',
                '.fxc-infobar',
                '.msportalfx-infobar',
                '[role="toolbar"]',
                '.fxs-command-bar',
                '.fxs-toolbar',
                '.azc-toolbar',
                '.fxc-commandBar',
                'form',
                'input', 'textarea', 'select', '[role="radio"]', '[role="checkbox"]', '[role="switch"]',
                '.monaco-editor',
                '.terminal',
                'pre',
                'code'
            ];
        }

        isClaimed(el) {
            return !el || !isVisible(el) || this.claimedNodes.has(el);
        }

        claim(el, owner) {
            if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
            this.claimedNodes.add(el);
            this.claimMap.set(el, owner);
        }

        claimDescendantsSafely(rootEl, owner) {
            if (!rootEl || rootEl.nodeType !== Node.ELEMENT_NODE) return;
            this.claim(rootEl, owner);

            const descendants = rootEl.getElementsByTagName('*');
            for (let i = 0; i < descendants.length; i++) {
                const child = descendants[i];
                const isShielded = this.shieldedSelectors.some(sel => {
                    try { return child.matches && child.matches(sel); } catch (_) { return false; }
                });
                if (isShielded) {
                    continue; // Não canibaliza elementos semânticos nobres
                }
                this.claimedNodes.add(child);
            }
        }

        claimDescendants(el, owner) {
            this.claimDescendantsSafely(el, owner);
        }
    }

    // ------------------------------------------------------------------
    // HELPERS COMPARTILHADOS (100% Passivos)
    // ------------------------------------------------------------------
    function resolveFullText(el) {
        if (!el) return '';
        let text = (el.innerText || el.textContent || el.value || '').trim();

        if (text.includes('[...]') || text.includes('…') || text.includes('...')) {
            const selfFull = el.getAttribute('uib-tooltip') || 
                             el.getAttribute('data-original-title') || 
                             el.getAttribute('title') || 
                             el.getAttribute('tooltip') ||
                             el.getAttribute('aria-label');
            if (selfFull && selfFull.length > text.length) return selfFull.trim();

            const container = el.closest('div, tr, p, li, .form-group') || el.parentElement;
            if (container) {
                const copyEl = container.querySelector('[data-clipboard-text], [data-copy], button, a, [uib-tooltip], [title], input[type="text"], input[readonly]');
                if (copyEl) {
                    for (const attr of Array.from(copyEl.attributes || [])) {
                        const val = attr.value || '';
                        if (val.length > text.length && (val.includes('http') || val.includes('/') || val.length > 20)) {
                            return val.trim();
                        }
                    }
                }
            }
        }
        return text;
    }

    const CONTROL_SELECTOR = 'input, select, textarea, [role="switch"], [role="checkbox"], [role="radio"], por-switch-field, p-inputswitch';
    function isVisible(el) {
        if (!el || el.closest('[hidden], [inert], [aria-hidden="true"]')) return false;
        for (let node = el; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        }
        // display: contents generates no box, but its children still render.
        return el.getClientRects().length > 0 || getComputedStyle(el).display === 'contents';
    }
    const CHOICE_SELECTOR = 'input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]';
    function choiceKind(el) {
        if (el.type === 'radio' || el.getAttribute('role') === 'radio') return 'radio';
        if (el.type === 'checkbox' || el.getAttribute('role') === 'checkbox') return 'checkbox';
        return null;
    }
    function isChecked(el) {
        if (el.tagName === 'INPUT') return el.checked;
        if (el.getAttribute('aria-checked') === 'true') return true;
        if (el.getAttribute('aria-checked') === 'false') return false;
        const native = el.querySelector?.('input[type="checkbox"], input[type="radio"]');
        if (native) return native.checked;
        return /(^|[\s_-])(checked|active)(\s|$)/.test(el.getAttribute('class') || '');
    }
    function escapeMarkdown(value) {
        return String(value ?? '').replace(/([\\`*_{}\[\]<>|])/g, '\\$1');
    }
    function referencedElements(el, attribute) {
        return (el.getAttribute(attribute) || '').split(/\s+/).filter(Boolean)
            .map(id => el.ownerDocument.getElementById(id)).filter(Boolean);
    }
    function labelInfo(inp) {
        const refs = referencedElements(inp, 'aria-labelledby');
        if (refs.length) return { text: refs.map(el => el.innerText || el.textContent).join(' ').trim(), nodes: refs };
        const labels = Array.from(inp.labels || []);
        if (labels.length) return { text: labels.map(el => el.innerText || el.textContent).join(' ').trim(), nodes: labels };
        if (inp.getAttribute('aria-label')) return { text: inp.getAttribute('aria-label').trim(), nodes: [] };
        // Search only nearby preceding content, never a whole page/form wrapper.
        let cursor = inp;
        for (let depth = 0; cursor && depth < 5; depth++, cursor = cursor.parentElement) {
            const prev = cursor.previousElementSibling;
            if (prev && !prev.querySelector(CONTROL_SELECTOR) && !prev.matches(CONTROL_SELECTOR) && isVisible(prev)) {
                const text = (prev.innerText || '').trim();
                if (text && !/^(máx|max|limite)\b/i.test(text)) return { text, nodes: [prev] };
            }
            if (cursor.parentElement?.matches('form, main, body, fieldset, [role="group"], [role="radiogroup"]')) break;
        }
        const ownText = inp.matches(CONTROL_SELECTOR) && !['INPUT', 'SELECT', 'TEXTAREA'].includes(inp.tagName) ? (inp.innerText || '').trim() : '';
        return { text: ownText || inp.placeholder || inp.title || inp.name || inp.id || 'Campo sem rótulo', nodes: [] };
    }
    function resolveHumanLabel(inp) { return labelInfo(inp).text; }

    // ------------------------------------------------------------------
    // EXTRATORES MODULARES ESPECIALIZADOS
    // ------------------------------------------------------------------

    // 1. Metadata & Breadcrumbs
    const MetadataExtractor = {
        id: 'metadata',
        priority: 10,
        canHandle: () => true,
        extract: async (ctx) => {
            const bladeTitleEl = ctx.root.querySelector('.fxs-blade-title, [class*="blade-title"], h1, [role="heading"][aria-level="1"], [class*="title-text"]');
            const bladeTitle = (bladeTitleEl?.innerText || ctx.document.title || 'Sem título').replace(/✕|\n/g, ' ').trim();
            ctx.pageTitle = bladeTitle;
            const titleEl = bladeTitleEl;
            if (titleEl) ctx.registry.claimDescendants(titleEl, 'metadata');
            const now = new Date().toLocaleString('pt-BR');

            let md = `---\ntitle: "${bladeTitle.replace(/"/g, '\\"')}"\nsource: "${ctx.url}"\ndate: "${now}"\ntags:\n  - snapmd\n  - universal-snapshot\n---\n\n`;
            md += `# ${bladeTitle}\n\n> **Fonte:** [${ctx.url}](${ctx.url})\n> **Capturado em:** ${now}\n\n`;

            try {
                const breadcrumbEl = ctx.root.querySelector('.breadcrumb, [aria-label="breadcrumb"], ol[class*="breadcrumb"], div[class*="breadcrumb"], .fxs-breadcrumb');
                if (breadcrumbEl) {
                    ctx.registry.claimDescendants(breadcrumbEl, 'metadata');
                    const crumbs = Array.from(breadcrumbEl.querySelectorAll('li, a, span'))
                        .map(c => (c.innerText || '').trim())
                        .filter(c => c && c !== '/' && c !== '>');
                    const uniqueCrumbs = Array.from(new Set(crumbs));
                    if (uniqueCrumbs.length > 0) {
                        md += `📁 **Navegação:** \`${uniqueCrumbs.join(' > ')}\`\n\n`;
                    }
                }
            } catch (_) {}

            return [{ type: 'metadata', priority: 10, markdown: md, title: bladeTitle }];
        }
    };

    // 2. Modais e Diálogos Ativos em Primeiro Plano
    const ModalExtractor = {
        id: 'modal',
        priority: 20,
        canHandle: (ctx) => {
            return !!ctx.root.querySelector('.p-dialog:not(.p-dialog-hidden), [role="dialog"], .modal.show, div.p-dynamic-dialog, .drawer.open');
        },
        extract: async (ctx) => {
            const activeDialog = Array.from(ctx.root.querySelectorAll('.p-dialog:not(.p-dialog-hidden), [role="dialog"], .modal.show, div.p-dynamic-dialog, .drawer.open')).find(isVisible);
            if (!activeDialog) return [];

            const modalHeading = activeDialog.querySelector('.p-dialog-header, .p-dialog-title, h1, h2, h3');
            if (modalHeading) ctx.registry.claimDescendants(modalHeading, 'modal');

            const dialogHeader = (activeDialog.querySelector('.p-dialog-header, .p-dialog-title, h1, h2, h3, [class*="header"], [class*="title"]')?.innerText || 'Diálogo Ativo').replace(/✕|\n/g, '').trim();
            let md = `## 🪟 Diálogo / Modal Ativo: ${dialogHeader}\n\n`;

            const contextArea = activeDialog.querySelector('.p-dialog-content > div:first-child, [class*="context"], [class*="user"], [class*="info"]');
            if (contextArea) {
                ctx.registry.claimDescendants(contextArea, 'modal');
                const rawLines = (contextArea.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
                if (rawLines.length > 0) {
                    md += `### Contexto do Diálogo\n`;
                    rawLines.slice(0, 10).forEach(l => {
                        md += `- ${l}\n`;
                    });
                    md += `\n`;
                }
            }

            return [{ type: 'modal', priority: 20, markdown: md }];
        }
    };

    // 3. Banners e Alertas Informativos (Prioridade 20)
    const BannerNoticeExtractor = {
        id: 'banners',
        priority: 20,
        canHandle: (ctx) => {
            return !!ctx.root.querySelector('.fxc-infobar, .msportalfx-infobar, [role="alert"], [class*="infobar"], div[class*="notice"], div[class*="warning"], div[class*="banner"]');
        },
        extract: async (ctx) => {
            const notices = Array.from(ctx.root.querySelectorAll('.fxc-infobar, .msportalfx-infobar, [role="alert"], [class*="infobar"], div[class*="notice"], div[class*="warning"], div[class*="banner"]'));
            const bannerBlocks = [];
            const seenBanners = new Set();

            notices.forEach(n => {
                if (!isVisible(n) || ctx.registry.isClaimed(n) || n.closest('nav, .fxs-sidebar-menu, .fxs-blade-content-navigation')) return;
                ctx.registry.claimDescendantsSafely(n, 'banners');

                const text = (n.innerText || n.textContent || '').replace(/✕|\n/g, ' ').replace(/\s+/g, ' ').trim();
                if (text && text.length > 15 && !seenBanners.has(text.slice(0, 60))) {
                    seenBanners.add(text.slice(0, 60));

                    let callout = 'NOTE';
                    const cls = (n.className || '').toLowerCase();
                    const lowerText = text.toLowerCase();
                    if (cls.includes('warning') || cls.includes('warn') || lowerText.includes('consentimento') || lowerText.includes('revogar') || lowerText.includes('atenção')) {
                        callout = 'WARNING';
                    } else if (cls.includes('error') || cls.includes('danger') || cls.includes('bloqueado')) {
                        callout = 'CAUTION';
                    }

                    bannerBlocks.push(`> [!${callout}]\n> ${text}`);
                }
            });

            if (bannerBlocks.length === 0) return [];

            let md = `## ⚠️ Avisos e Informações da Página\n\n` + bannerBlocks.join('\n\n') + '\n\n';
            return [{ type: 'banners', priority: 20, markdown: md }];
        }
    };

    // 4. Estágios e Jobs de Pipelines (Prioridade 25 - Azure DevOps, GitHub Actions, CI/CD)
    const PipelineStagesExtractor = {
        id: 'stages',
        priority: 25,
        canHandle: (ctx) => {
            return !!ctx.root.querySelector('[role="tree"], .bolt-tree, [class*="jobs-tree"], [class*="stages-tree"], div[aria-label*="Jobs"], [class*="job-list"]');
        },
        extract: async (ctx) => {
            const trees = Array.from(ctx.root.querySelectorAll('[role="tree"], .bolt-tree, [class*="jobs-tree"], [class*="stages-tree"], div[aria-label*="Jobs"], [class*="job-list"]'));
            const stages = [];
            const seenStages = new Set();

            trees.forEach(tree => {
                if (ctx.registry.isClaimed(tree)) return;

                const items = Array.from(tree.querySelectorAll('[role="treeitem"], .bolt-list-row, [class*="job-item"], [class*="stage-item"]'));
                items.forEach(it => {
                    const txt = (it.innerText || it.textContent || '').split('\n').map(l => l.trim()).filter(Boolean).join(' — ');
                    if (!txt || txt.length > 120 || seenStages.has(txt.toLowerCase())) return;
                    seenStages.add(txt.toLowerCase());
                    ctx.registry.claim(it, 'stages');

                    const isSelected = it.getAttribute('aria-selected') === 'true' || it.classList.contains('selected') || it.classList.contains('active');
                    stages.push(isSelected ? `- [x] **${txt}** (Selecionado)` : `- [ ] ${txt}`);
                });
            });

            if (stages.length === 0) return [];
            let md = `## 🚀 Estágios e Jobs da Execução (Pipeline)\n\n` + stages.join('\n') + '\n\n';
            return [{ type: 'stages', priority: 25, markdown: md }];
        }
    };

    // 5. Ações Disponíveis na Tela / Command Bars (Prioridade 30)
    const ActionBarExtractor = {
        id: 'actions',
        priority: 30,
        canHandle: (ctx) => {
            return !!ctx.root.querySelector('.fxs-command-bar, .azc-toolbar, [role="toolbar"], .fxc-commandBar, .fxs-toolbar, button, a.btn, [role="button"]');
        },
        extract: async (ctx) => {
            const actionElements = Array.from(ctx.root.querySelectorAll(
                '.fxs-command-bar-item, .fxc-commandBar-item, .azc-toolbar-item, .fxs-toolbar button, [role="toolbar"] button, [role="toolbar"] [role="button"], button, a.btn, [role="button"]'
            )).filter(b => {
                if (!isVisible(b) || ctx.registry.isClaimed(b)) return false;
                if (b.closest('nav, .fxs-sidebar-menu, .fxs-blade-content-navigation, table, [role="grid"], .fxc-grid, [class*="user-menu"]')) return false;

                const txt = (b.innerText || b.textContent || '').trim();
                if (txt.includes('@') || txt.includes('.assis') || txt.length < 2 || txt.length > 70 || txt.includes('\n\n')) return false;
                if (['fechar', 'close', '✕', 'x'].includes(txt.toLowerCase())) return false;
                return true;
            });

            if (actionElements.length === 0) return [];

            const actionsList = [];
            const seenActions = new Set();
            actionElements.forEach(btn => {
                ctx.registry.claim(btn, 'actions');
                const bText = (btn.innerText || btn.textContent || '').replace(/[\n\t]/g, ' ').replace(/\s+/g, ' ').trim();
                if (seenActions.has(bText.toLowerCase())) return;
                seenActions.add(bText.toLowerCase());

                const isDisabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true' || btn.classList.contains('disabled');
                actionsList.push(`- [ ] **${bText}**${isDisabled ? ' _(Desabilitado)_' : ''}`);
            });

            if (actionsList.length === 0) return [];

            let md = `## ⚡ Ações Disponíveis na Tela\n\n` + actionsList.slice(0, 15).join('\n') + '\n\n';
            return [{ type: 'actions', priority: 30, markdown: md }];
        }
    };

    // 6. Terminais, Logs e Blocos de Código (Prioridade 35 - Executa antes de tabelas genéricas)
    const LogTerminalExtractor = {
        id: 'terminal',
        priority: 35,
        canHandle: (ctx) => {
            return !!ctx.root.querySelector('pre, code, .monaco-editor, .ace_editor, textarea[readonly], [class*="log-viewer"], [class*="logs-viewer"], [class*="logviewer"], [class*="virtualized-log-viewer"], [class*="terminal"], [class*="console"], [id*="log-viewer"], [id*="logs"], [class*="logs-container"], .xterm, logs-viewer, log-viewer, .bolt-terminal, [class*="log-content"], div[class*="logViewer"], .log-view, div[class*="log-line"]');
        },
        extract: async (ctx) => {
            const codeBlocks = Array.from(ctx.root.querySelectorAll('pre, code, .monaco-editor, .ace_editor, textarea[readonly], [class*="log-viewer"], [class*="logs-viewer"], [class*="logviewer"], [class*="virtualized-log-viewer"], [class*="terminal"], [class*="console"], [id*="log-viewer"], [id*="logs"], [class*="logs-container"], .xterm, logs-viewer, log-viewer, .bolt-terminal, [class*="log-content"], div[class*="logViewer"], .log-view'));
            const capturedCodes = [];
            const seenCodes = new Set();

            codeBlocks.forEach(cb => {
                if (ctx.registry.isClaimed(cb) || (cb.tagName === 'CODE' && cb.closest('pre'))) return;
                ctx.registry.claimDescendantsSafely(cb, 'terminal');

                let codeContent = '';
                const lineEls = Array.from(cb.querySelectorAll('.log-line-content, .log-line, .view-line, .ace_line, div[class*="log-line"]'));
                
                if (lineEls.length > 0) {
                    codeContent = lineEls.map(l => (l.innerText || l.textContent || '').trimEnd()).filter(Boolean).join('\n');
                } else if (cb.classList && cb.classList.contains('xterm')) {
                    const rows = Array.from(cb.querySelectorAll('.xterm-rows > div'));
                    codeContent = rows.map(r => r.innerText || '').join('\n');
                } else {
                    codeContent = (cb.value || cb.innerText || cb.textContent || '').toString();
                }

                codeContent = codeContent.replace(/\u001b\[[0-9;]*[a-zA-Z]/g, '').trim();

                if (codeContent.length > 10 && !seenCodes.has(codeContent.slice(0, 80))) {
                    seenCodes.add(codeContent.slice(0, 80));

                    let lang = 'text';
                    if (codeContent.startsWith('{') || codeContent.startsWith('[')) lang = 'json';
                    else if (codeContent.includes('version:') || codeContent.includes('services:')) lang = 'yaml';
                    else if (codeContent.includes('function') || codeContent.includes('const ') || codeContent.includes('import ')) lang = 'javascript';
                    else if (codeContent.includes('agent v') || codeContent.includes('Listening for Jobs') || codeContent.includes('Connecting to') || codeContent.includes('Triggered by') || codeContent.includes('Timing')) lang = 'text';
                    else if (codeContent.includes('docker ') || codeContent.includes('curl ') || codeContent.includes('kubectl ')) lang = 'bash';

                    capturedCodes.push(`\`\`\`${lang}\n${codeContent}\n\`\`\``);
                }
            });

            if (capturedCodes.length === 0) return [];

            let md = `## 📜 Logs, Terminal e Saída de Execução\n\n` + capturedCodes.slice(0, 4).join('\n\n') + '\n\n';
            return [{ type: 'terminal', priority: 35, markdown: md }];
        }
    };

    // 7. Tabelas de Dados e Grids ARIA (Prioridade 40 - Ignora containers de log)
    const TableExtractor = {
        id: 'table',
        priority: 40,
        canHandle: (ctx) => {
            return !!ctx.root.querySelector('table, [role="table"], [role="grid"], .fxc-grid, .azc-grid');
        },
        extract: async (ctx) => {
            const grids = Array.from(ctx.root.querySelectorAll('table, [role="table"], [role="grid"], .fxc-grid, .azc-grid'));
            if (grids.length === 0) return [];

            let tablesOutput = '';
            grids.forEach((tbl, tIdx) => {
                if (ctx.registry.isClaimed(tbl) || tbl.closest('nav, .fxs-sidebar-menu, .fxs-blade-content-navigation')) return;

                // Não processa containers de logs como tabelas
                const isLogViewer = tbl.closest('[class*="log-viewer"], [class*="logviewer"], [class*="virtualized-log-viewer"], .monaco-editor, pre, code') ||
                                    (tbl.className && (tbl.className.includes('log-viewer') || tbl.className.includes('virtualized-log-viewer')));
                if (isLogViewer) return;

                // Cabeçalhos (th, columnheader ou primeira linha)
                let ths = Array.from(tbl.querySelectorAll('thead th, [role="columnheader"], .fxc-grid-header th, .fxc-grid-cell.fxc-grid-header-cell, tr:first-child th'))
                    .map(th => (th.innerText || th.textContent || '').replace(/\n/g, ' ').trim())
                    .filter(Boolean);

                // Linhas de dados (exclui linhas que contêm headers de coluna)
                let rows = Array.from(tbl.querySelectorAll('tbody tr, [role="row"]'))
                    .filter(r => !r.querySelector('[role="columnheader"]') && !r.closest('thead'));

                if (ths.length === 0 && rows.length > 0) {
                    const firstRowCells = Array.from(rows[0].querySelectorAll('td, [role="gridcell"], [role="cell"]'));
                    ths = firstRowCells.map((_, i) => `Coluna ${i + 1}`);
                }

                if (ths.length === 0 || rows.length === 0) return;

                const colIndices = [];
                const cleanHeaders = [];
                ths.forEach((h, idx) => {
                    const lower = h.toLowerCase();
                    if (!['', 'filter', 'items per page', 'select', 'ações', 'actions', '...'].includes(lower) && !lower.includes('quick action')) {
                        colIndices.push(idx);
                        cleanHeaders.push(h);
                    }
                });

                if (cleanHeaders.length === 0) return;

                let tblMd = `### Tabela / Grid ${grids.length > 1 ? `#${tIdx + 1}` : ''}\n\n`;
                tblMd += '| ' + cleanHeaders.join(' | ') + ' |\n';
                tblMd += '| ' + cleanHeaders.map(() => '---').join(' | ') + ' |\n';

                let rowCount = 0;
                rows.forEach(r => {
                    // Linha de agrupamento (ex: "Microsoft Graph (1)")
                    const isGroupHeader = r.classList.contains('fxc-grid-group-row') || 
                                          r.classList.contains('fxc-grid-group') || 
                                          r.getAttribute('aria-expanded') !== null ||
                                          r.querySelector('.fxc-grid-group-title, [class*="group"]');

                    if (isGroupHeader) {
                        const groupTitle = (r.innerText || r.textContent || '').replace(/[\n|]/g, ' ').replace(/\s+/g, ' ').trim();
                        if (groupTitle) {
                            tblMd += `| **${groupTitle}** | ` + cleanHeaders.slice(1).map(() => '---').join(' | ') + ' |\n';
                            rowCount++;
                        }
                        return;
                    }

                    const cells = Array.from(r.querySelectorAll('td, [role="gridcell"], [role="cell"]'));
                    if (cells.length === 0) return;

                    const rowData = [];
                    colIndices.forEach(idx => {
                        const cell = cells[idx];
                        let cellText = cell ? resolveFullText(cell).replace(/[\n|]/g, ' ').replace(/\s+/g, ' ').trim() : '-';
                        rowData.push(cellText || '-');
                    });

                    if (rowData.some(d => d !== '-')) {
                        tblMd += '| ' + rowData.join(' | ') + ' |\n';
                        rowCount++;
                    }
                });

                if (rowCount > 0) {
                    ctx.registry.claimDescendantsSafely(tbl, 'table');
                    tablesOutput += tblMd + '\n';
                }
            });

            if (!tablesOutput) return [];
            return [{ type: 'table', priority: 40, markdown: `## 📊 Tabelas de Dados e Permissões\n\n` + tablesOutput }];
        }
    };

    // 7. Menus e Navegação da Tela (Prioridade 60 - Reivindicação Estrita sem Canibalizar Lâminas)
    const MenuTreeExtractor = {
        id: 'menu',
        priority: 60,
        canHandle: (ctx) => {
            // NUNCA incluir classes genéricas de blade como 'menu-blade' ou 'ApplicationMenuBlade'
            return !!ctx.root.querySelector('nav, [role="navigation"], .fxs-sidebar-menu, .fxs-blade-content-navigation, aside.sidebar, [class*="sidebar-nav"], [class*="left-nav"]');
        },
        extract: async (ctx) => {
            const navContainers = Array.from(ctx.root.querySelectorAll(
                'nav, [role="navigation"], .fxs-sidebar-menu, .fxs-blade-content-navigation, aside.sidebar, [class*="sidebar-nav"], [class*="left-nav"]'
            )).filter(nav => {
                // Desqualificador crítico: se for a lâmina inteira ou contiver tabelas/grids/banners, NÃO é um menu
                if (!isVisible(nav)) return false;
                if (nav.classList.contains('fxs-blade') || nav.classList.contains('ApplicationMenuBlade')) return false;
                if (nav.querySelector('.fxc-grid, [role="grid"], table, .fxc-infobar, .fxs-command-bar, [role="toolbar"]')) return false;
                return true;
            });

            const menuItemsFound = [];
            const seenMenus = new Set();
            const noiseTexts = ['nenhum resultado', 'pesquisar', 'saiba mais', 'fechar', 'voltar', 'atualizar', 'comentários'];

            navContainers.forEach(nav => {
                // NÃO fazemos claimDescendants(nav) para não devorar nós irmãos ou subárvores!
                const items = Array.from(nav.querySelectorAll('a, [role="menuitem"], [role="tab"], [role="treeitem"], li.fxs-menu-item, div.fxs-menu-item'));

                const groupList = [];
                items.forEach(it => {
                    // Rejeita itens que estejam dentro de toolbars, tabelas ou conteúdo de lâmina
                    if (it.closest('.fxs-toolbar, [role="toolbar"], .fxc-commandBar, [role="grid"], table, .fxc-grid')) return;

                    const text = (it.innerText || it.textContent || '').split('\n')[0].trim();
                    if (!text || text.length > 50 || seenMenus.has(text.toLowerCase())) return;
                    if (noiseTexts.some(n => text.toLowerCase().includes(n))) return;

                    seenMenus.add(text.toLowerCase());
                    ctx.registry.claim(it, 'menu'); // Claim granular estrito do nó!

                    const directTargets = [it, it.parentElement].filter(Boolean);
                    const isActive = directTargets.some(el => 
                        el.classList.contains('active') ||
                        el.classList.contains('selected') ||
                        el.classList.contains('fxs-menu-item-selected') ||
                        el.className.includes('selected') ||
                        el.getAttribute('aria-selected') === 'true' ||
                        el.getAttribute('aria-current') === 'page'
                    );

                    groupList.push(isActive ? `- [x] **${text}** (Ativo)` : `- [ ] ${text}`);
                });

                if (groupList.length > 0) {
                    menuItemsFound.push(groupList.join('\n'));
                }
            });

            if (menuItemsFound.length === 0) return [];

            let md = `## 🧭 Menu Lateral e Opções Disponíveis na Tela\n\n` + menuItemsFound.slice(0, 8).join('\n\n') + '\n\n';
            return [{ type: 'menu', priority: 60, markdown: md }];
        }
    };

    // 8. Propriedades e Chave-Valor (Corporate Blades, Entra ID, Portais)
    const CorporateBladeExtractor = {
        id: 'keyvalue',
        priority: 70,
        canHandle: () => true,
        extract: async (ctx) => {
            const propPairs = [];
            const visitedPairs = new Set();

            // 1. Definition Lists (<dl>, <dt>, <dd>)
            ctx.root.querySelectorAll('dl').forEach(dl => {
                if (ctx.registry.isClaimed(dl)) return;
                ctx.registry.claimDescendants(dl, 'keyvalue');

                const dts = Array.from(dl.querySelectorAll('dt'));
                const dds = Array.from(dl.querySelectorAll('dd'));
                dts.forEach((dt, i) => {
                    const k = (dt.innerText || '').trim();
                    const v = dds[i] ? resolveFullText(dds[i]) : '';
                    const pairKey = `${k}::${v}`;
                    if (k && v && !visitedPairs.has(pairKey)) {
                        visitedPairs.add(pairKey);
                        propPairs.push(`- **${k}:** ${v}`);
                    }
                });
            });

            // 2. Linhas de texto com padrão "Chave : Valor" (Entra ID)
            const textLines = (ctx.root.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
            textLines.forEach(line => {
                if (line.includes(' : ') && line.length < 250) {
                    const parts = line.split(' : ');
                    const k = parts[0].trim();
                    const v = parts.slice(1).join(' : ').trim();
                    const pairKey = `${k}::${v}`;
                    if (k && v && k.length < 50 && !visitedPairs.has(pairKey)) {
                        visitedPairs.add(pairKey);
                        propPairs.push(`- **${k}:** ${v}`);
                    }
                }
            });

            // 3. Form groups estruturados
            const candidateRows = Array.from(ctx.root.querySelectorAll(
                '.form-group, .row, [class*="row"], tr, [class*="setting"], [class*="property"], [class*="field"], .azc-form-group'
            ));

            candidateRows.forEach(row => {
                if (ctx.registry.isClaimed(row) || row.closest('table tbody, nav, .sidebar, .fxs-sidebar')) return;

                if (row.querySelector(CONTROL_SELECTOR)) return;
                const labelEl = row.querySelector('label, [class*="label"], strong, th, .bold, div[class*="name"]');
                if (labelEl) {
                    const k = (labelEl.innerText || '').replace(/[\n:]/g, '').trim();
                    if (!k || k.length > 60) return;

                    const valEl = row.querySelector('input[type="text"], input[readonly], .form-control-static, [class*="value"], [class*="content"]') || row;
                    let v = resolveFullText(valEl);

                    if (typeof v === 'string' && typeof k === 'string' && v.startsWith(k)) {
                        v = v.slice(k.length).replace(/^[:\s—]+/, '').trim();
                    }

                    if (typeof v === 'string') {
                        v = v.replace(/Copy link|copied|Exibir|Editar|Salvar|Cancel/gi, '').trim();
                        const pairKey = `${k}::${v}`;
                        if (v && v !== k && v.length > 0 && !visitedPairs.has(pairKey)) {
                            visitedPairs.add(pairKey);
                            propPairs.push(`- **${k}:** ${v}`);
                            ctx.registry.claimDescendants(row, 'keyvalue');
                        }
                    }
                }
            });

            if (propPairs.length === 0) return [];
            return [{ type: 'keyvalue', priority: 70, markdown: `## 📋 Propriedades e Configurações da Tela\n\n` + propPairs.join('\n') + '\n\n' }];
        }
    };

    // 9. Controles, Toggles e Formulários Ativos
    const FormStateExtractor = {
        id: 'forms', priority: 65,
        canHandle: ctx => !!ctx.root.querySelector(CONTROL_SELECTOR),
        extract: async ctx => {
            const inputs = Array.from(ctx.root.querySelectorAll(CONTROL_SELECTOR));
            const handled = new Set();
            const output = [];
            const eligible = el => isVisible(el) && !['hidden', 'password', 'submit', 'button', 'reset', 'image'].includes(el.type)
                && !el.closest('nav, .sidebar, .fxs-sidebar');
            function consumeLabel(info) { info.nodes.forEach(el => ctx.registry.claimDescendants(el, 'forms')); }
            function details(el) {
                const hints = referencedElements(el, 'aria-describedby');
                const nearby = el.parentElement?.querySelectorAll('small, .help-text, .helper-text, [class*="helper"]') || [];
                const nodes = Array.from(new Set([...hints, ...nearby])).filter(isVisible);
                nodes.forEach(el => ctx.registry.claimDescendants(el, 'forms'));
                const text = Array.from(new Set(nodes.map(el => (el.innerText || '').trim()).filter(Boolean)));
                if (el.maxLength >= 0 && !text.some(t => t.includes(String(el.maxLength)))) text.push(`Máx. ${el.maxLength} caracteres`);
                if (el.required || el.getAttribute('aria-required') === 'true') text.push('Obrigatório');
                if (el.disabled || el.getAttribute('aria-disabled') === 'true') text.push('Desabilitado');
                if (el.readOnly) text.push('Somente leitura');
                return text.length ? '\n\n' + text.map(t => `_${escapeMarkdown(t)}_`).join(' · ') : '';
            }
            inputs.forEach(inp => {
                if (handled.has(inp) || !eligible(inp)) return;
                // Visible native child controls carry the live state of custom switch wrappers;
                // otherwise the wrapper itself reports the state.
                const nested = Array.from(inp.querySelectorAll(CONTROL_SELECTOR));
                if (nested.some(eligible)) return;
                nested.forEach(el => { handled.add(el); ctx.registry.claim(el, 'forms'); });
                handled.add(inp);
                ctx.registry.claim(inp, 'forms');
                const kind = choiceKind(inp);
                const groupOf = el => el.closest('fieldset, [role="radiogroup"], [role="group"]');
                const questionOf = el => el.closest('[data-question], [class*="question"], .form-group');
                const container = groupOf(inp);
                if (kind) {
                    const group = inputs.filter(el => eligible(el) && !handled.has(el) && choiceKind(el) === kind &&
                        (inp.name && el.name === inp.name && el.form === inp.form && el.getRootNode() === inp.getRootNode() ||
                         container && groupOf(el) === container && questionOf(el) === questionOf(inp) && !(inp.name && el.name && el.name !== inp.name)));
                    const members = [inp, ...group];
                    const isOptionLabel = el => members.some(control => Array.from(control.labels || []).includes(el));
                    const titleIn = scope => scope ? Array.from(scope.querySelectorAll('label, p, h2, h3, h4, [class*="label"]')).find(el => !el.querySelector(CONTROL_SELECTOR) && !isOptionLabel(el) && isVisible(el)) : null;
                    // A fieldset may hold several questions; then its legend does not name this one.
                    const mixed = container && Array.from(container.querySelectorAll(CHOICE_SELECTOR)).some(el => eligible(el) && !members.includes(el));
                    let groupTitle = null;
                    if (mixed) {
                        let scope = inp.parentElement;
                        while (scope && scope !== container && !members.every(el => scope.contains(el))) scope = scope.parentElement;
                        const narrow = scope && scope !== container && !Array.from(scope.querySelectorAll(CHOICE_SELECTOR)).some(el => eligible(el) && !members.includes(el));
                        groupTitle = narrow ? titleIn(scope) : null;
                        if (!groupTitle) {
                            let anchor = inp;
                            while (anchor.parentElement && anchor.parentElement !== container && anchor.parentElement.querySelectorAll(CHOICE_SELECTOR).length === 1) anchor = anchor.parentElement;
                            for (let prev = anchor.previousElementSibling; prev; prev = prev.previousElementSibling) {
                                if (prev.matches(CONTROL_SELECTOR) || prev.querySelector(CONTROL_SELECTOR)) break;
                                if (prev.tagName !== 'LEGEND' && isVisible(prev) && (prev.innerText || '').trim()) { groupTitle = prev; break; }
                            }
                        }
                    } else if (members.length > 1) {
                        groupTitle = titleIn(inp.closest('.form-group, [data-question], [class*="question"], [class*="field"]'));
                    }
                    const legend = mixed ? null : container?.querySelector(':scope > legend');
                    const question = groupTitle ? { text: groupTitle.innerText, nodes: [groupTitle] } : legend ? { text: legend.innerText, nodes: [legend] } : container && !mixed ? labelInfo(container) : labelInfo(inp);
                    consumeLabel(question);
                    const options = members.map(el => {
                        handled.add(el); ctx.registry.claim(el, 'forms');
                        const info = labelInfo(el); consumeLabel(info);
                        const checked = isChecked(el);
                        return `- [${checked ? 'x' : ' '}] ${escapeMarkdown(info.text === question.text && el.value && el.value !== 'on' ? el.value : info.text)}`;
                    });
                    output.push(`### ${escapeMarkdown(question.text)}\n\n${options.join('\n')}${details(inp)}`);
                    return;
                }
                const info = labelInfo(inp); consumeLabel(info);
                let value = inp.value ?? '';
                if (inp.tagName === 'SELECT') {
                    value = Array.from(inp.selectedOptions).map(opt => opt.text.trim()).join(', ') || 'Não preenchido';
                    const options = Array.from(inp.options).map(opt => opt.text.trim());
                    value = `Selecionado: ${value}\nOpções: ${options.join(' / ')}`;
                } else if (inp.getAttribute('role') === 'switch' || inp.matches('por-switch-field, p-inputswitch')) {
                    value = isChecked(inp) ? 'Marcado (true)' : 'Desmarcado (false)';
                }
                const text = String(value).trim() ? escapeMarkdown(value) : 'Não preenchido';
                output.push(`### ${escapeMarkdown(info.text)}\n\n${text}${details(inp)}`);
            });
            return output.length ? [{ type: 'forms', priority: 65, markdown: '## Controles e Formulários Ativos\n\n' + output.join('\n\n') }] : [];
        }
    };

    // Preserve remaining visible text nodes without re-emitting specialized blocks.
    const VisibleContentExtractor = {
        id: 'content', priority: 90, canHandle: () => true,
        extract: async ctx => {
            const walker = ctx.document.createTreeWalker(ctx.root, NodeFilter.SHOW_TEXT);
            const lines = [];
            let node;
            while ((node = walker.nextNode())) {
                const parent = node.parentElement;
                if (!parent || !isVisible(parent) || parent.closest('script, style, noscript, template, input, textarea, select, button, nav, [role="navigation"]')) continue;
                let claimed = false;
                for (let el = parent; el && el !== ctx.root; el = el.parentElement) {
                    if (ctx.registry.isClaimed(el)) { claimed = true; break; }
                }
                if (claimed) continue;
                const text = node.textContent.replace(/\s+/g, ' ').trim();
                if (!text) continue;
                const heading = parent.closest('h1, h2, h3, h4, h5, h6');
                if (heading && heading.textContent.trim() === ctx.pageTitle) continue;
                const block = parent.closest('p, li, h1, h2, h3, h4, h5, h6, div, section') || parent;
                const previous = lines[lines.length - 1];
                if (previous?.element === block) previous.text += ' ' + escapeMarkdown(text);
                else lines.push({ element: block, text: escapeMarkdown(text), heading });
            }
            return lines.length ? [{ type: 'content', priority: 90, markdown: '## Conteúdo da Página\n\n' + lines.map(l => (l.heading ? '### ' : '') + l.text).join('\n\n') }] : [];
        }
    };

    // ------------------------------------------------------------------
    // ORCHESTRATOR: Execução do Pipeline com Circuit-Breaker
    // ------------------------------------------------------------------
    class PipelineOrchestrator {
        constructor() {
            this.extractors = [
                MetadataExtractor,
                ModalExtractor,
                BannerNoticeExtractor,
                PipelineStagesExtractor,
                ActionBarExtractor,
                LogTerminalExtractor,
                TableExtractor,
                MenuTreeExtractor,
                FormStateExtractor,
                CorporateBladeExtractor,
                VisibleContentExtractor
            ];
        }

        async execute(rawRoot) {
            const registry = new DOMNodeRegistry();
            const ctx = {
                root: rawRoot,
                document: rawRoot.ownerDocument || document,
                url: window.location.href || '',
                registry: registry
            };

            const blocks = [];

            for (const extractor of this.extractors) {
                try {
                    if (extractor.canHandle(ctx)) {
                        let timeoutId;
                        let result;
                        try {
                            const timeoutPromise = new Promise((_, reject) => {
                                timeoutId = setTimeout(() => reject(new Error(`Timeout no extrator ${extractor.id}`)), 1500);
                            });
                            result = await Promise.race([extractor.extract(ctx), timeoutPromise]);
                        } finally { clearTimeout(timeoutId); }
                        if (Array.isArray(result)) {
                            blocks.push(...result);
                        }
                    }
                } catch (err) {
                    console.warn(`[SnapMD] Extrator '${extractor.id}' falhou de forma controlada:`, err);
                }
            }

            blocks.sort((a, b) => a.priority - b.priority);
            const markdown = blocks.map(b => b.markdown.trim()).filter(Boolean).join('\n\n');

            const metaBlock = blocks.find(b => b.type === 'metadata');
            const pageTitle = metaBlock?.title || document.title || 'snapshot';

            return {
                title: pageTitle,
                url: window.location.href,
                markdown: markdown
            };
        }
    }

    // ------------------------------------------------------------------
    // EXECUÇÃO PRINCIPAL
    // ------------------------------------------------------------------
    const orchestrator = new PipelineOrchestrator();
    return await orchestrator.execute(document.body);
})();
