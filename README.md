# Claude Usage

Claude Usage is a Manifest V3 browser extension for Claude.ai that shows your current usage directly from the toolbar popup.

It displays three usage buckets:

- **Current Session**: the current short-window Claude usage percentage.
- **Weekly Limit**: the weekly Claude usage percentage.
- **Claude Design**: the weekly Claude Design usage percentage (only shown when in use).

## How it works

The extension refreshes usage through Claude.ai's internal authenticated API.

- Automatic refresh runs every 5 minutes.
- Manual refresh is available from the popup.
- The popup shows the extension version so you can confirm which local build is loaded.
- A content-script fallback fires if a usage tab is already open and the API path fails.

## Features

- Toolbar badge showing the current session percentage.
- Popup with current session and weekly usage cards.
- Reset countdowns when Claude returns reset timestamps.
- Claude Design usage card (hidden until Design is active).
- Manual refresh button.
- Quick link to `https://claude.ai/settings/usage`.
- Local storage caching so the last known value remains visible between refreshes.

## Browser support

This extension is designed for Chromium-based browsers that support Chrome Extensions Manifest V3, including:

- Google Chrome
- Microsoft Edge
- Brave

The codebase uses the standard `chrome.*` extension APIs, so the local development flow is similar across all three browsers.

## Run locally

Load the unpacked extension from the inner `claudetrack/` directory in this repository.

The extension files are here:

- `claudetrack/manifest.json`
- `claudetrack/background.js`
- `claudetrack/popup.html`

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `claudetrack/` folder inside this repo.
5. Pin the extension if you want fast access from the toolbar.

### Edge

1. Open `edge://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `claudetrack/` folder inside this repo.
5. Pin the extension from the Edge toolbar if needed.

### Brave

1. Open `brave://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `claudetrack/` folder inside this repo.
5. Pin the extension from the Brave toolbar if needed.

## Notes for local testing

- You must already be logged in to `https://claude.ai`.
- After loading the extension, open the popup and confirm the version shown there matches the current build.
- Automatic refresh should work without manually opening the usage page.
- If Claude changes its internal API behavior, the fallback parser may still help, but the primary refresh path is the API integration in `background.js`.

## Project structure

- `claudetrack/manifest.json`: extension manifest and permissions.
- `claudetrack/background.js`: automatic refresh logic, Claude API fetching, storage, and badge updates.
- `claudetrack/content.js`: fallback usage-page parsing logic for `claude.ai/settings/usage`.
- `claudetrack/popup.html`: popup markup.
- `claudetrack/popup.css`: popup styling.
- `claudetrack/popup.js`: popup rendering, manual refresh flow, and storage listeners.
