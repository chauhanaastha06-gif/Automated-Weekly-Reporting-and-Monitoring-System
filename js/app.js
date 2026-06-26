let submissionChart = null;

// ── Utility: Safe JSON Parse to prevent empty response errors ──
async function safeJsonParse(response) {
    const text = await response.text();
    if (!text || text.trim() === '') return [];
    try {
        return JSON.parse(text);
    } catch (error) {
        console.warn('API returned invalid JSON. Treating as empty array:', text);
        return [];
    }
}

// ── Utility: Fetch Detailed Report from Webhook ────────────
async function showReportModal(teamName, weekId, teamEmail) {
    const viewModal = document.getElementById('viewModal');
    if (!viewModal) return;

    document.getElementById('viewModalTitle').textContent = `Report Details - ${teamName} (${weekId})`;
    document.getElementById('viewWorkDone').innerHTML = '<div class="spinner spinner-sm"></div> Loading...';
    document.getElementById('viewWip').innerHTML = '<div class="spinner spinner-sm"></div> Loading...';
    document.getElementById('viewPlanned').innerHTML = '<div class="spinner spinner-sm"></div> Loading...';
    document.getElementById('viewAchievements').innerHTML = '<div class="spinner spinner-sm"></div> Loading...';
    
    viewModal.classList.add('show');

    try {
        const response = await fetch('https://n8n.globalwavedynamics.com/webhook/send-history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: teamEmail })
        });
        
        let resultText = await response.text();
        let result;
        try { result = JSON.parse(resultText); } catch(e) { result = resultText; }
        if (typeof result === 'string') {
            try { result = JSON.parse(result); } catch(e) {}
        }
        
        let historyData = [];
        if (Array.isArray(result)) {
            historyData = result;
            if (historyData.length === 1 && Array.isArray(historyData[0])) {
                historyData = historyData[0];
            }
        } else if (result && result.data && Array.isArray(result.data)) {
            historyData = result.data;
        } else if (result && result.history && Array.isArray(result.history)) {
            historyData = result.history;
        } else if (result && typeof result === 'object') {
            if (result["Week ID"] || result.weekId) {
                historyData = [result];
            }
        }

        const entry = historyData.find(item => (item["Week ID"] || item.weekId) === weekId);

        if (!entry) {
            document.getElementById('viewWorkDone').textContent = 'No detailed data found for this week.';
            document.getElementById('viewWip').textContent = 'No detailed data found for this week.';
            document.getElementById('viewPlanned').textContent = 'No detailed data found for this week.';
            document.getElementById('viewAchievements').textContent = 'No detailed data found for this week.';
        } else {
            document.getElementById('viewWorkDone').textContent = entry["Work Done This Week"] || entry.workDone || 'N/A';
            document.getElementById('viewWip').textContent = entry["Work In Progress"] || entry.wip || 'N/A';
            document.getElementById('viewPlanned').textContent = entry["Plans For Next Week"] || entry.nextWeekPlan || 'N/A';
            document.getElementById('viewAchievements').textContent = entry["Achievements"] || entry.achievements || 'N/A';
        }
    } catch (err) {
        console.error('Error fetching details:', err);
        document.getElementById('viewWorkDone').textContent = 'Error loading data.';
        document.getElementById('viewWip').textContent = 'Error loading data.';
        document.getElementById('viewPlanned').textContent = 'Error loading data.';
        document.getElementById('viewAchievements').textContent = 'Error loading data.';
    }
}

// ── Utility: Get current ISO week ID ──────────────────────
function getCurrentWeekId() {
    const today       = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const daysPassed  = Math.floor((today - startOfYear) / 86400000);
    const weekNumber  = Math.ceil((daysPassed + startOfYear.getDay() + 1) / 7);
    return `${today.getFullYear()}-WK-${weekNumber}`;
}

