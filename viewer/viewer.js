// ============================================================
// JobTracker — Viewer Script
// Full-page job list with search, filter, edit, delete
// ============================================================

const $ = id => document.getElementById(id);

const THEME_KEY = 'jobtracker_theme';
let allJobs = [];
let currentFilter = '';
let currentSearch = '';

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

// ── Load jobs ─────────────────────────────────────────────────
async function loadJobs() {
  try {
    const res = await msg('GET_JOBS');
    if (!res.success) throw new Error(res.error);
    allJobs = res.jobs || [];
    renderJobs();
    updateCount();
  } catch (err) {
    console.error('[JobTracker] Failed to load jobs:', err);
    showEmptyState('Error loading jobs. Please refresh.');
  }
}

// ── Render job item ───────────────────────────────────────────
function renderJobItem(job) {
  const title = job.title || 'Untitled Job';
  const company = job.company || 'Unknown Company';
  const location = job.location || '-';
  const salary = job.salary || '-';
  const notes = job.notes || '';
  const status = job.status || '🔖 Saved';
  
  return `
    <tr data-id="${job.id}">
      <td class="job-date">${escapeHtml(job.dateAdded || '-')}</td>
      <td class="job-status">${escapeHtml(status)}</td>
      <td>
        <div class="job-title">${escapeHtml(title)}</div>
      </td>
      <td class="job-company">${escapeHtml(company)}</td>
      <td class="job-location">${escapeHtml(location)}</td>
      <td class="job-salary">${escapeHtml(salary)}</td>
      <td class="job-notes">${escapeHtml(truncate(notes, 30))}</td>
      <td>
        <button class="btn--icon" title="Edit" data-action="edit">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
          </svg>
        </button>
        <a href="${escapeHtml(job.url || '#')}" target="_blank" class="btn--icon" title="Open job" ${!job.url ? 'style="display:none"' : ''}>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </a>
      </td>
    </tr>
  `;
}

// ── Filter and search jobs ────────────────────────────────────
function getFilteredJobs() {
  return allJobs.filter(job => {
    // Status filter
    if (currentFilter && job.status !== currentFilter) {
      return false;
    }
    
    // Search filter
    if (currentSearch) {
      const search = currentSearch.toLowerCase();
      const text = `${job.title} ${job.company} ${job.location}`.toLowerCase();
      return text.includes(search);
    }
    
    return true;
  });
}

// ── Render jobs table ─────────────────────────────────────────
function renderJobs() {
  const jobs = getFilteredJobs();
  const tbody = $('job-table-body');
  const emptyState = $('empty-state');
  const table = $('job-table');
  
  if (jobs.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    table.style.display = 'none';
    return;
  }
  
  emptyState.style.display = 'none';
  table.style.display = 'table';
  
  tbody.innerHTML = jobs.map(renderJobItem).join('');
  
  // Add click handlers for rows
  tbody.querySelectorAll('tr').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="edit"]') || e.target.closest('a')) {
        return;
      }
      openEditModal(row.dataset.id);
    });
  });
  
  // Add edit button handlers
  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('tr').dataset.id;
      openEditModal(id);
    });
  });
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateCount() {
  const filtered = getFilteredJobs();
  $('results-count').textContent = `${filtered.length} job${filtered.length !== 1 ? 's' : ''}`;
}

function showEmptyState(message) {
  const emptyState = $('empty-state');
  emptyState.querySelector('h3').textContent = message || 'No jobs found';
  emptyState.style.display = 'block';
  $('job-table').style.display = 'none';
}

// ── Edit Modal ────────────────────────────────────────────────
let editingJobId = null;

function openEditModal(jobId) {
  const job = allJobs.find(j => j.id === jobId);
  if (!job) return;
  
  editingJobId = jobId;
  $('edit-job-id').value = jobId;
  $('edit-title').value = job.title || '';
  $('edit-company').value = job.company || '';
  $('edit-status').value = job.status || '🔖 Saved';
  $('edit-location').value = job.location || '';
  $('edit-notes').value = job.notes || '';
  $('edit-url').value = job.url || '';
  
  $('edit-modal').style.display = 'flex';
}

