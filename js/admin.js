/**
 * Fehmina Hospital & Trauma Centre, Lucknow
 * Executive Management Dashboard Controller (100% Serverless / Google Sheets Edition)
 * Celebrating 25 Years of Healthcare Excellence (2001–2026)
 */

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================
  // CONFIGURATION & STATE
  // ==========================================
  const DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycbykYwlyzT-UARtUf5LfmWHWbVyB3piNuy2Eh_I1-QJ7efolblddgTKObzjFRCFUq-lo/exec';
  let activeSheetUrl = localStorage.getItem('fehmina_sheet_url') || DEFAULT_SHEET_URL;
  let customAdminPass = localStorage.getItem('fehmina_admin_pass') || 'fehmina2026';
  
  let allSubmissions = [];
  let filteredSubmissions = [];
  let isLoadingData = false;

  // DOM Elements - Auth & Screens
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const adminLoginForm = document.getElementById('admin-login-form');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const btnLogout = document.getElementById('btn-logout');
  const btnRefreshAll = document.getElementById('btn-refresh-all');

  // DOM Elements - Filters
  const filterMonth = document.getElementById('filter-month');
  const filterDept = document.getElementById('filter-dept');
  const filterRating = document.getElementById('filter-rating');
  const btnApplyFilters = document.getElementById('btn-apply-filters');
  const btnResetFilters = document.getElementById('btn-reset-filters');

  // DOM Elements - KPIs
  const kpiTotalResponses = document.getElementById('kpi-total-responses');
  const kpiAvgRating = document.getElementById('kpi-avg-rating');
  const kpiStaffNominations = document.getElementById('kpi-staff-nominations');
  const kpiSatisfactionRate = document.getElementById('kpi-satisfaction-rate');

  // DOM Elements - Scorecard & Staff
  const categoryScoreList = document.getElementById('category-score-list');
  const staffMonthLabel = document.getElementById('staff-month-label');
  const staffPodiumWrap = document.getElementById('staff-podium-wrap');
  const staffNominationsTable = document.getElementById('staff-nominations-table');

  // DOM Elements - Distribution & Trends
  const ratingDistributionBars = document.getElementById('rating-distribution-bars');
  const monthlyTrendContainer = document.getElementById('monthly-trend-container');

  // DOM Elements - Submissions Table
  const submissionSearchInput = document.getElementById('submission-search-input');
  const submissionsTableBody = document.getElementById('submissions-table-body');
  const btnExportCsv = document.getElementById('btn-export-csv');

  // DOM Elements - Settings
  const settingsForm = document.getElementById('settings-form');
  const setGoogleSheetUrl = document.getElementById('set-google-sheet-url');
  const setDepartments = document.getElementById('set-departments');
  const btnTestSheets = document.getElementById('btn-test-sheets');
  const sheetsStatusMsg = document.getElementById('sheets-status-msg');
  const settingsStatus = document.getElementById('settings-status');

  const passwordChangeForm = document.getElementById('password-change-form');
  const newAdminPassword = document.getElementById('new-admin-password');
  const passwordStatus = document.getElementById('password-status');

  // DOM Elements - Detail Modal
  const submissionDetailModal = document.getElementById('submission-detail-modal');
  const modalTitleId = document.getElementById('modal-title-id');
  const modalTimestamp = document.getElementById('modal-timestamp');
  const modalDetailName = document.getElementById('modal-detail-name');
  const modalDetailPhone = document.getElementById('modal-detail-phone');
  const modalDetailDept = document.getElementById('modal-detail-dept');
  const modalDetailAddress = document.getElementById('modal-detail-address');
  const modalRatingsGrid = document.getElementById('modal-ratings-grid');
  const modalStaffBox = document.getElementById('modal-staff-box');
  const modalStaffName = document.getElementById('modal-staff-name');
  const modalStaffReason = document.getElementById('modal-staff-reason');
  const modalCommentsBox = document.getElementById('modal-comments-box');
  const modalCommentsText = document.getElementById('modal-comments-text');
  const btnCloseDetailModal = document.getElementById('btn-close-detail-modal');
  const btnModalDone = document.getElementById('btn-modal-done');

  // Set default month in filter (YYYY-MM)
  const today = new Date();
  filterMonth.value = today.toISOString().slice(0, 7);

  // Initialize Auth Check
  checkAuthentication();

  function checkAuthentication() {
    const isAuthed = sessionStorage.getItem('fehmina_admin_auth') === 'true' || localStorage.getItem('fehmina_admin_auth') === 'true';
    if (isAuthed) {
      showDashboard();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
  }

  function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    loadSettingsIntoUI();
    loadDashboardDataFromGoogleSheet();
  }

  // ==========================================
  // AUTHENTICATION LOGIC
  // ==========================================
  adminLoginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');

    const user = loginUsername.value.trim().toLowerCase();
    const pass = loginPassword.value;

    if (user === 'admin' && pass === customAdminPass) {
      sessionStorage.setItem('fehmina_admin_auth', 'true');
      showDashboard();
    } else {
      loginError.textContent = 'Invalid username or password. Please try again.';
      loginError.classList.remove('hidden');
    }
  });

  btnLogout.addEventListener('click', () => {
    sessionStorage.removeItem('fehmina_admin_auth');
    localStorage.removeItem('fehmina_admin_auth');
    showLogin();
  });

  // Password update
  passwordChangeForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newPass = newAdminPassword.value.trim();
    if (!newPass || newPass.length < 6) {
      passwordStatus.textContent = 'Password must be at least 6 characters.';
      passwordStatus.style.color = '#c8102e';
      return;
    }

    customAdminPass = newPass;
    localStorage.setItem('fehmina_admin_pass', newPass);
    passwordStatus.textContent = '✓ Password updated successfully!';
    passwordStatus.style.color = '#007a3d';
    newAdminPassword.value = '';
    setTimeout(() => { passwordStatus.textContent = ''; }, 3000);
  });

  // ==========================================
  // SETTINGS MANAGEMENT
  // ==========================================
  function loadSettingsIntoUI() {
    if (setGoogleSheetUrl) {
      setGoogleSheetUrl.value = activeSheetUrl;
    }
    const savedDepts = localStorage.getItem('fehmina_departments');
    if (savedDepts && setDepartments) {
      setDepartments.value = savedDepts;
      updateDepartmentDropdown(savedDepts);
    } else if (setDepartments) {
      setDepartments.value = "Chest / Respiratory / Pulmonology, Neurology & Neuro Surgery, Orthopaedics & Joint Replacement, General Medicine, General & Laparoscopic Surgery, Gynaecology & Obstetrics, Pediatrics & Neonatology, Cardiology, Urology & Nephrology, Emergency & Trauma Care, ICU / Critical Care";
    }
  }

  settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newUrl = setGoogleSheetUrl.value.trim();
    const newDepts = setDepartments.value.trim();

    if (newUrl) {
      activeSheetUrl = newUrl;
      localStorage.setItem('fehmina_sheet_url', newUrl);
    }
    if (newDepts) {
      localStorage.setItem('fehmina_departments', newDepts);
      updateDepartmentDropdown(newDepts);
    }

    settingsStatus.textContent = '✓ Settings saved successfully!';
    settingsStatus.style.color = '#007a3d';
    setTimeout(() => { settingsStatus.textContent = ''; }, 3000);

    loadDashboardDataFromGoogleSheet();
  });

  function updateDepartmentDropdown(deptStr) {
    if (!filterDept) return;
    const currentVal = filterDept.value;
    const depts = deptStr.split(',').map(d => d.trim()).filter(Boolean);
    filterDept.innerHTML = '<option value="">All Departments</option>' + 
      depts.map(d => `<option value="${d}">${d}</option>`).join('');
    if (depts.includes(currentVal)) {
      filterDept.value = currentVal;
    }
  }

  if (btnTestSheets) {
    btnTestSheets.addEventListener('click', async () => {
      const url = setGoogleSheetUrl.value.trim() || activeSheetUrl;
      sheetsStatusMsg.textContent = 'Testing connection to Google Sheet...';
      sheetsStatusMsg.style.color = '#0369a1';

      try {
        const testUrl = url + (url.includes('?') ? '&' : '?') + 'action=ping';
        const res = await fetch(testUrl);
        const data = await res.json();
        if (data.success) {
          sheetsStatusMsg.textContent = `✓ Connected successfully! Total Submissions in Sheet: ${data.total_rows || 0}`;
          sheetsStatusMsg.style.color = '#007a3d';
        } else {
          sheetsStatusMsg.textContent = '✕ Error: ' + (data.error || 'Webhook did not respond as expected.');
          sheetsStatusMsg.style.color = '#c8102e';
        }
      } catch (err) {
        sheetsStatusMsg.textContent = '✕ Connection failed. Make sure Apps Script Web App is deployed with "Who has access: Anyone".';
        sheetsStatusMsg.style.color = '#c8102e';
      }
    });
  }

  // ==========================================
  // GOOGLE SHEET DATA FETCHING & ENGINE
  // ==========================================
  async function loadDashboardDataFromGoogleSheet() {
    if (isLoadingData) return;
    isLoadingData = true;

    if (btnRefreshAll) {
      btnRefreshAll.textContent = '⏳ Loading...';
      btnRefreshAll.disabled = true;
    }

    try {
      const fetchUrl = activeSheetUrl + (activeSheetUrl.includes('?') ? '&' : '?') + 'action=get_data';
      const res = await fetch(fetchUrl);
      const data = await res.json();

      if (data.success && Array.isArray(data.submissions)) {
        allSubmissions = data.submissions;
      } else {
        allSubmissions = [];
      }
    } catch (err) {
      console.warn('Could not fetch from Google Apps Script Web App:', err);
      // If network flutter occurs, retain current state
    } finally {
      isLoadingData = false;
      if (btnRefreshAll) {
        btnRefreshAll.textContent = '🔄 Refresh Data';
        btnRefreshAll.disabled = false;
      }
      applyFiltersAndCompute();
    }
  }

  if (btnRefreshAll) {
    btnRefreshAll.addEventListener('click', () => {
      loadDashboardDataFromGoogleSheet();
    });
  }

  // ==========================================
  // CLIENT-SIDE FILTERING & ANALYTICS ENGINE
  // ==========================================
  function applyFiltersAndCompute() {
    const monthVal = filterMonth.value; // YYYY-MM
    const deptVal = filterDept.value;
    const ratingVal = filterRating.value ? parseInt(filterRating.value, 10) : null;
    const searchVal = submissionSearchInput.value.toLowerCase().trim();

    // 1. Filter Submissions
    filteredSubmissions = allSubmissions.filter(sub => {
      // Month Filter
      if (monthVal && sub.timestamp) {
        if (!sub.timestamp.startsWith(monthVal)) return false;
      }
      // Department Filter
      if (deptVal && sub.department) {
        if (!sub.department.toLowerCase().includes(deptVal.toLowerCase())) return false;
      }
      // Rating Filter
      if (ratingVal !== null && sub.overall_rating !== ratingVal) {
        return false;
      }
      // Search Box Filter
      if (searchVal) {
        const textToSearch = [
          sub.id,
          sub.patient_name,
          sub.patient_phone,
          sub.patient_address,
          sub.department,
          sub.written_feedback,
          sub.staff_of_month_name_text,
          sub.staff_appreciation_reason
        ].filter(Boolean).join(' ').toLowerCase();

        if (!textToSearch.includes(searchVal)) return false;
      }

      return true;
    });

    // 2. Compute KPIs
    const totalCount = filteredSubmissions.length;
    kpiTotalResponses.textContent = totalCount;

    let overallSum = 0;
    let staffNomCount = 0;
    let positiveCount = 0;
    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    filteredSubmissions.forEach(s => {
      const r = s.overall_rating || 0;
      overallSum += r;
      if (r >= 4) positiveCount++;
      if (r >= 1 && r <= 5) ratingDist[r]++;
      if (s.staff_of_month_name_text && s.staff_of_month_name_text.trim()) {
        staffNomCount++;
      }
    });

    const avgOverall = totalCount > 0 ? (overallSum / totalCount).toFixed(1) : '0.0';
    kpiAvgRating.innerHTML = `${avgOverall} <small>/ 5.0</small>`;
    kpiStaffNominations.textContent = staffNomCount;

    const satRate = totalCount > 0 ? ((positiveCount / totalCount) * 100).toFixed(1) : '--';
    kpiSatisfactionRate.textContent = `${satRate}%`;

    // 3. Compute 9 Core Touchpoints Scorecard
    renderScorecard(filteredSubmissions);

    // 4. Compute Staff of the Month
    renderStaffLeaderboard(filteredSubmissions, monthVal);

    // 5. Render Distribution
    renderDistribution(ratingDist, totalCount);

    // 6. Render Monthly Trends (computed over ALL historical submissions)
    renderMonthlyTrends(allSubmissions);

    // 7. Render Submissions Table
    renderSubmissionsTable(filteredSubmissions);
  }

  // ==========================================
  // SCORECARD RENDERING (9 TOUCHPOINTS)
  // ==========================================
  function renderScorecard(subs) {
    const total = subs.length;
    const categories = [
      { key: 'overall_rating', label: '1. Overall Experience' },
      { key: 'doctor_rating', label: '2. Doctor & Medical Care' },
      { key: 'doctor_communication_rating', label: '3. Doctor Communication' },
      { key: 'nursing_rating', label: '4. Nursing Staff' },
      { key: 'staff_behaviour_rating', label: '5. Staff Behaviour' },
      { key: 'cleanliness_rating', label: '6. Cleanliness & Hygiene' },
      { key: 'room_ward_rating', label: '7. Room / Ward Experience' }, // PRESERVED
      { key: 'billing_discharge_rating', label: '8. Billing & Discharge' },
      { key: 'waiting_time_rating', label: '9. Service Speed / Waiting Time' }
    ];

    if (total === 0) {
      categoryScoreList.innerHTML = categories.map(cat => `
        <div class="score-item">
          <div class="score-header">
            <span>${cat.label}</span>
            <span class="score-num">0.00 ★</span>
          </div>
          <div class="score-bar-bg">
            <div class="score-bar-fill" style="width: 0%;"></div>
          </div>
        </div>
      `).join('');
      return;
    }

    categoryScoreList.innerHTML = categories.map(cat => {
      let sum = 0;
      let validCount = 0;
      subs.forEach(s => {
        const val = s[cat.key];
        if (typeof val === 'number' && val > 0) {
          sum += val;
          validCount++;
        }
      });

      const avg = validCount > 0 ? (sum / validCount).toFixed(2) : '0.00';
      const pct = Math.min(100, (Number(avg) / 5) * 100);

      let fillClass = '';
      if (Number(avg) < 3.0) fillClass = 'score-low';
      else if (Number(avg) < 4.0) fillClass = 'score-med';

      return `
        <div class="score-item">
          <div class="score-header">
            <span>${cat.label}</span>
            <span class="score-num">${avg} ★</span>
          </div>
          <div class="score-bar-bg">
            <div class="score-bar-fill ${fillClass}" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // STAFF OF THE MONTH LEADERBOARD
  // ==========================================
  function renderStaffLeaderboard(subs, monthStr) {
    if (staffMonthLabel) {
      staffMonthLabel.textContent = monthStr ? `Nominations for ${monthStr}` : 'All-time Patient Nominations';
    }

    // Group by staff member name
    const staffMap = {};
    subs.forEach(s => {
      const name = (s.staff_of_month_name_text || '').trim();
      if (!name) return;

      const normName = name.toLowerCase();
      if (!staffMap[normName]) {
        staffMap[normName] = {
          displayName: name,
          count: 0,
          appreciations: []
        };
      }
      staffMap[normName].count++;
      if (s.staff_appreciation_reason) {
        staffMap[normName].appreciations.push({
          reason: s.staff_appreciation_reason,
          timestamp: s.timestamp
        });
      }
    });

    const nominations = Object.values(staffMap).sort((a, b) => b.count - a.count);

    if (nominations.length === 0) {
      staffPodiumWrap.innerHTML = '<p class="text-muted text-center" style="padding:20px;">Is selection mein abhi tak koi staff nomination submit nahi hua.</p>';
      staffNominationsTable.innerHTML = '';
      return;
    }

    // Top 3 Podium
    const top3 = nominations.slice(0, 3);
    const podiumRanks = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];
    const podiumClasses = ['podium-gold', 'podium-silver', 'podium-bronze'];

    staffPodiumWrap.innerHTML = top3.map((staff, idx) => `
      <div class="podium-card ${podiumClasses[idx]}">
        <div class="podium-badge">${podiumRanks[idx]}</div>
        <h3 class="podium-name">${escapeHtml(staff.displayName)}</h3>
        <div class="podium-votes"><strong>${staff.count}</strong> Nominations</div>
      </div>
    `).join('');

    // All Staff Table
    staffNominationsTable.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Staff Member Name</th>
            <th>Total Nominations</th>
            <th>Recent Patient Appreciation Quotes</th>
          </tr>
        </thead>
        <tbody>
          ${nominations.map((staff, i) => {
            const quotes = staff.appreciations
              .slice(0, 2)
              .map(a => `<div class="staff-quote">"${escapeHtml(a.reason)}" <small class="text-muted">(${a.timestamp ? a.timestamp.split(' ')[0] : ''})</small></div>`)
              .join('');

            return `
              <tr>
                <td><strong>#${i + 1}</strong></td>
                <td><strong>${escapeHtml(staff.displayName)}</strong></td>
                <td><span class="badge-pill badge-green">${staff.count} Votes</span></td>
                <td>${quotes || '<em class="text-muted">Direct nomination</em>'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // ==========================================
  // RATING DISTRIBUTION & MONTHLY TRENDS
  // ==========================================
  function renderDistribution(dist, total) {
    const starLabels = ['5 Stars (Bahut Achha)', '4 Stars (Achha)', '3 Stars (Theek-thaak)', '2 Stars (Kharaab)', '1 Star (Bahut Kharaab)'];
    const starKeys = [5, 4, 3, 2, 1];

    ratingDistributionBars.innerHTML = starKeys.map((k, i) => {
      const count = dist[k] || 0;
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
      return `
        <div class="dist-row">
          <span class="dist-stars">${starLabels[i]}</span>
          <div class="dist-bar-track">
            <div class="dist-bar-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="dist-count">${count} (${pct}%)</span>
        </div>
      `;
    }).join('');
  }

  function renderMonthlyTrends(subs) {
    const monthlyMap = {};
    subs.forEach(s => {
      if (!s.timestamp) return;
      const monthKey = s.timestamp.substring(0, 7); // YYYY-MM
      if (monthKey && monthKey.length === 7) {
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + 1;
      }
    });

    const months = Object.keys(monthlyMap).sort();
    if (months.length === 0) {
      monthlyTrendContainer.innerHTML = '<p class="text-muted text-center" style="padding:20px;">No historical trend data available.</p>';
      return;
    }

    const maxCount = Math.max(...Object.values(monthlyMap), 1);
    monthlyTrendContainer.innerHTML = months.map(m => {
      const count = monthlyMap[m];
      const hPct = Math.max(10, (count / maxCount) * 100);
      return `
        <div class="trend-col">
          <span class="trend-val">${count}</span>
          <div class="trend-bar" style="height: ${hPct}%;"></div>
          <span class="trend-label">${m}</span>
        </div>
      `;
    }).join('');
  }

  // ==========================================
  // SUBMISSIONS EXPLORER TABLE & DETAILS MODAL
  // ==========================================
  function getScoreBadge(score, label) {
    let cls = 'score-badge-low';
    if (score >= 5) cls = 'score-badge-5';
    else if (score >= 4) cls = 'score-badge-4';
    else if (score >= 3) cls = 'score-badge-3';
    return `<span class="score-badge ${cls}" title="${label}: ${score}/5">${label}: ${score}★</span>`;
  }

  function renderSubmissionsTable(subs) {
    if (!subs || subs.length === 0) {
      submissionsTableBody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted" style="padding:24px;">
            No patient submissions found matching your filters.
          </td>
        </tr>
      `;
      return;
    }

    submissionsTableBody.innerHTML = subs.map(s => {
      let overallCls = 'score-badge-low';
      if (s.overall_rating >= 5) overallCls = 'score-badge-5';
      else if (s.overall_rating >= 4) overallCls = 'score-badge-4';
      else if (s.overall_rating >= 3) overallCls = 'score-badge-3';

      const clinicalBadges = 
        getScoreBadge(s.doctor_rating, 'Doc') +
        getScoreBadge(s.nursing_rating, 'Nurse') +
        getScoreBadge(s.cleanliness_rating, 'Clean') +
        getScoreBadge(s.room_ward_rating, 'Room'); // PRESERVED

      const staffText = s.staff_of_month_name_text 
        ? `🏆 <strong>${escapeHtml(s.staff_of_month_name_text)}</strong>${s.staff_appreciation_reason ? `<br><small class="text-muted">"${escapeHtml(s.staff_appreciation_reason)}"</small>` : ''}`
        : '<span class="text-muted">-</span>';

      return `
        <tr>
          <td>
            <strong>${escapeHtml(s.id)}</strong><br>
            <small class="text-muted">${s.timestamp ? s.timestamp.split(' ')[0] : ''}</small>
          </td>
          <td>
            <strong>${escapeHtml(s.patient_name || 'Anonymous')}</strong><br>
            ${s.patient_phone ? `<small><a href="tel:${s.patient_phone}" style="color:#007a3d;font-weight:600;">${s.patient_phone}</a></small><br>` : ''}
            ${s.patient_address ? `<small class="text-muted" style="font-size:0.75rem;">📍 ${escapeHtml(s.patient_address)}</small>` : ''}
          </td>
          <td><span class="badge-dept">${escapeHtml(s.department || '-')}</span></td>
          <td><strong class="score-badge ${overallCls}" style="font-size:0.92rem; padding: 4px 8px;">${s.overall_rating} ★</strong></td>
          <td>${clinicalBadges}</td>
          <td style="max-width: 200px;">${staffText}</td>
          <td style="max-width: 220px; font-size: 0.82rem;">${escapeHtml(s.written_feedback || '-') }</td>
          <td>
            <button type="button" class="btn-action-sm btn-view-detail" data-id="${escapeHtml(s.id)}">🔍 Details</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach click listeners to Details buttons
    document.querySelectorAll('.btn-view-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const subId = btn.getAttribute('data-id');
        const item = allSubmissions.find(s => s.id === subId);
        if (item) openDetailModal(item);
      });
    });
  }

  function openDetailModal(sub) {
    if (!sub) return;

    modalTitleId.textContent = 'Feedback #' + sub.id;
    modalTimestamp.textContent = 'Submitted on: ' + (sub.timestamp || '--');
    modalDetailName.textContent = sub.patient_name || 'Anonymous';
    
    if (sub.patient_phone) {
      modalDetailPhone.textContent = sub.patient_phone;
      modalDetailPhone.href = 'tel:' + sub.patient_phone;
    } else {
      modalDetailPhone.textContent = 'Not provided';
      modalDetailPhone.removeAttribute('href');
    }

    modalDetailDept.textContent = sub.department || 'Not specified';
    modalDetailAddress.textContent = sub.patient_address || 'Not provided';

    const ratingItems = [
      { name: '1. Overall Experience', val: sub.overall_rating },
      { name: '2. Doctor & Medical Treatment', val: sub.doctor_rating },
      { name: '3. Doctor Communication', val: sub.doctor_communication_rating },
      { name: '4. Nursing Staff Support', val: sub.nursing_rating },
      { name: '5. Staff Behaviour', val: sub.staff_behaviour_rating },
      { name: '6. Cleanliness & Hygiene', val: sub.cleanliness_rating },
      { name: '7. Room / Ward Experience', val: sub.room_ward_rating }, // PRESERVED
      { name: '8. Billing & Discharge', val: sub.billing_discharge_rating },
      { name: '9. Service Speed / Waiting Time', val: sub.waiting_time_rating }
    ];

    modalRatingsGrid.innerHTML = ratingItems.map(item => {
      const v = item.val || 0;
      const starStr = '⭐'.repeat(v);
      return `
        <div class="detail-rating-item">
          <span class="detail-rating-name">${item.name}</span>
          <span class="detail-rating-val">${v} / 5 (${starStr})</span>
        </div>
      `;
    }).join('');

    if (sub.staff_of_month_name_text && sub.staff_of_month_name_text.trim()) {
      modalStaffBox.classList.remove('hidden');
      modalStaffName.textContent = sub.staff_of_month_name_text;
      modalStaffReason.textContent = sub.staff_appreciation_reason ? `"${sub.staff_appreciation_reason}"` : 'Direct nomination without comment';
    } else {
      modalStaffBox.classList.add('hidden');
    }

    if (sub.written_feedback && sub.written_feedback.trim()) {
      modalCommentsBox.classList.remove('hidden');
      modalCommentsText.textContent = sub.written_feedback;
    } else {
      modalCommentsBox.classList.add('hidden');
    }

    submissionDetailModal.classList.remove('hidden');
  }

  function closeDetailModal() {
    submissionDetailModal.classList.add('hidden');
  }

  btnCloseDetailModal.addEventListener('click', closeDetailModal);
  btnModalDone.addEventListener('click', closeDetailModal);
  submissionDetailModal.addEventListener('click', (e) => {
    if (e.target === submissionDetailModal) closeDetailModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !submissionDetailModal.classList.contains('hidden')) {
      closeDetailModal();
    }
  });

  // ==========================================
  // SEARCH & FILTER EVENTS
  // ==========================================
  submissionSearchInput.addEventListener('input', () => {
    applyFiltersAndCompute();
  });

  btnApplyFilters.addEventListener('click', () => {
    applyFiltersAndCompute();
  });

  btnResetFilters.addEventListener('click', () => {
    filterMonth.value = '';
    filterDept.value = '';
    filterRating.value = '';
    submissionSearchInput.value = '';
    applyFiltersAndCompute();
  });

  // ==========================================
  // DIRECT BROWSER CSV EXPORT (18 COLUMNS)
  // ==========================================
  btnExportCsv.addEventListener('click', () => {
    if (filteredSubmissions.length === 0) {
      alert('No data to export for current filters.');
      return;
    }

    const headers = [
      "Submission ID",
      "Timestamp",
      "Patient Name",
      "Patient Phone",
      "Patient Address",
      "Department",
      "Overall Rating",
      "Doctor & Medical Care Rating",
      "Doctor Communication Rating",
      "Nursing Staff Rating",
      "Staff Behaviour Rating",
      "Cleanliness & Hygiene Rating",
      "Room / Ward Rating",
      "Billing & Discharge Rating",
      "Waiting Time Rating",
      "Written Feedback",
      "Staff of the Month Nomination",
      "Staff Appreciation Reason"
    ];

    const escapeCsv = (str) => {
      const s = String(str || '').replace(/"/g, '""');
      return `"${s}"`;
    };

    const csvRows = [headers.join(',')];

    filteredSubmissions.forEach(s => {
      const row = [
        escapeCsv(s.id),
        escapeCsv(s.timestamp),
        escapeCsv(s.patient_name),
        escapeCsv(s.patient_phone),
        escapeCsv(s.patient_address),
        escapeCsv(s.department),
        s.overall_rating || '',
        s.doctor_rating || '',
        s.doctor_communication_rating || '',
        s.nursing_rating || '',
        s.staff_behaviour_rating || '',
        s.cleanliness_rating || '',
        s.room_ward_rating || '',
        s.billing_discharge_rating || '',
        s.waiting_time_rating || '',
        escapeCsv(s.written_feedback),
        escapeCsv(s.staff_of_month_name_text),
        escapeCsv(s.staff_appreciation_reason)
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = "\uFEFF" + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `fehmina_feedback_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  // Helper: Simple HTML Escaper
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

});
