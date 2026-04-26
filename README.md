<div align="center">
  <img src="icons/icon128.png" alt="Video Speeder" width="128" />
  <h1>Video Speeder</h1>
  <p><strong>Tab Media Controller for Chrome</strong></p>

  <p>
    <img src="https://img.shields.io/badge/Chrome-MV3-blue?logo=googlechrome" alt="Chrome MV3" />
    <img src="https://img.shields.io/badge/version-1.0.2-brightgreen" alt="Version" />
    <img src="https://img.shields.io/badge/license-MIT-lightgrey" alt="License" />
    <img src="https://img.shields.io/badge/dependencies-none-success" alt="No Dependencies" />
  </p>
</div>

---

## Overview

Control the playback speed of every `<video>` and `<audio>` element on any page — per tab or across all open tabs. Fine-tune from **0.25×** to **4.00×** with a polished popup UI featuring a precision slider, quick presets, and real-time feedback.

Works everywhere: YouTube, Netflix, Spotify, lecture platforms, local files, and embedded media inside iframes.

---

## Features

<table>
  <tr>
    <td><strong>⚡ Per-Tab Control</strong></td>
    <td>Set a different speed for each tab. Switch tabs and the speed follows.</td>
  </tr>
  <tr>
    <td><strong>🌐 All-Tabs Mode</strong></td>
    <td>One slider to rule them all. Speed up (or slow down) every open tab at once.</td>
  </tr>
  <tr>
    <td><strong>🔁 Auto-Reenforcement</strong></td>
    <td>Hooks into <code>play</code>, <code>playing</code>, <code>loadedmetadata</code>, and <code>ratechange</code> events — if a site resets the speed, the extension puts it right back.</td>
  </tr>
  <tr>
    <td><strong>👀 DOM Observer</strong></td>
    <td><code>MutationObserver</code> watches for dynamically added media elements (SPA navigations, infinite scroll, lazy-loaded players).</td>
  </tr>
  <tr>
    <td><strong>🎵 Pitch Preservation</strong></td>
    <td>Audio pitch stays natural at any speed. No chipmunk voices, no demon growls.</td>
  </tr>
  <tr>
    <td><strong>🖼️ All Frames</strong></td>
    <td>Injected into every iframe with <code>all_frames: true</code> + <code>match_about_blank: true</code>. YouTube embeds, Vimeo players — everything gets covered.</td>
  </tr>
  <tr>
    <td><strong>💾 Session-Only Storage</strong></td>
    <td>Speeds reset when the browser closes. No persistent clutter.</td>
  </tr>
  <tr>
    <td><strong>🛡️ Error Resilient</strong></td>
    <td>Gracefully handles DRM-protected players, programmatic content script injection fallback, and double-injection guards.</td>
  </tr>
</table>

---

## Popup UI

```
┌──────────────────────────────────────┐
│            VIDEO SPEEDER             │
│     12 media elements found          │
│                                      │
│     [  THIS TAB  ]  [  ALL TABS  ]   │
│                                      │
│              ┌──────┐                │
│              │ 1.50×│  ← speed bubble│
│              └──╲───┘                │
│    ───●───────────────────────       │
│    0.25×                   4.00×     │
│                                      │
│    [ − ]  [ + ]                      │
│                                      │
│  [0.5×] [1×] [1.25×] [1.5×] [2×]   │
│                                      │
│            [ RESET 1.00× ]           │
└──────────────────────────────────────┘
```

- **Slider** with a floating bubble that tracks the thumb position in real-time
- **±0.05 step** buttons for fine-tuning
- **Five quick presets** for one-click speed changes
- **Mode toggle** between per-tab and all-tabs control
- **Live media count** shows how many `<video>`/`<audio>` elements are detected on the current page

---

## How It Works

```
┌──────────┐    chrome.runtime    ┌──────────────┐    chrome.tabs     ┌──────────────┐
│ popup.js │ ──────────────────→ │ background.js │ ────────────────→ │  content.js  │
│  (UI)    │ ←────────────────── │  (orchestrator)│ ←──────────────── │ (page inject) │
└──────────┘   sendMessage       └──────────────┘   sendMessage      └──────────────┘
                                         │
                                  chrome.storage.session
                                  (per-tab speed + global default)
```

1. **Content script** (`content.js`) loads in every page and frame, scans for media elements, and listens for speed commands
2. **Background service worker** (`background.js`) stores speeds in `chrome.storage.session`, coordinates between popup and content scripts, and handles fallback script injection
3. **Popup** (`popup.js`) renders the slider UI and sends commands to the background worker with a 45ms debounce for smooth dragging

---

## Installation

### Load Unpacked (Developer Mode)

1. Clone or download this repo
   ```bash
   git clone https://github.com/your-username/video-speeder.git
   ```
2. Open Chrome and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right)
4. Click **Load unpacked** and select the `video-speeder` folder
5. The extension icon appears in your toolbar — click it on any page with media

### Chrome Web Store (coming soon)

---

## Permissions

| Permission | Reason |
|-----------|--------|
| `storage` | Save per-tab speed settings (session-only, cleared on close) |
| `tabs` | Query tabs for all-tabs mode, send messages to content scripts |
| `scripting` | Programmatically inject the content script as a fallback |
| `<all_urls>` (host) | Inject the content script into every page so speed control works everywhere |

The extension stores **no persistent data**, sends **no network requests**, and collects **no analytics**.

---

## Project Structure

```
video-speeder/
├── manifest.json        # Extension manifest (Manifest V3)
├── background.js        # Service worker — orchestration & storage
├── content.js           # Injected into every page/frame — media control
├── popup.html           # Popup HTML structure
├── popup.js             # Popup interaction logic & state
├── popup.css            # Popup styling (custom slider, bubble, presets)
├── icons/               # Extension icons (16, 32, 48, 128)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

Zero dependencies. Pure vanilla JavaScript. No build step required.

---

## Configuration

| Setting | Default | Range |
|---------|---------|-------|
| Speed | 1.00× | 0.25× – 4.00× |
| Slider step | 0.01 | — |
| Button step | 0.05 | — |
| Debounce | 45ms | — |
| Minimum Chrome | 102 | — |

---

## Development

No setup needed. Edit the files, reload the extension at `chrome://extensions`.

```bash
# Lint JavaScript files (optional)
npx eslint *.js
```

To contribute, fork the repo and submit a PR. Keep it vanilla — no frameworks, no transpilers, no build tools.

---

## License

MIT &copy; 2026
