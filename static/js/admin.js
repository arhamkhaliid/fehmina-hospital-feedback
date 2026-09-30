/**
 * Fehmina Hospital & Trauma Centre, Lucknow
 * Executive Management Dashboard Controller
 */

document.addEventListener('DOMContentLoaded', () => {

  // Auth State
  let authToken = localStorage.getItem('fehmina_admin_token') || '';
  let cachedSubmissions = [];

  // DOM Elements - Screens
  const loginScreen = document.getElementById('login-screen');
  const dashboardScreen = document.getElementById('dashboard-screen');
  const adminLoginForm = document.getElementById('admin-login-form');
  const loginUsername = document.getElementById('login-username');
  const loginPassword = document.getElementById('login-password');
  const loginError = document.getElementById('login-error');
  const btnLogout = document.getElementById('btn-logout');

  // DOM Elements - Filters
  const filterMonth = document.getElementById('filter-month');
  const filterDept = document.getElementById('filter-dept');
  const filterWard = document.getElementById('filter-ward');
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
  const btnTriggerBackup = document.getElementById('btn-trigger-backup');

  // DOM Elements - Settings
  const settingsForm = document.getElementById('settings-form');
  const setGoogleSheetUrl = document.getElementById('set-google-sheet-url');
  const setDepartments = document.getElementById('set-departments');
  const setWards = document.getElementById('set-wards');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const settingsStatus = document.getElementById('settings-status');
  const btnTestSheets = document.getElementById('btn-test-sheets');
  const btnSyncAllSheets = document.getElementById('btn-sync-all-sheets');
  const sheetsStatusMsg = document.getElementById('sheets-status-msg');

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

  // 1. Set current month in filter default (YYYY-MM)
  const today = new Date();
  const currentMonthStr = today.toISOString().slice(0, 7);
  filterMonth.value = currentMonthStr;

  // 2. Initialize Auth Check
  checkAuthentication();

  async function checkAuthentication() {
    if (!authToken) {
      showLogin();
      return;
    }

    try {
      const res = await fetch('/api/admin/check-auth', {
        headers: { 'Authorization': 'Bearer ' + authToken }
      });
      const data = await res.json();
      if (data.success && data.authenticated) {
        showDashboard();
      } else {
        localStorage.removeItem('fehmina_admin_token');
        authToken = '';
        showLogin();
      }
    } catch (e) {
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
    loadSettings();
    loadDashboardData();
  }

  // 3. Login Action
  adminLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.classList.add('hidden');

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        authToken = data.token;
        localStorage.setItem('fehmina_admin_token', authToken);
        showDashboard();
      } else {
        loginError.textContent = data.error || 'Invalid credentials.';
        loginError.classList.remove('hidden');
      }
    } catch (err) {
      loginError.textContent = 'Server connection error. Please try again.';
      loginError.classList.remove('hidden');
    }
  });

  // 4. Logout Action
  btnLogout.addEventListener('click', () => {
    localStorage.removeItem('fehmina_admin_token');
    authToken = '';
    showLogin();
  });

  function getHeaders() {
    return {
      'Authorization': 'Bearer ' + authToken,
      'Content-Type': 'application/json'
    };
  }

  // 5. Load Settings
  async function loadSettings() {
    try {
      const res = await fetch('/api/admin/settings', { headers: getHeaders() });
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        if (setGoogleSheetUrl) setGoogleSheetUrl.value = s.google_sheet_webhook_url || '';
        if (setDepartments) setDepartments.value = s.departments || '';
        if (setWards) setWards.value = s.wards || '';

        // Populate filter dropdowns
        if (s.departments && filterDept) {
          filterDept.innerHTML = '<option value="">All Departments</option>' + 
            s.departments.split(',').map(d => '<option value="' + d.trim() + '">' + d.trim() + '</option>').join('');
        }
        if (s.wards && filterWard) {
          filterWard.innerHTML = '<option value="">All Wards</option>' + 
            s.wards.split(',').map(w => '<option value="' + w.trim() + '">' + w.trim() + '</option>').join('');
        }
      }
    } catch (e) {}
  }

  // 6. Load Full Dashboard Data
  async function loadDashboardData() {
    const params = new URLSearchParams();
    if (filterMonth.value) params.append('month', filterMonth.value);
    if (filterDept.value) params.append('department', filterDept.value);
    if (filterWard.value) params.append('ward', filterWard.value);
    if (filterRating.value) params.append('rating', filterRating.value);

    // Fetch Stats
    try {
      const resStats = await fetch('/api/admin/stats?' + params.toString(), { headers: getHeaders() });
      const statsData = await resStats.json();
      if (statsData.success) {
        renderKPIs(statsData.kpis, statsData.distribution);
        renderScorecard(statsData.kpis);
        renderDistribution(statsData.distribution, statsData.kpis.total_responses || 0);
        renderMonthlyTrend(statsData.monthly_trend);
      }
    } catch (e) {}

    // Fetch Staff Nominations
    try {
      const nomMonth = filterMonth.value || '';
      const resNom = await fetch('/api/admin/staff-of-month?month=' + nomMonth, { headers: getHeaders() });
      const nomData = await resNom.json();
      if (nomData.success) {
        renderStaffLeaderboard(nomData.nominations, nomMonth);
      }
    } catch (e) {}

    // Fetch Submissions
    try {
      const resSubs = await fetch('/api/admin/submissions?' + params.toString(), { headers: getHeaders() });
      const subsData = await resSubs.json();
      if (subsData.success) {
        cachedSubmissions = subsData.submissions || [];
        renderSubmissionsTable(cachedSubmissions);
      }
    } catch (e) {}
  }

  // 7. Render KPIs
  function renderKPIs(kpis, dist) {
    if (!kpis) return;
    const total = kpis.total_responses || 0;
    kpiTotalResponses.textContent = total;
    
    const avg = kpis.avg_overall ? Number(kpis.avg_overall).toFixed(1) : '0.0';
    kpiAvgRating.innerHTML = avg + ' <small>/ 5.0</small>';
    
    kpiStaffNominations.textContent = kpis.total_staff_nominations || 0;

    // Calculate Positive Satisfaction Rate (4★ & 5★)
    if (dist && total > 0) {
      const positiveCount = (dist[5] || 0) + (dist[4] || 0);
      const satPct = ((positiveCount / total) * 100).toFixed(1);
      kpiSatisfactionRate.textContent = satPct + '%';
    } else {
      kpiSatisfactionRate.textContent = total > 0 ? '100%' : '--%';
    }
  }

  // 8. Render Category Scorecard
  function renderScorecard(kpis) {
    if (!kpis) return;

    const categories = [
      { key: 'avg_overall', label: '1. Overall Experience' },
      { key: 'avg_doctor', label: '2. Doctor & Medical Care' },
      { key: 'avg_doctor_communication', label: '3. Doctor Communication' },
      { key: 'avg_nursing', label: '4. Nursing Staff' },
      { key: 'avg_staff_behaviour', label: '5. Staff Behaviour' },
      { key: 'avg_cleanliness', label: '6. Cleanliness & Hygiene' },
      { key: 'avg_room_ward', label: '7. Room / Ward Experience' },
      { key: 'avg_billing_discharge', label: '8. Billing & Discharge' },
      { key: 'avg_waiting_time', label: '9. Service Speed / Waiting Time' }
    ];

    categoryScoreList.innerHTML = categories.map(cat => {
      const score = kpis[cat.key] ? Number(kpis[cat.key]).toFixed(2) : '0.00';
      const pct = Math.min(100, (Number(score) / 5) * 100);
      let fillClass = '';
      if (Number(score) < 3.0) fillClass = 'score-low';
      else if (Number(score) < 4.0) fillClass = 'score-med';

      return '<div class="score-item">' +
          '<div class="score-header">' +
            '<span>' + cat.label + '</span>' +
            '<span class="score-num">' + score + ' ★</span>' +
          '</div>' +
          '<div class="score-bar-bg">' +
            '<div class="score-bar-fill ' + fillClass + '" style="width: ' + pct + '%"></div>' +
          '</div>' +
        '</div>';
    }).join('');
  }

  // 9. Render Staff Leaderboard
  function renderStaffLeaderboard(nominations, monthStr) {
    if (staffMonthLabel) {
      staffMonthLabel.textContent = monthStr ? ('Nominations for ' + monthStr) : 'All-time Patient Nominations';
    }

    if (!nominations || nominations.length === 0) {
      staffPodiumWrap.innerHTML = '<p class="text-muted text-center" style="padding:20px;">Is month mein abhi tak koi staff nomination submit nahi hua.</p>';
      staffNominationsTable.innerHTML = '';
      return;
    }

    // Top 3 Podium
    const top3 = nominations.slice(0, 3);
    const podiumRanks = ['🥇 1st Place', '🥈 2nd Place', '🥉 3rd Place'];
    const podiumClasses = ['podium-gold', 'podium-silver', 'podium-bronze'];

    staffPodiumWrap.innerHTML = top3.map((staff, idx) => {
      return '<div class="podium-card ' + podiumClasses[idx] + '">' +
          '<div class="podium-badge">' + podiumRanks[idx] + '</div>' +
          '<h3 class="podium-name">' + staff.name + '</h3>' +
          '<div class="podium-votes"><strong>' + staff.count + '</strong> Nominations</div>' +
        '</div>';
    }).join('');

    // All Staff Table
    staffNominationsTable.innerHTML = '<table class="admin-table">' +
        '<thead>' +
          '<tr>' +
            '<th>Rank</th>' +
            '<th>Staff Member Name</th>' +
            '<th>Total Nominations</th>' +
            '<th>Recent Patient Appreciation Quotes</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' +
          nominations.map((staff, i) => {
            const quotes = (staff.appreciations || [])
              .filter(a => a.reason)
              .slice(0, 2)
              .map(a => '<div class="staff-quote">"' + a.reason + '" <small class="text-muted">(' + (a.timestamp ? a.timestamp.split(' ')[0] : '') + ')</small></div>')
              .join('');

            return '<tr>' +
                '<td><strong>#' + (i + 1) + '</strong></td>' +
                '<td><strong>' + staff.name + '</strong></td>' +
                '<td><span class="badge-pill badge-green">' + staff.count + ' Votes</span></td>' +
                '<td>' + (quotes || '<em class="text-muted">Direct nomination</em>') + '</td>' +
              '</tr>';
          }).join('') +
        '</tbody>' +
      '</table>';
  }

  // 10. Render Rating Distribution
  function renderDistribution(dist, total) {
    if (!dist) return;
    const starLabels = ['5 Stars (Bahut Achha)', '4 Stars (Achha)', '3 Stars (Theek-thaak)', '2 Stars (Kharaab)', '1 Star (Bahut Kharaab)'];
    const starKeys = [5, 4, 3, 2, 1];

    ratingDistributionBars.innerHTML = starKeys.map((k, i) => {
      const count = dist[k] || 0;
      const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
      return '<div class="dist-row">' +
          '<span class="dist-stars">' + starLabels[i] + '</span>' +
          '<div class="dist-bar-track">' +
            '<div class="dist-bar-fill" style="width: ' + pct + '%"></div>' +
          '</div>' +
          '<span class="dist-count">' + count + ' (' + pct + '%)</span>' +
        '</div>';
    }).join('');
  }

  // 11. Render Monthly Trends
  function renderMonthlyTrend(monthlyData) {
    if (!monthlyData || monthlyData.length === 0) {
      monthlyTrendContainer.innerHTML = '<p class="text-muted text-center" style="padding:20px;">No historical trend data available.</p>';
      return;
    }

    const maxCount = Math.max(...monthlyData.map(m => m.count), 1);
    monthlyTrendContainer.innerHTML = monthlyData.map(m => {
      const hPct = Math.max(8, (m.count / maxCount) * 100);
      return '<div class="trend-col">' +
          '<span class="trend-val">' + m.count + '</span>' +
          '<div class="trend-bar" style="height: ' + hPct + '%"></div>' +
          '<span class="trend-label">' + m.month + '</span>' +
        '</div>';
    }).join('');
  }

  // 12. Helper to get score badge HTML
  function getScoreBadge(score, label) {
    let cls = 'score-badge-low';
    if (score >= 5) cls = 'score-badge-5';
    else if (score >= 4) cls = 'score-badge-4';
    else if (score >= 3) cls = 'score-badge-3';
    return '<span class="score-badge ' + cls + '" title="' + label + ': ' + score + '/5">' + label + ': ' + score + '★</span>';
  }

  // 13. Render Submissions Table
  function renderSubmissionsTable(submissions) {
    if (!submissions || submissions.length === 0) {
      submissionsTableBody.innerHTML = '<tr>' +
          '<td colspan="8" class="text-center text-muted" style="padding:20px;">No submissions found for selected filters.</td>' +
        '</tr>';
      return;
    }

    submissionsTableBody.innerHTML = submissions.map(s => {
      // Overall Badge
      let overallCls = 'score-badge-low';
      if (s.overall_rating >= 5) overallCls = 'score-badge-5';
      else if (s.overall_rating >= 4) overallCls = 'score-badge-4';
      else if (s.overall_rating >= 3) overallCls = 'score-badge-3';

      const clinicalBadges = 
        getScoreBadge(s.doctor_rating, 'Doc') +
        getScoreBadge(s.nursing_rating, 'Nurse') +
        getScoreBadge(s.cleanliness_rating, 'Clean');

      const staffText = s.staff_of_month_name_text 
        ? ('🏆 <strong>' + s.staff_of_month_name_text + '</strong>' + (s.staff_appreciation_reason ? ('<br><small class="text-muted">"' + s.staff_appreciation_reason + '"</small>') : ''))
        : '<span class="text-muted">-</span>';

      return '<tr>' +
          '<td>' +
            '<strong>' + s.id + '</strong><br>' +
            '<small class="text-muted">' + (s.timestamp ? s.timestamp.split(' ')[0] : '') + '</small>' +
          '</td>' +
          '<td>' +
            '<strong>' + (s.patient_name || 'Anonymous') + '</strong><br>' +
            (s.patient_phone ? ('<small><a href="tel:' + s.patient_phone + '" style="color:#007a3d;font-weight:600;">' + s.patient_phone + '</a></small><br>') : '') +
            (s.patient_address ? ('<small class="text-muted" style="font-size:0.75rem;">📍 ' + s.patient_address + '</small>') : '') +
          '</td>' +
          '<td><span class="badge-dept">' + (s.department || 'General') + '</span></td>' +
          '<td><strong class="score-badge ' + overallCls + '" style="font-size:0.92rem; padding: 4px 8px;">' + s.overall_rating + ' ★</strong></td>' +
          '<td>' + clinicalBadges + '</td>' +
          '<td style="max-width: 200px;">' + staffText + '</td>' +
          '<td style="max-width: 220px; font-size: 0.82rem;">' + (s.written_feedback || '<span class="text-muted">-</span>') + '</td>' +
          '<td>' +
            '<button type="button" class="btn-action-sm btn-view-detail" data-id="' + s.id + '">🔍 Details</button>' +
          '</td>' +
        '</tr>';
    }).join('');

    // Attach click handlers to Details buttons
    document.querySelectorAll('.btn-view-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const subId = btn.getAttribute('data-id');
        const item = cachedSubmissions.find(s => s.id === subId);
        if (item) openDetailModal(item);
      });
    });
  }

  // 14. Submission Detail Modal Logic
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

    modalDetailDept.textContent = sub.department || 'General';
    modalDetailAddress.textContent = sub.patient_address || 'Not provided';

    // 9 Ratings list
    const ratingItems = [
      { name: '1. Overall Experience', val: sub.overall_rating },
      { name: '2. Doctor & Medical Treatment', val: sub.doctor_rating },
      { name: '3. Doctor Communication', val: sub.doctor_communication_rating },
      { name: '4. Nursing Staff Support', val: sub.nursing_rating },
      { name: '5. Staff Behaviour', val: sub.staff_behaviour_rating },
      { name: '6. Cleanliness & Hygiene', val: sub.cleanliness_rating },
      { name: '7. Room / Ward Experience', val: sub.room_ward_rating },
      { name: '8. Billing & Discharge', val: sub.billing_discharge_rating },
      { name: '9. Service Speed / Waiting Time', val: sub.waiting_time_rating }
    ];

    modalRatingsGrid.innerHTML = ratingItems.map(item => {
      const v = item.val || 0;
      let starStr = '⭐'.repeat(v);
      return '<div class="detail-rating-item">' +
          '<span class="detail-rating-name">' + item.name + '</span>' +
          '<span class="detail-rating-val">' + v + ' / 5 (' + starStr + ')</span>' +
        '</div>';
    }).join('');

    // Staff Appreciation
    if (sub.staff_of_month_name_text && sub.staff_of_month_name_text.trim()) {
      modalStaffBox.classList.remove('hidden');
      modalStaffName.textContent = sub.staff_of_month_name_text;
      modalStaffReason.textContent = sub.staff_appreciation_reason ? ('"' + sub.staff_appreciation_reason + '"') : 'Direct nomination without comment';
    } else {
      modalStaffBox.classList.add('hidden');
    }

    // Written Comments
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

  // 15. Live Search Submissions
  submissionSearchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      renderSubmissionsTable(cachedSubmissions);
      return;
    }
    const filtered = cachedSubmissions.filter(s => {
      return (s.id && s.id.toLowerCase().includes(q)) ||
             (s.patient_name && s.patient_name.toLowerCase().includes(q)) ||
             (s.patient_phone && s.patient_phone.includes(q)) ||
             (s.patient_address && s.patient_address.toLowerCase().includes(q)) ||
             (s.department && s.department.toLowerCase().includes(q)) ||
             (s.written_feedback && s.written_feedback.toLowerCase().includes(q)) ||
             (s.staff_of_month_name_text && s.staff_of_month_name_text.toLowerCase().includes(q)) ||
             (s.staff_appreciation_reason && s.staff_appreciation_reason.toLowerCase().includes(q));
    });
    renderSubmissionsTable(filtered);
  });

  // 16. Filter Events
  btnApplyFilters.addEventListener('click', () => {
    loadDashboardData();
  });

  btnResetFilters.addEventListener('click', () => {
    filterMonth.value = '';
    filterDept.value = '';
    filterWard.value = '';
    filterRating.value = '';
    loadDashboardData();
  });

  // 17. CSV Export
  btnExportCsv.addEventListener('click', () => {
    window.location.href = '/api/admin/export-csv?token=' + encodeURIComponent(authToken);
  });

  // 18. Trigger SQLite Backup
  btnTriggerBackup.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/admin/create-backup', {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        alert('Database backup created successfully:\n' + data.filename);
      } else {
        alert('Backup failed: ' + (data.error || 'Unknown error'));
      }
    } catch (e) {
      alert('Backup failed: ' + e.message);
    }
  });

  // 19. Save System Settings
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    settingsStatus.textContent = 'Saving...';
    settingsStatus.style.color = '#0f172a';

    const payload = {
      google_sheet_webhook_url: setGoogleSheetUrl ? setGoogleSheetUrl.value.trim() : '',
      departments: setDepartments.value.trim(),
      wards: setWards.value.trim()
    };

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        settingsStatus.textContent = '✓ Settings saved successfully!';
        settingsStatus.style.color = '#007a3d';
        loadSettings();
      } else {
        settingsStatus.textContent = 'Error: ' + (data.error || 'Failed to save');
        settingsStatus.style.color = '#c8102e';
      }
    } catch (err) {
      settingsStatus.textContent = 'Error: ' + err.message;
      settingsStatus.style.color = '#c8102e';
    }
  });

  // 20. Test Google Sheet Connection
  if (btnTestSheets) {
    btnTestSheets.addEventListener('click', async () => {
      sheetsStatusMsg.textContent = 'Testing connection to Google Sheet webhook...';
      sheetsStatusMsg.style.color = '#0369a1';

      try {
        const res = await fetch('/api/admin/test-sheets', {
          method: 'POST',
          headers: getHeaders()
        });
        const data = await res.json();
        if (data.success) {
          sheetsStatusMsg.textContent = '✓ Connected successfully! Google Sheet webhook is responsive.';
          sheetsStatusMsg.style.color = '#007a3d';
        } else {
          sheetsStatusMsg.textContent = '✕ Connection Failed: ' + (data.error || 'Webhook did not respond.');
          sheetsStatusMsg.style.color = '#c8102e';
        }
      } catch (err) {
        sheetsStatusMsg.textContent = '✕ Connection Error: ' + err.message;
        sheetsStatusMsg.style.color = '#c8102e';
      }
    });
  }

  // 21. Sync All Submissions to Google Sheet
  if (btnSyncAllSheets) {
    btnSyncAllSheets.addEventListener('click', async () => {
      if (!confirm('Kya aap sabhi patient submissions ko Google Sheet mein sync karna chahte hain?')) return;

      sheetsStatusMsg.textContent = 'Syncing submissions to Google Sheet...';
      sheetsStatusMsg.style.color = '#0369a1';

      try {
        const res = await fetch('/api/admin/sync-sheets', {
          method: 'POST',
          headers: getHeaders()
        });
        const data = await res.json();
        if (data.success) {
          sheetsStatusMsg.textContent = '✓ ' + (data.message || 'Successfully synced submissions to Google Sheet.');
          sheetsStatusMsg.style.color = '#007a3d';
        } else {
          sheetsStatusMsg.textContent = '✕ Sync Error: ' + (data.error || 'Sync failed.');
          sheetsStatusMsg.style.color = '#c8102e';
        }
      } catch (err) {
        sheetsStatusMsg.textContent = '✕ Sync Error: ' + err.message;
        sheetsStatusMsg.style.color = '#c8102e';
      }
    });
  }

  // 22. Change Password Action
  passwordChangeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    passwordStatus.textContent = 'Updating...';
    passwordStatus.style.color = '#0f172a';

    const newPass = newAdminPassword.value;
    if (!newPass || newPass.length < 6) {
      passwordStatus.textContent = 'Password must be at least 6 characters.';
      passwordStatus.style.color = '#c8102e';
      return;
    }

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ new_password: newPass })
      });
      const data = await res.json();
      if (data.success) {
        passwordStatus.textContent = '✓ Password updated successfully!';
        passwordStatus.style.color = '#007a3d';
        newAdminPassword.value = '';
      } else {
        passwordStatus.textContent = 'Error: ' + (data.error || 'Failed to update');
        passwordStatus.style.color = '#c8102e';
      }
    } catch (err) {
      passwordStatus.textContent = 'Error: ' + err.message;
      passwordStatus.style.color = '#c8102e';
    }
  });

});
