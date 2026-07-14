// ─── Claude Usage Monitor — In-page Usage Panel (content script) ────────────
// Renders the usage data that background.js already persisted to
// chrome.storage.local ('claudeUsage') as a small always-visible panel inside
// the claude.ai sidebar, with a fixed-position floating fallback.
//
// Hard guarantees (project core values — do not weaken):
//   • One-way data flow: background → storage → this script → DOM (write-only).
//     This script NEVER reads, parses, or transmits any page content
//     (conversations, projects, files). Its only inputs are chrome.storage
//     and the <html> element's theme attributes (to match light/dark).
//   • All rendering is document.createElement + textContent (no HTML strings).
//   • Zero network requests / telemetry.

'use strict';

// ═══ SELECTORS — the ONLY section expected to break when claude.ai ships a ═══
// redesign. Fix it here; nothing below depends on the page structure.
//
// Tried in order, first match wins; the panel is appended at the END of the
// matched element. When none match, the panel mounts on <body> as a floating
// box (bottom-right) instead of disappearing.
//
// Assumptions (unverified against the live DOM — replace with real selectors
// from DevTools if the sidebar mount never kicks in):
const SIDEBAR_SELECTORS = [
  'nav[data-testid="menu-sidebar"]',    // main left sidebar, per its test id
  '[data-testid="menu-sidebar"]',       // same test id if the tag changes
  'nav[aria-label="Sidebar"]',          // aria-label fallbacks
  'nav[aria-label="Main navigation"]',
];

// ── Storage keys ────────────────────────────────────────────────────────────
const USAGE_KEY    = 'claudeUsage';        // written by background.js (read-only here)
const PLAN_KEY     = 'claudePlan';         // written by background.js (read-only here)
const COLLAPSE_KEY = 'cumPanelCollapsed';  // owned by this script; never touches claudeUsage

// ── Behaviour constants ─────────────────────────────────────────────────────
const REMOUNT_DEBOUNCE_MS = 300;    // MutationObserver → ensureMounted() debounce
const COUNTDOWN_TICK_MS   = 60000;  // refresh "Resets in …" / "Updated …" copy

// Rows in display order. Weekly all-models first, then the per-model weekly
// caps (the headline feature: spot at a glance which model is nearly full),
// then the 5h session. Sub-cap rows appear only when the API returned data
// for them this week (percentage !== null), mirroring the popup's auto mode.
const ROWS = [
  { key: 'weekly',  label: 'Weekly · all models', always: true  },
  { key: 'fable',   label: 'Fable · weekly',      always: false },
  { key: 'opus',    label: 'Opus · weekly',       always: false },
  { key: 'sonnet',  label: 'Sonnet · weekly',     always: false },
  { key: 'design',  label: 'Design · weekly',     always: false },
  { key: 'session', label: 'Session · 5h',        always: true  },
];

// ── Tiny DOM helper (createElement only — never HTML strings) ───────────────

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ── Formatting (mirrors popup.js so both surfaces read the same) ────────────

function formatTimeUntil(epochMs) {
  if (!epochMs) return null;
  const diff = epochMs - Date.now();
  if (diff <= 0) return 'Resetting soon';
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (d > 0) return `Resets in ${d}d ${h}h`;
  if (h > 0) return `Resets in ${h}h ${m}m`;
  return `Resets in ${m}m`;
}

