# TODO

## Track "Daily included routine runs"

claude.ai's usage UI now shows a **Daily included routine runs** bucket
(observed: `15 / 15`, daily reset ~24h). Add it as a tracked card.

What makes it different from the existing cards:

- **Count-based**, not utilization %. The UI shows `used / limit` (e.g. `0/15`),
  closer to the `extra_usage` (credits) shape than to the percentage buckets.
  Bar fill must be derived as `used / limit`.
- **Daily reset** (~24h), unlike the 5h session and 7d weekly/sub-caps.
- **Separate endpoint** — it is NOT in `/api/organizations/{orgId}/usage`. It
  lives behind the Claude Code gateway (see below), so it needs its own fetch +
  host permission, not just a new field in `mapApiUsageToStoredShape`.

### API (verified live on a Max 5x org)

```
GET https://claude.ai/v1/code/routines/run-budget
```

Required headers (cookie auth via `credentials: 'include'`, plus):

- `anthropic-beta: ccr-triggers-2026-01-30`  ← gates the route; without it → 404
- `anthropic-version: 2023-06-01`            ← without it → 400 "header is required"
- `x-organization-uuid: {orgId}`             ← org scope (reuse `getClaudeOrgId`)

(The `anthropic-client-*` / `x-activity-session-id` telemetry headers the SPA
sends are NOT required.)

Response (200):

```json
{ "used": "0", "limit": "15", "unified_billing_enabled": true }
```

- `used` and `limit` are **strings** → parse with `Number()`.
- **No `resets_at`** is returned — daily reset is implicit. The card can't show a
  precise countdown from this payload; label it "Resets daily" (or omit reset).
- `anthropic-beta` is a **dated** value and will likely change as the feature
  graduates — fetch must fail soft (hide the card on 4xx).

Work needed — ✅ done (shipped at v1.4.8):

- [x] **Verify the API.** Endpoint, headers and shape confirmed above.
- [x] `claudetrack/background.js` — separate `fetchRoutineBudget()` (own headers,
  after the org id); stores `{ used, limit }` on the usage object. Fails soft on
  4xx so non-routine plans just don't show it.
- [x] `claudetrack/popup.html` + `popup.css` — routine card markup/style.
- [x] `claudetrack/popup.js` — renders the count (`X / Y`) with a derived bar. It
  **joins the optional-cards menu, renamed Models → View** (now holds the
  per-model weekly caps + the daily routine card). Tri-state like the sub-caps:
  default shown, user can opt out; auto-hidden when the plan has no routine budget.
- [x] `manifest.json` + `manifest.firefox.json` — host permission
  `https://claude.ai/v1/code/routines/run-budget`.
- [x] Bump version (manifests + docs) to 1.4.8 and update README / store listings.

Open question (resolved): the bucket is gated by the `ccr-triggers` beta + the
org's `unified_billing_enabled`. On orgs without it the endpoint will likely 4xx,
so the card should auto-hide on fetch failure (same pattern as the weekly
sub-caps).

## Release status

- v1.4.8 (routine-runs card + **View** menu) is implemented and committed, but
  **not released yet**. Hold the ZIP build + store submission until the version
  currently in review clears on **both Chrome and Firefox**, then ship v1.4.8.
- A full visual restyle of the extension **and** the landing is planned
  separately (see "Polish UI" below); the v1.4.8 screenshots may be re-shot as
  part of that, so don't over-invest in screenshot polish before the restyle.

## Landing page — pending (separate repo)

Repo: <https://github.com/msadofschi/claude-usage-monitor-landing> (Cloudflare).

- [ ] Propagate the **Models → View** menu rename.
- [ ] Add the **Daily routine runs** card to the feature copy + screenshots.
- [ ] Restyle alongside the extension (see "Polish UI with the Impeccable design skill" below).

## Update landing page for v1.4.6 + custom domain — ✅ done 2026-06-08 (shipped at v1.4.7)

The website lives in a separate repo (<https://github.com/msadofschi/claude-usage-monitor-landing>,
served via Cloudflare). After v1.4.6 ships it needs to reflect the new feature
set and move to the custom domain.

- [x] **New features copy** — document the subscription **plan badge**
  (Max 5x, Pro, Team…) and the **per-model weekly sub-caps** (Opus / Sonnet /
  Design) with the **Models** show/hide menu (Select all / Deselect all), plus
  plan-gated sub-caps (only on paid plans).
- [x] **Refresh screenshots** to show the plan badge, sub-caps row and the
  Models menu.
- [x] **Custom domain** — point the Cloudflare site at the new domain and update the
  privacy-policy URL path. (Shipped as extension v1.4.7 → claude-monitor.com.)
- [x] Bump any version references on the page to 1.4.7 (label + JSON-LD
  `softwareVersion`). Note: `ext-screenshot.png` still has "v1.4.6" baked in —
  re-shoot only if you want the image to read 1.4.7 (no UI change since 1.4.6).

## Polish UI with the Impeccable design skill

Use the **Impeccable** design skill (<https://impeccable.style/>) to refine the
popup UI and the store/landing visuals, removing the generic "AI slop" look and
tightening hierarchy, contrast and spacing.

- [ ] Install for Claude Code: `/plugin marketplace add pbakaus/impeccable`
  (or `npx impeccable skills install`).
- [ ] Run its commands (e.g. `/typeset`, `/colorize`) over `claudetrack/popup.html`
  + `popup.css` — it edits real code, so review diffs and keep the existing
  design system rather than letting it overwrite.
- [ ] Re-run the store screenshots (`screenshot_helper/`, `screenshots/`) after
  the polish so the listing reflects the refined look.
- [ ] Optionally run its 41-rule anti-pattern detector as a PR check.
