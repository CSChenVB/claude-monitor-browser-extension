// ─── Claude Usage Monitor — Options ──────────────────────────────────────────
// Notification settings, stored under `notifSettings`. The background worker
// re-reads them on every poll, so changes apply on the next refresh.

const DEFAULTS = { enabled: true, warnAt: 80, critAt: 95 };

const enabledEl = document.getElementById('notifEnabled');
const warnEl    = document.getElementById('warnAt');
const critEl    = document.getElementById('critAt');
const testBtn   = document.getElementById('testBtn');
const statusEl  = document.getElementById('status');

function clampThreshold(value, fallback) {
  const num = Math.round(Number(value));
  if (!Number.isFinite(num)) return fallback;
  return Math.min(100, Math.max(1, num));
}

chrome.storage.local.get('notifSettings', ({ notifSettings }) => {
  const s = { ...DEFAULTS, ...(notifSettings || {}) };
  enabledEl.checked = Boolean(s.enabled);
  warnEl.value = clampThreshold(s.warnAt, DEFAULTS.warnAt);
  critEl.value = clampThreshold(s.critAt, DEFAULTS.critAt);
});

let statusTimer = null;

function flashStatus(text) {
  statusEl.textContent = text;
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusEl.textContent = ''; }, 1500);
}

// `notifications` is an optional permission, requested from a user gesture the
// first time notifications are turned on. Chrome no longer disables the whole
// extension on update because the permission isn't required up front.
function ensureNotifPermission() {
  return new Promise((resolve) => {
    chrome.permissions.contains({ permissions: ['notifications'] }, (has) => {
      if (has) return resolve(true);
      chrome.permissions.request({ permissions: ['notifications'] }, (granted) => resolve(Boolean(granted)));
    });
  });
}

async function save() {
  // Turning notifications on needs the optional permission; if the user denies
  // it, revert the toggle and don't persist an enabled state we can't honor.
  if (enabledEl.checked) {
    const granted = await ensureNotifPermission();
    if (!granted) {
      enabledEl.checked = false;
      flashStatus('Permission denied');
      return;
    }
  }
  const warnAt = clampThreshold(warnEl.value, DEFAULTS.warnAt);
  // The critical threshold can't sit below the warning one.
  const critAt = Math.max(warnAt, clampThreshold(critEl.value, DEFAULTS.critAt));
  warnEl.value = warnAt;
  critEl.value = critAt;
  chrome.storage.local.set(
    { notifSettings: { enabled: enabledEl.checked, warnAt, critAt } },
    () => flashStatus('Saved'),
  );
}

[enabledEl, warnEl, critEl].forEach(el => el.addEventListener('change', save));

testBtn.addEventListener('click', async () => {
  if (!(await ensureNotifPermission())) { flashStatus('Permission denied'); return; }
  chrome.notifications.create('usage-test', {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Claude session at 82%',
    message: 'Resets in 1h 23m (test)',
  });
});
