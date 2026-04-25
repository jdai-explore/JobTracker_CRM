// ============================================================
// JobTracker — Background Service Worker
// Handles: Local storage, CSV export
// Built by Jayadev | Free to use and modify. Good luck! 🚀
// ============================================================

const STORAGE_KEY = 'jobtracker_jobs';

// ── Job Data Helpers ─────────────────────────────────────────
async function getJobs() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  return data[STORAGE_KEY] || [];
}

async function saveJob(jobData) {
  const jobs = await getJobs();
  
  // Check for duplicates by URL
  const existingIndex = jobs.findIndex(j => 
    j.url && jobData.url && j.url.split('?')[0] === jobData.url.split('?')[0]
  );
  
  const now = new Date();
  const job = {
    id: existingIndex >= 0 ? jobs[existingIndex].id : crypto.randomUUID(),
    dateAdded: existingIndex >= 0 ? jobs[existingIndex].dateAdded : now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
    timestamp: existingIndex >= 0 ? jobs[existingIndex].timestamp : now.toISOString(),
    status: jobData.status || '🔖 Saved',
    title: jobData.title || '',
    company: jobData.company || '',
    location: jobData.location || '',
    workplaceType: jobData.workplaceType || '',
    salary: jobData.salary || '',
    url: jobData.url || '',
    hiringManager: jobData.hiringManager || '',
    managerProfileUrl: jobData.managerProfileUrl || '',
    notes: jobData.notes || '',
    dateApplied: jobData.dateApplied || '',
    interviewDate: jobData.interviewDate || '',
    offer: jobData.offer || '',
    followUpNotes: jobData.followUpNotes || ''
  };
  
  if (existingIndex >= 0) {
    jobs[existingIndex] = job;
  } else {
    jobs.unshift(job); // Add to beginning (newest first)
  }
  
  await chrome.storage.local.set({ [STORAGE_KEY]: jobs });
  return { job, isUpdate: existingIndex >= 0 };
}

async function deleteJob(jobId) {
  const jobs = await getJobs();
  const filtered = jobs.filter(j => j.id !== jobId);
  await chrome.storage.local.set({ [STORAGE_KEY]: filtered });
}

async function updateJob(jobId, updates) {
  const jobs = await getJobs();
  const index = jobs.findIndex(j => j.id === jobId);
  if (index >= 0) {
    jobs[index] = { ...jobs[index], ...updates };
    await chrome.storage.local.set({ [STORAGE_KEY]: jobs });
    return jobs[index];
  }
  return null;
}

async function checkIfAlreadySaved(jobUrl) {
  if (!jobUrl) return null;
  const jobs = await getJobs();
  return jobs.find(j => 
    j.url && jobUrl && j.url.split('?')[0] === jobUrl.split('?')[0]
  ) || null;
}

// ── CSV Export ─────────────────────────────────────────────────
function escapeCSV(value) {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function exportToCSV() {
  const jobs = await getJobs();
  
  const headers = [
    'Date Added', 'Status', 'Job Title', 'Company', 'Location',
    'Workplace Type', 'Job URL',
    'Hiring Manager', 'Manager Profile URL', 'Notes', 'Date Applied',
    'Interview Date', 'Offer', 'Follow-Up Notes'
  ];
  
  const rows = jobs.map(job => [
    job.dateAdded,
    job.status,
    job.title,
    job.company,
    job.location,
    job.workplaceType,
    job.url,
    job.hiringManager,
    job.managerProfileUrl,
    job.notes,
    job.dateApplied,
    job.interviewDate,
    job.offer,
    job.followUpNotes
  ]);
  
  const csvContent = [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n');
  
  return csvContent;
}

async function downloadCSV() {
  const csvContent = await exportToCSV();
  
  // Convert to data URL (blobs don't work well in service workers)
  const encodedContent = encodeURIComponent(csvContent);
  const dataUrl = `data:text/csv;charset=utf-8,${encodedContent}`;
  
  const now = new Date();
  const filename = `job-tracker-${now.toISOString().split('T')[0]}.csv`;
  
  await chrome.downloads.download({
    url: dataUrl,
    filename: filename,
    saveAs: true
  });
}

// ── Get Stats ─────────────────────────────────────────────────
async function getStats() {
  const jobs = await getJobs();
  const statusCounts = {};
  jobs.forEach(j => {
    statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;
  });
  
  return {
    total: jobs.length,
    byStatus: statusCounts,
    recent: jobs.slice(0, 5)
  };
}

// ── Message handler ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  handleMessage(msg, sender).then(sendResponse).catch(err => {
    sendResponse({ success: false, error: err.message || String(err) });
  });
  return true; // keep channel open for async
});

async function handleMessage(msg, sender) {
  switch (msg.type) {

    case 'GET_STATS': {
      const stats = await getStats();
      return { success: true, ...stats };
    }

    case 'GET_JOBS': {
      const jobs = await getJobs();
      return { success: true, jobs };
    }

    case 'SAVE_JOB': {
      const result = await saveJob(msg.jobData);
      return { 
        success: true, 
        job: result.job, 
        isUpdate: result.isUpdate,
        totalJobs: (await getJobs()).length
      };
    }

    case 'UPDATE_JOB': {
      const job = await updateJob(msg.jobId, msg.updates);
      return { success: true, job };
    }

    case 'DELETE_JOB': {
      await deleteJob(msg.jobId);
      return { success: true };
    }

    case 'CHECK_SAVED': {
      const existing = await checkIfAlreadySaved(msg.url);
      return { success: true, saved: !!existing, info: existing };
    }

    case 'EXPORT_CSV': {
      const csvContent = await exportToCSV();
      return { success: true, csvContent };
    }

    case 'DOWNLOAD_CSV': {
      await downloadCSV();
      return { success: true };
    }

    default:
      throw new Error(`Unknown message type: ${msg.type}`);
  }
}

console.log('[JobTracker] Background service worker ready. Local storage mode. Built by Jayadev 🚀');