function formatTimestamp(epochMs) {
  if (!epochMs) return 'Never updated';
  const diffMin = Math.round((Date.now() - epochMs) / 60000);
  if (diffMin < 1)  return 'Just updated';
  if (diffMin < 60) return `Updated ${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Updated ${diffH}h ago`;
  const d = new Date(epochMs);
  return `Updated ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function colorClass(pct) {
  if (pct < 50) return 'cum-panel-green';
  if (pct < 80) return 'cum-panel-yellow';
  return 'cum-panel-red';
}

// ── Panel construction (built once, values updated in place) ────────────────

let host = null;        // outer container that gets (re)mounted
let refs = null;        // cached element refs for fast re-render
let lastData = null;    // last claudeUsage snapshot (for countdown ticks)
let lastPlan = null;
let collapsed = false;

function buildPanel() {
  host = el('div', 'cum-panel');

  // Header: title + plan badge + collapse toggle. The whole header is the
  // toggle target (bigger hit area), with a real <button> for keyboard access.
  const header = el('div', 'cum-panel-header');
  const title = el('span', 'cum-panel-title', 'Claude usage');
  const badge = el('span', 'cum-panel-badge');
  badge.hidden = true;
  const toggle = el('button', 'cum-panel-toggle', '▾');
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Collapse usage panel');
  toggle.setAttribute('aria-expanded', 'true');
  header.append(title, badge, toggle);
  header.addEventListener('click', onToggleCollapsed);

  const body = el('div', 'cum-panel-body');

  // Empty state — shown instead of rows until background.js has data.
  const empty = el('div', 'cum-panel-empty', 'No usage data yet — it loads within a few minutes, or open the extension popup and hit refresh.');

  const rows = {};
  for (const { key, label } of ROWS) {
    const row = el('div', 'cum-panel-row');
    const top = el('div', 'cum-panel-row-top');
    const name = el('span', 'cum-panel-row-label', label);
    const pct = el('span', 'cum-panel-row-pct', '—');
    top.append(name, pct);
    const track = el('div', 'cum-panel-track');
    const fill = el('div', 'cum-panel-fill');
    track.append(fill);
    const reset = el('div', 'cum-panel-reset', '');
    row.append(top, track, reset);
    rows[key] = { row, pct, fill, reset };
    body.append(row);
  }

  // Optional lines: routine runs (count-based) and extra usage credits.
  const routine = el('div', 'cum-panel-line');
  routine.append(el('span', 'cum-panel-line-label', 'Routine runs'), el('span', 'cum-panel-line-value', ''));
  routine.hidden = true;
  const extra = el('div', 'cum-panel-line');
  extra.append(el('span', 'cum-panel-line-label', 'Extra credits'), el('span', 'cum-panel-line-value', ''));
  extra.hidden = true;
  body.append(routine, extra);

  const footer = el('div', 'cum-panel-footer', '');
  body.append(empty, footer);

  host.append(header, body);

  refs = {
    header, badge, toggle, body, empty, rows, footer,
    routine, routineValue: routine.lastChild,
    extra, extraValue: extra.lastChild,
  };
}

function onToggleCollapsed(event) {
  event.stopPropagation();
  setCollapsed(!collapsed);
  // Persisted so the choice survives reloads and other claude.ai tabs; a new,
  // dedicated key — claudeUsage stays owned exclusively by background.js.
  chrome.storage.local.set({ [COLLAPSE_KEY]: collapsed });
}

function setCollapsed(next) {
  collapsed = Boolean(next);
  if (!host) return;
  host.classList.toggle('cum-panel-collapsed', collapsed);
  refs.body.hidden = collapsed;
  refs.toggle.textContent = collapsed ? '▸' : '▾';
  refs.toggle.setAttribute('aria-label', collapsed ? 'Expand usage panel' : 'Collapse usage panel');
  refs.toggle.setAttribute('aria-expanded', String(!collapsed));
}

// ── Render (storage snapshot → DOM; write-only) ─────────────────────────────

function render(data, plan) {
  if (!host) return;
  lastData = data ?? null;
  if (plan !== undefined) lastPlan = plan;

  const planLabel = lastPlan && typeof lastPlan === 'object' ? lastPlan.label : null;
  refs.badge.textContent = planLabel || '';
  refs.badge.hidden = !planLabel;

  const hasData = Boolean(
    data && ((data.session?.percentage ?? null) !== null || (data.weekly?.percentage ?? null) !== null)
  );
  refs.empty.hidden = hasData;
  refs.footer.hidden = !hasData;

  for (const { key, always } of ROWS) {
    const r = refs.rows[key];
    const bucket = data?.[key];
    const rawPct = bucket?.percentage ?? null;
    const show = hasData && (always || rawPct !== null);
    r.row.hidden = !show;
    if (!show) continue;

    if (rawPct !== null) {
      const p = Math.min(100, Math.max(0, Math.round(rawPct)));
      r.pct.textContent = `${p}%`;
      r.fill.style.width = `${p}%`;
      const cls = colorClass(rawPct);
      for (const c of ['cum-panel-green', 'cum-panel-yellow', 'cum-panel-red']) {
        r.pct.classList.toggle(c, c === cls);
        r.fill.classList.toggle(c, c === cls);
      }
    } else {
      r.pct.textContent = '—';
      r.fill.style.width = '0%';
    }

    // Sub-caps reset with the weekly window — same fallback as the popup.
    const resetTime = bucket?.resetTime ?? (key !== 'session' ? data?.weekly?.resetTime : null) ?? null;
    r.reset.textContent = formatTimeUntil(resetTime) || bucket?.label || '';
  }

  // Routine runs: count-based `used / limit`, shown when the plan exposes it.
  const routine = data?.routine;
  const routineOffered = hasData && Number.isFinite(Number(routine?.limit)) && Number(routine.limit) > 0;
  refs.routine.hidden = !routineOffered;
  if (routineOffered) {
    refs.routineValue.textContent = `${Math.max(0, routine.used ?? 0)} / ${routine.limit} today`;
  }

  // Extra usage credits: percentage of the monthly spend limit.
  const extra = data?.extra;
  const extraOffered = hasData && Boolean(extra && extra.monthlyLimit > 0);
  refs.extra.hidden = !extraOffered;
  if (extraOffered) {
    const rawPct = Number.isFinite(extra.utilization)
      ? extra.utilization
      : (extra.usedCredits / extra.monthlyLimit) * 100;
    refs.extraValue.textContent = `${Math.round(rawPct)}% of limit`;
  }

  if (hasData) refs.footer.textContent = formatTimestamp(data.lastUpdated);
}

// ── Theme (light/dark) ──────────────────────────────────────────────────────
// claude.ai flags its theme on <html> (class / data attribute). Reading those
// two attributes is presentation-only — no page *content* is touched. Falls
// back to the OS preference when the page gives no signal.

function applyTheme() {
  if (!host) return;
  const html = document.documentElement;
  const signal = `${html.getAttribute('data-mode') || ''} ${html.getAttribute('data-theme') || ''} ${html.className || ''}`.toLowerCase();
  let dark;
  if (/\bdark\b/.test(signal)) dark = true;
  else if (/\blight\b/.test(signal)) dark = false;
  else dark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? true;
  host.classList.toggle('cum-panel-dark', dark);
}

// ── Mounting + auto-remount ─────────────────────────────────────────────────
// claude.ai re-renders its sidebar on navigation, which can detach the panel.
// A debounced MutationObserver re-mounts it, and upgrades a floating panel to
// the sidebar once one appears (or degrades back if the sidebar vanishes).

function findSidebar() {
  for (const selector of SIDEBAR_SELECTORS) {
    let node = null;
    try { node = document.querySelector(selector); } catch { /* bad selector after an edit */ }
    if (node) return node;
  }
  return null;
}

function ensureMounted() {
  if (!host || !document.body) return;
  const sidebar = findSidebar();
  if (sidebar) {
    if (host.parentElement !== sidebar) {
      host.classList.remove('cum-panel-floating');
      sidebar.append(host);
    }
  } else if (host.parentElement !== document.body) {
    // Fallback: fixed floating panel (bottom-right) instead of disappearing.
    host.classList.add('cum-panel-floating');
    document.body.append(host);
  }
  applyTheme();
}

let remountTimer = null;

function scheduleEnsureMounted() {
  if (remountTimer !== null) return;
  remountTimer = setTimeout(() => {
    remountTimer = null;
    ensureMounted();
  }, REMOUNT_DEBOUNCE_MS);
}

function startObservers() {
  // Debounced + connectivity-checked, so the observer stays cheap even though
  // it watches the whole tree; our own re-mounts settle in one no-op pass.
  new MutationObserver(scheduleEnsureMounted)
    .observe(document.documentElement, { childList: true, subtree: true });

  // Theme flips only touch <html> attributes; track them separately.
  new MutationObserver(applyTheme)
    .observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-mode', 'data-theme'] });
}

// ── Init ────────────────────────────────────────────────────────────────────

function init() {
  buildPanel();

  chrome.storage.local.get([USAGE_KEY, PLAN_KEY, COLLAPSE_KEY], (items) => {
    setCollapsed(Boolean(items[COLLAPSE_KEY]));
    render(items[USAGE_KEY] || null, items[PLAN_KEY] ?? null);
    ensureMounted();
    startObservers();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[USAGE_KEY]) render(changes[USAGE_KEY].newValue || null, undefined);
    if (changes[PLAN_KEY]) render(lastData, changes[PLAN_KEY].newValue ?? null);
    if (changes[COLLAPSE_KEY]) setCollapsed(Boolean(changes[COLLAPSE_KEY].newValue));
  });

  // Keep the countdowns and the "Updated …" footer honest between polls.
  setInterval(() => {
    if (lastData) render(lastData, undefined);
  }, COUNTDOWN_TICK_MS);
}

init();
