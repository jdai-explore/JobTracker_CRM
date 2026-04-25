// ============================================================
// JobTracker — Popup Script (Local Storage Mode)
// Built by Jayadev | Free to use and modify. Good luck! 🚀
// ============================================================

const $ = id => document.getElementById(id);

const THEME_KEY = 'jobtracker_theme';

// ── Theme Management ────────────────────────────────────────────
function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || 'dark';
}

function setStoredTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const lightIcon = $('theme-icon-light');
  const darkIcon = $('theme-icon-dark');
  if (lightIcon && darkIcon) {
    if (theme === 'light') {
      lightIcon.style.display = 'none';
      darkIcon.style.display = 'block';
    } else {
      lightIcon.style.display = 'block';
      darkIcon.style.display = 'none';
    }
  }
}

function toggleTheme() {
  const current = getStoredTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  setStoredTheme(next);
  applyTheme(next);
}

function initTheme() {
  const theme = getStoredTheme();
  applyTheme(theme);
}

// ── Info Modal ────────────────────────────────────────────────
function openInfoModal() {
  $('info-modal').style.display = 'flex';
}

function closeInfoModal() {
  $('info-modal').style.display = 'none';
}

// ── Send message to background ────────────────────────────────
async function msg(type, data = {}) {
  return chrome.runtime.sendMessage({ type, ...data });
}

// ── Render status badges ──────────────────────────────────────
function renderStatusBadges(byStatus) {
  const container = $('status-badges');
  if (!container) return;
  
  const statusEmojis = {
    '🔖 Saved': '🔖',
    '✅ Applied — LinkedIn': '✅',
    '✅ Applied — Company Site': '✅',
    '📞 Phone Screen': '📞',
    '🎯 Interview': '🎯',
    '🤝 Offer': '🤝',
    '❌ Rejected': '❌',
    '👻 Ghosted': '👻'
  };
  
  const entries = Object.entries(byStatus)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 4);
  
  if (entries.length === 0) {
    container.innerHTML = '<span class="status-badge status-badge--empty">No status yet</span>';
    return;
  }
  
  container.innerHTML = entries.map(([status, count]) => {
    const emoji = statusEmojis[status] || '●';
    return `<span class="status-badge">${emoji} ${count}</span>`;
  }).join('');
}

// ── Format relative time ──────────────────────────────────────
function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Render job item ───────────────────────────────────────────
function renderJobItem(job) {
  const title = job.title || 'Untitled Job';
  const company = job.company || 'Unknown Company';
  const location = job.location || '';
  const status = job.status || '🔖 Saved';
  const relativeTime = formatRelativeTime(job.timestamp);
  
  return `
    <div class="job-item" data-id="${job.id}">
      <div class="job-item__main">
        <div class="job-item__title">${escapeHtml(title)}</div>
        <div class="job-item__meta">
          <span class="job-item__company">${escapeHtml(company)}</span>
          ${location ? `<span class="job-item__location">${escapeHtml(location)}</span>` : ''}
        </div>
      </div>
      <div class="job-item__aside">
        <span class="job-item__status">${status}</span>
        <span class="job-item__time">${relativeTime}</span>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Render recent jobs ────────────────────────────────────────
function renderRecentJobs(jobs) {
  const container = $('recent-jobs');
  if (!container) return;
  
  if (jobs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state__icon">💼</span>
        <p>No jobs saved yet.</p>
        <p class="empty-state__hint">Go to LinkedIn Jobs and click "Save to Tracker"</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = jobs.slice(0, 5).map(renderJobItem).join('');
}

// ── Load and display stats ───────────────────────────────────
async function loadStats() {
  try {
    const res = await msg('GET_STATS');
    if (!res.success) throw new Error(res.error);
    
    $('total-jobs').textContent = res.total || 0;
    renderStatusBadges(res.byStatus || {});
    renderRecentJobs(res.recent || []);
  } catch (err) {
    console.error('[JobTracker] Failed to load stats:', err);
    $('total-jobs').textContent = '?';
  }
}

// ── Export CSV ─────────────────────────────────────────────────
async function exportCSV() {
  const btn = $('export-btn');
  const originalHTML = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner spinner--sm"></span> Exporting…`;
  
  try {
    await msg('DOWNLOAD_CSV');
    btn.innerHTML = `✓ Exported!`;
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }, 2000);
  } catch (err) {
    console.error('[JobTracker] Export failed:', err);
    btn.innerHTML = `❌ Failed`;
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }, 2000);
  }
}

// ── Open viewer page ──────────────────────────────────────────
function openViewer() {
  const viewerUrl = chrome.runtime.getURL('viewer/viewer.html');
  chrome.tabs.create({ url: viewerUrl });
}

// ── Event listeners ───────────────────────────────────────────
$('export-btn')?.addEventListener('click', exportCSV);
$('view-all-btn')?.addEventListener('click', openViewer);
$('theme-toggle')?.addEventListener('click', toggleTheme);
$('info-btn')?.addEventListener('click', openInfoModal);
$('info-modal-close')?.addEventListener('click', closeInfoModal);
$('info-modal')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal__overlay')) {
    closeInfoModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && $('info-modal')?.style.display === 'flex') {
    closeInfoModal();
  }
});

// ── Boot ──────────────────────────────────────────────────────
initTheme();
loadStats();
