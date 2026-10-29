// public/admin/admin.js
// Admin Panel application logic

(function () {
  'use strict';

  const API_BASE = window.location.origin;

  // Views
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');

  // Login elements
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('usernameInput');
  const passwordInput = document.getElementById('passwordInput');
  const loginError = document.getElementById('loginError');
  const btnLoginSubmit = document.getElementById('btnLoginSubmit');
  const btnLogout = document.getElementById('btnLogout');

  // Header elements
  const headerLiveTime = document.getElementById('headerLiveTime');
  const headerActiveSlotBadge = document.getElementById('headerActiveSlotBadge');
  const alertBanner = document.getElementById('alertBanner');

  // Publisher elements
  const publishDate = document.getElementById('publishDate');
  const publishSlot = document.getElementById('publishSlot');
  const btnSelectCurrentSlot = document.getElementById('btnSelectCurrentSlot');
  const prefixBadges = [
    document.getElementById('prefixBadge1'),
    document.getElementById('prefixBadge2'),
    document.getElementById('prefixBadge3'),
    document.getElementById('prefixBadge4')
  ];
  const numInputs = [
    document.getElementById('numInput1'),
    document.getElementById('numInput2'),
    document.getElementById('numInput3'),
    document.getElementById('numInput4')
  ];
  const chipPreviews = [
    document.getElementById('chipPreview1'),
    document.getElementById('chipPreview2'),
    document.getElementById('chipPreview3'),
    document.getElementById('chipPreview4')
  ];
  const btnPublish = document.getElementById('btnPublish');
  const btnClearSlot = document.getElementById('btnClearSlot');

  // Schedule elements
  const scheduleTableBody = document.getElementById('scheduleTableBody');
  const statPublishedCount = document.getElementById('statPublishedCount');
  const statPendingCount = document.getElementById('statPendingCount');
  const thAdminCols = [
    document.getElementById('thAdminCol1'),
    document.getElementById('thAdminCol2'),
    document.getElementById('thAdminCol3'),
    document.getElementById('thAdminCol4')
  ];

  // Settings Modal elements
  const settingsModal = document.getElementById('settingsModal');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const btnCloseSettings = document.getElementById('btnCloseSettings');
  const btnCancelSettings = document.getElementById('btnCancelSettings');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const settingPrefixes = [
    document.getElementById('settingPrefix1'),
    document.getElementById('settingPrefix2'),
    document.getElementById('settingPrefix3'),
    document.getElementById('settingPrefix4')
  ];
  const settingEventTitle = document.getElementById('settingEventTitle');
  const settingGroupTitle = document.getElementById('settingGroupTitle');
  const settingEnforceHours = document.getElementById('settingEnforceHours');
  const settingCurrentPassword = document.getElementById('settingCurrentPassword');
  const settingNewPassword = document.getElementById('settingNewPassword');
  const btnUpdatePassword = document.getElementById('btnUpdatePassword');

  // State
  let token = localStorage.getItem('admin_token') || '';
  let prefixes = ['R$R', 'C$H', 'N$V', 'R$Y'];
  let currentSlotsData = [];

  // =========================================================================
  // AUTHENTICATION
  // =========================================================================

  function getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  async function checkSession() {
    if (!token) {
      showLogin();
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/me`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        showDashboard();
      } else {
        token = '';
        localStorage.removeItem('admin_token');
        showLogin();
      }
    } catch (e) {
      showLogin();
    }
  }

  function showLogin() {
    loginView.classList.add('active');
    dashboardView.classList.remove('active');
    usernameInput.value = '';
    passwordInput.value = '';
  }

  function showDashboard() {
    loginView.classList.remove('active');
    dashboardView.classList.add('active');
    initDashboard();
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.style.display = 'none';
    btnLoginSubmit.disabled = true;
    btnLoginSubmit.textContent = 'Authenticating...';

    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.value.trim(),
          password: passwordInput.value
        })
      });

      const data = await res.json();
      if (data.success) {
        token = data.token;
        localStorage.setItem('admin_token', token);
        showDashboard();
      } else {
        loginError.textContent = data.message || 'Login failed';
        loginError.style.display = 'block';
      }
    } catch (err) {
      loginError.textContent = 'Unable to connect to server';
      loginError.style.display = 'block';
    } finally {
      btnLoginSubmit.disabled = false;
      btnLoginSubmit.textContent = 'Log In to Dashboard';
    }
  });

  btnLogout.addEventListener('click', () => {
    token = '';
    localStorage.removeItem('admin_token');
    showLogin();
  });

  // =========================================================================
  // DASHBOARD INITIALIZATION
  // =========================================================================

  async function initDashboard() {
    // Set default date to today YYYY-MM-DD
    const today = new Date();
    const isoDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    publishDate.value = isoDate;

    populateSlotDropdown();
    startClock();
    await loadSettings();
    await loadDailySlots();

    // Auto-select active slot
    selectCurrentSlot();
  }

  function startClock() {
    const updateTime = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      headerLiveTime.textContent = `${hh}:${mm}:${ss}`;

      // Calculate current active slot
      const totalMin = now.getHours() * 60 + now.getMinutes();
      const startMin = 8 * 60 + 30; // 08:30
      const endMin = 23 * 60;        // 23:00

      if (totalMin >= startMin && totalMin <= endMin) {
        const diff = totalMin - startMin;
        const slotIdx = Math.floor(diff / 15);
        const slotMin = startMin + (slotIdx * 15);
        const sH = Math.floor(slotMin / 60);
        const sM = slotMin % 60;
        const activeStr = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
        headerActiveSlotBadge.textContent = `Active Slot: ${activeStr}`;
        headerActiveSlotBadge.style.backgroundColor = '#10b981';
      } else {
        headerActiveSlotBadge.textContent = 'Status: Outside Hours';
        headerActiveSlotBadge.style.backgroundColor = '#ef4444';
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  // Populate 59 slots from 08:30 to 23:00
  function populateSlotDropdown() {
    publishSlot.innerHTML = '';
    let min = 8 * 60 + 30;
    const end = 23 * 60;

    while (min <= end) {
      const h = Math.floor(min / 60);
      const m = min % 60;
      const str = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      const opt = document.createElement('option');
      opt.value = str;
      opt.textContent = `${str} (15m slot)`;
      publishSlot.appendChild(opt);
      min += 15;
    }
  }

  function selectCurrentSlot() {
    const now = new Date();
    const totalMin = now.getHours() * 60 + now.getMinutes();
    const startMin = 8 * 60 + 30;
    const endMin = 23 * 60;

    let target = '08:30';
    if (totalMin >= startMin && totalMin <= endMin) {
      const diff = totalMin - startMin;
      const slotIdx = Math.floor(diff / 15);
      const slotMin = startMin + (slotIdx * 15);
      const sH = Math.floor(slotMin / 60);
      const sM = slotMin % 60;
      target = `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`;
    }

    publishSlot.value = target;
    onSlotChanged();
  }

  btnSelectCurrentSlot.addEventListener('click', selectCurrentSlot);
  publishSlot.addEventListener('change', onSlotChanged);
  publishDate.addEventListener('change', loadDailySlots);

  function onSlotChanged() {
    const selectedSlot = publishSlot.value;
    const found = currentSlotsData.find(s => s.slotTime === selectedSlot);

    if (found && found.isPublished) {
      numInputs[0].value = found.r1;
      numInputs[1].value = found.r2;
      numInputs[2].value = found.r3;
      numInputs[3].value = found.r4;
    } else {
      numInputs.forEach(input => (input.value = ''));
    }
    updatePreviewChips();
  }

  // Update preview chips as admin types
  function updatePreviewChips() {
    numInputs.forEach((input, i) => {
      let val = input.value.trim();
      if (val.length > 2) {
        val = val.slice(0, 2);
        input.value = val;
      }
      const displayNum = val ? String(val).padStart(2, '0') : '--';
      chipPreviews[i].textContent = `${prefixes[i]}${displayNum}`;
    });
  }

  numInputs.forEach(input => {
    input.addEventListener('input', updatePreviewChips);
    input.addEventListener('blur', () => {
      if (input.value.trim()) {
        input.value = String(parseInt(input.value, 10) || 0).padStart(2, '0');
        updatePreviewChips();
      }
    });
  });

  // =========================================================================
  // LOAD SLOTS & PUBLISH LOGIC
  // =========================================================================

  async function loadDailySlots() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/slots?date=${publishDate.value}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (!data.success) return;

      currentSlotsData = data.slots;
      if (data.prefixes) {
        prefixes = data.prefixes;
        updatePrefixDisplays();
      }

      renderScheduleTable(data.slots);
      onSlotChanged();
    } catch (e) {
      showAlert('Error fetching slots: ' + e.message, 'error');
    }
  }

  function updatePrefixDisplays() {
    prefixes.forEach((pref, i) => {
      if (prefixBadges[i]) prefixBadges[i].textContent = pref;
      if (thAdminCols[i]) thAdminCols[i].textContent = pref;
    });
    updatePreviewChips();
  }

  function renderScheduleTable(slots) {
    let publishedCount = 0;
    let html = '';

    for (const item of slots) {
      if (item.isPublished) publishedCount++;

      const isCurrentSelected = item.slotTime === publishSlot.value;
      const statusBadge = item.isPublished
        ? `<span class="badge-status badge-published">Published</span>`
        : `<span class="badge-status badge-pending">Pending</span>`;

      html += `
        <tr class="${isCurrentSelected ? 'row-active' : ''}">
          <td style="font-weight: 800; font-family: monospace;">${item.slotTime}</td>
          <td>${statusBadge}</td>
          <td>${item.isPublished ? prefixes[0] + item.r1 : '--'}</td>
          <td>${item.isPublished ? prefixes[1] + item.r2 : '--'}</td>
          <td>${item.isPublished ? prefixes[2] + item.r3 : '--'}</td>
          <td>${item.isPublished ? prefixes[3] + item.r4 : '--'}</td>
          <td>
            <button class="btn-table-edit" data-slot="${item.slotTime}">Edit</button>
          </td>
        </tr>
      `;
    }

    scheduleTableBody.innerHTML = html;
    statPublishedCount.textContent = `${publishedCount} Published`;
    statPendingCount.textContent = `${slots.length - publishedCount} Pending`;

    // Attach click listeners to edit buttons
    document.querySelectorAll('.btn-table-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slot = e.target.getAttribute('data-slot');
        publishSlot.value = slot;
        onSlotChanged();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  // Publish Button
  btnPublish.addEventListener('click', async () => {
    const date = publishDate.value;
    const slotTime = publishSlot.value;

    const r1 = numInputs[0].value.trim();
    const r2 = numInputs[1].value.trim();
    const r3 = numInputs[2].value.trim();
    const r4 = numInputs[3].value.trim();

    if (!r1 || !r2 || !r3 || !r4) {
      showAlert('Please enter numerical values (00-99) for all 4 slots', 'error');
      return;
    }

    try {
      btnPublish.disabled = true;
      btnPublish.textContent = 'Publishing...';

      const res = await fetch(`${API_BASE}/api/admin/publish`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ date, slotTime, r1, r2, r3, r4 })
      });

      const data = await res.json();
      if (data.success) {
        showAlert(data.message, 'success');
        await loadDailySlots();
      } else {
        showAlert(data.message, 'error');
      }
    } catch (e) {
      showAlert('Failed to publish: ' + e.message, 'error');
    } finally {
      btnPublish.disabled = false;
      btnPublish.textContent = '🚀 Publish Live Result';
    }
  });

  // Clear Slot Button
  btnClearSlot.addEventListener('click', async () => {
    const slotTime = publishSlot.value;
    if (!confirm(`Are you sure you want to clear result for ${slotTime}?`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/clear`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ date: publishDate.value, slotTime })
      });
      const data = await res.json();
      if (data.success) {
        showAlert(data.message, 'success');
        numInputs.forEach(i => (i.value = ''));
        updatePreviewChips();
        await loadDailySlots();
      }
    } catch (e) {
      showAlert('Failed to clear: ' + e.message, 'error');
    }
  });

  function showAlert(message, type = 'success') {
    alertBanner.textContent = message;
    alertBanner.className = `alert-banner ${type}`;
    alertBanner.style.display = 'flex';
    setTimeout(() => {
      alertBanner.style.display = 'none';
    }, 4000);
  }

  // =========================================================================
  // SETTINGS MODAL LOGIC
  // =========================================================================

  async function loadSettings() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        prefixes = [
          s.prefix_1 || 'R$R',
          s.prefix_2 || 'C$H',
          s.prefix_3 || 'N$V',
          s.prefix_4 || 'R$Y'
        ];
        settingPrefixes[0].value = prefixes[0];
        settingPrefixes[1].value = prefixes[1];
        settingPrefixes[2].value = prefixes[2];
        settingPrefixes[3].value = prefixes[3];

        settingEventTitle.value = s.event_code_title || 'Gift Event Code';
        settingGroupTitle.value = s.yantra_group_title || 'YANTRA GROUP';
        settingEnforceHours.checked = s.enforce_operating_hours === '1';

        updatePrefixDisplays();
      }
    } catch (e) {
      console.error('Settings load error:', e);
    }
  }

  btnOpenSettings.addEventListener('click', () => {
    loadSettings();
    settingsModal.classList.add('active');
  });

  btnCloseSettings.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  btnCancelSettings.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  btnSaveSettings.addEventListener('click', async () => {
    const payload = {
      prefix_1: settingPrefixes[0].value.trim().toUpperCase() || 'R$R',
      prefix_2: settingPrefixes[1].value.trim().toUpperCase() || 'C$H',
      prefix_3: settingPrefixes[2].value.trim().toUpperCase() || 'N$V',
      prefix_4: settingPrefixes[3].value.trim().toUpperCase() || 'R$Y',
      event_code_title: settingEventTitle.value.trim() || 'Gift Event Code',
      yantra_group_title: settingGroupTitle.value.trim() || 'YANTRA GROUP',
      enforce_operating_hours: settingEnforceHours.checked ? '1' : '0'
    };

    try {
      btnSaveSettings.disabled = true;
      const res = await fetch(`${API_BASE}/api/admin/settings`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showAlert('Settings updated successfully', 'success');
        settingsModal.classList.remove('active');
        await loadSettings();
        await loadDailySlots();
      } else {
        showAlert(data.message, 'error');
      }
    } catch (e) {
      showAlert('Error saving settings', 'error');
    } finally {
      btnSaveSettings.disabled = false;
    }
  });

  btnUpdatePassword.addEventListener('click', async () => {
    const currentPassword = settingCurrentPassword.value;
    const newPassword = settingNewPassword.value;

    if (!currentPassword || !newPassword) {
      alert('Please enter both current and new password');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/admin/change-password`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        alert('Password changed successfully! Please keep it secure.');
        settingCurrentPassword.value = '';
        settingNewPassword.value = '';
      } else {
        alert('Error: ' + data.message);
      }
    } catch (e) {
      alert('Network error while updating password');
    }
  });

  // Check login on startup
  checkSession();

})();
