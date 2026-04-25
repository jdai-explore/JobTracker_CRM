// ============================================================
// JobTracker — Popup Script
// Built by Jayadev | Free to use and modify. Good luck! 🚀
// ============================================================

const $ = id => document.getElementById(id);

// ── Views ────────────────────────────────────────────────────
const views = {
  signin: $('view-signin'),
  setup:  $('view-setup'),
  ready:  $('view-ready'),
};

function showView(name) {
  Object.values(views).forEach(v => { if (v) v.style.display = 'none'; });
  if (views[name]) views[name].style.display = 'block';
}

// ── Status message helper ─────────────────────────────────────
function showStatus(msg, type = 'loading') {
  const el = $('setup-status');
  if (!el) return;
  el.textContent = msg;
  el.className = `status-msg status-msg--${type}`;
  el.style.display = 'block';
}

function hideStatus() {
  const el = $('setup-status');
  if (el) el.style.display = 'none';
}

// ── Populate user info ────────────────────────────────────────
function populateUser(email, name) {
  if (!email) return;

  // Header avatar via gravatar / initial fallback
  const avatarUrl = `https://www.gravatar.com/avatar/${btoa(email.toLowerCase())}?s=60&d=identicon`;
  const nameStr = name || email.split('@')[0];

  $('header-user').style.display = 'flex';
  $('user-avatar').src = avatarUrl;

  // Setup view
  if ($('user-card-avatar'))  $('user-card-avatar').src = avatarUrl;
  if ($('user-card-name'))    $('user-card-name').textContent = nameStr;
  if ($('user-card-email'))   $('user-card-email').textContent = email;

  // Ready view
  if ($('user-card-ready-avatar')) $('user-card-ready-avatar').src = avatarUrl;
  if ($('user-card-ready-name'))   $('user-card-ready-name').textContent = nameStr;
  if ($('user-card-ready-email'))  $('user-card-ready-email').textContent = email;
}

// ── Send message to background ────────────────────────────────
async function msg(type, data = {}) {
  return chrome.runtime.sendMessage({ type, ...data });
}

// ── Boot: check current state ─────────────────────────────────
async function init() {
  try {
    const status = await msg('GET_STATUS');
    const { userEmail, spreadsheetId } = status;

    if (!userEmail) {
      showView('signin');
      return;
    }

    populateUser(userEmail, status.userName);

    if (!spreadsheetId) {
      showView('setup');
    } else {
      showView('ready');
    }
  } catch (err) {
    showView('signin');
    console.error('[JobTracker] Init error:', err);
  }
}

// ── Sign In ───────────────────────────────────────────────────
$('sign-in-btn')?.addEventListener('click', async () => {
  const btn = $('sign-in-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Connecting…';

  try {
    const res = await msg('SIGN_IN');
    if (!res.success) throw new Error(res.error);
    populateUser(res.email, res.name);
    showView('setup');
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `
      <svg class="btn__google-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
      Sign in with Google`;
    alert(`Sign in failed: ${err.message || err}. Make sure you've added your OAuth client ID to manifest.json.`);
  }
});

// ── Sign Out ──────────────────────────────────────────────────
$('sign-out-btn')?.addEventListener('click', async () => {
  if (!confirm('Sign out from JobTracker?')) return;
  await msg('SIGN_OUT');
  $('header-user').style.display = 'none';
  showView('signin');
});

// ── Create New Sheet ──────────────────────────────────────────
$('create-sheet-btn')?.addEventListener('click', async () => {
  const btn = $('create-sheet-btn');
  btn.disabled = true;
  btn.innerHTML = `<span class="setup-opt__icon">⏳</span><div><strong>Creating your sheet…</strong><p>Setting up columns, formatting & dropdowns</p></div>`;
  showStatus('Creating your "🗂️ My Job Search Tracker" in Google Drive…', 'loading');

  try {
    const res = await msg('CREATE_SHEET');
    if (!res.success) throw new Error(res.error);

    showStatus(`✅ Sheet created! Opening it now…`, 'success');
    chrome.tabs.create({ url: res.url });
    setTimeout(() => showView('ready'), 1500);
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = `<span class="setup-opt__icon">✨</span><div><strong>Create New Sheet</strong><p>Generate a beautifully formatted tracker in your Drive</p></div>`;
    showStatus(`Error: ${err.message || err}`, 'error');
  }
});

// ── Connect Existing Sheet ────────────────────────────────────
$('connect-sheet-btn')?.addEventListener('click', async () => {
  const inputEl = $('sheet-id-input');
  let sheetId = (inputEl?.value || '').trim();

  // Accept full URL or just the ID
  const urlMatch = sheetId.match(/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) sheetId = urlMatch[1];

  if (!sheetId) {
    showStatus('Please paste a Sheet ID or URL.', 'error');
    return;
  }

  const btn = $('connect-sheet-btn');
  btn.disabled = true;
  btn.textContent = 'Connecting…';
  showStatus('Verifying access to your spreadsheet…', 'loading');

  try {
    const res = await msg('CONNECT_SHEET', { spreadsheetId: sheetId });
    if (!res.success) throw new Error(res.error);
    showStatus('✅ Sheet connected!', 'success');
    setTimeout(() => showView('ready'), 1200);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Connect Sheet';
    showStatus(`Error: ${err.message || err}`, 'error');
  }
});

// ── Open Sheet ────────────────────────────────────────────────
$('open-sheet-btn')?.addEventListener('click', () => {
  msg('OPEN_SHEET');
});

// ── Change Sheet ──────────────────────────────────────────────
$('change-sheet-btn')?.addEventListener('click', async () => {
  await chrome.storage.local.remove('spreadsheetId');
  hideStatus();
  const inputEl = $('sheet-id-input');
  if (inputEl) inputEl.value = '';
  const btn = $('create-sheet-btn');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<span class="setup-opt__icon">✨</span><div><strong>Create New Sheet</strong><p>Generate a beautifully formatted tracker in your Drive</p></div>`;
  }
  showView('setup');
});

// ── Boot ──────────────────────────────────────────────────────
init();
