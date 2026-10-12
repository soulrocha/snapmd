const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const playwright = require("playwright");
(async () => {
 const browser = await playwright.chromium.launch({headless:true, channel:process.env.SNAPMD_BROWSER || 'msedge'});
 try {
 const page = await browser.newPage();
 const long = '6. Para promover diversidade e inclusão, informe quais recursos de acessibilidade seriam necessários durante o processo seletivo. Esta pergunta é opcional e sua candidatura será concluída normalmente.';
 const html = `<h1>Formulário sintético</h1><nav><a href="#" aria-current="page">Minha candidatura</a></nav><div role="alert">As respostas não poderão ser editadas depois.</div><p>Instrução geral de preenchimento.</p><form><fieldset><legend>Você foi indicado?</legend><label><input type="radio" name="referral" value="yes">Sim</label><label><input type="radio" name="referral" value="no" checked>Não</label></fieldset><div><label for="salary">Pretensão salarial</label><input id="salary" value="10000"></div><div><label for="q4">4. Informe a matrícula de quem indicou você, se aplicável.</label><textarea id="q4" maxlength="1000" placeholder="Digite sua resposta aqui"></textarea><small>Máx. 1000 caracteres</small></div><div><label for="q5">5. Se você é colaborador, informe sua matrícula.</label><textarea id="q5"></textarea></div><div style="margin-top:1200px"><p id="long">${long}</p><textarea aria-labelledby="long"></textarea></div><label>Resposta repetida<input value="igual"></label><label>Resposta repetida<input value="igual"></label><label>Caracteres<textarea id="special"></textarea></label><label hidden>SEGREDO<input value="hidden"></label><div style="display:none"><input value="INVISÍVEL"></div><label>Senha<input type="password" value="PASSWORD"></label>${Array.from({length:35},(_,i)=>`<label>Extra ${i}<input value="${i}"></label>`).join('')}<button type="submit">Salvar e continuar</button></form><table><thead><tr><th>Nome</th><th>Status</th></tr></thead><tbody><tr><td>Recurso único</td><td>Ativo</td></tr></tbody></table><div role="dialog"><h2>Modal sintético</h2><p>Texto exclusivo do modal.</p></div>`;
 await page.route('https://exemplo.gov.br/inscricao', route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html}));
 await page.goto('https://exemplo.gov.br/inscricao');
 await page.locator('#special').fill('Acentos: ação\n**texto** `código` [link]');
 const before = await page.content();
 const source = fs.readFileSync(path.join(__dirname,'../extractor.js'),'utf8');
 const result = await page.evaluate(source);
 const md = result.markdown;
 for(const text of [long,'4. Informe','5. Se você','10000','Não preenchido','Máx. 1000','- [x] Não','- [ ] Sim','Extra 34','Instrução geral','Recurso único','Modal sintético','Texto exclusivo do modal.']) assert.ok(md.includes(text),text);
 assert.equal(md.match(/### Resposta repetida/g).length,2);
 assert.equal(md.match(/Recurso único/g).length,1);
 assert.ok(!md.includes('SEGREDO') && !md.includes('INVISÍVEL') && !md.includes('PASSWORD'));
 assert.ok(md.includes('\\*\\*texto\\*\\*') && md.includes('ação\n'));
 assert.equal(await page.content(),before,'Extraction must not mutate the DOM');
 const edge = await browser.newPage();
 await edge.setContent(`<div role="dialog" style="display:none"><h2>Login fechado</h2></div><div role="dialog"><h2>Confirmação aberta</h2><p>Deseja continuar?</p></div><form><div role="switch" aria-checked="true" aria-label="Notificações"><input type="checkbox" style="display:none"></div><p-inputswitch class="p-inputswitch-checked"><span>Modo escuro</span><input type="checkbox" checked style="display:none"></p-inputswitch><fieldset><legend>Perfil</legend><p>Regime de contratação</p><label><input type="radio" name="employment" value="clt" checked>CLT</label><label><input type="radio" name="employment" value="pj">PJ</label><p>Benefícios desejados</p><label><input type="checkbox" name="benefits" checked>Vale-refeição</label><label><input type="checkbox" name="benefits">Plano de saúde</label></fieldset></form><div style="display:contents">Texto em contents <span>e filho</span></div>`);
 const edgeMd = (await edge.evaluate(source)).markdown;
 assert.ok(edgeMd.includes('Diálogo / Modal Ativo: Confirmação aberta'), 'first visible dialog');
 assert.ok(/### Notificações\n\nMarcado \(true\)/.test(edgeMd), 'switch wrapper with hidden native input');
 assert.ok(/### Modo escuro\n\nMarcado \(true\)/.test(edgeMd), 'p-inputswitch wrapper state');
 assert.ok(/### Regime de contratação\n\n- \[x\] CLT\n- \[ \] PJ\n/.test(edgeMd), 'radio question');
 assert.ok(/### Benefícios desejados\n\n- \[x\] Vale-refeição\n- \[ \] Plano de saúde/.test(edgeMd), 'separate checkbox question');
 assert.ok(edgeMd.includes('Texto em contents') && edgeMd.includes('e filho'), 'display: contents text');
 await edge.close();

 const popupURL='file:///'+path.resolve('popup.html').replace(/\\/g,'/');
 async function open(mode='success',reduced=false){
  const p=await browser.newPage({viewport:{width:400,height:560},reducedMotion:reduced?'reduce':'no-preference'});
  await p.addInitScript(({data,mode})=>{
   window.__attempts=0;window.__reloads=0;window.__copied='';
   window.chrome={tabs:{query:async()=>mode==='absent'?[]:[{id:1,url:mode==='restricted'?'chrome://settings':'https://'+ 'a'.repeat(160)+'.test',title:'Título '.repeat(60)}],reload:()=>window.__reloads++},scripting:{executeScript:async()=>{window.__attempts++;if(mode==='pending')return await new Promise(resolve=>window.__resolve=()=>resolve([{result:data}]));if(mode==='error'||(mode==='retry'&&window.__attempts===1))throw Error('Synthetic failure');return [{result:mode==='empty'?{markdown:''}:data}];}}};
   Object.defineProperty(navigator,'clipboard',{value:{writeText:async t=>{if(window.__clipboardFail)throw Error('denied');if(window.__clipboardPending)await new Promise(resolve=>window.__clipboardResolve=resolve);window.__copied=t;}}});
  },{data:result,mode});
  await p.goto(popupURL);return p;
 }
 const popup=await open();await popup.waitForFunction(()=>!document.querySelector('#btnCopy').disabled);
 await popup.locator('#btnCopy').click();assert.equal(await popup.evaluate(()=>window.__copied),md);
 const downloadEvent=popup.waitForEvent('download');await popup.keyboard.press('Control+s');const downloaded=await downloadEvent;assert.match(downloaded.suggestedFilename(),/^[a-z0-9-]+-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}\.md$/);assert.equal(fs.readFileSync(await downloaded.path(),'utf8'),md);
 await popup.waitForTimeout(450);await popup.waitForFunction(()=>document.querySelector('.pet').complete && document.querySelector('.pet').naturalWidth>0);await popup.evaluate(()=>{document.getElementById('source').textContent='exemplo.gov.br';document.getElementById('status').textContent='Markdown pronto';const preview=document.getElementById('markdownPreview');const index=preview.textContent.indexOf('### Você foi indicado?');const preceding=preview.textContent.slice(0,index).split('\n').length;preview.scrollTop=Math.max(0,(preceding-2)*19.2);});await popup.screenshot({path:process.env.SNAPMD_SCREENSHOT||path.join(__dirname,'../assets/popup-preview.png')});
 const layout=await popup.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,preview:document.querySelector('#markdownPreview').getBoundingClientRect().height}));assert.ok(layout.width<=400&&layout.height<=560&&layout.preview>200,JSON.stringify(layout));
 await popup.evaluate(()=>window.__clipboardPending=true);await popup.locator('#btnCopy').click();assert.ok(await popup.locator('#btnCopy').isDisabled());assert.equal(await popup.locator('.copied').count(),0);await popup.evaluate(()=>window.__clipboardResolve());await popup.waitForFunction(()=>document.querySelector('.copied'));
 await popup.waitForTimeout(450);await popup.evaluate(()=>{window.__clipboardPending=false;window.__clipboardFail=true;});await popup.locator('#btnCopy').click();assert.ok((await popup.locator('#status').textContent()).includes('Não foi possível copiar'));assert.equal(await popup.locator('.copied').count(),0);assert.equal(await popup.locator('#markdownPreview').textContent(),md);assert.equal(await popup.locator('#btnDownload').isDisabled(),false);
 const pending=await open('pending');await pending.waitForFunction(()=>window.__resolve);assert.ok(await pending.locator('#btnCopy').isDisabled());assert.ok(await pending.locator('.extracting').count());await pending.evaluate(()=>window.__resolve());await pending.waitForFunction(()=>!document.querySelector('#btnCopy').disabled);
 for(const mode of ['error','empty','restricted','absent']){const p=await open(mode);await p.waitForFunction(()=>!document.querySelector('#errorState').hidden);assert.ok(await p.locator('#btnCopy').isDisabled());assert.ok(await p.locator('#btnDownload').isDisabled());assert.equal(await p.locator('.extracting').count(),0);assert.equal(await p.evaluate(()=>window.__reloads),0);await p.close();}
 const retry=await open('retry');await retry.locator('#btnRetry').click();await retry.waitForFunction(()=>!document.querySelector('#btnCopy').disabled);assert.equal(await retry.evaluate(()=>window.__attempts),2);assert.equal(await retry.evaluate(()=>window.__reloads),0);
 const reduced=await open('pending',true);await reduced.waitForFunction(()=>window.__resolve);assert.equal(await reduced.locator('.leaf').first().evaluate(e=>getComputedStyle(e).animationName),'none');
 console.log('PASS: passive complete extraction, states, retry without reload, clipboard confirmation/failure, Unicode download, reduced motion and 400x560 layout');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
