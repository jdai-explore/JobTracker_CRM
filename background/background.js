// ============================================================
// JobTracker — Background Service Worker
// Handles: OAuth2, Google Sheets API, storage management
// Built by Jayadev | Free to use and modify. Good luck! 🚀
// ============================================================

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API_BASE  = 'https://www.googleapis.com/drive/v3';

// ── OAuth ────────────────────────────────────────────────────
async function getAuthToken(interactive = false) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(chrome.runtime.lastError?.message || 'Auth failed');
      } else {
        resolve(token);
      }
    });
  });
}

async function revokeToken() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, () => {
          fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
        });
      }
      resolve();
    });
  });
}

// ── Google Sheets API helpers ────────────────────────────────
async function sheetsRequest(url, method = 'GET', body = null, token) {
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  if (res.status === 401) throw new Error('UNAUTHORIZED');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Create master tracker spreadsheet ───────────────────────
async function createTrackerSheet(token) {
  const headers = [
    'Date Added', 'Status', 'Job Title', 'Company', 'Location',
    'Workplace Type', 'Salary Range', 'Job URL',
    'Hiring Manager', 'Manager Profile URL', 'Notes', 'Date Applied',
    'Interview Date', 'Offer', 'Follow-Up Notes'
  ];

  const spreadsheet = await sheetsRequest(SHEETS_API_BASE, 'POST', {
    properties: { title: '🗂️ My Job Search Tracker' },
    sheets: [{
      properties: {
        title: 'Applications',
        gridProperties: { frozenRowCount: 1 }
      },
      data: [{
        startRow: 0, startColumn: 0,
        rowData: [{
          values: headers.map((h, i) => ({
            userEnteredValue: { stringValue: h },
            userEnteredFormat: {
              backgroundColor: i === 0 ? { red: 0.11, green: 0.11, blue: 0.18 }
                : i === 1 ? { red: 0.16, green: 0.30, blue: 0.89 }
                : { red: 0.11, green: 0.11, blue: 0.18 },
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                bold: true,
                fontSize: 11,
                fontFamily: 'Google Sans'
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE'
            }
          }))
        }]
      }]
    }]
  }, token);

  const sheetId = spreadsheet.sheets[0].properties.sheetId;
  const spreadsheetId = spreadsheet.spreadsheetId;

  // Apply column widths and formatting
  await sheetsRequest(
    `${SHEETS_API_BASE}/${spreadsheetId}:batchUpdate`, 'POST',
    {
      requests: [
        // Column widths
        { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 110 }, fields: 'pixelSize' } },
        { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 }, properties: { pixelSize: 130 }, fields: 'pixelSize' } },
        { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 200 }, fields: 'pixelSize' } },
        { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 3, endIndex: 4 }, properties: { pixelSize: 160 }, fields: 'pixelSize' } },
        { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 7, endIndex: 8 }, properties: { pixelSize: 220 }, fields: 'pixelSize' } },
        { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 10, endIndex: 11 }, properties: { pixelSize: 240 }, fields: 'pixelSize' } },
        // Row height for header
        { updateDimensionProperties: { range: { sheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 40 }, fields: 'pixelSize' } },
        // Status dropdown validation
        {
          setDataValidation: {
            range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 1, endColumnIndex: 2 },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: '🔖 Saved' },
                  { userEnteredValue: '✅ Applied — LinkedIn' },
                  { userEnteredValue: '✅ Applied — Company Site' },
                  { userEnteredValue: '📞 Phone Screen' },
                  { userEnteredValue: '🎯 Interview' },
                  { userEnteredValue: '🤝 Offer' },
                  { userEnteredValue: '❌ Rejected' },
                  { userEnteredValue: '👻 Ghosted' }
                ]
              },
              strict: false,
              showCustomUi: true
            }
          }
        },
        // Alternate row banding
        {
          addBanding: {
            bandedRange: {
              bandedRangeId: 1,
              range: { sheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 0, endColumnIndex: 15 },
              rowProperties: {
                headerColor: { red: 0.11, green: 0.11, blue: 0.18 },
                firstBandColor: { red: 0.97, green: 0.97, blue: 0.99 },
                secondBandColor: { red: 1, green: 1, blue: 1 }
              }
            }
          }
        }
      ]
    },
    token
  );

  return spreadsheetId;
}

