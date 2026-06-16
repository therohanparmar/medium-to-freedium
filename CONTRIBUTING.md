# Contributing

Thanks for your interest in improving **Open in Freedium**! This is a tiny, zero-dependency
Chrome/Firefox extension (plain HTML/CSS/JS, Manifest V3) - no build step required.

**One codebase ships to both browsers.** A single `manifest.json` works for Chrome
and Firefox: Chrome ignores the `browser_specific_settings.gecko` block, while
Firefox requires it for signing. No separate build or folder.

First, clone the repository:

```bash
git clone https://github.com/rohan-parmar/medium-to-freedium.git
```

### Chrome / Edge / Brave (Chromium)

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the project folder (the one with `manifest.json`).
4. Open a Medium article - the button appears in the bottom-right corner.

> After editing a source file, click the **↻ reload** icon on the extension card,
> then refresh your Medium tab to see the change.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and select `manifest.json`.
3. Open a Medium article - the button appears in the bottom-right corner.

> Temporary add-ons are removed on restart. For a permanent install, publish to
> [AMO](https://addons.mozilla.org/developers/) (free, no developer fee).

## Project structure

```
medium-to-freedium/
├── manifest.json     # Manifest V3 configuration
├── config.js         # Freedium base URL (edit this to change the domain)
├── content.js        # Button injection, SPA detection, toast
├── content.css       # Button + toast styles, light/dark theming
├── freedium-retry.js # Auto-reloads Freedium pages on a transient 5xx
├── icons/            # icon16 / icon48 / icon128
├── PRIVACY.md        # Privacy policy
├── LICENSE
├── README.md
└── CONTRIBUTING.md
```

## Configuration

The target Freedium domain lives in **`config.js`** - it's the only place to change it:

```js
window.OpenInFreediumConfig = {
  baseUrl: "https://freedium-mirror.cfd/",
};
```

`content.js` reads this value (with a safe fallback and trailing-slash
normalization), so switching to another instance is a one-line edit.

## How it works

| Concern | Approach |
| --- | --- |
| Article-only display | The button shows only when the URL ends in Medium's 12-char story id (e.g. `…-1a2b3c4d5e6f`); listing pages never match. |
| SPA navigation | Uses the **Navigation API** (with `history` + `popstate` fallbacks) to add the button on articles and remove it on listings - no full page reload needed. |
| Resilience | A debounced, URL-aware `MutationObserver` re-adds the button if Medium re-renders and drops it. |
| Error recovery | `freedium-retry.js` runs on Freedium pages; if the navigation returned a 5xx (read via Navigation Timing `responseStatus`), it reloads up to twice to ride out the mirror's transient errors. |
| Security | No `innerHTML`, no remote code, no external assets - built with DOM APIs only. |

## Guidelines

- Keep it **dependency-free** - no frameworks or build tooling.
- Match the existing code style; keep comments minimal and meaningful.
- Test changes on real Medium articles in **both light and dark mode**.
- Verify the button appears on article pages and is removed on feeds/profiles
  when navigating without a page reload.

## Submitting changes

1. Fork the repo and create a feature branch.
2. Make your change and test it locally as above.
3. Open a pull request describing what changed and why.

Issues and feature requests are welcome too - open one any time.
