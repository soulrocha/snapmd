const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const playwright = require("playwright");
(async () => {
 const browser = await playwright.chromium.launch({headless:true, channel:process.env.SNAPMD_BROWSER || 'msedge'});
 try {
 const page = await browser.newPage();
 const long = '6. Para promover diversidade e inclusão, informe quais recursos de acessibilidade seriam necessários durante o processo seletivo. Esta pergunta é opcional e sua candidatura será concluída normalmente.';
 const source = fs.readFileSync(path.join(__dirname,'../extractor.js'),'utf8');
 const html = `<h1>Formulário sintético</h1><nav><a href="#" aria-current="page">Minha candidatura</a></nav><div role="alert">As respostas não poderão ser editadas depois.</div><p>Instrução geral de preenchimento.</p><form><fieldset><legend>Você foi indicado?</legend><label><input type="radio" name="referral" value="yes">Sim</label><label><input type="radio" name="referral" value="no" checked>Não</label></fieldset><div><label for="salary">Pretensão salarial</label><input id="salary" value="10000"></div><div><label for="q4">4. Informe a matrícula de quem indicou você, se aplicável.</label><textarea id="q4" maxlength="1000" placeholder="Digite sua resposta aqui"></textarea><small>Máx. 1000 caracteres</small></div><div><label for="q5">5. Se você é colaborador, informe sua matrícula.</label><textarea id="q5"></textarea></div><div style="margin-top:1200px"><p id="long">${long}</p><textarea aria-labelledby="long"></textarea></div><label>Resposta repetida<input value="igual"></label><label>Resposta repetida<input value="igual"></label><label>Caracteres<textarea id="special"></textarea></label><label hidden>SEGREDO<input value="hidden"></label><div style="display:none"><input value="INVISÍVEL"></div><label>Senha<input type="password" value="PASSWORD"></label><label>Cartão<input autocomplete="cc-number" value="4111111111111111"></label><input type="hidden" value="TOKENOCULTO">${Array.from({length:35},(_,i)=>`<label>Extra ${i}<input value="${i}"></label>`).join('')}<button type="submit">Salvar e continuar</button></form><table><thead><tr><th>Nome</th><th>Status</th></tr></thead><tbody><tr><td>Recurso único</td><td>Ativo</td></tr><tr><td>Linha igual</td><td>X</td></tr><tr><td>Linha igual</td><td>X</td></tr></tbody></table><div role="dialog"><h2>Modal sintético</h2><p>Texto exclusivo do modal.</p></div>`;
 await page.route('https://exemplo.gov.br/inscricao', route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html}));
 await page.goto('https://exemplo.gov.br/inscricao');
 await page.locator('#special').fill('Acentos: ação\n**texto** `código` [link]');
 const before = await page.content();
 const result = await page.evaluate(source);
 const md = result.markdown;
 for(const text of [long,'4. Informe','5. Se você','**Pretensão salarial:** 10000','Não preenchido','máx. 1000 caracteres','- [x] Não','- [ ] Sim','Extra 34','Instrução geral','Recurso único','Modal sintético','Texto exclusivo do modal.','[botão: Salvar e continuar]','Minha candidatura _(ativo)_','**Você foi indicado?**','> [!WARNING]','> As respostas']) assert.ok(md.includes(text),text+'\n---\n'+md);
 assert.equal(md.match(/\*\*Resposta repetida:\*\* igual/g).length,2,'repeated fields kept');
 assert.equal(md.match(/\| Linha igual \| X \|/g).length,2,'identical rows kept');
 assert.equal(md.match(/Recurso único/g).length,1);
 for(const secret of ['SEGREDO','INVISÍVEL','PASSWORD','4111111111111111','TOKENOCULTO']) assert.ok(!md.includes(secret),secret);
 assert.ok(md.includes('**Senha:** _(oculto)_') && md.includes('**Cartão:** _(oculto)_'),'masked fields');
 assert.ok(md.includes('\\*\\*texto\\*\\*') && md.includes('ação\n'),'escaped multiline value');
 assert.equal(md.match(/Pretensão salarial/g).length,1,'label not repeated');
 assert.equal(await page.content(),before,'Extraction must not mutate the DOM');

 // Critérios de captura completa, numa página só.
 const rich = await browser.newPage({viewport:{width:1200,height:800}});
 await rich.route('https://portal.test/', route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><title>Portal</title><body>
 <p>Execute no PowerShell:</p><pre><code class="language-powershell">gh release download v1</code></pre><p>Atalhos: <kbd>Ctrl+Enter</kbd> para copiar e <code>a\`b</code>.</p>
 <p>Veja a <a href="/docs">documentação</a> e o <a href="#topo">topo</a>.</p>
 <a href="/items/143" id="card"><div><h3>Acesso Administrador</h3><p>Solicitação de Acesso</p></div></a>
 <h2>Nível dois</h2><h3>Nível três</h3>
 <ol><li>Um<ul><li>Sub A</li><li>Sub B</li></ul></li><li>Dois</li></ol>
 <div id="many">${Array.from({length:20},(_,i)=>`<button>Ação ${i}</button>`).join('')}</div>
 <div role="grid" aria-rowcount="500"><div role="row"><div role="columnheader">Sel</div><div role="columnheader" aria-sort="ascending">Usuário</div></div><div role="row" aria-selected="true"><div role="gridcell"><div role="checkbox" aria-checked="true" aria-label="Selecionar Ana"></div></div><div role="gridcell">Ana</div></div><div role="row"><div role="gridcell"><div role="checkbox" aria-checked="false" aria-label="Selecionar Bia"></div></div><div role="gridcell">Bia</div></div></div>
 <div style="display:flex;gap:8px"><span>Nome</span><span>Status</span></div>
 <pre class="log">${Array.from({length:30},(_,i)=>`linha de log ${i+1}`).join('\n')}</pre>
 <div class="xterm"><div class="xterm-rows"><div>root@portainer:/# ls</div><div>bin etc</div></div><textarea class="xterm-helper-textarea" aria-label="Terminal input"></textarea></div>
 <x-card><span slot="t">Conteúdo slotado</span></x-card>
 <iframe srcdoc="<p>Dentro do iframe</p>" style="width:300px;height:60px"></iframe>
 <div style="visibility:hidden">Oculto por visibility<span style="visibility:visible">Filho visível</span></div>
 <div style="height:0;overflow:hidden">Acordeão fechado</div>
 <details><summary>Detalhes fechados</summary>Conteúdo fechado</details><details open><summary>Detalhes abertos</summary>Conteúdo aberto</details>
 <div role="tablist"><button role="tab" aria-selected="true">Visão geral</button><button role="tab" aria-selected="false">Logs</button></div>
 <button aria-expanded="true">Filtros</button><button disabled>Excluir</button><button aria-label="Fechar painel"><svg aria-hidden="true" width="10" height="10"><path d="M0 0"/></svg></button>
 <ul class="menu"><li class="active"><a href="/a">Aplicativos Fiscais</a></li><li><a href="/b">Backup</a></li></ul>
 <label>País<select><option>Brasil</option><option selected>Portugal</option></select></label>
 <div role="switch" aria-checked="true" aria-label="Notificações"><input type="checkbox" style="display:none"></div>
 <p-inputswitch class="p-inputswitch-checked"><span>Modo escuro</span><input type="checkbox" checked style="display:none"></p-inputswitch>
 <input type="checkbox" id="custom" style="display:none" checked><label for="custom">Aceito os termos</label>
 <div style="display:contents">Texto em contents <span>e filho</span></div>
 <main aria-hidden="true" inert><p>Fundo do modal</p></main>
 <div role="dialog" aria-modal="true"><h2>Confirmar exclusão</h2><p>Deseja continuar?</p></div>
 <script>customElements.define('x-card',class extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).innerHTML='<h4>Título na sombra</h4><slot name="t"></slot>';}});</script>
 </body>`}));
 await rich.goto('https://portal.test/');
 await rich.waitForFunction(()=>document.querySelector('iframe').contentDocument?.body?.textContent.includes('Dentro'));
 const richBefore = await rich.content();
 const scrollBefore = await rich.evaluate(()=>scrollY);
 const r = (await rich.evaluate(source)).markdown;
 const has = (text,label=text)=>assert.ok(r.includes(text),label+'\n---\n'+r);
 has('Execute no PowerShell:');
 has('```powershell\ngh release download v1\n```','fenced code');
 has('`Ctrl+Enter` para copiar','inline kbd'); has('`` a`b ``','backtick code');
 has('[documentação](https://portal.test/docs)','absolute link');
 assert.ok(r.includes('topo') && !r.includes('#topo'),'hash link without URL');
 has('Solicitação de Acesso _(link: https://portal.test/items/143)_','block link');
 has('## Nível dois'); has('### Nível três'); has('### Acesso Administrador');
 has('1. Um\n   - Sub A\n   - Sub B\n2. Dois','nested lists');
 assert.equal(r.match(/\[botão: Ação \d+\]/g).length,20,'20 buttons');
 has('| Sel | Usuário ↑ |','grid header'); has('| _(selecionado)_ [x] Selecionar Ana | Ana |','grid checked'); has('| [ ] Selecionar Bia | Bia |','grid unchecked');
 has('3 de 500 linhas renderizadas','virtualized grid');
 assert.ok(!r.includes('NomeStatus') && r.includes('Nome'),'flex spans separated');
 has('linha de log 1\n'); has('linha de log 30\n```','30 log lines');
 has('root@portainer:/# ls\nbin etc','xterm rows'); assert.ok(!r.includes('Terminal input'),'xterm helper ignored');
 assert.equal(r.match(/Título na sombra/g)?.length,1,'shadow\n'+r); assert.equal(r.match(/Conteúdo slotado/g)?.length,1,'slot once');
 has('Dentro do iframe','same-origin iframe');
 assert.ok(!r.includes('Oculto por visibility') && r.includes('Filho visível'),'visibility child');
 assert.ok(!r.includes('Acordeão fechado'),'collapsed accordion');
 has('▸ Detalhes fechados _(fechado)_'); assert.ok(!r.includes('Conteúdo fechado'),'closed details'); has('▾ Detalhes abertos _(aberto)_'); has('Conteúdo aberto');
 has('[aba: Visão geral] _(selecionado)_'); has('[aba: Logs]');
 has('[botão: Filtros] _(expandido)_'); has('[botão: Excluir] _(desabilitado)_'); has('[botão: Fechar painel]');
 has('[Aplicativos Fiscais](https://portal.test/a)'); assert.ok(/- _\(ativo\)_ \[Aplicativos Fiscais\]/.test(r),'active li\n'+r);
 has('**País:** Portugal _(opções: Brasil / Portugal)_');
 has('[x] Notificações _(switch)_'); has('[x] Modo escuro'); has('- [x] Aceito os termos');
 assert.equal(r.match(/Aceito os termos/g).length,1,'hidden checkbox label once');
 has('Texto em contents e filho');
 has('Fundo do modal','aria-hidden/inert background kept');
 has('**[Diálogo aberto: Confirmar exclusão]**'); has('> **Diálogo aberto:** Confirmar exclusão');
 assert.equal(await rich.content(),richBefore,'no DOM mutation'); assert.equal(await rich.evaluate(()=>scrollY),scrollBefore,'no scroll');
 // Frame filho de mesma origem devolve null: o pai já o percorreu.
 assert.equal(await rich.frames()[1].evaluate(source),null,'child frame defers to parent');

 const big = await browser.newPage();
 await big.setContent(`<div>${Array.from({length:4000},(_,i)=>`<div class="row"><span>Item ${i}</span><a href="/x${i}">abrir</a><input value="v${i}"><b>ok</b></div>`).join('')}</div>`);
 const t0 = Date.now(); const bigMd = (await big.evaluate(source)).markdown; const elapsed = Date.now()-t0;
 assert.ok(bigMd.includes('Item 3999') && elapsed < 1500, `20k nodes in ${elapsed}ms`);
 await big.setContent(`<ol>${Array.from({length:10000},(_,i)=>`<li>Item ${i}</li>`).join('')}</ol>`);
 const t1 = Date.now(); const olMd = (await big.evaluate(source)).markdown; const olElapsed = Date.now()-t1;
 assert.ok(olMd.includes('10000. Item 9999') && olElapsed < 1500, `ol 10k in ${olElapsed}ms`);
 await big.close(); await rich.close();

 // Regressões encontradas na auditoria adversarial.
 const qa = await browser.newPage();
 await qa.route('https://qa.test/', route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><body>
 <input autocomplete="billing cc-number" value="4111111111111111"><input autocomplete="section-pay cc-csc" value="987">
 <div> <a href="/x"><div></div>Depois</a></div><button><div class="spinner"></div>Salvar</button><button><div>Bloco</div></button>
 <label>Nome<span style="display:none">SPANOCULTO</span><input value="a"></label>
 <div style="visibility:hidden"><input type="checkbox" style="display:none"><label>ROTULOINVISIVEL</label></div>
 <div hidden="until-found">OCULTOUNTIL<input value="VALORUNTIL"></div>
 <div role="grid"><div role="row">Texto direto na linha</div></div><div role="table"><div>Conteúdo sem linha</div></div>
 <div role="textbox" contenteditable="true"><h2>Título do doc</h2><p>Parágrafo um</p></div>
 <div style="white-space:pre-wrap"><p>Comentário <b>importante</b></p></div>
 <a href="#!/2/docker/containers">Containers</a> <a href="#/dashboard">Painel</a>
 <fieldset disabled><button>Enviar</button></fieldset>
 <label>Enviar documento<input type="file" style="display:none"></label>
 <ul><li><label><input type="radio" name="s">Small</label><label><input type="radio" name="s" checked>Standard</label></li></ul>
 <main aria-hidden="true"><input value="X"></main>
 <ol reversed><li>Terceiro</li><li>Segundo</li></ol><ol><li value="7">Sete</li><li>Oito</li></ol>
 <p># não é título</p><p>1. não é lista</p><p><code>a\`\`b</code></p>
 <table><tr><th>C</th></tr><tr><td><pre>x\ny</pre></td></tr></table>
 <div role="alert"></div><select aria-label="Vazio"></select><label>Rótulo:<input value="b"></label>
 </body>`}));
 await qa.goto('https://qa.test/');
 const q = (await qa.evaluate(source)).markdown;
 const hasQ = (text,label=text)=>assert.ok(q.includes(text),label+'\n---\n'+q);
 for(const leak of ['4111111111111111','987','SPANOCULTO','ROTULOINVISIVEL','OCULTOUNTIL','VALORUNTIL','[!WARNING]','opções: )','Rótulo::']) assert.ok(!q.includes(leak),leak+'\n---\n'+q);
 hasQ('[Depois](https://qa.test/x)'); hasQ('[botão: Salvar]'); hasQ('Bloco _(botão)_');
 hasQ('**Nome:** a'); hasQ('**Rótulo:** b'); hasQ('Texto direto na linha'); hasQ('Conteúdo sem linha');
 hasQ('## Título do doc'); assert.equal(q.match(/Parágrafo um/g).length,1,'editor once');
 hasQ('Comentário **importante**'); assert.ok(!/```\s*\nComentário/.test(q),'pre-wrap prose not code');
 hasQ('[Containers](https://qa.test/#!/2/docker/containers)'); hasQ('[Painel](https://qa.test/#/dashboard)');
 hasQ('[botão: Enviar] _(desabilitado)_');
 hasQ('Enviar documento'); hasQ('- [ ] Small\n- [x] Standard'); hasQ('**Campo sem rótulo:** X');
 hasQ('2. Terceiro\n1. Segundo'); hasQ('7. Sete\n8. Oito');
 hasQ('\\# não é título'); hasQ('1\\. não é lista'); hasQ('``` a``b ```');
 hasQ('| `x ↵ y` |');
 // Filtro de frames por URL (Chrome/Edge não têm runtime.getFrameId).
 await qa.setContent(`<div style="visibility:hidden"><iframe src="https://child.test/a#x"></iframe></div>
  <div style="height:0;overflow:hidden"><iframe src="https://child.test/b"></iframe></div>
  <iframe src="https://child.test/vis"></iframe><div style="visibility:hidden"><iframe src="https://child.test/vis"></iframe></div>
  <x-host></x-host><iframe id="outer" style="width:300px;height:100px" srcdoc="<div style='visibility:hidden'><iframe src='https://child.test/nested'></iframe></div><iframe src='https://child.test/inner'></iframe>"></iframe>
  <iframe src="about:blank"></iframe><table><tr></tr></table>
  <script>document.querySelector('x-host').attachShadow({mode:'open'}).innerHTML='<div style="visibility:hidden"><iframe src="https://child.test/shadow"></iframe></div>';</script>`);
 await qa.waitForFunction(()=>document.querySelector('#outer').contentDocument?.querySelectorAll('iframe').length===2);
 const hq = await qa.evaluate(source);
 assert.deepEqual(hq.shownFrameUrls.sort(),['about:srcdoc','https://child.test/inner','https://child.test/vis'],'shown: '+hq.shownFrameUrls);
 assert.deepEqual(hq.hiddenFrameUrls.sort(),['https://child.test/a','https://child.test/b','https://child.test/nested','https://child.test/shadow','https://child.test/vis'],'hidden: '+hq.hiddenFrameUrls);
 assert.ok(!hq.markdown.includes('Coluna 1'),'empty table skipped');

 // Ajustes vindos da pesquisa (Playwright aria snapshot, browser-use, log do Portainer).
 await qa.setContent(`<pre class="log_viewer">
   <div class="line"><p class="inner_line"><span>2026-10-13 INFO start</span></p></div>
   <div class="line"><p class="inner_line"><span>2026-10-13 ERROR boom</span></p></div>
 </pre>
 <pre><span class="k">const</span> <span>x</span> = 1;</pre>
 <nav aria-label="Menu principal"><a href="/a">Início</a></nav><main><p>Corpo</p></main>
 <ul><li><nav aria-label="Interna"><a href="/b">Sub</a></nav></li></ul>
 <div role="status">Salvo com sucesso</div><div aria-live="polite" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">ANUNCIO</div><div role="status"></div>
 <a href="/u" title="Nome completo do usuário administrador">Nome completo do us…</a><span title="qualquer coisa">Carregando...</span>
 <label for="mail">E-mail</label><input id="mail" value="x" aria-invalid="true" aria-errormessage="err"><span id="err">Informe um e-mail válido</span>`);
 const n = (await qa.evaluate(source)).markdown;
 const hasN = (text,label=text)=>assert.ok(n.includes(text),label+'\n---\n'+n);
 hasN('```\n2026-10-13 INFO start\n2026-10-13 ERROR boom\n```','one line per log entry');
 hasN('const x = 1;','inline spans stay on one line');
 hasN('_[navegação: Menu principal]_'); hasN('_[fim: navegação]_'); hasN('_[conteúdo principal]_');
 hasN('- [Sub](','landmark inside li keeps list marker');
 hasN('> [!NOTE]\n> Salvo com sucesso'); assert.ok(!n.includes('> ANUNCIO'),'sr-only announcer not quoted');
 assert.equal(n.match(/\[!NOTE\]/g).length,1,'empty status no callout');
 hasN('[Nome completo do us…](https://qa.test/u) _(completo: Nome completo do usuário administrador)_');
 assert.ok(!n.includes('completo: qualquer coisa'),'unrelated title ignored');
 hasN('erro: Informe um e-mail válido');
 await qa.setContent(`<pre><div>linha1 <span style="display:none">SEGREDOPRE</span></div><div>linha2</div></pre>
 <div title="Nome completo X"><span title="Nome completo X">Nome compl…</span></div>
 <ul><li><div role="status">Toast na lista</div></li></ul>
 <div>Antes2 <nav style="display:contents"><a href="/n">Nav</a></nav> depois2</div>
 <nav aria-label="Vazia"></nav>
 <label for="h">Campo</label><input id="h" aria-invalid="true" aria-describedby="hint"><small id="hint">Use o email corporativo</small>`);
 const m = (await qa.evaluate(source)).markdown;
 const hasM = (text,label=text)=>assert.ok(m.includes(text),label+'\n---\n'+m);
 hasM('linha1\nlinha2'); assert.ok(!m.includes('SEGREDOPRE'),'hidden span in log line');
 assert.equal(m.match(/completo: Nome completo X/g).length,1,'truncation noted once');
 hasM('- Toast na lista'); assert.ok(!m.includes('> - [!NOTE]'),'live region in li keeps list');
 assert.ok(m.indexOf('Antes2') < m.indexOf('_[navegação]_'),'text before contents landmark stays outside');
 assert.ok(!m.includes('navegação: Vazia'),'empty landmark omitted');
 hasM('mensagem: Use o email corporativo');

 // Revisão do PR (Devin).
 await qa.setContent(`<div role="switch" aria-label="Alertas"><input type="checkbox" checked></div>
 <label><input type="checkbox"> Aceito os <a href="/termos">termos</a></label>
 <div role="grid"><div role="row"><div role="columnheader" aria-colindex="1">Nome</div><div role="columnheader" aria-colindex="2">Email</div><div role="columnheader" aria-colindex="3">Papel</div></div>
 <div role="row"><div role="gridcell" aria-colindex="1">Ana</div><div role="gridcell" aria-colindex="3">Admin</div></div></div>
 <label>Número<input value="4111 1111 1111 1111"></label><label>CVV<input value="123"></label><label>Código OTP<input name="otp_code" value="654321"></label>
 <label>Pedido<input value="1234567890123"></label><label>Pinned<input value="sim"></label>`);
 const dv = (await qa.evaluate(source)).markdown;
 const hasD = (text,label=text)=>assert.ok(dv.includes(text),label+'\n---\n'+dv);
 hasD('[x] Alertas _(switch)_','switch wrapper reads nested checkbox');
 hasD('[ ] Aceito os termos [termos](https://qa.test/termos)','link inside label keeps URL');
 hasD('| Ana |   | Admin |','sparse grid keeps columns');
 for(const secret of ['4111','123 ','654321']) assert.ok(!dv.includes(secret),secret+'\n'+dv);
 hasD('**Número:** _(oculto)_'); hasD('**CVV:** _(oculto)_'); hasD('**Código OTP:** _(oculto)_');
 hasD('**Pedido:** 1234567890123','non-Luhn number kept'); hasD('**Pinned:** sim','word containing pin kept');
 await qa.setContent(`<div role="grid"><div role="row"><div role="gridcell" aria-colindex="1">A</div><div role="gridcell" aria-colindex="999999">Z</div></div></div>
 <label>IMEI<input value="490154203237518"></label><input id="txtSenha" value="VAZOU1"><input name="userPassword" value="VAZOU2">
 <label>Cartão pontuado<input value="4111.1111.1111.1111"></label><label>CNPJ<input value="11222333000181"></label>`);
 const dv2 = (await qa.evaluate(source)).markdown;
 assert.ok(dv2.length < 5000 && dv2.includes('| A | Z |'),'huge aria-colindex compacted\n'+dv2.slice(0,500));
 assert.ok(dv2.includes('**IMEI:** 490154203237518'),'IMEI kept\n'+dv2);
 for(const secret of ['VAZOU1','VAZOU2','4111']) assert.ok(!dv2.includes(secret),secret+'\n'+dv2);
 assert.ok(dv2.includes('**CNPJ:** 11222333000181'),'CNPJ kept');

 // Canvas e xterm em canvas: marcador no extractor, dados lidos pelo page-reader.js no world MAIN.
 const reader = fs.readFileSync(path.join(__dirname,'../page-reader.js'),'utf8');
 await qa.setContent(`<h3>Memory usage</h3><canvas id="mem" width="50" height="20"></canvas><p>Texto <canvas width="5" height="5"></canvas> no meio</p>
 <div class="xterm"><div class="xterm-accessibility"><div class="xterm-accessibility-tree"><div>linha a</div><div>linha b</div></div></div></div>
 <div class="xterm" id="t3"><canvas width="10" height="10"></canvas><textarea class="xterm-helper-textarea"></textarea></div>
 <script>
 window.Chart={instances:{1:{canvas:document.getElementById('mem'),data:{labels:['10:00:00','10:00:05','10:00:10'],datasets:[{label:'Memory',data:[1000,3000,2000]}]},options:{tooltips:{callbacks:{label:(t,d)=>d.datasets[t.datasetIndex].label+': '+(t.yLabel/1000).toFixed(1)+' kB'}}}}}};
 // Imita o xterm 3 empacotado pelo webpack 5 (Portainer): o Terminal vive numa closure, a classe só no registro de módulos.
 (()=>{const mods={7:function(m){/* xterm-helper-textarea */ class Terminal{constructor(el){this.element=el;this.buffer={lines:{length:3},translateBufferLineToString:i=>['','$ uptime',' 10:00 up 1 day'][i]};el.addEventListener('keyup',ev=>{if(ev.keyCode!==16)window.__focused=true;this._keyUp(ev);},true);} _keyUp(){window.__keyUpRan=true;}} m.exports={Terminal};}};
 const cache={};function req(id){if(!cache[id]){cache[id]={exports:{}};mods[id](cache[id]);}return cache[id].exports;}req.m=mods;
 window.webpackChunkfake=[];window.webpackChunkfake.push=function(d){if(d[2])d[2](req);return Array.prototype.push.call(this,d);};
 const {Terminal}=req(7);new Terminal(document.getElementById('t3'));})();
 </script>`);
 const sx = await qa.evaluate(source);
 assert.equal(sx.slots.length,3,'canvas, inline canvas, canvas terminal\n'+JSON.stringify(sx.slots));
 assert.ok(sx.markdown.includes('```\nlinha a\nlinha b\n```'),'xterm accessibility tree\n'+sx.markdown);
 const domBefore = await qa.content();
 const read = await qa.evaluate(`${reader};snapmdReadPage(${JSON.stringify(sx.slots)})`);
 const [memSlot,inlineSlot,termSlot] = sx.slots;
 assert.ok(read[memSlot.token].includes('| Memory | 2.0 kB | 10:00:10 | 1.0 kB | 3.0 kB | 2.0 kB |'),'chart summary\n'+read[memSlot.token]);
 assert.ok(read[memSlot.token].includes('| 10:00:05 | 3.0 kB |'),'recent values');
 assert.equal(read[inlineSlot.token],undefined,'unknown canvas keeps fallback');
 assert.equal(read[termSlot.token],'```text\n$ uptime\n 10:00 up 1 day\n```','xterm 3 buffer via webpack');
 assert.deepEqual(await qa.evaluate(()=>[window.__keyUpRan,window.__focused]),[undefined,undefined],'synthetic Shift has no side effect');
 await qa.evaluate(()=>document.getElementById('t3').dispatchEvent(new KeyboardEvent('keyup')));
 assert.equal(await qa.evaluate(()=>window.__keyUpRan),true,'_keyUp restored');
 assert.equal(await qa.content(),domBefore,'reader does not mutate the DOM');
 // Índice desatualizado: o leitor confere o tipo e não inventa dado.
 assert.deepEqual(await qa.evaluate(`${reader};snapmdReadPage([{token:'x',kind:'canvas',index:99},{token:'y',kind:'xterm',index:5}])`),{});
 // Revisão do PR (Devin): string numérica e callback que lê data[index] em vez de yLabel.
 await qa.setContent('<canvas id="c"></canvas><script>window.Chart={instances:{1:{canvas:document.getElementById("c"),data:{labels:["a","b","c"],datasets:[{label:"Lat",data:["1","9","5"]}]},options:{tooltips:{callbacks:{label:(t,d)=>d.datasets[t.datasetIndex].label+": "+d.datasets[t.datasetIndex].data[t.index]+" ms"}}}}}};</script>');
 const cs = await qa.evaluate(source);
 const cr = (await qa.evaluate(reader+';snapmdReadPage('+JSON.stringify(cs.slots)+')'))[cs.slots[0].token];
 assert.ok(cr.includes('| Lat | 5 ms | c | 1 ms | 9 ms | 5 ms |') && cr.includes('| b | 9 ms |'),'numeric strings and per-point index\n'+cr);
 // Pontos { x, y } e média diferente do último valor: prova a cópia dos dados e o índice de mínimo e máximo.
 await qa.setContent('<canvas id="c"></canvas><script>window.Chart={instances:{1:{canvas:document.getElementById("c"),data:{labels:["a","b","c"],datasets:[{label:"Lat",data:[{x:"a",y:1},{x:"b",y:9},{x:"c",y:2}]}]},options:{tooltips:{callbacks:{label:(t,d)=>d.datasets[t.datasetIndex].label+": "+d.datasets[t.datasetIndex].data[t.index].y+" ms"}}}}}};</script>');
 const ps = await qa.evaluate(source);
 const pr = (await qa.evaluate(reader+';snapmdReadPage('+JSON.stringify(ps.slots)+')'))[ps.slots[0].token];
 assert.ok(pr.includes('| Lat | 2 ms | c | 1 ms | 9 ms | 4 ms |') && pr.includes('| a | 1 ms |'),'object points keep their shape\n'+pr);
 // Valor de várias linhas dentro de lista, citação e link (sem o prefixo da linha, o Markdown quebrava).
 await qa.setContent('<ul><li>Uso <canvas></canvas></li><li>outro</li></ul><p>x <canvas></canvas></p><ul><li><p>Bloco</p><canvas></canvas></li><li>fim</li></ul><blockquote><p>Citação</p><canvas></canvas><p>continua</p></blockquote><p><a href="https://x.test/">ver <canvas></canvas></a></p>');
 const sl = await qa.evaluate(source);
 await qa.close();
 const popupURL='file:///'+path.resolve('popup.html').replace(/\\/g,'/');
 async function open(mode='success',reduced=false,data=result){
  const p=await browser.newPage({viewport:{width:400,height:560},reducedMotion:reduced?'reduce':'no-preference'});
  await p.addInitScript(({data,mode})=>{
   window.__attempts=0;window.__reloads=0;window.__copied='';
   window.chrome={tabs:{query:async()=>mode==='absent'?[]:[{id:1,url:mode==='restricted'?'chrome://settings':'https://'+ 'a'.repeat(160)+'.test',title:'Título '.repeat(60)}],reload:()=>window.__reloads++},scripting:{executeScript:async(opts)=>{if(opts.world==='MAIN'){if(mode==='slots-fail')throw Error('main denied');return [{result:Object.fromEntries(opts.args[0].map((s,i)=>[s.token,i===1?{x:1}:'| t |\n| --- |']))}];}window.__attempts++;if(mode==='allframes-fail'&&opts.target.allFrames)throw Error('frame denied');if(mode==='frames')return [{frameId:0,result:{...data,shownFrameUrls:['https://login.microsoftonline.test/'],hiddenFrameUrls:['https://hidden.test/']}},{frameId:9,result:{url:'https://hidden.test/#/rota',markdown:'FRAMEOCULTO'}},{frameId:7,result:{title:'f',url:'https://login.microsoftonline.test/',markdown:'Conteúdo do frame'}},{frameId:8,result:null}];if(mode==='pending')return await new Promise(resolve=>window.__resolve=()=>resolve([{result:data}]));if(mode==='error'||(mode==='retry'&&window.__attempts<=2))throw Error('Synthetic failure');return [{result:mode==='empty'?{markdown:''}:data}];}}};
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{if(window.__clipboardFail)throw Error('denied');if(window.__clipboardPending)await new Promise(resolve=>window.__clipboardResolve=resolve);window.__copied=t;}}});
  },{data,mode});
  await p.goto(popupURL);return p;
 }
 const tPop = Date.now();
 const popup = await open();
 await popup.waitForFunction(() => !document.querySelector('#btnCopy').disabled);
 const popElapsed = Date.now() - tPop;
 assert.ok(popElapsed < 600, `botão habilitado imediatamente (${popElapsed}ms)`);
 assert.ok(await popup.locator('.pet-stage.collecting').count() > 0, 'animação do ladino continua rolando no fundo');
 await popup.waitForFunction(() => !document.querySelector('.pet-stage').classList.contains('collecting'));
 const animElapsed = Date.now() - tPop;
 assert.ok(animElapsed >= 950, `duração mínima da animação do ladino respeitada (${animElapsed}ms)`);
 await popup.locator('#btnCopy').click();assert.equal(await popup.evaluate(()=>window.__copied),md);
 const downloadEvent=popup.waitForEvent('download');await popup.keyboard.press('Control+s');const downloaded=await downloadEvent;assert.match(downloaded.suggestedFilename(),/^[a-z0-9-]+-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.md$/);assert.equal(fs.readFileSync(await downloaded.path(),'utf8'),md);
 await popup.waitForTimeout(450);await popup.waitForFunction(()=>document.querySelector('.pet').complete && document.querySelector('.pet').naturalWidth>0);await popup.evaluate(()=>{document.getElementById('source').textContent='exemplo.gov.br';document.getElementById('status').textContent='Markdown pronto';const preview=document.getElementById('markdownPreview');const index=preview.textContent.indexOf('### Você foi indicado?');const preceding=preview.textContent.slice(0,index).split('\n').length;preview.scrollTop=Math.max(0,(preceding-2)*19.2);});await popup.screenshot({path:process.env.SNAPMD_SCREENSHOT||path.join(__dirname,'../assets/popup-preview.png')});
 const layout=await popup.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,preview:document.querySelector('#markdownPreview').getBoundingClientRect().height}));assert.ok(layout.width<=400&&layout.height<=560&&layout.preview>200,JSON.stringify(layout));
 await popup.evaluate(()=>window.__clipboardPending=true);await popup.locator('#btnCopy').click();assert.ok(await popup.locator('#btnCopy').isDisabled());assert.equal(await popup.locator('.copied').count(),0);await popup.evaluate(()=>window.__clipboardResolve());await popup.waitForFunction(()=>document.querySelector('.copied'));
 await popup.waitForTimeout(450);await popup.evaluate(()=>{window.__clipboardPending=false;window.__clipboardFail=true;});await popup.locator('#btnCopy').click();assert.ok((await popup.locator('#status').textContent()).includes('Não foi possível copiar'));assert.equal(await popup.locator('.copied').count(),0);assert.equal(await popup.locator('#markdownPreview').textContent(),md);assert.equal(await popup.locator('#btnDownload').isDisabled(),false);
 const pending=await open('pending');await pending.waitForFunction(()=>window.__resolve);assert.ok(await pending.locator('#btnCopy').isDisabled());assert.ok(await pending.locator('.extracting').count());await pending.evaluate(()=>window.__resolve());await pending.waitForFunction(()=>!document.querySelector('#btnCopy').disabled);
 for(const mode of ['error','empty','restricted','absent']){const p=await open(mode);await p.waitForFunction(()=>!document.querySelector('#errorState').hidden);assert.ok(await p.locator('#btnCopy').isDisabled());assert.ok(await p.locator('#btnDownload').isDisabled());assert.equal(await p.locator('.extracting').count(),0);assert.equal(await p.evaluate(()=>window.__reloads),0);await p.close();}
 const retry=await open('retry');await retry.locator('#btnRetry').click();await retry.waitForFunction(()=>!document.querySelector('#btnCopy').disabled);assert.equal(await retry.evaluate(()=>window.__attempts),3);assert.equal(await retry.evaluate(()=>window.__reloads),0);
 const framed=await open('frames');await framed.waitForFunction(()=>!document.querySelector('#btnCopy').disabled);assert.ok(!/FRAMEOCULTO|NETOOCULTO/.test(await framed.locator('#markdownPreview').textContent()),'hidden frame and its children dropped');assert.ok((await framed.locator('#markdownPreview').textContent()).endsWith('---\n\n## Frame: https://login.microsoftonline.test/\n\nConteúdo do frame\n'),'frames appended');
 const fallback=await open('allframes-fail');await fallback.waitForFunction(()=>!document.querySelector('#btnCopy').disabled);assert.equal(await fallback.evaluate(()=>window.__attempts),2);assert.equal(await fallback.locator('#markdownPreview').textContent(),md);
 for(const mode of ['slots','slots-fail']){const p=await open(mode,false,sx);await p.waitForFunction(()=>!document.querySelector('#btnCopy').disabled);const text=await p.locator('#markdownPreview').textContent();
  assert.ok(!/SNAPMD[0-9a-f]{8}N/.test(text),'no leftover token\n'+text);
  assert.ok(text.includes(mode==='slots'?'### Memory usage\n\n| t |\n| --- |\n\nTexto _[canvas sem texto acessível]_ no meio':'### Memory usage\n\n_[canvas sem texto acessível]_\n\nTexto _[canvas sem texto acessível]_ no meio'),mode+'\n'+text);
  if(mode==='slots-fail')assert.ok(text.includes('_(terminal sem texto no DOM: renderizado em canvas)_'),'terminal fallback');await p.close();}
 const nested=await open('slots',false,sl);await nested.waitForFunction(()=>!document.querySelector('#btnCopy').disabled);const nt=await nested.locator('#markdownPreview').textContent();
 for(const text of ['- Uso _[gráfico]_\n\n  | t |\n  | --- |\n\n- outro','x _[canvas sem texto acessível]_','> Citação\n>\n> | t |\n> | --- |\n>\n> continua','- Bloco\n\n  | t |\n  | --- |\n\n- fim','[ver _[gráfico]_](https://x.test/)\n\n| t |\n| --- |\n']) assert.ok(nt.includes(text),text+'\n---\n'+nt);
 await nested.close();
 const reduced=await open('pending',true);await reduced.waitForFunction(()=>window.__resolve);assert.equal(await reduced.locator('.leaf').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 const tRed = Date.now(); const quick = await open('success', true);
 await quick.waitForFunction(() => !document.querySelector('#btnCopy').disabled);
 const redElapsed = Date.now() - tRed;
 assert.ok(redElapsed < 800, `reducedMotion deve ser imediato sem delay (${redElapsed}ms)`);
 await quick.close();
 // Captura em sequência: quiz em SPA com botões em shadow DOM (como o <ion-button> do ClassMarker),
 // cronômetro que muda a cada segundo e "Finish" na última questão.
 const sequenceSource = fs.readFileSync(path.join(__dirname,'../sequence.js'),'utf8');
 const quiz = await browser.newPage();
 await quiz.route('https://quiz.test/', route=>route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><title>Quiz sintético</title><body>
 <p>Time left: <span id="t">00:29:59</span></p><main id="q"></main><nav id="nav"></nav>
 <script>
 customElements.define('x-button',class extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).innerHTML='<button type="button"><slot></slot></button>';}});
 let i=0,clicks={finish:0};const total=4;window.__clicks=clicks;
 setInterval(()=>{document.getElementById('t').textContent='00:'+String(Math.floor(Math.random()*60)).padStart(2,'0')+':00';},50);
 function render(){document.getElementById('q').innerHTML='<h2>Question '+(i+1)+' of '+total+'</h2><p>Pergunta número '+(i+1)+'?</p><label><input type="radio" name="a">Opção A'+(i+1)+'</label><label><input type="radio" name="a">Opção B'+(i+1)+'</label>';
  document.getElementById('nav').innerHTML='<x-button data-cy="previous-btn">Previous</x-button>'+(i<total-1?'<x-button data-cy="next-btn">Next <span aria-hidden="true">›</span></x-button>':'<x-button data-cy="finish-btn">Finish</x-button>');}
 document.addEventListener('click',e=>{const b=e.target.closest('x-button');if(!b)return;const cy=b.dataset.cy;if(cy==='finish-btn')clicks.finish++;
  // SPA lenta: limpa a tela e só desenha a próxima depois de um tempo.
  if(cy==='next-btn'){document.getElementById('q').textContent='Carregando…';setTimeout(()=>{i++;render();},120);}});
 render();
 </script></body>`}));
 await quiz.goto('https://quiz.test/');
 const runSeq = (opts={}) => quiz.evaluate(async ({sequenceSource,source,opts})=>{
  (0,eval)(sequenceSource+';window.__seq={snapmdRunSequence,snapmdPageFingerprint,snapmdClickNext};');
  const {snapmdRunSequence,snapmdPageFingerprint,snapmdClickNext}=window.__seq;const counts=[];
  return {...await snapmdRunSequence({capture:()=>(0,eval)(source),fingerprint:snapmdPageFingerprint,clickNext:snapmdClickNext,progress:s=>counts.push(s.count),shouldStop:()=>false,sleep:ms=>new Promise(r=>setTimeout(r,ms))},opts),counts};
 },{sequenceSource,source,opts});
 const seq = await runSeq();
 assert.equal(seq.steps,4,JSON.stringify(seq));assert.equal(seq.reason,'missing');assert.deepEqual(seq.counts,[1,2,3,4]);assert.equal(seq.title,'Quiz sintético');
 for(let n=1;n<=4;n++){assert.ok(seq.markdown.includes(`Question ${n} of 4`)&&seq.markdown.includes(`Opção B${n}`),'question '+n+'\n'+seq.markdown);assert.ok(seq.markdown.includes(`<!-- SnapMD: tela ${n} de 4 -->`));}
 assert.ok(!seq.markdown.includes('Carregando'),'waits for the slow render');
 assert.ok(seq.markdown.startsWith('---\ntitle: "Quiz sintético"'),'frontmatter on top');assert.equal(seq.markdown.match(/\*\*Fonte:\*\*/g).length,1,'header once');assert.equal(seq.markdown.match(/^title:/gm).length,1,'one frontmatter');
 assert.equal(await quiz.evaluate(()=>window.__clicks.finish),0,'never clicks Finish');
 assert.equal(await quiz.evaluate(()=>[...document.querySelectorAll('input:checked')].length),0,'never answers');
 // Botão que não muda nada, botão desabilitado e página sem avançar: para com o motivo certo.
 await quiz.setContent('<p>Fixa</p><button onclick="">Next</button>');
 assert.equal((await runSeq({changeTimeout:400})).reason,'unchanged');
 await quiz.setContent('<p>Fim</p><button disabled>Próximo</button>');
 assert.equal((await runSeq()).reason,'disabled');
 await quiz.setContent('<p>Envio</p><button>Submit</button><a href="/next-step" class="btn-submit">Enviar</a>');
 const none = await runSeq(); assert.equal(none.reason,'missing'); assert.equal(none.steps,1);
 // Paginação que volta ao início: para na repetição.
 await quiz.setContent('<p id="p">Página 1</p><a href="#" rel="next" onclick="event.preventDefault();const p=document.getElementById(\'p\');p.textContent=p.textContent===\'Página 1\'?\'Página 2\':\'Página 1\'">»</a>');
 const loop = await runSeq(); assert.equal(loop.reason,'repeated'); assert.equal(loop.steps,2);
 await quiz.close();

 // Popup com o background disponível: o botão aparece, inicia, mostra o progresso e para.
 const seqPopup = await browser.newPage({viewport:{width:400,height:560}});
 await seqPopup.addInitScript(data=>{
  window.__sent=[];const listeners=[];
  window.chrome={tabs:{query:async()=>[{id:5,url:'https://quiz.test/',title:'Quiz'}]},scripting:{executeScript:async()=>[{result:data}]},
   runtime:{sendMessage:async m=>{window.__sent.push(m);if(window.__noBackground&&m.type==='sequence-start')throw Error('Could not establish connection. Receiving end does not exist.');return m.type==='sequence-get'?null:m.type==='sequence-start'?{ok:true}:undefined;},onMessage:{addListener:f=>listeners.push(f)}}};
  window.__emit=state=>listeners.forEach(f=>f({type:'sequence-state',state}));
 },result);
 await seqPopup.goto(popupURL);
 await seqPopup.waitForFunction(()=>!document.querySelector('#btnCopy').disabled);
 assert.equal(await seqPopup.locator('#btnSequence').isVisible(),true);
 await seqPopup.evaluate(()=>window.__noBackground=true);await seqPopup.locator('#btnSequence').click();
 await seqPopup.waitForFunction(()=>document.querySelector('#status').textContent.includes('Recarregue o SnapMD'));
 await seqPopup.evaluate(()=>window.__noBackground=false);await seqPopup.locator('#btnSequence').click();
 assert.deepEqual(await seqPopup.evaluate(()=>window.__sent.at(-1)),{type:'sequence-start',tabId:5});
 assert.equal(await seqPopup.locator('#status').textContent(),'Iniciando sequência…');
 await seqPopup.evaluate(()=>window.__emit({tabId:5,count:3,running:true}));
 assert.equal(await seqPopup.locator('#status').textContent(),'Sequência: 3 telas…');
 assert.equal(await seqPopup.locator('#btnSequence').getAttribute('aria-label'),'Parar sequência');
 await seqPopup.locator('#btnSequence').click();
 assert.deepEqual(await seqPopup.evaluate(()=>window.__sent.at(-1)),{type:'sequence-stop'});
 await seqPopup.evaluate(()=>window.__emit({tabId:5,count:30,running:false,reason:'missing',file:'quiz-sequencia.md'}));
 assert.equal(await seqPopup.locator('#status').textContent(),'Sequência: 30 telas baixadas (não há mais botão de avançar)');
 const seqLayout=await seqPopup.evaluate(()=>document.documentElement.scrollWidth);assert.ok(seqLayout<=400,'toolbar fits with the extra button');
 await seqPopup.close();
 console.log('PASS: passive complete extraction, states, retry without reload, clipboard confirmation/failure, Unicode download, reduced motion, 400x560 layout and sequence capture');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
