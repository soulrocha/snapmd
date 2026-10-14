# Changelog

All notable changes to SnapMD are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- English README with a Brazilian Portuguese translation (`README.pt-BR.md`), and a hero image and social preview rendered from the real popup over a sample page (`npm run hero`).

### Changed
- New pixel-art icon with the Rogue holding a Markdown page, also shown next to the name in the popup header.
- `package.json` with `check`, `test`, `hero` and `package` scripts.
- GitHub Actions CI on Windows with Microsoft Edge: syntax check, end-to-end tests and the release ZIP as an artifact.
- Issue and pull request templates, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.editorconfig`, `.gitattributes` and Dependabot.

### Removed
- Unused images `assets/popup-1.3-preview.png` and `assets/snapmd-preview.jpg`.

## [1.5.0] - 2026-10-14

### Added
- xterm.js 3 terminals drawn on `<canvas>` (such as the Portainer console) are read in the page's MAIN world and copied as a code block with the full scrollback.
- Chart.js charts become a table with series, last value, time of the last point, minimum, maximum and average, plus the last five points, formatted like the tooltip.
- A canvas terminal or chart whose data cannot be read keeps the note and gets an image of the canvas.

## [1.4.0] - 2026-10-13

### Changed
- Capture rewritten to walk the whole page in reading order without trimming lists or dropping repeated content.
- Install is now a Git clone in `%LOCALAPPDATA%\SnapMD`, updated with `git pull`.

### Added
- Heading levels, nested and numbered lists, links with URL, inline and block code.
- Tables and ARIA grids as Markdown tables, with `[x]`/`[ ]` cells and a note when the grid has not rendered every row.
- Logs and terminals (Portainer, xterm, Monaco) as code blocks.
- Cross-origin iframes (such as Microsoft Entra) as `## Frame: url`. Hidden iframes are dropped.
- Shadow DOM, modals, toasts and page regions.
- Control state: checked, value, selected, disabled, expanded, active tab, focus and validation message.
- Passwords, card numbers, CVV, one-time codes and secret-looking fields are never copied.
- Host permission `<all_urls>`, needed to read cross-origin iframes.

## [1.3.1] - 2026-10-12

### Added
- First public release: full-page capture and the focused popup with the Rogue (Ladino) mascot.

[Unreleased]: https://github.com/soulrocha/snapmd/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/soulrocha/snapmd/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/soulrocha/snapmd/compare/v1.3.1...v1.4.0
[1.3.1]: https://github.com/soulrocha/snapmd/releases/tag/v1.3.1
