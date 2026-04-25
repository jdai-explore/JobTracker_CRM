# JobTracker — LinkedIn Job Tracker (Zero Setup)

> **Built by Jayadev** · Free to use and modify as you wish · Good luck with the job search!
> *The developer is not liable in any way for your use of this extension.*

**Job searching is exhausting.** You're polishing your resume, brushing up on skills, networking, and applying to dozens of roles. The last thing you need is the mental overhead of tracking which companies you've applied to, where you are in each process, and what notes you made about specific opportunities.

**JobTracker exists to remove that cognitive load.**

One-click save any LinkedIn job to your personal tracker. Export to CSV and open in Excel, Google Sheets, Notion, or anywhere. **No accounts, no setup, no cloud required.**

Spend your energy on what actually matters — landing the role — not on spreadsheets and copy-paste.

---

## Features

- **One-Click Save** — Button injected right next to LinkedIn's native Apply button
- **Smart Scraping** — Auto-extracts: Job Title, Company, Location, Workplace Type (Remote/Hybrid/On-site), Salary Range, Hiring Manager name & profile URL, Job URL, Date Added
- **Export Anywhere** — Download CSV anytime. Opens in Excel, Google Sheets, Notion, Airtable, etc.
- **Duplicate Detection** — Button turns gray if you've already saved that job, showing the date saved
- **Quick Notes** — Right-click the button to add a note before saving (e.g., "Ask Dave for referral")
- **Status Tracking** — Save as: Saved / Applied on LinkedIn / Applied on Company Site / Interview / Offer / etc.
- **Privacy First** — Your data stays in your browser. No cloud accounts needed. Works offline.

---

## Setup (30 Seconds)

### Step 1: Install the Extension

1. Download and unzip this extension folder
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top right)
4. Click **"Load unpacked"**
5. Select the extension folder

### Step 2: Start Saving Jobs!

1. Go to [linkedin.com/jobs](https://linkedin.com/jobs)
2. Open any job listing
3. Click **"Save to Tracker"** next to the Apply button
4. Done! Click the JobTracker icon to see your saved jobs

**No accounts needed. No setup. Works immediately.**

---

## How to Use

| Action | Result |
|--------|--------|
| **Left-click** the button | Quick-save with default status |
| **Right-click** the button | Opens menu to choose status + add a note |
| Button is **gray** | Job already saved — shows the date |
| **Click extension icon** | View stats, recent jobs, export to CSV |

### Status Options (right-click menu)
- Save for Later
- Applied on LinkedIn
- Applied on Company Site
- Phone Screen
- Interview
- Offer
- Rejected
- Ghosted

### Exporting Your Data
1. Click the JobTracker icon in Chrome
2. Click **"Export CSV"** 
3. Open the downloaded file in:
   - **Microsoft Excel** — double-click the CSV
   - **Google Sheets** — File → Import → Upload
   - **Notion** — Add a database → Import → CSV
   - **Airtable** — Add a base → Import data → CSV file

---

## 📊 Data Fields

| Field | Source |
|-------|--------|
| Date Added | Auto (when you saved it) |
| Status | Your selection (dropdown in export) |
| Job Title | Auto-extracted from LinkedIn |
| Company | Auto-extracted |
| Location | Auto-extracted |
| Workplace Type | Remote / Hybrid / On-site |
| Salary Range | Auto-extracted if listed |
| Job URL | Direct link to the listing |
| Hiring Manager | Name if shown on listing |
| Manager Profile URL | LinkedIn profile link |
| Notes | Your quick note from right-click menu |
| Date Applied | Add manually in export |
| Interview Date | Add manually in export |
| Offer | Add manually in export |
| Follow-Up Notes | Add manually in export |

**All data is stored locally in your browser.** Export to CSV anytime to create a backup or work with it in spreadsheets.

---

## 🔧 Troubleshooting

**Button not appearing?**
- Make sure you're on `linkedin.com/jobs/...` (the jobs section)
- Try scrolling to the job detail panel — wait for it to load fully
- Refresh the page

**Where is my data stored?**
- Your data is saved in your browser's local storage (IndexedDB)
- It persists even if you close Chrome
- Export to CSV regularly as a backup

**Can I sync between devices?**
- Not directly — data stays in each browser
- Export CSV from one device, import to your spreadsheet on another

**LinkedIn changed its layout and scraping broke?**
- LinkedIn occasionally changes their CSS class names
- The extension will still save the URL even if other fields fail to extract
- Check for updates to this extension

---

## 🛠️ Tech Stack

- **Manifest V3** Chrome Extension
- **chrome.storage.local** for offline data persistence
- **CSV Export** with RFC 4180 formatting for Excel compatibility
- **MutationObserver** for LinkedIn SPA navigation detection
- Vanilla JS — no frameworks, no bundler needed

---

## 📁 File Structure

```
jobtracker/
├── manifest.json              # Extension config & permissions
├── background/
│   └── background.js          # Service worker: local storage, CSV export
├── content/
│   ├── content.js             # LinkedIn scraper + button injection
│   └── content.css            # Injected styles
├── popup/
│   ├── popup.html             # Extension popup (stats dashboard)
│   ├── popup.js               # Popup logic
│   └── popup.css              # Popup styles
├── viewer/
│   ├── viewer.html            # Full job list page
│   ├── viewer.js              # View, edit, delete jobs
│   └── viewer.css             # Table styles
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md                  # This file
```

---

## License & Disclaimer

**Free to use, free to modify, free to distribute.**

Built by Jayadev as a productivity tool for job seekers. Feel free to fork, improve, and share it.

The developer (Jayadev) is **not liable in any way** for your use of this extension. Your Google credentials and sheet data are your own responsibility. This extension does not transmit data anywhere except the Google APIs you explicitly authorize.

---

*Good luck with your job search! You've got this.*
