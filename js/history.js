document.addEventListener('DOMContentLoaded', async () => {
    const user = Auth.getUser();
    if (!user || !user.email) return;

    const historyLoading = document.getElementById('historyLoading');
    const historyTable = document.getElementById('historyTable');
    const historyBody = document.getElementById('historyBody');

    // View Modal Elements
    const viewModal = document.getElementById('viewModal');
    const viewModalClose = document.getElementById('viewModalClose');
    const viewModalTitle = document.getElementById('viewModalTitle');
    const viewWorkDone = document.getElementById('viewWorkDone');
    const viewWip = document.getElementById('viewWip');
    const viewPlanned = document.getElementById('viewPlanned');
    const viewAchievements = document.getElementById('viewAchievements');

    let historyData = [];

    // Fetch history
    try {
        const response = await fetch('https://n8n.globalwavedynamics.com/webhook/send-history', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email: user.email })
        });

        let resultText = await response.text();
        let result;
        try {
            result = JSON.parse(resultText);
        } catch(e) {
            result = resultText;
        }

        // Sometimes n8n webhook might return a stringified array
        if (typeof result === 'string') {
            try { result = JSON.parse(result); } catch(e) {}
        }
        
        // Debug logging
        console.log("Raw history response:", result);

        // Extract data based on common n8n structures
        if (Array.isArray(result)) {
            historyData = result;
            // Sometimes n8n wraps the data in another array: [ [ { ... } ] ]
            if (historyData.length === 1 && Array.isArray(historyData[0])) {
                historyData = historyData[0];
            }
        } else if (result && result.data && Array.isArray(result.data)) {
            historyData = result.data;
        } else if (result && result.history && Array.isArray(result.history)) {
            historyData = result.history;
        } else if (result && typeof result === 'object') {
            // Check if it's a single object instead of an array
            if (result["Week ID"] || result.weekId) {
                historyData = [result];
            } else {
                console.warn('Could not find data array in response:', result);
                historyData = [];
                // Attach raw response for debugging visually
                window._debugHistoryResponse = result;
            }
        } else {
            historyData = [];
            window._debugHistoryResponse = result;
        }
        
        // Ensure historyData is always an array
        if (!Array.isArray(historyData)) {
            historyData = [];
        }

        // Sort historyData by Week ID descending (latest first)
        historyData.sort((a, b) => {
            const aId = a["Week ID"] || a.weekId || '';
            const bId = b["Week ID"] || b.weekId || '';
            return bId.localeCompare(aId);
        });
        
        // Fetch and append Draft if it exists
        try {
            const weekId = typeof getCurrentWeekId === 'function' ? getCurrentWeekId() : '';
            if (weekId) {
                const draftRes = await fetch('https://n8n.globalwavedynamics.com/webhook/load-draft', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: user.email, weekId })
                });
                const draftText = await draftRes.text();
                if (draftText && draftText.trim()) {
                    let draftData;
                    try { draftData = JSON.parse(draftText); } catch(e){}
                    if (Array.isArray(draftData)) draftData = draftData[0];
                    if (draftData && typeof draftData === 'object') {
                        const valWorkDone     = draftData['Work Done This Week'] || draftData['Work Done '] || draftData['Work Done'] || draftData.workDone || draftData.work_done || '';
                        const valWip          = draftData['Work In Progress']    || draftData['WIP ']       || draftData['WIP']        || draftData.wip || '';
                        const valNextWeekPlan = draftData['Plans For Next Week'] || draftData['Next Week Plan '] || draftData['Next Week Plan'] || draftData.nextWeekPlan || draftData.next_week_plan || '';
                        const valAchievements = draftData['Achievements']        || draftData['Achievements ']   || draftData.achievements   || '';
                        
                        if (valWorkDone || valWip || valNextWeekPlan || valAchievements) {
                            draftData["Status"] = "Draft";
                            draftData["Week ID"] = weekId;
                            
                            // Prevent adding draft if history already has a submitted report for this week
                            const alreadySubmitted = historyData.some(row => (row["Week ID"] || row.weekId) === weekId);
                            if (!alreadySubmitted) {
                                historyData.unshift(draftData);
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Could not fetch draft for history:', e);
        }
        
    } catch (error) {
        console.error('Error fetching history:', error);
        historyLoading.innerHTML = '<div style="color: var(--red);">Failed to load history.</div>';
        return;
    }

    historyLoading.style.display = 'none';
    historyTable.style.display = 'table';

    if (historyData.length === 0) {
        let debugText = '';
        if (window._debugHistoryResponse) {
            try {
                debugText = '<br><br><small style="color:var(--text-muted);">Debug: ' + JSON.stringify(window._debugHistoryResponse) + '</small>';
            } catch(e) {}
        }
        historyBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">No history found.${debugText}</td></tr>`;
        return;
    }

    // Render table
    historyData.forEach((row, index) => {
        const weekId = row["Week ID"] || row.weekId || 'N/A';
        const status = row["Status"] || row.status || 'Submitted';
        
        // Status Badge Style
        let statusStyle = 'background: var(--green-bg); color: var(--green);';
        if (status.toLowerCase().includes('pending')) {
            statusStyle = 'background: var(--amber-bg); color: var(--amber);';
        } else if (status.toLowerCase().includes('late')) {
            statusStyle = 'background: var(--red-bg); color: var(--red);';
        } else if (status.toLowerCase().includes('draft')) {
            statusStyle = 'background: var(--blue-bg, #e0f2fe); color: var(--blue, #0284c7);';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${weekId}</td>
            <td><span class="status-badge" style="${statusStyle} padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;">${status}</span></td>
            <td>
                <button class="btn-sm btn-secondary-sm view-btn" data-index="${index}">View</button>
            </td>
            <td>
                <button class="btn-sm btn-primary-sm import-btn" data-index="${index}">Import</button>
            </td>
        `;
        historyBody.appendChild(tr);
    });

    // View functionality
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.target.getAttribute('data-index');
            const data = historyData[index];
            
            viewModalTitle.textContent = `Report Details - ${data["Week ID"] || data.weekId || 'N/A'}`;
            viewWorkDone.textContent = data["Work Done This Week"] || data["Work Done "] || data["Work Done"] || data.workDone || data.work_done || 'N/A';
            viewWip.textContent = data["Work In Progress"] || data["WIP "] || data["WIP"] || data.wip || 'N/A';
            viewPlanned.textContent = data["Plans For Next Week"] || data["Next Week Plan "] || data["Next Week Plan"] || data.nextWeekPlan || data.next_week_plan || 'N/A';
            viewAchievements.textContent = data["Achievements"] || data["Achievements "] || data.achievements || 'N/A';

            viewModal.classList.add('show');
        });
    });

    // Close Modal
    viewModalClose.addEventListener('click', () => viewModal.classList.remove('show'));
    viewModal.addEventListener('click', (e) => {
        if (e.target === viewModal) viewModal.classList.remove('show');
    });

    // Import functionality
    document.querySelectorAll('.import-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.target.getAttribute('data-index');
            const data = historyData[index];
            
            // Store the specific data we want to import into the form
            const importData = {
                workDone: data["Work Done This Week"] || data["Work Done "] || data["Work Done"] || data.workDone || data.work_done || '',
                wip: data["Work In Progress"] || data["WIP "] || data["WIP"] || data.wip || '',
                nextWeekPlan: data["Plans For Next Week"] || data["Next Week Plan "] || data["Next Week Plan"] || data.nextWeekPlan || data.next_week_plan || '',
                achievements: data["Achievements"] || data["Achievements "] || data.achievements || ''
            };
            
            sessionStorage.setItem('importedReport', JSON.stringify(importData));
            
            // Redirect to form.html
            window.location.href = 'form.html';
        });
    });
});
