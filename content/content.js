// ============================================================
// JobTracker — Content Script for LinkedIn
// Scrapes job data, injects Save button, shows toast notifications
// Built by Jayadev | Free to use and modify. Good luck! 🚀
// ============================================================

(function () {
  'use strict';

  // Prevent double injection
  if (window.__jobTrackerInjected) return;
  window.__jobTrackerInjected = true;

  // ── State ────────────────────────────────────────────────────
  const state = {
    currentJobId: null,
    savedJobs: new Map(),     // jobId → { dateAdded, status }
    notesPending: null,
  };

  // ── Selectors (ordered by specificity / reliability) ────────
  const SEL = {
    jobTitle: [
      '.job-details-jobs-unified-top-card__job-title h1',
      '.job-details-jobs-unified-top-card__job-title a',
      '.jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title',
      'h1.t-24.t-bold',
      '.job-view-layout h1',
      '[data-test-job-title]',
      'h1',
    ],
    company: [
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
      '[data-test-company-name]',
    ],
    location: [
      '.job-details-jobs-unified-top-card__primary-description-container .tvm__text:first-child',
      '.job-details-jobs-unified-top-card__primary-description .tvm__text:first-child',
      '.job-details-jobs-unified-top-card__primary-description',
      '.job-details-jobs-unified-top-card__subtitle .tvm__text:first-child',
      '.job-details-jobs-unified-top-card__subtitle',
      '.jobs-unified-top-card__subtitle',
      '.jobs-unified-top-card__bullet',
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__subtitle-bullet',
      '[data-test-job-location]',
      '.topcard__flavor--bullet',
    ],
    workplace: [
      '.job-details-jobs-unified-top-card__workplace-type',
      '.jobs-unified-top-card__workplace-type',
      '.jobs-unified-top-card__job-insight span',
      '[data-test-workplace-type]',
    ],
    salary: [
      '.job-details-jobs-unified-top-card__salary-main-rail-card',
      '.jobs-unified-top-card__salary-main-rail-card',
      '.compensation__salary',
      '[data-test-salary-info]',
      '.jobs-unified-top-card__job-insight--highlight',
    ],
    hiringManager: [
      '.hirer-card__hirer-information .hoverable-link-text',
      '.hirer-card__hirer-information span',
      '.hiring-team .hoverable-link-text',
      '[data-test-hiring-manager-name]',
    ],
    hiringManagerProfile: [
      '.hirer-card__hirer-information a[href*="/in/"]',
      '.hiring-team a[href*="/in/"]',
    ],
    applyButton: [
      '.jobs-apply-button',
      '.jobs-s-apply button',
      '.job-details-jobs-unified-top-card__container--two-pane .jobs-apply-button',
      '[data-control-name="jobdetails_topcard_inapply"]',
      '[data-job-id] .jobs-apply-button',
      '.jobs-unified-top-card__content--two-pane .jobs-apply-button',
      // Full tab view selectors (no two-pane layout)
      '.job-view-layout .jobs-apply-button',
      '.jobs-details__main-content .jobs-apply-button',
      '.scaffold-layout__main .jobs-apply-button',
    ],
    saveButton: [
      'button[data-view-name*="job-save"]',
      '.jobs-save-button',
      'button.jobs-save-button',
      // Full tab view
      '.job-view-layout button[data-view-name*="job-save"]',
      '.scaffold-layout__main .jobs-save-button',
    ],
    topCardContainer: [
      '.job-details-jobs-unified-top-card__container--two-pane',
      '.jobs-unified-top-card__content--two-pane',
      '.jobs-s-apply',
      '.jobs-unified-top-card__content',
      '.jobs-details__main-content .jobs-unified-top-card',
      // Full tab view
      '.job-view-layout .jobs-unified-top-card',
      '.scaffold-layout__main .jobs-unified-top-card',
      '.job-details-jobs-unified-top-card',
    ],
    actionButtonsArea: [
      '.jobs-s-apply',
      '.jobs-apply-button-container',
      '.job-details-jobs-unified-top-card__primary-description-container',
      '.jobs-unified-top-card__content--two-pane .mt4',
      // Full tab view
      '.job-view-layout .jobs-apply-button-container',
      '.job-view-layout .jobs-s-apply',
      '.job-details-jobs-unified-top-card__actions',
    ],
  };

  // ── DOM query helpers ────────────────────────────────────────
  function $first(selectors, root = document) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el) return el;
    }
    return null;
  }

  function cleanText(el) {
    if (!el) return '';
    return el.innerText?.trim().replace(/\s+/g, ' ') || '';
  }

  // ── Get current job ID from URL ──────────────────────────────
  function getCurrentJobId() {
    const url = window.location.href;
    const match = url.match(/currentJobId=(\d+)/) || url.match(/\/jobs\/view\/(\d+)/);
    return match ? match[1] : null;
  }

  function getCleanJobUrl() {
    const jobId = getCurrentJobId();
    if (jobId) return `https://www.linkedin.com/jobs/view/${jobId}/`;
    return window.location.href.split('?')[0];
  }

  // ── Scrape job data from the current page ────────────────────
  function scrapeJobData() {
    const title        = cleanText($first(SEL.jobTitle));
    const company      = cleanText($first(SEL.company));
    const locationEl   = $first(SEL.location);
    const workplaceEl  = $first(SEL.workplace);
    const salaryEl     = $first(SEL.salary);
    const managerEl    = $first(SEL.hiringManager);
    const managerLinkEl= $first(SEL.hiringManagerProfile);

    // Location extraction - handle various LinkedIn formats
    let location = '';
    let workplaceType = '';
    
    if (locationEl) {
      const fullText = cleanText(locationEl);
      // Try to find location pattern: "City, State" or "City, Country" or just "City"
      // Common patterns: "San Francisco, CA", "New York, United States", "Remote"
      
      // Check for separator patterns first
      const separators = ['·', '(', '—', '•'];
      let foundSeparator = false;
      
      for (const sep of separators) {
        if (fullText.includes(sep)) {
          const parts = fullText.split(sep).map(p => p.trim()).filter(p => p);
          if (parts.length >= 2) {
            // First part is usually location
            location = parts[0];
            // Check remaining parts for workplace type
            const remainingText = parts.slice(1).join(' ').toLowerCase();
            if (remainingText.includes('remote') || remainingText.includes('hybrid') || remainingText.includes('on-site') || remainingText.includes('onsite')) {
              workplaceType = parts[1].replace(/[()]/g, '').trim();
            }
            foundSeparator = true;
            break;
          }
        }
      }
      
      // If no separator found, use the whole text as location (unless it looks like workplace only)
      if (!foundSeparator) {
        const textLower = fullText.toLowerCase();
        if (textLower === 'remote' || textLower === 'hybrid' || textLower === 'on-site' || textLower === 'onsite') {
          workplaceType = fullText;
          location = 'Not specified';
        } else {
          location = fullText;
        }
      }
    }
    
    // Fallback: Try to extract from subtitle container if location is still empty
    // LinkedIn often puts "Company · Location · Workplace" in the subtitle
    if (!location) {
      const subtitleContainer = document.querySelector('.job-details-jobs-unified-top-card__subtitle, .jobs-unified-top-card__subtitle');
      if (subtitleContainer) {
        const subtitleText = cleanText(subtitleContainer);
        // Pattern: "Company · Location · Remote" or "Company · Location (Remote)"
        const parts = subtitleText.split(/[·•]/).map(p => p.trim()).filter(p => p);
        if (parts.length >= 2) {
          // parts[0] is company, parts[1] is usually location
          const possibleLocation = parts[1];
          // Verify it looks like a location (contains comma or is not a workplace type)
          const lowerLoc = possibleLocation.toLowerCase();
          if (!['remote', 'hybrid', 'on-site', 'onsite'].includes(lowerLoc)) {
            location = possibleLocation;
          }
          // Check parts[2] for workplace type if exists
          if (parts.length >= 3) {
            const wpLower = parts[2].toLowerCase().replace(/[()]/g, '');
            if (wpLower.includes('remote') || wpLower.includes('hybrid') || wpLower.includes('on-site') || wpLower.includes('onsite')) {
              workplaceType = parts[2].replace(/[()]/g, '').trim();
            }
          }
        }
      }
    }
    
    // Get workplace type if not already extracted
    if (!workplaceType && workplaceEl) {
      workplaceType = cleanText(workplaceEl);
    }
    
    // Normalize workplace type
    const wpLower = workplaceType.toLowerCase();
    if (wpLower.includes('remote')) workplaceType = 'Remote';
    else if (wpLower.includes('hybrid')) workplaceType = 'Hybrid';
    else if (wpLower.includes('on-site') || wpLower.includes('onsite')) workplaceType = 'On-site';

    // Salary - try to find range pattern
    let salary = cleanText(salaryEl);
    if (!salary) {
      // Fallback: look for $ patterns in description
      const descEl = document.querySelector('.jobs-description__content');
      if (descEl) {
        const match = descEl.innerText.match(/\$[\d,]+(?:k|K)?(?:\s*[-–—]\s*\$[\d,]+(?:k|K)?)?(?:\s*(?:per year|\/yr|annually))?/);
        if (match) salary = match[0].trim();
      }
    }

    const hiringManager = cleanText(managerEl);
    const managerProfileUrl = managerLinkEl?.href || '';

    // Debug logging
    console.log('[JobTracker] Scraped:', { title, company, location, workplaceType });

    return {
      title,
      company,
      location,
      workplaceType,
      salary,
      hiringManager,
      managerProfileUrl,
      url: getCleanJobUrl(),
    };
  }

  // ── Find best button injection point ────────────────────────
  function findInjectionPoint() {
    // Prefer inserting next to apply button
    const applyBtn = $first(SEL.applyButton);
    if (applyBtn) {
      console.log('[JobTracker] Found injection point: apply button');
      return { anchor: applyBtn, position: 'afterend' };
    }

    const saveBtn = $first(SEL.saveButton);
    if (saveBtn) {
      console.log('[JobTracker] Found injection point: save button');
      return { anchor: saveBtn, position: 'afterend' };
    }

    const actionArea = $first(SEL.actionButtonsArea);
    if (actionArea) {
      console.log('[JobTracker] Found injection point: action area');
      return { anchor: actionArea, position: 'beforeend' };
    }

    // Last resort: find any button container in the top card area
    const topCard = document.querySelector('.job-details-jobs-unified-top-card, .jobs-unified-top-card');
    if (topCard) {
      // Try to find any button row
      const buttonRow = topCard.querySelector('[class*="button"], [class*="action"], .mt4, .mt5');
      if (buttonRow) {
        console.log('[JobTracker] Found injection point: top card button row');
        return { anchor: buttonRow, position: 'afterend' };
      }
      // Try to find the primary description container as anchor
      const descContainer = topCard.querySelector('.job-details-jobs-unified-top-card__primary-description-container, .jobs-unified-top-card__primary-description');
      if (descContainer) {
        console.log('[JobTracker] Found injection point: description container');
        return { anchor: descContainer, position: 'afterend' };
      }
    }

    console.log('[JobTracker] No injection point found!');
    return null;
  }

  // ── Build the Save button ─────────────────────────────────────
  function createSaveButton() {
    const wrapper = document.createElement('div');
    wrapper.id = 'jt-btn-wrapper';
    wrapper.innerHTML = `
      <button id="jt-save-btn" class="jt-btn jt-btn--idle" title="Save to JobTracker">
        <svg class="jt-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="11" x2="12" y2="17"/>
          <line x1="9" y1="14" x2="15" y2="14"/>
        </svg>
        <span class="jt-btn-text">Save to Tracker</span>
        <span class="jt-btn-meta"></span>
      </button>
      <div id="jt-status-menu" class="jt-status-menu">
        <div class="jt-status-menu__header">Save as…</div>
        <button class="jt-status-opt" data-status="🔖 Saved">🔖 Save for Later</button>
        <button class="jt-status-opt" data-status="✅ Applied — LinkedIn">✅ Applied on LinkedIn</button>
        <button class="jt-status-opt" data-status="✅ Applied — Company Site">✅ Applied on Company Site</button>
        <div class="jt-status-menu__divider"></div>
        <label class="jt-notes-label">Quick Note:</label>
        <textarea class="jt-notes-input" id="jt-notes-field" placeholder="e.g. Ask Dave for a referral…" rows="2"></textarea>
        <button class="jt-status-opt jt-status-opt--primary" id="jt-confirm-save">💾 Save Now</button>
      </div>
    `;
    return wrapper;
  }

  // ── Toast notifications ───────────────────────────────────────
  let toastEl = null;
  let toastTimer = null;

  function ensureToast() {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'jt-toast';
      document.body.appendChild(toastEl);
    }
    return toastEl;
  }

  function showToast(message, type = 'success', duration = 4000, action = null) {
    const toast = ensureToast();
    clearTimeout(toastTimer);

    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';
    const actionHtml = action
      ? `<button class="jt-toast-action" id="jt-toast-action">${action.label}</button>`
      : '';

    toast.innerHTML = `
      <span class="jt-toast-icon">${icon}</span>
      <span class="jt-toast-msg">${message}</span>
      ${actionHtml}
      <button class="jt-toast-close">×</button>
    `;
    toast.className = `jt-toast jt-toast--${type} jt-toast--show`;

    toast.querySelector('.jt-toast-close')?.addEventListener('click', () => hideToast());
    if (action) {
      toast.querySelector('#jt-toast-action')?.addEventListener('click', () => {
        action.fn();
        hideToast();
      });
    }

    toastTimer = setTimeout(hideToast, duration);
  }

  function hideToast() {
    if (toastEl) toastEl.className = 'jt-toast';
    clearTimeout(toastTimer);
  }

  // ── Notes modal (right-click) ────────────────────────────────
  let menuVisible = false;
  let selectedStatus = '🔖 Saved';

  function openMenu(btn) {
    const menu = document.getElementById('jt-status-menu');
    if (!menu) return;
    selectedStatus = '🔖 Saved';
    menu.classList.add('jt-status-menu--open');
    menuVisible = true;
    document.getElementById('jt-notes-field')?.focus();

    // Highlight default
    document.querySelectorAll('.jt-status-opt').forEach(b => b.classList.remove('jt-status-opt--selected'));
    document.querySelector('[data-status="🔖 Saved"]')?.classList.add('jt-status-opt--selected');
  }

  function closeMenu() {
    document.getElementById('jt-status-menu')?.classList.remove('jt-status-menu--open');
    menuVisible = false;
  }

  // ── Set button to saved state ────────────────────────────────
  function setSavedState(btn, info) {
    if (!btn) return;
    btn.classList.remove('jt-btn--idle', 'jt-btn--loading');
    btn.classList.add('jt-btn--saved');
    const metaEl = btn.querySelector('.jt-btn-meta');
    if (metaEl && info?.dateAdded) metaEl.textContent = info.dateAdded;
    btn.querySelector('.jt-btn-text').textContent = 'Saved';
    btn.title = info?.dateAdded ? `Saved on ${info.dateAdded}` : 'Already saved';
  }

  function setIdleState(btn) {
    if (!btn) return;
    btn.classList.remove('jt-btn--saved', 'jt-btn--loading', 'jt-btn--error');
    btn.classList.add('jt-btn--idle');
    btn.querySelector('.jt-btn-text').textContent = 'Save to Tracker';
    btn.querySelector('.jt-btn-meta').textContent = '';
    btn.title = 'Save to JobTracker';
  }

  function setLoadingState(btn) {
    if (!btn) return;
    btn.classList.remove('jt-btn--idle', 'jt-btn--saved', 'jt-btn--error');
    btn.classList.add('jt-btn--loading');
    btn.querySelector('.jt-btn-text').textContent = 'Saving…';
  }

  // ── Core save action ─────────────────────────────────────────
  async function saveJob(status = '🔖 Saved') {
    const btn = document.getElementById('jt-save-btn');
    closeMenu();
    setLoadingState(btn);

    const jobData = scrapeJobData();
    if (!jobData.title && !jobData.company) {
      setIdleState(btn);
      showToast('Could not detect job details. Try scrolling to the job listing first.', 'warning');
      return;
    }

    // Attach notes + status
    const notesInput = document.getElementById('jt-notes-field');
    jobData.notes = notesInput?.value?.trim() || '';
    jobData.status = status;

    try {
      const response = await chrome.runtime.sendMessage({ type: 'SAVE_JOB', jobData });

      if (!response.success) throw new Error(response.error);

      // Cache result
      const jobId = getCurrentJobId() || getCleanJobUrl();
      state.savedJobs.set(jobId, {
        dateAdded: response.job?.dateAdded || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status,
      });

      setSavedState(btn, state.savedJobs.get(jobId));

      const actionText = response.isUpdate ? 'Updated' : 'Saved';
      const totalText = response.totalJobs ? ` (${response.totalJobs} total)` : '';
      showToast(
        `${actionText}: ${jobData.title} at ${jobData.company}${totalText}`,
        'success',
        4000
      );

    } catch (err) {
      setIdleState(btn);
      const msg = err.message || String(err);
      showToast(`Save failed: ${msg}`, 'error', 6000);
    }
  }

  // ── Inject the button into LinkedIn's UI ─────────────────────
  function injectButton() {
    // Remove old button if present
    document.getElementById('jt-btn-wrapper')?.remove();

    const injection = findInjectionPoint();
    if (!injection) return false;

    const { anchor, position } = injection;
    const wrapper = createSaveButton();
    anchor.insertAdjacentElement(position, wrapper);

    // Wire up events
    const btn = document.getElementById('jt-save-btn');

    // Left click → quick save with default status
    btn.addEventListener('click', (e) => {
      if (menuVisible) { closeMenu(); return; }
      if (btn.classList.contains('jt-btn--saved') || btn.classList.contains('jt-btn--loading')) return;
      saveJob('🔖 Saved');
    });

    // Right-click or long-press → open menu
    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (btn.classList.contains('jt-btn--saved') || btn.classList.contains('jt-btn--loading')) return;
      openMenu(btn);
    });

    // Long press support for touch
    let pressTimer = null;
    btn.addEventListener('touchstart', () => {
      pressTimer = setTimeout(() => openMenu(btn), 500);
    });
    btn.addEventListener('touchend', () => clearTimeout(pressTimer));

    // Status option clicks
    document.querySelectorAll('.jt-status-opt[data-status]').forEach(opt => {
      opt.addEventListener('click', () => {
        document.querySelectorAll('.jt-status-opt').forEach(b => b.classList.remove('jt-status-opt--selected'));
        opt.classList.add('jt-status-opt--selected');
        selectedStatus = opt.dataset.status;
      });
    });

    // Confirm save button
    document.getElementById('jt-confirm-save')?.addEventListener('click', () => {
      saveJob(selectedStatus);
    });

    // Click outside → close menu
    document.addEventListener('click', (e) => {
      if (menuVisible && !document.getElementById('jt-btn-wrapper')?.contains(e.target)) {
        closeMenu();
      }
    });

    return true;
  }

  // ── Check saved status for current job ───────────────────────
  async function checkSavedStatus() {
    const jobId = getCurrentJobId();
    const url   = getCleanJobUrl();

    if (state.savedJobs.has(jobId || url)) {
      const btn = document.getElementById('jt-save-btn');
      setSavedState(btn, state.savedJobs.get(jobId || url));
      return;
    }

    try {
      const res = await chrome.runtime.sendMessage({ type: 'CHECK_SAVED', url });
      if (res?.saved && res?.info) {
        state.savedJobs.set(jobId || url, res.info);
        const btn = document.getElementById('jt-save-btn');
        setSavedState(btn, res.info);
      }
    } catch {
      // Silently fail - check is non-critical
    }
  }

  // ── SPA navigation observer ───────────────────────────────────
  let injectDebounce = null;

  function onNavigate() {
    clearTimeout(injectDebounce);
    injectDebounce = setTimeout(async () => {
      const jobId = getCurrentJobId();
      console.log('[JobTracker] onNavigate called, jobId:', jobId, 'url:', location.href);

      if (!jobId) {
        console.log('[JobTracker] No job ID found, skipping injection');
        return;
      }

      if (jobId === state.currentJobId) {
        console.log('[JobTracker] Same job ID, skipping');
        return;
      }
      state.currentJobId = jobId;

      // Wait for LinkedIn's content to render
      const foundElement = await waitForElement(SEL.applyButton.concat(SEL.saveButton), 5000);
      console.log('[JobTracker] Wait for element result:', foundElement?.tagName, foundElement?.className);

      const injected = injectButton();
      console.log('[JobTracker] Injection result:', injected);

      if (injected) {
        checkSavedStatus();
      }
    }, 600);
  }

  function waitForElement(selectors, timeout = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const interval = setInterval(() => {
        const el = $first(selectors);
        if (el || Date.now() - start > timeout) {
          clearInterval(interval);
          resolve(el);
        }
      }, 200);
    });
  }

  // Watch URL changes (LinkedIn is a SPA)
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onNavigate();
    }
  });
  urlObserver.observe(document.body, { subtree: true, childList: true });

  // Also watch for job panel content changes
  const contentObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.addedNodes.length) {
        const hasApplyBtn = $first(SEL.applyButton.concat(SEL.saveButton));
        const hasOurBtn   = document.getElementById('jt-save-btn');
        if (hasApplyBtn && !hasOurBtn) {
          onNavigate();
          break;
        }
      }
    }
  });
  contentObserver.observe(document.body, { subtree: true, childList: true });

  // ── Boot ─────────────────────────────────────────────────────
  function boot() {
    const url = location.href;
    console.log('[JobTracker] === BOOT START ===');
    console.log('[JobTracker] URL:', url);

    // Check if this is a direct job view URL (full tab)
    const isDirectJobView = url.includes('/jobs/view/');
    console.log('[JobTracker] isDirectJobView:', isDirectJobView);
    
    // Initial delay for LinkedIn's render
    const initialDelay = isDirectJobView ? 3000 : 1500;
    console.log('[JobTracker] Starting timer:', initialDelay, 'ms');
    
    setTimeout(function() {
      console.log('[JobTracker] === DELAY COMPLETE ===');
      console.log('[JobTracker] Calling onNavigate...');
      onNavigate();
      
      // Set up retries for full tab views
      if (isDirectJobView) {
        console.log('[JobTracker] Setting up full tab retries...');
        [3000, 6000, 9000].forEach(function(delay) {
          setTimeout(function() {
            try {
              const hasBtn = document.getElementById('jt-save-btn');
              const hasApply = $first(SEL.applyButton);
              const hasSave = $first(SEL.saveButton);
              console.log('[JobTracker] Retry (' + delay + 'ms): hasBtn=' + !!hasBtn + ', hasApply=' + !!hasApply + ', hasSave=' + !!hasSave);
              
              if (!hasBtn && (hasApply || hasSave)) {
                console.log('[JobTracker] Retrying injection...');
                state.currentJobId = null;
                onNavigate();
              }
            } catch (e) {
              console.error('[JobTracker] Retry error:', e);
            }
          }, delay);
        });
      }
    }, initialDelay);
  }

  // Start boot sequence
  boot();
  console.log('[JobTracker] Content script loaded. Built by Jayadev');
})();
