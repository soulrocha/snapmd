# SnapMD

Abra a extensão para transformar o conteúdo da página em Markdown, incluindo perguntas, respostas e opções marcadas ou desmarcadas. Confira a prévia e copie para sua LLM, sem precisar tirar prints.

![Popup do SnapMD](assets/popup-preview.png)

## Como usar

1. Abra a página que deseja capturar e clique no SnapMD.
2. Confira o Markdown na prévia.
3. Clique em **Copiar Markdown** ou no ícone de download para salvar um `.md`.

Atalhos: `Ctrl+Enter` para copiar, `Ctrl+S` para baixar e `Esc` para fechar. O Ladino reúne folhas durante a extração e comemora somente quando a cópia é confirmada. A preferência do sistema por movimento reduzido é respeitada.

Toda a extração ocorre no navegador. O SnapMD não envia dados a servidores e não preenche nem envia formulários. Confira o conteúdo antes de compartilhá-lo.

## Instalar

Com o [Git](https://git-scm.com/) instalado, clone o repositório na pasta de aplicativos do usuário (PowerShell):

```powershell
git clone https://github.com/soulrocha/snapmd.git "$env:LOCALAPPDATA\SnapMD"
```

Abra `edge://extensions` ou `chrome://extensions`, ative **Modo do desenvolvedor**, escolha **Carregar sem compactação** e selecione a pasta `%LOCALAPPDATA%\SnapMD`. A pasta fica sempre na versão atual: não há uma pasta por versão.

## Atualizar

```powershell
git -C "$env:LOCALAPPDATA\SnapMD" pull
```

Depois clique em **Recarregar** no card do SnapMD em `edge://extensions`.

Prefere um pacote sem Git? Cada release no GitHub traz um `snapmd-<versão>.zip` com os mesmos arquivos; extraia-o na mesma pasta.

## Limites da captura

A captura percorre a página inteira em ordem de leitura, inclusive abaixo da área atual de rolagem: títulos, listas, links com URL, tabelas e grids, código, logs e terminais, shadow DOM, iframes, modais e avisos (toasts). Regiões como navegação e conteúdo principal aparecem delimitadas. Cada controle sai com o estado (marcado, selecionado, valor, desabilitado, expandido, aba ativa, foco, erro de validação). Texto cortado com reticências ganha o texto completo do tooltip. Senhas, campos de cartão e códigos de uso único nunca têm o valor copiado.

Para ler iframes de outra origem, como os de portais Microsoft, a extensão pede acesso a todos os sites (`<all_urls>`). Ela só lê a página quando você clica no ícone.

Limites: linhas de grid ou log virtualizado que a página ainda não carregou não estão no DOM e não aparecem (a captura informa "N de M linhas renderizadas" quando o grid declara o total). Do terminal sai só o que está na tela; o histórico rolado não fica no DOM. Terminal desenhado em canvas, imagens sem texto alternativo e PDFs não fornecem texto. Páginas internas do navegador são restritas. O botão **Tentar novamente** repete a captura sem recarregar a página e sem perder os dados do formulário.

## Desenvolvimento e publicação

Com Node.js, Playwright e um navegador Chromium instalados:

```powershell
node --check popup.js
node --check extractor.js
node tests/verify.cjs
powershell -ExecutionPolicy Bypass -File scripts/package-release.ps1
```

Depois do merge do PR, publique a release usando o ZIP gerado:

```powershell
gh release create v1.4.0 dist/snapmd-1.4.0.zip --repo soulrocha/snapmd --target main --title "SnapMD 1.4.0" --generate-notes
```

O empacotamento inclui somente os arquivos necessários à extensão e a documentação. A release não é publicada pelo script.

## Créditos e licença

O Ladino vem do [Claude Code Hero Journey](https://github.com/soulrocha/Claude-code-hero-journey), de Saulo Rocha, sob licença MIT. Sua licença acompanha a extensão em [assets/hero-journey-LICENSE.txt](assets/hero-journey-LICENSE.txt). SnapMD também usa [licença MIT](LICENSE).
