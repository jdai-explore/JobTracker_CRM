# 🗂️ JobTracker — LinkedIn → Google Sheets Chrome Extension

> **Built by Jayadev** · Free to use and modify as you wish · Good luck with the job search! 🚀  
> *The developer is not liable in any way for your use of this extension.*

One-click save any LinkedIn job to your personal Google Sheets CRM. Auto-extracts job title, company, salary, location, and more — no copy-pasting ever again.

---

## ✨ Features

- **💾 One-Click Save** — Button injected right next to LinkedIn's native Apply button
- **🤖 Smart Scraping** — Auto-extracts: Job Title, Company, Location, Workplace Type (Remote/Hybrid/On-site), Salary Range, Hiring Manager name & profile URL, Job URL, Date Added
- **📊 Beautiful Google Sheet** — Auto-creates a formatted "My Job Search Tracker" with frozen headers, alternating row colors, and status dropdowns
- **🔄 Duplicate Detection** — Button turns gray if you've already saved that job, showing the date saved
- **📝 Quick Notes** — Right-click the button to add a note before saving (e.g., "Ask Dave for referral")
- **✅ Status Tagging** — Save as: Saved / Applied on LinkedIn / Applied on Company Site (+ more in the sheet)
- **🍞 Toast Notifications** — Unobtrusive bottom-right confirmation with a direct link to the row
- **🔒 Privacy First** — Data goes directly to YOUR Google Drive, nowhere else

---

## 🚀 Setup Guide (Step by Step)

### Step 1: Create a Google Cloud Project & OAuth Client

This is a one-time setup to get your own OAuth credentials.

1. Go to [https://console.cloud.google.com/](https://console.cloud.google.com/)
2. Click **"New Project"** → name it `JobTracker` → Create
3. In the left menu: **APIs & Services → Library**
4. Search and enable:
   - ✅ **Google Sheets API**
   - ✅ **Google Drive API**
5. Go to **APIs & Services → OAuth consent screen**
   - User Type: **External**
   - App name: `JobTracker`
   - Fill in your email for support & developer contact
   - Scopes: Add `.../auth/spreadsheets` and `.../auth/drive.file`
   - Test users: Add your own Gmail address
   - Save & Continue
6. Go to **APIs & Services → Credentials**
   - Click **"+ CREATE CREDENTIALS" → OAuth client ID**
   - Application type: **Chrome Extension**
   - Name: `JobTracker`
   - Item ID: Your Chrome extension ID (see Step 2 below to get this first)

### Step 2: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `linkedin-job-crm` folder
5. The extension will appear — note the **Extension ID** (a long string like `abcdefghijklmnopqrstuvwxyzabcdef`)

### Step 3: Add Your OAuth Client ID

1. Go back to the Google Cloud Console (from Step 1, point 6)
2. Paste your Extension ID into the **"Item ID"** field → Create
3. Copy the **Client ID** (looks like `12345678-abc123.apps.googleusercontent.com`)
4. Open `manifest.json` in the extension folder
5. Replace `YOUR_GOOGLE_OAUTH_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID:
   ```json
   "oauth2": {
     "client_id": "YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com",
     ...
   }
   ```
6. Go back to `chrome://extensions/` → Click the **refresh icon** on JobTracker

### Step 4: Connect Your Google Sheet

1. Click the **JobTracker icon** in Chrome's toolbar
2. Click **"Sign in with Google"** and authorize the app
3. Choose:
   - **"✨ Create New Sheet"** — Instantly generates a formatted tracker in your Google Drive
   - **Or paste an existing Sheet ID** if you already have a tracker

### Step 5: Start Saving Jobs!

1. Go to [linkedin.com/jobs](https://linkedin.com/jobs)
2. Open any job listing
3. Click **"💾 Save to Sheet"** next to the Apply button
4. Done! Check your Google Sheet ✅

---

## 🎮 How to Use

| Action | Result |
|--------|--------|
| **Left-click** the button | Quick-save as "🔖 Saved" |
| **Right-click** the button | Opens menu to choose status + add a note |
| Button is **gray** | Job already saved — shows the date |
| **Toast notification** appears | Click "Open Sheet ↗" to jump directly to the row |

### Status Options (right-click menu)
- 🔖 Save for Later
- ✅ Applied on LinkedIn
- ✅ Applied on Company Site

### Additional statuses available in the sheet's dropdown:
- 📞 Phone Screen
- 🎯 Interview
- 🤝 Offer
- ❌ Rejected
- 👻 Ghosted

---

## 📊 Your Google Sheet Columns

| Column | Contents |
|--------|----------|
| Date Added | When you saved it |
| Status | Dropdown (Saved / Applied / Interview / etc.) |
| Job Title | Auto-extracted from LinkedIn |
| Company | Auto-extracted |
| Location | Auto-extracted |
| Workplace Type | Remote / Hybrid / On-site |
| Salary Range | Auto-extracted if listed |
| Job URL | Direct link to the listing |
| Hiring Manager | Name if shown on listing |
| Manager Profile URL | LinkedIn profile link |
| Notes | Your quick note from right-click menu |
| Date Applied | Fill this in yourself |
| Interview Date | Fill this in yourself |
| Offer | Fill this in yourself |
| Follow-Up Notes | Fill this in yourself |

---

## 🔧 Troubleshooting

**Button not appearing?**
- Make sure you're on `linkedin.com/jobs/...` (the jobs section)
- Try scrolling to the job detail panel — wait for it to load fully
- Refresh the page

**"No spreadsheet connected" error?**
- Click the extension icon → ensure you're signed in and a sheet is connected

**"Could not access spreadsheet" error?**
- Make sure the sheet is owned by or shared with your Google account

**OAuth error / Sign in not working?**
- Double-check your Client ID in `manifest.json`
- Make sure your Google account is in the "Test users" list in Google Cloud Console
- Make sure the Sheets and Drive APIs are enabled

**LinkedIn changed its layout and scraping broke?**
- LinkedIn occasionally changes their CSS class names
- Open an issue on GitHub — this is the main ongoing maintenance item
- The extension will still save the URL even if other fields fail to extract

---

## 🛠️ Tech Stack

- **Manifest V3** Chrome Extension
- **Google Sheets API v4** for reading/writing
- **Google Drive API v3** for sheet creation
- **chrome.identity** for OAuth2 authentication
- **MutationObserver** for LinkedIn SPA navigation detection
- Vanilla JS — no frameworks, no bundler needed

---

## 📁 File Structure

```
linkedin-job-crm/
├── manifest.json              # Extension config & permissions
├── background/
│   └── background.js          # Service worker: OAuth, Sheets API
├── content/
│   ├── content.js             # LinkedIn scraper + button injection
│   └── content.css            # Injected styles
├── popup/
│   ├── popup.html             # Extension popup
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                  # This file
```

---

## ⚖️ License & Disclaimer

**Free to use, free to modify, free to distribute.**

Built by Jayadev as a productivity tool for job seekers. Feel free to fork, improve, and share it.

The developer (Jayadev) is **not liable in any way** for your use of this extension. Your Google credentials and sheet data are your own responsibility. This extension does not transmit data anywhere except the Google APIs you explicitly authorize.

---

*Good luck with your job search! You've got this 💪*