// ── Week badge in navbar ───────────────────────────────────
const weekBadge = document.getElementById('weekBadgeNav');
if (weekBadge) {
    const today = new Date();
    weekBadge.textContent = `${getCurrentWeekId()} · ${today.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

// ── Theme toggle ──────────────────────────────────────────
const themeToggle = document.getElementById('themeToggle');
if (themeToggle) {
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-mode');
    }
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
    });
}

// ── Weekly schedule highlight ─────────────────────────────
function highlightSchedule() {
    const currDate       = new Date();
    const currentDayNum  = currDate.getDay() || 7;
    const monday         = new Date(currDate);
    monday.setDate(currDate.getDate() - (currentDayNum - 1));

    const days = { 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri' };

    Object.keys(days).forEach(dayNum => {
        const el = document.getElementById(days[dayNum]);
        if (!el) return;
        const targetDate = new Date(monday);
        targetDate.setDate(monday.getDate() + (parseInt(dayNum) - 1));
        const dateSpan = el.querySelector('.day-date');
        if (dateSpan) {
            dateSpan.textContent = targetDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        }
    });

    const today = currDate.getDay();
    if (days[today]) document.getElementById(days[today])?.classList.add('today');
    document.getElementById('thu')?.classList.add('reminder');
    document.getElementById('fri')?.classList.add('final-reminder');
}
highlightSchedule();

function showDirectorReportModal(isSuccess) {
    let modal = document.getElementById('directorReportModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'directorReportModal';
        modal.className = 'popup-overlay';
        modal.innerHTML = `
        <div class="popup-box">
            <div class="popup-icon" id="drModalIcon" style="margin: 0 auto 24px auto;"></div>
            <div class="popup-title" style="justify-content: center; border-bottom: none;" id="drModalTitle"></div>
            <div class="popup-msg" id="drModalMsg" style="text-align: center; margin-bottom: 32px; font-size: 16px;"></div>
            <div style="text-align: center;">
                <button class="popup-close-btn" id="drModalCloseBtn">Got it, thanks!</button>
            </div>
        </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('drModalCloseBtn').addEventListener('click', () => modal.classList.remove('show'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    }

    const iconEl = document.getElementById('drModalIcon');
    const titleEl = document.getElementById('drModalTitle');
    const msgEl = document.getElementById('drModalMsg');

    if (isSuccess) {
        iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
        iconEl.style.color = "var(--green, #10b981)";
        iconEl.style.background = "var(--green-bg, rgba(16, 185, 129, 0.1))";
        titleEl.textContent = 'Report Sent!';
        msgEl.innerHTML = 'Director report generation started successfully.<br>It will be delivered shortly.';
    } else {
        iconEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        iconEl.style.color = "var(--red, #ef4444)";
        iconEl.style.background = "var(--red-bg, rgba(239, 68, 68, 0.1))";
        titleEl.textContent = 'Action Failed';
        msgEl.innerHTML = 'Failed to start report generation.<br>Please try again later.';
    }

    modal.classList.add('show');
}

// ── Director Report button ────────────────────────────────
const sendBtn = document.getElementById('sendReportBtn');
if (sendBtn) {
    sendBtn.addEventListener('click', async () => {
        sendBtn.disabled  = true;
        sendBtn.innerText = 'Generating…';
        try {
            const user = JSON.parse(
  sessionStorage.getItem('wt_user')
);

await fetch(
  'https://n8n.globalwavedynamics.com/webhook/send-report-now',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reportedBy: user.name,
      department: user.department,
      role: user.role
    })
  }
);
            showDirectorReportModal(true);
            sendBtn.innerText = 'PDF Sent ✓';
        } catch (error) {
            console.error(error);
            showDirectorReportModal(false);
            sendBtn.innerText = 'Director Report';
        }
        setTimeout(() => {
            sendBtn.disabled  = false;
            sendBtn.innerText = 'Director Report';
        }, 5000);
    });
}

// ── Filter buttons (Tracker page) ────────────────────────
const allBtn       = document.getElementById('allBtn');
const submittedBtn = document.getElementById('submittedBtn');
const pendingBtn   = document.getElementById('pendingBtn');

function filterTrackerRows(matchStatus) {
    document.querySelectorAll('#trackerBody tr').forEach(row => {
        const status = row.cells[4]?.textContent.trim();
        row.style.display = (!matchStatus || status === matchStatus) ? '' : 'none';
    });
}

