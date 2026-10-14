<div align="center">

<img src="assets/hero.png" alt="O SnapMD transforma um formulário de pedido de acesso, um grid de containers e um log em Markdown com caixas marcadas, valores dos campos, tabela e bloco de código" width="100%">

# SnapMD

**Copie o que a página está *fazendo*, não só o que ela diz.**<br>
Extensão para Chrome e Edge que transforma a página aberta (estado dos formulários, grids, terminais, modais abertos) em Markdown limpo para colar no ChatGPT, no Claude ou em qualquer LLM. Sem print, e nada sai do seu navegador.

[![Release](https://img.shields.io/github/v/release/soulrocha/snapmd?label=release&color=66dfe4)](https://github.com/soulrocha/snapmd/releases/latest)
[![CI](https://github.com/soulrocha/snapmd/actions/workflows/ci.yml/badge.svg)](https://github.com/soulrocha/snapmd/actions/workflows/ci.yml)
[![Licença: MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-a187ed)](LICENSE)
![Manifest V3](https://img.shields.io/badge/manifest-v3-649ee7)
![Chrome | Edge](https://img.shields.io/badge/navegador-Chrome%20%7C%20Edge-efa786)

[Instalar](#instalar) · [O que captura](#o-que-captura) · [Privacidade](#privacidade-e-permissões) · [Limites](#limites) · [Desenvolvimento](#desenvolvimento) · [English](README.md)

</div>

---

## Por que o SnapMD?

A maioria das ferramentas de "página para Markdown" recorta artigos: roda o Readability, guarda o texto do post e joga o resto fora. Leitores no servidor, como Jina e Firecrawl, buscam a URL de novo e nunca veem sua sessão logada, a aba que você clicou ou o modal aberto agora.

Esse é justamente o contexto de que você precisa ao perguntar a uma LLM sobre um **portal administrativo, um console de nuvem, um formulário do governo ou um painel interno**. O SnapMD lê o DOM que está na sua tela e anota o **estado** dele:

| Na tela | No Markdown |
| --- | --- |
| Rádio ou checkbox marcado | `- [x] Production` / `- [ ] Staging` |
| Campo ou select preenchido | `**Role:** Application Admin` |
| Grid com 500 linhas, 40 renderizadas | Tabela Markdown e o aviso de que só 40 de 500 linhas estavam renderizadas |
| Terminal web (xterm.js, mesmo em `<canvas>`) | Bloco de código com o histórico inteiro |
| Gráfico Chart.js | Tabela com último valor, mínimo, máximo e médio |
| Senha, cartão ou código de uso único | `_(oculto)_`. O valor nunca é copiado |

## Recursos

- **Estado de formulários e controles**: marcado, selecionado, valor, desabilitado, expandido, aba ativa, foco e erro de validação.
- **Página inteira em ordem de leitura**, inclusive abaixo da rolagem: títulos, listas aninhadas, links com URL, tabelas, grids ARIA, código e logs.
- **Shadow DOM, iframes da mesma origem e de outra origem** (como os frames do Microsoft Entra e do portal Azure), modais abertos e avisos (toasts).
- **Conteúdo em canvas**: terminais xterm.js (como o console do Portainer) e gráficos Chart.js são lidos pelo JavaScript da própria página e viram texto. Outros canvas entram como imagem.
- **Regiões da página** (navegação, conteúdo principal, formulários) vêm delimitadas para a LLM saber o que está lendo.
- **Segredos ficam de fora**: senhas, cartões, CVV, códigos de uso único e campos com nome de segredo são mascarados.
- **Só leitura**: o SnapMD não preenche, não envia e não altera a página. Os testes conferem que o DOM fica idêntico antes e depois da captura.
- **Copiar ou baixar**: confira a prévia, copie ou salve um `.md` com front matter YAML (título, URL de origem, data).

## Instalar

O SnapMD ainda não está na Chrome Web Store. Instale sem compactação a partir de um clone do Git, e atualizar vira um `git pull`.

```powershell
git clone https://github.com/soulrocha/snapmd.git "$env:LOCALAPPDATA\SnapMD"
```

1. Abra `edge://extensions` ou `chrome://extensions`.
2. Ative o **Modo do desenvolvedor**.
3. Clique em **Carregar sem compactação** e escolha a pasta `%LOCALAPPDATA%\SnapMD`.

No macOS ou Linux, clone em qualquer pasta (por exemplo `~/.local/share/snapmd`) e carregue essa pasta.

<details>
<summary>Instalar sem Git, ou atualizar</summary>

**Sem Git:** cada [release](https://github.com/soulrocha/snapmd/releases/latest) traz um `snapmd-<versão>.zip` com os mesmos arquivos. Extraia sempre na mesma pasta e carregue essa pasta.

**Atualizar:**

```powershell
git -C "$env:LOCALAPPDATA\SnapMD" pull
```

Depois clique em **Recarregar** no card do SnapMD em `edge://extensions`.

**Instalou a 1.3.1 pelo ZIP?** Remova o SnapMD em `edge://extensions`, apague a pasta `%LOCALAPPDATA%\SnapMD`, rode o `git clone` acima e carregue a pasta de novo. A partir da 1.4.0 a extensão pede acesso a todos os sites para ler iframes de outra origem.

</details>

## Como usar

1. Abra a página que deseja capturar e clique no ícone do SnapMD.
2. Confira o Markdown na prévia.
3. Clique em **Copiar Markdown** ou no ícone de download.

| Atalho | Ação |
| --- | --- |
| `Ctrl+Enter` | Copiar Markdown |
| `Ctrl+S` | Baixar `.md` |
| `Esc` | Fechar |

**Tentar novamente** repete a captura sem recarregar a página e sem perder os dados do formulário. O Ladino reúne folhas durante a extração e só comemora quando a cópia é confirmada. A preferência do sistema por movimento reduzido é respeitada.

<img src="assets/popup-preview.png" alt="Popup do SnapMD com a prévia em Markdown de um formulário, os botões de copiar e baixar e o mascote Ladino" width="320">

## O que captura

Saída real do formulário da imagem acima, recortada da captura completa:

```markdown
## Access request

**Environment**

- [ ] Staging
- [x] Production
- [x] Notify security team
- [ ] Temporary access

**Role:** Application Admin

**Justification:** Deploy hotfix 2.4.1

| Container | Status |
| --- | --- |
| api | Up 3 hours |
| worker | Exited (1) |
```

O arquivo completo também traz o front matter YAML (título, origem, data) e marcadores de região, como o início e o fim do conteúdo principal.

## Privacidade e permissões

Toda a extração ocorre no navegador. O SnapMD não tem servidor, não coleta métricas e não faz chamadas de rede, e só lê a página quando você clica no ícone.

| Permissão | Para quê |
| --- | --- |
| `activeTab`, `scripting` | Rodar o extrator na aba atual quando você clica no ícone |
| `<all_urls>` (host) | Ler **iframes de outra origem**, como os de login e portais Microsoft, que o `activeTab` sozinho não alcança |
| `tabs` | Ler o título e a URL da aba atual para a prévia e o nome do arquivo |
| `clipboardWrite` | Copiar o Markdown |

Confira o Markdown antes de compartilhar: ele contém o que a página mostra.

## Limites

- **Grids e logs virtualizados**: linhas que a página ainda não renderizou não estão no DOM. Quando o grid declara o total, o SnapMD avisa quantas foram renderizadas.
- **Terminal com texto no DOM**: sai só o que está na tela. O histórico rolado não fica no DOM.
- **Canvas**: terminais xterm.js 3 e gráficos Chart.js são lidos por inteiro. No xterm.js 4 e 5 o texto só é lido quando a página deixa o terminal acessível. Outros terminais e gráficos em canvas entram como imagem. Canvas dentro de shadow DOM ou de iframe da mesma origem sai só com o aviso.
- **Sem texto disponível**: outros canvas, imagens sem texto alternativo e PDFs.
- **Iframes de outra origem ocultos** são descartados pela URL. Um iframe visível dentro de outro oculto, ou um iframe oculto que mudou de endereço, ainda pode aparecer.
- Páginas internas do navegador (`edge://`, `chrome://`, a loja) não podem ser capturadas.

## Desenvolvimento

Requisitos: Node.js 20+ e Microsoft Edge (ou defina `SNAPMD_BROWSER=chromium` depois de `npx playwright install chromium`).

```powershell
npm install
npm run check      # node --check em todos os scripts
npm test           # suíte ponta a ponta com Playwright (tests/verify.cjs)
npm run hero       # gera de novo assets/hero.png e assets/social-preview.png
npm run package    # gera dist/snapmd-<versão>.zip
```

O `npm test` também gera de novo o `assets/popup-preview.png`. Defina `SNAPMD_SCREENSHOT` para salvar em outro lugar.

**Release:** suba a `version` em `manifest.json` e `package.json`, atualize o [CHANGELOG.md](CHANGELOG.md), faça o merge e rode:

```powershell
gh release create v1.5.0 dist/snapmd-1.5.0.zip --target main --title "SnapMD 1.5.0" --generate-notes
```

O script de empacotamento só junta os arquivos da extensão e a documentação. Ele não publica nada.

## Roadmap

- [ ] Interface e anotações em inglês (`_locales`), mantendo o pt-BR
- [ ] Publicação na Chrome Web Store e no Edge Add-ons
- [ ] Copiar só uma região selecionada da página
- [ ] Mais leitores de canvas (outras bibliotecas de gráfico, xterm.js 4 e 5)

Ideias e relatos de bug são bem-vindos. Veja o [CONTRIBUTING.md](CONTRIBUTING.md).

## Créditos e licença

O Ladino vem do [Claude Code Hero Journey](https://github.com/soulrocha/Claude-code-hero-journey), de Saulo Rocha, sob licença MIT. A licença dele acompanha a extensão em [assets/hero-journey-LICENSE.txt](assets/hero-journey-LICENSE.txt).

O SnapMD usa a [licença MIT](LICENSE).
