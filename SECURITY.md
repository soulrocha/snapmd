# Security policy

SnapMD reads whatever the current page shows, including form values, so security reports matter.

## Supported versions

Only the latest release receives fixes.

## Reporting a vulnerability

Please **do not open a public issue**. Use [GitHub private vulnerability reporting](https://github.com/soulrocha/snapmd/security/advisories/new) and include:

- the SnapMD version and browser,
- a minimal page or steps that reproduce the problem,
- what leaks or breaks (for example a secret field that is not masked, or a capture that changes the page).

You can expect a first answer within a week.

## Design guarantees

- No network calls, no telemetry. Everything runs in the browser.
- The page is only read when the user clicks the extension icon.
- The capture never writes to the DOM, fills fields or submits forms. The test suite checks this.
- Passwords, card numbers, CVV, one-time codes and secret-looking fields are masked.
