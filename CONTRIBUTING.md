# Contributing to SnapMD

Thanks for helping. Bug reports with a small HTML sample are the most useful contribution: they turn straight into a test.

## Set up

```powershell
git clone https://github.com/soulrocha/snapmd.git
cd snapmd
npm ci
npm run check
npm test
```

Tests drive Microsoft Edge through Playwright. To use Chromium instead, run `npx playwright install chromium` and set `SNAPMD_BROWSER=chromium`.

Load the folder as an unpacked extension in `edge://extensions` to try it on real pages.

## Making a change

1. Open an issue first for anything larger than a fix, so we can agree on the Markdown shape.
2. Add or extend a case in `tests/verify.cjs` with a synthetic page. Never use real customer or personal data.
3. Keep the guarantees: no DOM writes, no network calls, secrets masked.
4. Add a line under **Unreleased** in `CHANGELOG.md`.
5. Open a pull request. CI must be green.

## Style

- Plain JavaScript, no build step, no runtime dependencies.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `chore:`).
- Issues and pull requests can be written in English or Portuguese.