// ── Append a job row ─────────────────────────────────────────
async function appendJobRow(spreadsheetId, jobData, token) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const row = [
    dateStr,
    jobData.status || '🔖 Saved',
    jobData.title || '',
    jobData.company || '',
    jobData.location || '',
    jobData.workplaceType || '',
    jobData.salary || '',
    jobData.url || '',
    jobData.hiringManager || '',
    jobData.managerProfileUrl || '',
    jobData.notes || '',
    '', '', '', ''
  ];

  const result = await sheetsRequest(
    `${SHEETS_API_BASE}/${spreadsheetId}/values/Applications!A:O:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    'POST',
    { values: [row] },
    token
  );

  // Extract row number from updatedRange (e.g. "Applications!A42:O42")
  const range = result?.updates?.updatedRange || '';
  const match = range.match(/A(\d+)/);
  return match ? parseInt(match[1]) : '?';
}

// ── Check if job URL already saved ──────────────────────────
async function checkIfAlreadySaved(spreadsheetId, jobUrl, token) {
  if (!jobUrl) return null;
  try {
    const data = await sheetsRequest(
      `${SHEETS_API_BASE}/${spreadsheetId}/values/Applications!A:H`,
      'GET', null, token
    );
    const rows = data.values || [];
    for (let i = 1; i < rows.length; i++) {
      const rowUrl = rows[i][7] || '';
      if (rowUrl && jobUrl && rowUrl.includes(jobUrl.split('?')[0])) {
        return { rowNumber: i + 1, dateAdded: rows[i][0], status: rows[i][1] };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── Get spreadsheet URL ──────────────────────────────────────
function getSpreadsheetUrl(spreadsheetId) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
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

    case 'SIGN_IN': {
      const token = await getAuthToken(true);
      // Get user profile
      const profile = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());

      await chrome.storage.local.set({ userEmail: profile.email, userName: profile.name });
      return { success: true, email: profile.email, name: profile.name };
    }

    case 'SIGN_OUT': {
      await revokeToken();
      await chrome.storage.local.remove(['userEmail', 'userName', 'spreadsheetId']);
      return { success: true };
    }

    case 'GET_STATUS': {
      const data = await chrome.storage.local.get(['userEmail', 'spreadsheetId']);
      return { success: true, ...data };
    }

    case 'CREATE_SHEET': {
      const token = await getAuthToken(false);
      const spreadsheetId = await createTrackerSheet(token);
      await chrome.storage.local.set({ spreadsheetId });
      return { success: true, spreadsheetId, url: getSpreadsheetUrl(spreadsheetId) };
    }

    case 'CONNECT_SHEET': {
      // Validate the provided spreadsheet ID
      const token = await getAuthToken(false);
      try {
        await sheetsRequest(`${SHEETS_API_BASE}/${msg.spreadsheetId}?fields=spreadsheetId`, 'GET', null, token);
        await chrome.storage.local.set({ spreadsheetId: msg.spreadsheetId });
        return { success: true, spreadsheetId: msg.spreadsheetId };
      } catch (e) {
        throw new Error('Could not access that spreadsheet. Make sure the ID is correct and the sheet is accessible.');
      }
    }

    case 'SAVE_JOB': {
      const { spreadsheetId } = await chrome.storage.local.get('spreadsheetId');
      if (!spreadsheetId) throw new Error('No spreadsheet connected. Please set up in the extension popup.');

      let token;
      try {
        token = await getAuthToken(false);
      } catch {
        token = await getAuthToken(true);
      }

      const rowNumber = await appendJobRow(spreadsheetId, msg.jobData, token);
      return { success: true, rowNumber, spreadsheetUrl: getSpreadsheetUrl(spreadsheetId) };
    }

    case 'CHECK_SAVED': {
      const { spreadsheetId } = await chrome.storage.local.get('spreadsheetId');
      if (!spreadsheetId) return { success: true, saved: false };

      let token;
      try {
        token = await getAuthToken(false);
      } catch {
        return { success: true, saved: false };
      }

      const result = await checkIfAlreadySaved(spreadsheetId, msg.url, token);
      return { success: true, saved: !!result, info: result };
    }

    case 'OPEN_SHEET': {
      const { spreadsheetId } = await chrome.storage.local.get('spreadsheetId');
      if (spreadsheetId) {
        chrome.tabs.create({ url: getSpreadsheetUrl(spreadsheetId) });
      }
      return { success: true };
    }

    default:
      throw new Error(`Unknown message type: ${msg.type}`);
  }
}

console.log('[JobTracker] Background service worker ready. Built by Jayadev 🚀');