function closeEditModal() {
  $('edit-modal').style.display = 'none';
  editingJobId = null;
}

async function saveJobChanges(e) {
  e.preventDefault();
  
  if (!editingJobId) return;
  
  const updates = {
    title: $('edit-title').value.trim(),
    company: $('edit-company').value.trim(),
    status: $('edit-status').value,
    location: $('edit-location').value.trim(),
    notes: $('edit-notes').value.trim()
  };
  
  try {
    const res = await msg('UPDATE_JOB', { jobId: editingJobId, updates });
    if (!res.success) throw new Error(res.error);
    
    // Update local data
    const index = allJobs.findIndex(j => j.id === editingJobId);
    if (index >= 0) {
      allJobs[index] = { ...allJobs[index], ...updates };
    }
    
    renderJobs();
    closeEditModal();
  } catch (err) {
    console.error('[JobTracker] Failed to update job:', err);
    alert('Failed to save changes. Please try again.');
  }
}

async function deleteJob() {
  if (!editingJobId) return;
  
  if (!confirm('Delete this job? This cannot be undone.')) {
    return;
  }
  
  try {
    const res = await msg('DELETE_JOB', { jobId: editingJobId });
    if (!res.success) throw new Error(res.error);
    
    allJobs = allJobs.filter(j => j.id !== editingJobId);
    renderJobs();
    updateCount();
    closeEditModal();
  } catch (err) {
    console.error('[JobTracker] Failed to delete job:', err);
    alert('Failed to delete job. Please try again.');
  }
}

// ── Delete all data ────────────────────────────────────────────
async function deleteAllData() {
  if (!confirm('Delete ALL saved jobs? This cannot be undone.')) {
    return;
  }
  
  if (!confirm('Are you sure? All your job data will be permanently removed.')) {
    return;
  }
  
  try {
    await chrome.storage.local.remove('jobtracker_jobs');
    allJobs = [];
    renderJobs();
    updateCount();
  } catch (err) {
    console.error('[JobTracker] Failed to delete all:', err);
    alert('Failed to delete data. Please try again.');
  }
}

// ── Export CSV ─────────────────────────────────────────────────
async function exportCSV() {
  const btn = $('export-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Exporting…`;
  
  try {
    await msg('DOWNLOAD_CSV');
    btn.innerHTML = `✓ Exported!`;
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }, 2000);
  } catch (err) {
    console.error('[JobTracker] Export failed:', err);
    btn.innerHTML = `❌ Failed`;
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }, 2000);
  }
}

// ── Event Listeners ───────────────────────────────────────────
$('search-input').addEventListener('input', (e) => {
  currentSearch = e.target.value;
  renderJobs();
  updateCount();
});

$('status-filter').addEventListener('change', (e) => {
  currentFilter = e.target.value;
  renderJobs();
  updateCount();
});

$('export-btn').addEventListener('click', exportCSV);
$('delete-all-btn').addEventListener('click', deleteAllData);
$('theme-toggle').addEventListener('click', toggleTheme);
$('info-btn').addEventListener('click', openInfoModal);
$('info-modal-close').addEventListener('click', closeInfoModal);
$('info-modal')?.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal__overlay')) {
    closeInfoModal();
  }
});

// Edit Modal
$('modal-close').addEventListener('click', closeEditModal);
$('cancel-btn').addEventListener('click', closeEditModal);
$('edit-form').addEventListener('submit', saveJobChanges);
$('delete-job-btn').addEventListener('click', deleteJob);

// Close modals on overlay click
$('edit-modal').addEventListener('click', (e) => {
  if (e.target.classList.contains('modal__overlay')) {
    closeEditModal();
  }
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if ($('edit-modal').style.display === 'flex') closeEditModal();
    if ($('info-modal').style.display === 'flex') closeInfoModal();
  }
});

// ── Boot ──────────────────────────────────────────────────────
initTheme();
loadJobs();