allBtn?.addEventListener('click',       () => filterTrackerRows(null));
submittedBtn?.addEventListener('click', () => filterTrackerRows('Submitted'));
pendingBtn?.addEventListener('click',   () => filterTrackerRows('Pending'));

// ── Tracker history pivot loader ──────────────────────────
async function loadTrackerHistory() {
    const historyBody  = document.getElementById('historyBody');
    const historyHead  = document.getElementById('historyHead');
    const historyWrap  = document.getElementById('historyTableWrap');
    if (!historyBody || !historyHead) return;

    historyBody.innerHTML = `<tr><td colspan="3"><div class="section-loader"><div class="spinner"></div> Loading history…</div></td></tr>`;

    try {
        const [teamsRes, trackerRes] = await Promise.all([
            fetch('https://n8n.globalwavedynamics.com/webhook/teams-data'),
            fetch('https://n8n.globalwavedynamics.com/webhook/tracker-data')
        ]);
        const teams       = await safeJsonParse(teamsRes);
        let trackerData   = await safeJsonParse(trackerRes);

        // Fetch historical data for all teams to augment the pivot table
        const historyPromises = teams.map(async (team) => {
            if (!team['Team Leader Email']) return [];
            try {
                const response = await fetch('https://n8n.globalwavedynamics.com/webhook/send-history', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: team['Team Leader Email'] })
                });
                
                let resultText = await response.text();
                let result;
                try { result = JSON.parse(resultText); } catch(e) { result = resultText; }
                if (typeof result === 'string') {
                    try { result = JSON.parse(result); } catch(e) {}
                }
                
                let historyData = [];
                if (Array.isArray(result)) {
                    historyData = result;
                    if (historyData.length === 1 && Array.isArray(historyData[0])) {
                        historyData = historyData[0];
                    }
                } else if (result && result.data && Array.isArray(result.data)) {
                    historyData = result.data;
                } else if (result && result.history && Array.isArray(result.history)) {
                    historyData = result.history;
                } else if (result && typeof result === 'object' && (result["Week ID"] || result.weekId)) {
                    historyData = [result];
                }

                return historyData.map(record => ({
                    'Team': team['Team'],
                    'Team Leader Email': team['Team Leader Email'],
                    'Week ID': record['Week ID'] || record.weekId,
                    'Submission Status': record['Status'] || record.status || 'Submitted'
                }));
            } catch (err) {
                console.error('Error fetching history for team', team['Team'], err);
                return [];
            }
        });

        const allHistories = await Promise.all(historyPromises);
        allHistories.flat().forEach(histRec => {
            if (!histRec['Week ID']) return;
            const exists = trackerData.find(t => t['Team'] === histRec['Team'] && t['Week ID'] === histRec['Week ID']);
            if (!exists) {
                trackerData.push(histRec);
            }
        });

        // Ensure all original data from API is correctly marked as submitted
        trackerData.forEach(entry => {
            if (!entry['Submission Status'] || String(entry['Submission Status']).trim() === '') {
                entry['Submission Status'] = 'Submitted';
            }
        });

        // Get all unique weeks discovered across all data
        const allWeeks = Array.from(new Set(trackerData.map(i => i['Week ID']).filter(Boolean)));
        
        // Ensure every team has an entry for every known week
        teams.forEach(team => {
            const teamName = team['Team'];
            allWeeks.forEach(weekId => {
                const exists = trackerData.find(t => t['Team'] === teamName && t['Week ID'] === weekId);
                if (!exists) {
                    trackerData.push({
                        'Team': teamName,
                        'Team Leader': team['Team Leader'],
                        'Team Leader Email': team['Team Leader Email'],
                        'Week ID': weekId,
                        'Submission Status': 'Not Submitted'
                    });
                }
            });
        });

        // Sort trackerData by Week ID (descending) so newest are first, then by Team
        trackerData.sort((a, b) => {
            const weekA = a['Week ID'] || '';
            const weekB = b['Week ID'] || '';
            if (weekA !== weekB) return weekB.localeCompare(weekA);
            const teamA = a['Team'] || '';
            const teamB = b['Team'] || '';
            return teamA.localeCompare(teamB);
        });

        const currentWeekId = typeof getCurrentWeekId === 'function' ? getCurrentWeekId() : null;

        // Check if we are on tracker-breakdown.html
        const isBreakdown = window.location.pathname.includes('tracker-breakdown.html');
        const urlParams = new URLSearchParams(window.location.search);
        const selectedWeekId = urlParams.get('weekId');

        if (isBreakdown && selectedWeekId) {
            // Detail View (tracker-breakdown.html)
            const titleEl = document.getElementById('breakdownTitle');
            if (titleEl) titleEl.textContent = `Breakdown for ${selectedWeekId}`;
            
            historyHead.innerHTML =
                '<tr>' +
                '<th>Team</th><th>Leader</th><th>Email</th><th>Status</th><th style="width: 80px;"></th>' +
                '</tr>';
            
            historyBody.innerHTML = '';
            const weekData = trackerData.filter(i => i['Week ID'] === selectedWeekId);
            
            if (weekData.length === 0) {
                historyBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No historical submissions found for this week.</td></tr>';
            } else {
                weekData.forEach(entry => {
                    const teamName = entry['Team'] || '—';
                    const entryEmail = entry['Team Leader Email'] || entry['Email'] || entry['leaderEmail'] || '';
                    let teamInfo = teams.find(t => t['Team'] === teamName && t['Team Leader Email'] === entryEmail);
                    if (!teamInfo) teamInfo = teams.find(t => t['Team'] === teamName) || {};
                    
                    const leader = teamInfo['Team Leader'] || entry['Team Leader'] || '—';
                    const email = teamInfo['Team Leader Email'] || entryEmail || '—';
                    const status = entry['Submission Status'] || 'Not Submitted';
                    const cls = status === 'Not Submitted' || status === '—' ? 'not-submitted' : status.toLowerCase().replace(/\s+/g, '-');
                    
                    let viewBtnHtml = '';
                    if (status !== 'Not Submitted' && status !== '—') {
                        viewBtnHtml = `<button class="btn-sm btn-secondary-sm tracker-view-btn" data-team="${teamName}" data-week="${selectedWeekId}" data-email="${email}">View</button>`;
                    }
                    
                    historyBody.innerHTML +=
                        `<tr>
                            <td><strong>${teamName}</strong></td>
                            <td>${leader}</td>
                            <td>${email}</td>
                            <td><span class="status ${cls}">${status}</span></td>
                            <td>${viewBtnHtml}</td>
                        </tr>`;
                });
            }
        } else if (historyHead && historyBody) {
            // Master View (tracker.html)
            historyHead.innerHTML =
                '<tr>' +
                '<th>Week ID</th><th>Total Teams</th><th>Submitted</th><th>Pending/Late</th><th style="width: 140px;">Action</th>' +
                '</tr>';
            
            historyBody.innerHTML = '';
            if (allWeeks.length === 0) {
                historyBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">No historical submissions found.</td></tr>';
            } else {
                allWeeks.forEach(weekId => {
                    const weekData = trackerData.filter(i => i['Week ID'] === weekId);
                    const totalTeams = teams.length;
                    const submittedCount = weekData.filter(i => {
                        const status = (i['Submission Status'] || '').toLowerCase();
                        return status.includes('submitted') && !status.includes('not submitted') && !status.includes('late');
                    }).length;
                    const lateCount = weekData.filter(i => (i['Submission Status'] || '').toLowerCase().includes('late')).length;
                    const pendingCount = totalTeams - submittedCount - lateCount;
                    
                    historyBody.innerHTML +=
                        `<tr>
                            <td style="font-weight: 600;">${weekId}</td>
                            <td>${totalTeams}</td>
                            <td><span class="status submitted">${submittedCount}</span></td>
                            <td><span class="status pending">${pendingCount + lateCount}</span></td>
                            <td><button class="btn-sm btn-secondary-sm" onclick="window.location.href='tracker-breakdown.html?weekId=${encodeURIComponent(weekId)}'">View Breakdown</button></td>
                        </tr>`;
                });
            }
        }

        // Update stat cards on tracker page
        const currentWeekData = trackerData.filter(i => i['Week ID'] === currentWeekId);
        const submitted = currentWeekData.filter(i => i['Submission Status'] === 'Submitted').length;
        const pending   = currentWeekData.filter(i => i['Submission Status'] === 'Pending').length;
        const uniqueWeeks = new Set(trackerData.map(i => i['Week ID']).filter(Boolean)).size;
        
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('trackerTotalTeams', teams.length);
        set('trackerSubmitted',  submitted);
        set('trackerPending',    pending);
        set('trackerWeekCount',  uniqueWeeks);

        // View Modal Logic for tracker.html
        const viewModal = document.getElementById('viewModal');
        const viewModalClose = document.getElementById('viewModalClose');
        if (viewModal && viewModalClose) {
            // Close Modal (only attach once, handled outside)
        }

    } catch (err) {
        console.error('Error loading tracker history:', err);
        historyBody.innerHTML = `<tr><td colspan="3" style="color:var(--red);padding:16px;">Failed to load history data.</td></tr>`;
    } finally {
        const loader = document.getElementById('pageLoader');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => loader.remove(), 350);
        }
    }
}

