# SnapMD

Abra a extensão para transformar o conteúdo da página em Markdown, incluindo perguntas, respostas e opções marcadas ou desmarcadas. Confira a prévia e copie para sua LLM, sem precisar tirar prints.

![Popup do SnapMD](assets/popup-preview.png)

## Como usar

1. Abra a página que deseja capturar e clique no SnapMD.
2. Confira o Markdown na prévia.
3. Clique em **Copiar Markdown** ou no ícone de download para salvar um `.md`.

Atalhos: `Ctrl+Enter` para copiar, `Ctrl+S` para baixar e `Esc` para fechar. O Ladino reúne folhas durante a extração e comemora somente quando a cópia é confirmada. A preferência do sistema por movimento reduzido é respeitada.

Toda a extração ocorre no navegador. O SnapMD não envia dados a servidores e não preenche nem envia formulários. Confira o conteúdo antes de compartilhá-lo.

## Instalar a release

Após a publicação da versão `v1.3.1`, execute no PowerShell com o [GitHub CLI](https://cli.github.com/) instalado:

```powershell
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA\SnapMD\downloads"
gh release download v1.3.1 --repo soulrocha/snapmd --pattern snapmd-1.3.1.zip --dir "$env:LOCALAPPDATA\SnapMD\downloads"
Expand-Archive -LiteralPath "$env:LOCALAPPDATA\SnapMD\downloads\snapmd-1.3.1.zip" -DestinationPath "$env:LOCALAPPDATA\SnapMD\1.3.1"
```

Abra `chrome://extensions` ou `edge://extensions`, ative **Modo do desenvolvedor**, escolha **Carregar sem compactação** e selecione a pasta `SnapMD\1.3.1` criada em seu diretório local de aplicativos. Não há instalação automática no navegador. Para atualizar uma instalação de desenvolvimento, use **Recarregar** na página de extensões.

## Limites da captura

A captura lê conteúdo renderizado no DOM, inclusive abaixo da área atual de rolagem. Conteúdo virtualizado ainda não carregado, iframes inacessíveis, imagens, canvas e PDFs podem não fornecer texto. Páginas internas do navegador são restritas. O botão **Tentar novamente** repete a captura sem recarregar a página e sem perder os dados do formulário.

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
gh release create v1.3.1 dist/snapmd-1.3.1.zip --repo soulrocha/snapmd --target main --title "SnapMD 1.3.1" --generate-notes
```

O empacotamento inclui somente os arquivos necessários à extensão e a documentação. A release não é publicada pelo script.

## Créditos e licença

O Ladino vem do [Claude Code Hero Journey](https://github.com/soulrocha/Claude-code-hero-journey), de Saulo Rocha, sob licença MIT. Sua licença acompanha a extensão em [assets/hero-journey-LICENSE.txt](assets/hero-journey-LICENSE.txt). SnapMD também usa [licença MIT](LICENSE).
