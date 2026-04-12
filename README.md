# Claude Usage

Claude Usage is a browser extension that shows your Claude consumption at a glance in two buckets:

- **Current Session**: percentage used in the active session window.
- **Weekly Limit**: percentage used from the weekly quota.

## UI preview

The popup uses a compact dark theme and includes:

- Header with extension name and refresh button.
- Two usage cards with progress bars and color states:
  - green (<50%)
  - yellow (50–79%)
  - red (80%+)
- Reset countdown text (for example, `Resets in 2h 15m`).
- Footer with “last updated” and a quick link to `claude.ai/settings/usage`.
- Empty state (“No usage data yet”) with a CTA button to open the usage page.

## Run locally (Chrome / Edge / Brave)

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the `claudetrack/` folder.
4. Click the extension icon to open the popup.
5. If no data is shown yet, use **Open claude.ai/settings/usage**, then return to the popup.

## Project structure

- `claudetrack/popup.html`: popup markup.
- `claudetrack/popup.css`: popup styles and theme.
- `claudetrack/popup.js`: popup rendering, refresh flow, storage listeners.
- `claudetrack/background.js`: background polling and refresh messaging.
- `claudetrack/content.js`: usage-page extraction logic on `claude.ai`.
