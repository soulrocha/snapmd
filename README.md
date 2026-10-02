# SnapMD

<p align="center">
  <img src="assets/snapmd-preview.jpg" alt="SnapMD Preview" width="100%" />
</p>

SnapMD is a Chromium extension that extracts structured Markdown from web applications, administrative consoles, and internal dashboards.

Most web clippers rely on Mozilla Readability, which looks for editorial article tags like `<article>` and `<p>`. In single-page applications such as Microsoft Entra ID, Portainer, Kubernetes dashboards, and custom enterprise tools, the interface is composed of ARIA grids, modal dialogs, status banners, terminal streams, and form controls. Readability treats these elements as page chrome and strips them out.

SnapMD runs a passive DOM inspection pipeline designed specifically for application interfaces. It preserves live input values, data tables, active modal dialogs, and terminal logs without clicking or triggering navigation.

---

## What SnapMD Extracts

### Active modals and dialogs
When a modal is open (`.p-dialog`, `[role="dialog"]`, or `.modal.show`), SnapMD places its content at the top of the generated Markdown. This keeps the foreground task front and center.

### System notices and banners
Infobars and warning banners (`.fxc-infobar`, `[role="alert"]`) are extracted into GitHub Flavored Markdown alerts:

```markdown
> [!WARNING]
> Tenant-wide consent may revoke previously granted permissions.

> [!NOTE]
> Values reflect default organization policy.
```

### Action and command bars
Buttons inside toolbars (`.fxs-command-bar`, `[role="toolbar"]`, `.azc-toolbar`) are cataloged separately from navigation links, with their enabled or disabled state preserved.

### Data tables and ARIA grids
SnapMD extracts standard HTML `<table>` elements and multi-column `[role="grid"]` components (including Azure Ibiza and PrimeNG grids). Group headers, column headers, and cells are aligned into clean Markdown tables:

```markdown
### Permissions and Configured Resources

#### Group: Microsoft Graph (1)
| Permission | Type | Description | Admin Consent | Status |
| --- | --- | --- | --- | --- |
| User.Read.All | Application | Read all users full profiles | Yes | Granted |
```

### Container and terminal logs
Log outputs rendered inside `<pre>`, `.monaco-editor`, xterm.js rows, or custom container log viewers (such as Portainer) are captured in fenced code blocks. ANSI escape sequences are automatically cleaned.

### Sidebar navigation
Menus are captured with their hierarchy intact. SnapMD marks only the currently active route (`[x] Item (Ativo)`), and isolates the sidebar container so it never claims buttons or data tables belonging to the main content.

### Form states and switches
Inputs, select dropdowns, radio groups, checkboxes, and toggle switches (`[role="switch"]`, `por-switch-field`, `p-inputswitch`) are captured with their live values (`Marcado (true)` or `Desmarcado (false)`).

---

## Zero Synthetic Clicks

Some tools simulate clicks on accordions, tabs, or menus to reveal hidden text. On enterprise portals, synthetic clicks can trigger unwanted route changes, close active blades, or submit actions. 

SnapMD is strictly passive. It reads values directly from DOM properties and attributes (`textContent`, `value`, `uib-tooltip`, `aria-label`) without dispatching synthetic mouse or pointer events.

---

## Installation

SnapMD works on Google Chrome, Microsoft Edge, Brave, and other Chromium browsers.

1. Clone or download this repository:
   ```bash
   git clone https://github.com/soulrocha/snapmd.git
   ```
2. Open your browser extension management page:
   - Chrome / Brave: `chrome://extensions`
   - Microsoft Edge: `edge://extensions`
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** (or *Carregar sem compactação*).
5. Select the folder containing `manifest.json`.

---

## Keyboard Shortcuts

Inside the extension popup:

| Shortcut | Action |
| --- | --- |
| `Ctrl + Enter` | Copy generated Markdown to clipboard |
| `Ctrl + S` | Download note as `.md` file |
| `Escape` | Close the popup |

---

## Architecture

The extraction engine (`extractor.js`) uses a Pipes and Filters architecture coordinated by a `PipelineOrchestrator`:

1. **DOMNodeRegistry with semantic shielding:** A node claiming system tracks elements across extractors. High-value data nodes (`table`, `[role="grid"]`, `[role="alert"]`, `[role="toolbar"]`) are shielded so layout wrappers cannot claim or hide them.
2. **Deterministic execution order:** Metadata runs first, followed by foreground Modals, System Banners, Action Bars, Tables, Terminal Logs, Sidebar Navigation, Key-Value Pairs, and Form Controls.
3. **Local sandbox execution:** No analytics, no external scripts, and no remote calls. The extraction runs entirely within the local tab context.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
