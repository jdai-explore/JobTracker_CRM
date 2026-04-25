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
      // Generic fallbacks for hashed-class layouts (full-tab view)
      '.jobs-details h1',
      '.scaffold-layout__detail h1',
      'main h1',
      'h1',
    ],
    company: [
      '.job-details-jobs-unified-top-card__company-name a',
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
      '[data-test-company-name]',
      // Note: bare a[href*="/company/"] is intentionally omitted here —
      // it's too broad (would match nav/sidebar). The h1-proximity walk
      // in scrapeJobData() handles the hashed-class full-tab layout instead.
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
      // Generic fallbacks for full-tab hashed-class layout
      '.jobs-details-top-card__subtitle .tvm__text',
      '.jobs-details-top-card__subtitle',
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
      // Additional full-tab selectors
      '.jobs-apply-button--top-card',
      'button[data-job-id]',
      '.jobs-details-top-card__apply-button',
    ],
    saveButton: [
      'button[data-view-name*="job-save"]',
      '.jobs-save-button',
      'button.jobs-save-button',
      // Full tab view
      '.job-view-layout button[data-view-name*="job-save"]',
      '.scaffold-layout__main .jobs-save-button',
      'button[aria-label*="Save"]',
      'button[aria-label*="save"]',
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
      // Direct view layout
      '.jobs-details__main-content',
      '.scaffold-layout__detail',
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
      // Broader fallbacks for direct view
      '.jobs-details-top-card__actions',
      '.artdeco-card .jobs-s-apply',
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

  // ── Parse title/company from the browser tab title ──────────
  // LinkedIn always sets: "<Job Title> at <Company> | LinkedIn"
  // or: "<Job Title> - <Company> | LinkedIn"
  function parseTitleFromPageTitle() {
    const raw = document.title || '';
    // Strip trailing " | LinkedIn" or " - LinkedIn"
    const stripped = raw.replace(/\s*[|–—-]\s*LinkedIn\s*$/i, '').trim();
    // Split on " at " (most common) then " - "
    const atIdx = stripped.lastIndexOf(' at ');
    if (atIdx > 0) {
      return {
        title:   stripped.slice(0, atIdx).trim(),
        company: stripped.slice(atIdx + 4).trim(),
      };
    }
    const dashIdx = stripped.lastIndexOf(' - ');
    if (dashIdx > 0) {
      return {
        title:   stripped.slice(0, dashIdx).trim(),
        company: stripped.slice(dashIdx + 3).trim(),
      };
    }
    // Can't split — treat whole thing as title
    return { title: stripped, company: '' };
  }

  // ── Scrape job data from the current page ────────────────────
  function scrapeJobData() {
    let title        = cleanText($first(SEL.jobTitle));
    let company      = cleanText($first(SEL.company));
    const locationEl   = $first(SEL.location);
    const workplaceEl  = $first(SEL.workplace);
    const salaryEl     = $first(SEL.salary);
    const managerEl    = $first(SEL.hiringManager);
    const managerLinkEl= $first(SEL.hiringManagerProfile);

    // ── Fallback: parse document.title when DOM selectors yield nothing ──
    // This is highly reliable on full-tab /jobs/view/ pages because LinkedIn
    // always sets the tab title to "<Job Title> at <Company> | LinkedIn".
    if (!title || !company) {
      const parsed = parseTitleFromPageTitle();
      if (!title && parsed.title)    title   = parsed.title;
      if (!company && parsed.company) company = parsed.company;
      if (parsed.title || parsed.company) {
        console.log('[JobTracker] Used document.title fallback:', parsed);
      }
    }

    // ── Fallback: company from nearest /company/ link to the h1 ──
    if (!company) {
      const h1 = document.querySelector('h1');
      if (h1) {
        // Walk up the DOM from h1 looking for a sibling/cousin company link
        let node = h1.parentElement;
        for (let depth = 0; depth < 5 && node; depth++, node = node.parentElement) {
          const compLink = node.querySelector('a[href*="/company/"]');
          if (compLink) { company = cleanText(compLink); break; }
        }
      }
    }

    // ── Fallback: location from subtitle area near h1 ──────────────
    // On full-tab pages LinkedIn renders: Company · Location · Workplace
    // in a text row near the h1. We read the .tvm__text spans or the whole
    // subtitle text and parse out the parts.
    let locationFromSubtitle = '';
    if (!locationEl) {
      const h1 = document.querySelector('h1');
      if (h1) {
        let node = h1.parentElement;
        for (let depth = 0; depth < 8 && node; depth++, node = node.parentElement) {
          // Look for a subtitle-style container: contains '·' or '•' separated text
          const spans = node.querySelectorAll('.tvm__text, [class*="subtitle"] span, [class*="description"] span');
          if (spans.length >= 2) {
            // Pick first span that looks like a location (not a number, not workplace type)
            for (const span of spans) {
              const t = span.innerText?.trim();
              if (!t) continue;
              const tl = t.toLowerCase();
              // Skip workplace-type-only or number-only strings
              if (['remote', 'hybrid', 'on-site', 'onsite'].includes(tl)) continue;
              if (/^\d+$/.test(t)) continue;
              // Skip if it looks like applicant count (e.g. "42 applicants")
              if (tl.includes('applicant') || tl.includes('follower')) continue;
              locationFromSubtitle = t;
              break;
            }
            if (locationFromSubtitle) break;
          }
          // Also try reading full text with '·' separator
          const fullInner = node.innerText?.trim();
          if (fullInner && fullInner.includes('·') && node.children.length <= 6) {
            const parts = fullInner.split('·').map(p => p.trim()).filter(p => p);
            // parts[0] likely company (skip), parts[1] likely location
            if (parts.length >= 2) {
              const possLoc = parts[1];
              const pl = possLoc.toLowerCase();
              if (!['remote', 'hybrid', 'on-site', 'onsite'].includes(pl) &&
                  !pl.includes('applicant') && !pl.includes('follower')) {
                locationFromSubtitle = possLoc;
                break;
              }
            }
          }
        }
      }
    }

    // Location extraction - handle various LinkedIn formats
    let location = '';
    let workplaceType = '';
    
    if (locationEl) {
      const fullText = cleanText(locationEl);
      const separators = ['·', '(', '—', '•'];
      let foundSeparator = false;
      
      for (const sep of separators) {
        if (fullText.includes(sep)) {
          const parts = fullText.split(sep).map(p => p.trim()).filter(p => p);
          if (parts.length >= 2) {
            location = parts[0];
            const remainingText = parts.slice(1).join(' ').toLowerCase();
            if (remainingText.includes('remote') || remainingText.includes('hybrid') || remainingText.includes('on-site') || remainingText.includes('onsite')) {
              workplaceType = parts[1].replace(/[()]/g, '').trim();
            }
            foundSeparator = true;
            break;
          }
        }
      }
      
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

    // Apply the subtitle fallback if DOM selectors found nothing
    if (!location && locationFromSubtitle) {
      location = locationFromSubtitle;
      console.log('[JobTracker] Used subtitle proximity fallback for location:', location);
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
  //
  // KEY INSIGHT: LinkedIn wraps each action button in its own container:
  //   <div class="action-row">          ← flex parent (the row)
  //     <span class="apply-wrapper">    ← flex child 1
  //       <button>Easy Apply</button>
  //     </span>
  //     <span class="save-wrapper">     ← flex child 2
  //       <button aria-label="Save">💾</button>
  //     </span>
  //   </div>
  //
  // If we do afterend on <button aria-label="Save">, our div lands INSIDE
  // <span class="save-wrapper"> — which is why it visually overlaps the
  // Save button.
  //
  // The fix: walk UP from the button until we reach the element whose
  // PARENT is a flex/grid container — that's the correct flex-child level
  // to insert afterend, making our wrapper a true peer sibling in the row.
  // ─────────────────────────────────────────────────────────────
  function findFlexSibling(btn) {
    // Start at btn.parentElement, NOT btn itself.
    // Reason: LinkedIn wraps each button in its own div/span that IS already
    // a flex container. Starting at btn would return the raw <button> at depth=0,
    // causing afterend to insert inside that wrapper (the overlap bug).
    // Starting one level up means we correctly identify the wrapper div as the
    // flex child of the outer action row, so afterend puts us after it.
    let node = btn.parentElement || btn;
    for (let depth = 0; depth < 8 && node && node.parentElement && node !== document.body; depth++) {
      const parentDisplay = window.getComputedStyle(node.parentElement).display;
      if (parentDisplay === 'flex' || parentDisplay === 'inline-flex' || parentDisplay === 'grid') {
        console.log('[JobTracker] findFlexSibling: depth=' + depth + ' tag=' + node.tagName + ' class=' + (node.className?.toString().slice(0,40)));
        return node;
      }
      node = node.parentElement;
    }
    // Fallback: immediate parent of the button
    return btn.parentElement || btn;
  }

  function findInjectionPoint() {
    // ── Priority 1: Append to the action area container (Safe & Stealthy) ──
    // By appending to the end of the container, we avoid interfering with 
    // LinkedIn's index-based DOM logic for its primary buttons.
    const actionArea = $first(SEL.actionButtonsArea);
    if (actionArea) {
      console.log('[JobTracker] Injection: beforeend action area');
      return { anchor: actionArea, position: 'beforeend' };
    }

    // ── Priority 2: AFTER LinkedIn's native Save button (Fallback) ───────
    const saveBtn = $first(SEL.saveButton);
    if (saveBtn) {
      const anchor = findFlexSibling(saveBtn);
      console.log('[JobTracker] Injection: afterend Save flex-sibling', anchor?.tagName);
      return { anchor, position: 'afterend' };
    }

    // ── Priority 3: AFTER Apply button ───────────────────────────
    const applyBtn = $first(SEL.applyButton);
    if (applyBtn) {
      const anchor = findFlexSibling(applyBtn);
      console.log('[JobTracker] Injection: afterend Apply flex-sibling', anchor?.tagName);
      return { anchor, position: 'afterend' };
    }

    // ── Last resort: top card ─────────────────────────────────────
    const topCard = document.querySelector('.job-details-jobs-unified-top-card, .jobs-unified-top-card');
    if (topCard) {
      const buttonRow = topCard.querySelector('[class*="button"], [class*="action"], .mt4, .mt5');
      if (buttonRow) {
        console.log('[JobTracker] Injection: beforeend top card button row');
        return { anchor: buttonRow, position: 'beforeend' };
      }
    }

    console.log('[JobTracker] No injection point found!');
    return null;
  }

  // ── Build the Save button ─────────────────────────────────────
  function createSaveButton() {
    const wrapper = document.createElement('div');
    wrapper.id = 'jt-btn-wrapper';
    // Add a marker to help LinkedIn's tracking scripts ignore this branch if possible
    wrapper.setAttribute('data-jt-ignore', 'true');
    
    // Using a <div> with role="button" instead of a <button> tag.
    // Removed LinkedIn-like attributes (data-control-name) to avoid triggering 
    // their internal tracking/rule engine logic.
    wrapper.innerHTML = `
      <div id="jt-save-btn" class="jt-btn jt-btn--idle" title="Save to JobTracker" role="button" tabindex="0" data-jt-custom="true">
        <svg class="jt-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="11" x2="12" y2="17"/>
          <line x1="9" y1="14" x2="15" y2="14"/>
        </svg>
        <span class="jt-btn-text">Save to Tracker</span>
        <span class="jt-btn-meta"></span>
      </div>
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

    // On full-tab /jobs/view/ pages the h1 may not be in the DOM yet when
    // the button is first clicked (button injects as soon as any anchor is
    // found). Wait up to 4 s for the h1 before attempting to scrape.
    const isDirectView = window.location.href.includes('/jobs/view/');
    if (isDirectView) {
      const titleReady = await waitForElement(SEL.jobTitle, 4000);
      console.log('[JobTracker] saveJob: title element ready?', !!titleReady, titleReady?.tagName);
    }

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

    // Keyboard support (Enter/Space)
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
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

      // Skip only if the same job AND our button is already in the DOM.
      // On direct /jobs/view/ loads, observers may set currentJobId before
      // the page content is ready, so we must re-inject if button is missing.
      const btnAlreadyPresent = !!document.getElementById('jt-save-btn');
      if (jobId === state.currentJobId && btnAlreadyPresent) {
        console.log('[JobTracker] Same job ID and button already present, skipping');
        return;
      }
      state.currentJobId = jobId;

      // Build the full selector list including top-card containers as fallbacks
      const waitSelectors = SEL.applyButton
        .concat(SEL.saveButton)
        .concat(SEL.topCardContainer)
        .concat(SEL.actionButtonsArea);

      // Wait for LinkedIn's content to render
      const foundElement = await waitForElement(waitSelectors, 8000);
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
      }, 1000); // 1s interval is much lighter on the CPU/engine
    });
  }

  // ── Unified Observer ──────────────────────────────────────────
  let lastUrl = location.href;
  let isBooting = false;

  const observer = new MutationObserver(() => {
    if (isBooting) return;

    // 1. URL Change detection
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      onNavigate();
      return;
    }

    // 2. Passive content check
    const hasApplyBtn = $first(SEL.applyButton.concat(SEL.saveButton));
    if (hasApplyBtn && !document.getElementById('jt-save-btn')) {
      onNavigate();
    }
  });

  // Start observing only after a short delay to let LinkedIn's initial scripts settle
  setTimeout(() => {
    observer.observe(document.body, { subtree: true, childList: true });
  }, 2000);

  // ── Boot ─────────────────────────────────────────────────────
  //
  // For direct /jobs/view/<id>/ URLs the page is a full hard-load (not SPA
  // navigation). The URL/content MutationObservers fire many times during
  // render and can race ahead of the boot delay, pre-setting currentJobId so
  // that the boot's onNavigate() call thinks "same job, skip". We avoid this
  // by running a dedicated direct-injection path that:
  //   1. Waits for a meaningful element using waitForElement (up to 10 s)
  //   2. Calls injectButton() directly — bypassing the debounce and guard
  //   3. Falls back to periodic retries if the first attempt fails
  // ─────────────────────────────────────────────────────────────
  async function bootDirectView(jobId) {
    console.log('[JobTracker] bootDirectView: waiting for page elements...');

    const waitSelectors = SEL.applyButton
      .concat(SEL.saveButton)
      .concat(SEL.topCardContainer)
      .concat(SEL.actionButtonsArea);

    isBooting = true;
    const foundEl = await waitForElement(waitSelectors, 10000);
    console.log('[JobTracker] bootDirectView: foundEl =', foundEl?.tagName);

    state.currentJobId = jobId;
    const injected = injectButton();
    isBooting = false;
    console.log('[JobTracker] bootDirectView: injection result =', injected);

    if (injected) {
      checkSavedStatus();
      return;
    }

    // If still not injected, retry up to 3 times at 3-second intervals
    let retries = 0;
    const retryInterval = setInterval(() => {
      retries++;
      const hasBtn   = !!document.getElementById('jt-save-btn');
      const hasAnchor = !!$first(waitSelectors);
      console.log('[JobTracker] bootDirectView retry #' + retries + ': hasBtn=' + hasBtn + ', hasAnchor=' + hasAnchor);

      if (hasBtn) {
        clearInterval(retryInterval);
        return;
      }

      if (hasAnchor || retries >= 3) {
        clearInterval(retryInterval);
        state.currentJobId = null; // allow guard bypass
        const ok = injectButton();
        state.currentJobId = jobId;
        console.log('[JobTracker] bootDirectView retry injection:', ok);
        if (ok) checkSavedStatus();
      }
    }, 3000);
  }

  function boot() {
    const url = location.href;
    console.log('[JobTracker] === BOOT START ===');
    console.log('[JobTracker] URL:', url);

    // Check if this is a direct job view URL (full tab)
    const isDirectJobView = url.includes('/jobs/view/');
    console.log('[JobTracker] isDirectJobView:', isDirectJobView);

    if (isDirectJobView) {
      // Bypass the debounce/observer race entirely for direct views
      const jobId = getCurrentJobId();
      console.log('[JobTracker] Direct view job ID:', jobId);
      if (jobId) {
        bootDirectView(jobId);
      } else {
        // URL pattern matched but no ID extracted — fall back to normal path
        setTimeout(() => onNavigate(), 1500);
      }
    } else {
      // Normal SPA navigation — short delay then hand off to onNavigate
      const initialDelay = 1500;
      console.log('[JobTracker] Starting SPA timer:', initialDelay, 'ms');
      setTimeout(() => {
        console.log('[JobTracker] === DELAY COMPLETE ===');
        onNavigate();
      }, initialDelay);
    }
  }

  // Start boot sequence
  boot();
  console.log('[JobTracker] Content script loaded. Built by Jayadev');
})();