// ── Search box (Dashboard) ────────────────────────────────
function initSearchBox(trackerBody) {
    const searchBox = document.getElementById('searchBox');
    if (!searchBox || !trackerBody) return;
    searchBox.addEventListener('keyup', function () {
        const q = this.value.toLowerCase();
        trackerBody.querySelectorAll('tr').forEach(row => {
            row.style.display = row.cells[0]?.textContent.toLowerCase().includes(q) ? '' : 'none';
        });
    });
}

// ── Main data loader ──────────────────────────────────────
async function loadTeams() {
    try {
        const [teamsRes, trackerRes] = await Promise.all([
            fetch('https://n8n.globalwavedynamics.com/webhook/teams-data'),
            fetch('https://n8n.globalwavedynamics.com/webhook/tracker-data')
        ]);

        const teams       = await safeJsonParse(teamsRes);
        const trackerData = await safeJsonParse(trackerRes);
        const currentWeekId = getCurrentWeekId();

        // ── Dashboard: Tracker table ──────────────────────
        const trackerBody = document.getElementById('trackerBody');
        if (trackerBody) {
            trackerBody.innerHTML = `
                <tr><td colspan="6"><div class="section-loader"><div class="spinner"></div> Loading teams…</div></td></tr>
            `;
            await new Promise(r => setTimeout(r, 0));
            trackerBody.innerHTML = '';

            teams.forEach(team => {
                const entry  = trackerData.find(i => 
                    i['Team'] === team['Team'] && 
                    (i['Team Leader Email'] === team['Team Leader Email'] || i['Email'] === team['Team Leader Email'] || i['leaderEmail'] === team['Team Leader Email']) && 
                    i['Week ID'] === currentWeekId
                );
                const status = entry?.['Submission Status'] || 'Not Submitted';
                const statusClass = status.toLowerCase().replace(/\s+/g, '-');
                
                let viewBtnHtml = '';
                if (status !== 'Not Submitted') {
                    viewBtnHtml = `<button class="btn-sm btn-secondary-sm admin-view-btn" data-team="${team['Team']}" data-email="${team['Team Leader Email']}">View</button>`;
                }
                
                trackerBody.innerHTML += `
                    <tr>
                        <td>${team['Team']}</td>
                        <td>${team['Team Leader']}</td>
                        <td>${team['Team Leader Email']}</td>
                        <td>${currentWeekId}</td>
                        <td><span class="status ${statusClass}">${status}</span></td>
                        <td>${viewBtnHtml}</td>
                    </tr>
                `;
            });

            initSearchBox(trackerBody);

            // View Modal Logic
            const viewModal = document.getElementById('viewModal');
            const viewModalClose = document.getElementById('viewModalClose');
            if (viewModal && viewModalClose) {
                // Event delegation handles clicks, see bottom of file
            }
        }

        // ── Dashboard: Stat cards & Chart ────────────────
        const currentWeekData  = trackerData.filter(i => i['Week ID'] === currentWeekId);
        const submitted        = currentWeekData.filter(i => i['Submission Status'] === 'Submitted').length;
        const pending          = currentWeekData.filter(i => i['Submission Status'] === 'Pending').length;
        // Not submitted = teams that have NO entry in tracker data for this week
        const teamsWithEntry   = new Set(currentWeekData.map(i => i['Team']));
        const notSubmitted     = teams.filter(t => !teamsWithEntry.has(t['Team'])).length;
        const total            = teams.length;
        const percentage       = total > 0 ? Math.round((submitted / total) * 100) : 0;

        // Late = explicitly flagged as Late in Delay Status OR
        //        teams with no submission at all once the Friday deadline has passed
        const todayDay         = new Date().getDay(); // 0=Sun,1=Mon,...,5=Fri,6=Sat
        const deadlinePassed   = todayDay === 0 || todayDay === 6 || todayDay === 5;
        const lateFromFlag     = currentWeekData.filter(i => i['Delay Status'] === 'Late').length;
        const lateFromMissing  = deadlinePassed
            ? teams.filter(t => !teamsWithEntry.has(t['Team'])).length
            : 0;
        const late             = lateFromFlag + lateFromMissing;


        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        set('submittedCount',    submitted);
        set('pendingCount',      pending);
        set('notSubmittedCount', notSubmitted);
        set('lateCount',         late);
        set('overviewSubmitted',    submitted);
        set('overviewPending',      pending);
        set('overviewNotSubmitted', notSubmitted);
        set('overviewLate',         late);
        set('chartPercentage',   percentage + '%');

        // Tracker page counters
        set('trackerTotalTeams', teams.length);
        set('trackerSubmitted',  submitted);
        set('trackerPending',    pending);
        set('trackerWeek',       `${currentWeekId} (${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})`);

        // Last sync
        const lastSync = document.getElementById('lastSync');
        if (lastSync) lastSync.textContent = 'Last Sync: ' + new Date().toLocaleString();

        // ── Donut chart ───────────────────────────────────
        const chartCanvas = document.getElementById('submissionChart');
        if (chartCanvas) {
            if (submissionChart) submissionChart.destroy();
            submissionChart = new Chart(chartCanvas, {
                type: 'doughnut',
                data: {
                    labels:   ['Submitted', 'Pending', 'Not Submitted'],
                    datasets: [{
                        data:            [submitted, pending, notSubmitted],
                        backgroundColor: ['#22c55e', '#f59e0b', '#8b5cf6'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } }
                }
            });
        }

        // ── Teams page table (current week only) ─────────
        const teamsTableBody = document.getElementById('teamsTableBody');
        if (teamsTableBody) {
            teamsTableBody.innerHTML = '';
            teams.forEach((team, i) => {
                // Only look at this week's entry
                const entry  = trackerData.find(item => item['Team'] === team['Team'] && item['Week ID'] === currentWeekId);
                const status = entry?.['Submission Status'] || 'Not Submitted';
                const statusClass = status.toLowerCase().replace(/\s+/g, '-');
                teamsTableBody.innerHTML += `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${team['Team']}</td>
                        <td>${team['Team Leader']}</td>
                        <td>${team['Team Leader Email']}</td>
                        <td><span class="status ${statusClass}">${status}</span></td>
                    </tr>
                `;
            });
        }

    } catch (error) {
        console.error('Error loading data:', error);
    } finally {
        // Remove page loader
        const loader = document.getElementById('pageLoader');
        if (loader) {
            loader.classList.add('hidden');
            setTimeout(() => loader.remove(), 350);
        }
    }
}

loadTeams();
// Auto-refresh every 30 seconds
setInterval(loadTeams, 30000);

// Tracker history page
loadTrackerHistory();

// ============================================================================
// ── MANAGER TEAMS MODULE (Exclusively for teams.html) ───────────────────────
// ============================================================================

// ── API Call Functions ──
async function fetchManagerTeamsData() {
    const response = await fetch('https://n8n.globalwavedynamics.com/webhook/teams-data-for-manager');
    if (!response.ok) throw new Error('Failed to fetch teams data for manager');
    return await safeJsonParse(response);
}

// Re-uses the existing tracker-data endpoint
async function fetchTrackerDataForManager() {
    const response = await fetch('https://n8n.globalwavedynamics.com/webhook/tracker-data');
    if (!response.ok) throw new Error('Failed to fetch tracker data');
    return await safeJsonParse(response);
}

// ── Data Mapping Function ──
function mapTeamStatus(teamsData, trackerData, currentWeekId) {
    return teamsData.map(team => {
        const teamName    = team['Team'] || team['team'] || '—';
        const leaderName  = team['Team Leader'] || team['leader'] || '—';
        const leaderEmail = team['Team Leader Email'] || team['email'] || '—';
        
        let status = 'Not Submitted';
        if (currentWeekId) {
            const entry = trackerData.find(item => 
                item['Week ID'] === currentWeekId && 
                item['Team'] && 
                item['Team'].toLowerCase() === teamName.toLowerCase()
            );
            if (entry && entry['Submission Status']) {
                status = entry['Submission Status'];
            }
        }
        
        return {
            teamName,
            leaderName,
            leaderEmail,
            status,
            statusClass: status.toLowerCase().replace(/\s+/g, '-')
        };
    });
}

// ── Render Function ──
function renderManagerTeams(mappedData, tableBody) {
    tableBody.innerHTML = '';
    mappedData.forEach((data, i) => {
        tableBody.innerHTML += `
            <tr>
                <td>${i + 1}</td>
                <td>${data.teamName}</td>
                <td>${data.leaderName}</td>
                <td>${data.leaderEmail}</td>
            </tr>
        `;
    });
}

// ── Orchestrator ──
async function loadManagerTeams() {
    const tableBody = document.getElementById('managerTeamsTableBody');
    if (!tableBody) return;
    
    try {
        // 1. Fetch data
        const [teamsData, trackerData] = await Promise.all([
            fetchManagerTeamsData(),
            fetchTrackerDataForManager()
        ]);
        
        const currentWeekId = typeof getCurrentWeekId === 'function' ? getCurrentWeekId() : null;
        
        // 2. Map data
        const mappedData = mapTeamStatus(teamsData, trackerData, currentWeekId);
        
        // 3. Render
        renderManagerTeams(mappedData, tableBody);
        
    } catch (error) {
        console.error('Error loading manager teams data:', error);
        if (tableBody.innerHTML.includes('Loading')) {
            tableBody.innerHTML = `<tr><td colspan="5" style="color:var(--red);text-align:center;">Failed to load teams data</td></tr>`;
        }
    }
}

// Initialize custom loading mechanism if we are on teams.html
if (document.getElementById('managerTeamsTableBody')) {
    loadManagerTeams();
    setInterval(loadManagerTeams, 30000);
}

// ============================================================================
// ── MODAL EVENT DELEGATION ──────────────────────────────────────────────────
// ============================================================================
document.addEventListener('click', (e) => {
    // Check if click was on or inside an admin-view-btn
    const adminBtn = e.target.closest('.admin-view-btn');
    if (adminBtn) {
        const teamName = adminBtn.getAttribute('data-team');
        const teamEmail = adminBtn.getAttribute('data-email');
        const currentWeekId = typeof getCurrentWeekId === 'function' ? getCurrentWeekId() : null;
        if (currentWeekId) {
            showReportModal(teamName, currentWeekId, teamEmail);
        }
        return;
    }

    // Check if click was on or inside a tracker-view-btn
    const trackerBtn = e.target.closest('.tracker-view-btn');
    if (trackerBtn) {
        const teamName = trackerBtn.getAttribute('data-team');
        const weekId = trackerBtn.getAttribute('data-week');
        const teamEmail = trackerBtn.getAttribute('data-email');
        showReportModal(teamName, weekId, teamEmail);
        return;
    }

    // Check if click was on modal close button or outside the modal box
    const viewModal = document.getElementById('viewModal');
    const viewModalClose = document.getElementById('viewModalClose');
    if (viewModal && viewModal.classList.contains('show')) {
        if (e.target.closest('#viewModalClose') || e.target === viewModal) {
            viewModal.classList.remove('show');
        }
    }
});