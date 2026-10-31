// public/user/app.js
// Client logic for Captcha verification, Live Results display, All Results table, and SSE live sync

(function () {
  'use strict';

  // API Base URL
  const API_BASE = window.location.origin;

  // DOM Elements - Captcha Screen
  const captchaScreen = document.getElementById('captchaScreen');
  const captchaCode = document.getElementById('captchaCode');
  const captchaInput = document.getElementById('captchaInput');
  const btnRefreshCaptcha = document.getElementById('btnRefreshCaptcha');
  const btnSubmitCaptcha = document.getElementById('btnSubmitCaptcha');
  const captchaMsg = document.getElementById('captchaMsg');
  const btnExitCaptcha = document.getElementById('btnExitCaptcha');
  const versionLabel = document.getElementById('versionLabel');

  // DOM Elements - Live Screen
  const liveScreen = document.getElementById('liveScreen');
  const currentDateText = document.getElementById('currentDateText');
  const btnRefreshLive = document.getElementById('btnRefreshLive');
  const btnOpenAllResults = document.getElementById('btnOpenAllResults');
  const btnExitLive = document.getElementById('btnExitLive');
  const closedNotice = document.getElementById('closedNotice');
  const resultsGrid = document.getElementById('resultsGrid');
  const liveStatusText = document.getElementById('liveStatusText');
  const lastSyncTime = document.getElementById('lastSyncTime');

  // DOM Elements - 4 Cards
  const cardTimes = [
    document.getElementById('cardTime1'),
    document.getElementById('cardTime2'),
    document.getElementById('cardTime3'),
    document.getElementById('cardTime4')
  ];
  const cardCodes = [
    document.getElementById('cardCode1'),
    document.getElementById('cardCode2'),
    document.getElementById('cardCode3'),
    document.getElementById('cardCode4')
  ];

  // DOM Elements - All Results Modal
  const allResultsModal = document.getElementById('allResultsModal');
  const modalDateText = document.getElementById('modalDateText');
  const btnCloseAllResults = document.getElementById('btnCloseAllResults');
  const thEventCode = document.getElementById('thEventCode');
  const thYantraGroup = document.getElementById('thYantraGroup');
  const allResultsTableBody = document.getElementById('allResultsTableBody');

  // State
  let currentCaptchaToken = '';
  let eventSource = null;
  let activeSlot = null;

  // =========================================================================
  // CAPTCHA LOGIC
  // =========================================================================

  async function loadCaptcha() {
    try {
      captchaCode.textContent = '...';
      captchaMsg.textContent = '';
      const res = await fetch(`${API_BASE}/api/public/captcha?t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        currentCaptchaToken = data.captchaToken;
        captchaCode.textContent = data.captchaText;
        captchaInput.value = '';
        captchaInput.focus();
      } else {
        captchaCode.textContent = 'ERR';
      }
    } catch (e) {
      captchaCode.textContent = 'ERR';
      captchaMsg.textContent = 'Cannot connect to server';
    }
  }

  async function submitCaptcha() {
    const val = captchaInput.value.trim();
    if (!val) {
      showCaptchaError('Please enter captcha');
      return;
    }

    try {
      btnSubmitCaptcha.disabled = true;
      btnSubmitCaptcha.style.opacity = '0.7';

      const res = await fetch(`${API_BASE}/api/public/verify-captcha`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          captchaToken: currentCaptchaToken,
          userInput: val
        })
      });

      const data = await res.json();
      if (data.success) {
        // Success: transition to Live Results screen
        captchaScreen.classList.remove('active');
        liveScreen.classList.add('active');
        initLiveScreen();
      } else {
        showCaptchaError(data.message || 'Incorrect captcha');
        loadCaptcha();
      }
    } catch (e) {
      showCaptchaError('Network error. Try again.');
      loadCaptcha();
    } finally {
      btnSubmitCaptcha.disabled = false;
      btnSubmitCaptcha.style.opacity = '1';
    }
  }

  function showCaptchaError(msg) {
    captchaMsg.textContent = msg;
    captchaInput.style.borderColor = '#ff3838';
    captchaInput.animate(
      [
        { transform: 'translateX(-6px)' },
        { transform: 'translateX(6px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(0)' }
      ],
      { duration: 300 }
    );
  }

  // Event Listeners for Captcha
  btnRefreshCaptcha.addEventListener('click', loadCaptcha);
  btnSubmitCaptcha.addEventListener('click', submitCaptcha);
  captchaInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitCaptcha();
  });
  btnExitCaptcha.addEventListener('click', () => {
    captchaInput.value = '';
    loadCaptcha();
  });

  // =========================================================================
  // LIVE RESULTS SCREEN LOGIC
  // =========================================================================

  async function initLiveScreen() {
    await fetchStatus();
    await fetchLiveResults();
    connectSSE();
  }

  async function fetchStatus() {
    try {
      const res = await fetch(`${API_BASE}/api/public/status?t=${Date.now()}`);
      const data = await res.json();
      if (data.success) {
        currentDateText.textContent = data.currentDate;
        modalDateText.textContent = data.currentDate;
        activeSlot = data.activeSlot;
        if (data.settings) {
          if (data.settings.groupTitle) thYantraGroup.textContent = data.settings.groupTitle;
          if (data.settings.eventTitle) thEventCode.textContent = data.settings.eventTitle;
          if (data.settings.version) versionLabel.textContent = data.settings.version;
        }
      }
    } catch (e) {
      console.error('Error fetching status:', e);
    }
  }

  async function fetchLiveResults() {
    try {
      lastSyncTime.textContent = `Synced: ${new Date().toLocaleTimeString()}`;
      const res = await fetch(`${API_BASE}/api/public/live?t=${Date.now()}`);
      const data = await res.json();

      if (!data.isOpen) {
        // Outside operating hours
        closedNotice.style.display = 'flex';
        resultsGrid.style.display = 'none';
        return;
      }

      closedNotice.style.display = 'none';
      resultsGrid.style.display = 'grid';

      if (data.date) {
        currentDateText.textContent = data.date;
      }

      const displaySlot = data.slot || activeSlot || '08:30';

      if (data.cards && data.cards.length === 4) {
        for (let i = 0; i < 4; i++) {
          cardTimes[i].textContent = displaySlot;
          cardCodes[i].textContent = data.cards[i].code;
        }
      }
    } catch (e) {
      console.error('Error fetching live results:', e);
    }
  }

  // Connect Server-Sent Events (SSE) for Real-Time Updates
  function connectSSE() {
    if (eventSource) {
      eventSource.close();
    }

    try {
      eventSource = new EventSource(`${API_BASE}/api/public/stream`);

      eventSource.addEventListener('connected', () => {
        liveStatusText.textContent = 'Live Sync Connected';
      });

      eventSource.addEventListener('result_updated', (e) => {
        const payload = JSON.parse(e.data);
        console.log('[SSE] Live result updated:', payload);
        fetchLiveResults();
        if (allResultsModal.classList.contains('active')) {
          fetchAllResults();
        }
      });

      eventSource.addEventListener('result_cleared', () => {
        fetchLiveResults();
        if (allResultsModal.classList.contains('active')) {
          fetchAllResults();
        }
      });

      eventSource.addEventListener('settings_updated', () => {
        fetchStatus();
        fetchLiveResults();
      });

      eventSource.addEventListener('slot_transition', (e) => {
        fetchStatus();
        fetchLiveResults();
        if (allResultsModal.classList.contains('active')) {
          fetchAllResults();
        }
      });

      eventSource.onerror = () => {
        liveStatusText.textContent = 'Reconnecting...';
      };
    } catch (e) {
      console.error('SSE connection error:', e);
    }
  }

  // Button Listeners for Live Screen
  btnRefreshLive.addEventListener('click', () => {
    btnRefreshLive.style.transform = 'scale(0.92)';
    setTimeout(() => (btnRefreshLive.style.transform = 'none'), 120);
    fetchLiveResults();
  });

  btnExitLive.addEventListener('click', () => {
    liveScreen.classList.remove('active');
    captchaScreen.classList.add('active');
    loadCaptcha();
  });

  btnOpenAllResults.addEventListener('click', () => {
    allResultsModal.classList.add('active');
    fetchAllResults();
  });

  btnCloseAllResults.addEventListener('click', () => {
    allResultsModal.classList.remove('active');
  });

  // =========================================================================
  // ALL RESULTS TABLE LOGIC
  // =========================================================================

  async function fetchAllResults() {
    try {
      allResultsTableBody.innerHTML = `<tr><td colspan="5" style="padding: 20px; font-weight: bold;">Loading results...</td></tr>`;
      const res = await fetch(`${API_BASE}/api/public/results?t=${Date.now()}`);
      const data = await res.json();

      if (!data.success) {
        allResultsTableBody.innerHTML = `<tr><td colspan="5">Failed to load results</td></tr>`;
        return;
      }

      modalDateText.textContent = data.date;
      if (data.groupTitle) thYantraGroup.textContent = data.groupTitle;
      if (data.eventTitle) thEventCode.textContent = data.eventTitle;

      renderAllResultsTable(data.slots);
    } catch (e) {
      allResultsTableBody.innerHTML = `<tr><td colspan="5">Error loading table data</td></tr>`;
    }
  }

  function renderAllResultsTable(slots) {
    if (!slots || slots.length === 0) {
      allResultsTableBody.innerHTML = `<tr><td colspan="5">No slots available</td></tr>`;
      return;
    }

    let html = '';
    for (const item of slots) {
      const isActive = item.slotTime === activeSlot;
      const activeClass = isActive ? 'current-active' : '';

      // Extra client-side safeguard: if slot is in the future for today, always show '--'
      const isFuture = activeSlot && item.slotTime > activeSlot;
      const c1 = isFuture ? '--' : (item.c1 || '--');
      const c2 = isFuture ? '--' : (item.c2 || '--');
      const c3 = isFuture ? '--' : (item.c3 || '--');
      const c4 = isFuture ? '--' : (item.c4 || '--');

      html += `
        <tr class="slot-row ${activeClass}">
          <td class="slot-time-cell">${item.slotTime}</td>
          <td>${c1}</td>
          <td>${c2}</td>
          <td>${c3}</td>
          <td>${c4}</td>
        </tr>
      `;
    }
    allResultsTableBody.innerHTML = html;
  }

  // Initialize on page load
  loadCaptcha();

  // Attempt silent landscape lock on supported mobile browsers
  try {
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) {}

  // Periodic fallback refresh every 30 seconds
  setInterval(() => {
    if (liveScreen.classList.contains('active')) {
      fetchLiveResults();
    }
  }, 30000);

})();
