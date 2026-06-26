// ===============================
// Load Teams from Google Sheets
// ===============================

// ===============================
// Robust Import Logic
// ===============================
window._isImporting = false;
window._importInterval = null;

function setFormFieldsDisabled(disabled) {
    const fields = ['teamName', 'leaderEmail', 'leaderName', 'workDone', 'wip', 'nextWeekPlan', 'achievements'];
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = disabled;
        }
    });
}

const importedRaw = sessionStorage.getItem('importedReport');
if (importedRaw) {
    window._isImporting = true;
    try {
        const parsed = JSON.parse(importedRaw);
        sessionStorage.removeItem('importedReport');
        
        let applyCount = 0;
        window._importInterval = setInterval(() => {
            const wd = document.getElementById("workDone");
            if (wd) {
                wd.value = parsed.workDone || "";
                document.getElementById("achievements").value = parsed.achievements || "";
                document.getElementById("wip").value = parsed.wip || "";
                document.getElementById("nextWeekPlan").value = parsed.nextWeekPlan || "";
            }
            applyCount++;
            if (applyCount > 6) clearInterval(window._importInterval); // Stop after 3 seconds
        }, 500);
        
        console.log("Importing past report data. Skipping normal fetch.");
    } catch (e) {
        console.error("Error parsing imported report", e);
    }
}

let teamsData = [];

async function loadTeams() {
    try {
        const response = await fetch(
            "https://n8n.globalwavedynamics.com/webhook/teams-data"
        );

        teamsData = await response.json();

        const teamDropdown =
            document.getElementById("teamName");

        if (!teamDropdown) return;

        // Reset to just the placeholder (prevents duplicates on repeated calls)
        teamDropdown.innerHTML =
            '<option value="" disabled selected>Choose Team</option>';

        teamsData.forEach(team => {
            // Skip any "Independent" entries in the API data — handled separately below
            if ((team["Team"] || '').trim().toLowerCase() === 'independent') return;

            const emails = (team["Team Leader Email"] || '').split(',').map(e => e.trim()).join(',');
            teamDropdown.innerHTML += `
                <option value="${team["Team"]}" data-email="${emails}" data-role="${(team["Role"] || '').trim()}">
                    ${team["Team"]}
                </option>
            `;
        });

        // Add Independent option at the bottom — only once
        if (!teamDropdown.querySelector('option[value="__independent__"]')) {
            teamDropdown.innerHTML += `
                <option value="__independent__" data-email="" data-role="independent">
                    Independent
                </option>
            `;
        }

    } catch (error) {
        console.error(
            "Error loading teams:",
            error
        );
    }
}

loadTeams();


// ===============================
// Team Selection Logic
// ===============================

const teamDropdown =
    document.getElementById("teamName");

if (teamDropdown) {

    teamDropdown.addEventListener(
        "change",
        function () {

            const selectedTeam = this.value;

            // ── Handle Independent option ──
            if (selectedTeam === '__independent__') {
                // Keep Team Leader Name visible & editable — clear it so user can type their name
                const leaderNameEl = document.getElementById('leaderName');
                if (leaderNameEl) {
                    leaderNameEl.removeAttribute('readonly');
                    leaderNameEl.value = '';
                    leaderNameEl.placeholder = 'Enter your name';
                }

                // Switch email field to a text input pre-filled with session email
                const emailContainer = document.getElementById('leaderEmail').parentElement;
                const sessionEmail = (typeof Auth !== 'undefined' ? Auth.getUser().email : '') ||
                                     sessionStorage.getItem('userEmail') || '';
                emailContainer.innerHTML = `
                    <label>Email Address</label>
                    <input type="email" id="leaderEmail"
                           value="${sessionEmail}"
                           placeholder="your@email.com"
                           required>
                `;
                return;
            }

            // ── Restore readonly + email select when switching away from Independent ──
            const leaderNameEl = document.getElementById('leaderName');
            if (leaderNameEl) {
                leaderNameEl.setAttribute('readonly', true);
                leaderNameEl.placeholder = 'Auto-filled';
            }
            const emailEl = document.getElementById('leaderEmail');
            if (emailEl && emailEl.tagName === 'INPUT') {
                const emailContainer = emailEl.parentElement;
                emailContainer.innerHTML = `
                    <label>Email Address</label>
                    <select id="leaderEmail" required>
                        <option value="">Choose Email</option>
                    </select>
                `;
            }

            const teamInfo =
                teamsData.find(
                    t => t["Team"] === selectedTeam
                );

            if (!teamInfo) return;

            document.getElementById(
                "leaderName"
            ).value =
                teamInfo["Team Leader"];

            const emailDropdown =
                document.getElementById(
                    "leaderEmail"
                );

            emailDropdown.innerHTML =
                '<option value="">Choose Email</option>';

            const emails =
                teamInfo[
                    "Team Leader Email"
                ].split(",");

            emails.forEach(email => {

                emailDropdown.innerHTML += `
                    <option value="${email.trim()}">
                        ${email.trim()}
                    </option>
                `;

            });

            const weekId =
                getCurrentWeekId();

            fetch(
                `https://n8n.globalwavedynamics.com/webhook/existing-report?team=${encodeURIComponent(selectedTeam)}&weekId=${weekId}`
            )
                .then(async response => {
                    const text = await response.text();

                    if (!text) {
                        return {};
                    }

                    return JSON.parse(text);
                })
                .then(report => {

                    console.log("Existing report:", report);

                    // Check if already submitted
                    const status = report["Status"] || report.status || "";
                    const isSubmitted = status.toLowerCase().includes("submitted") ||
                                       status.toLowerCase().includes("late");

                    const submitBtn = document.querySelector('#reportForm button[type="submit"]');
                    if (isSubmitted) {
                        if (submitBtn) {
                            submitBtn.disabled = true;
                            submitBtn.innerText = "Already Submitted for this Week";
                            submitBtn.style.background = "var(--text-muted)";
                            submitBtn.style.cursor = "not-allowed";
                        }
                        setFormFieldsDisabled(true);
                        if (window._isImporting) {
                            window._isImporting = false;
                            if (window._importInterval) {
                                clearInterval(window._importInterval);
                            }
                        }
                    } else {
                        if (submitBtn && !window._alreadySubmitted) {
                            submitBtn.disabled = false;
                            submitBtn.innerText = "Submit Weekly Report";
                            submitBtn.style.background = "";
                            submitBtn.style.cursor = "";
                            setFormFieldsDisabled(false);
                        }
                    }

                    if (window._isImporting) {
                        console.log("Skipping form text overwrite because we are using imported data.");
                        return;
                    }

                    // ── KEY FIX: Only fill text fields if report is SUBMITTED ──
                    // If not submitted, leave fields empty so the draft auto-loader
                    // can fill them without being wiped by this response.
                    if (isSubmitted) {
                        document.getElementById("workDone").value =
                            report["Work Done This Week"] || report.workDone || "";
                        document.getElementById("achievements").value =
                            report["Achievements"] || report.achievements || "";
                        document.getElementById("wip").value =
                            report["Work In Progress"] || report.wip || "";
                        document.getElementById("nextWeekPlan").value =
                            report["Plans For Next Week"] || report.nextWeekPlan || "";
                    }

                })
                .catch(error => {

                    console.log(
                        "No previous report found",
                        error
                    );

                });

        }
    );

}


// ===============================
// Check if Already Submitted
// ===============================

async function checkSubmissionStatus() {
    try {
        const sessionEmail = (typeof Auth !== 'undefined' ? Auth.getUser().email : '') || sessionStorage.getItem('userEmail') || '';
        if (!sessionEmail) return;

        const response = await fetch('https://n8n.globalwavedynamics.com/webhook/send-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: sessionEmail })
        });

        let resultText = await response.text();
        let result;
        try { result = JSON.parse(resultText); } catch(e) { result = resultText; }
        if (typeof result === 'string') { try { result = JSON.parse(result); } catch(e) {} }

        let historyData = [];
        if (Array.isArray(result)) {
            historyData = result;
            if (historyData.length === 1 && Array.isArray(historyData[0])) { historyData = historyData[0]; }
        } else if (result && result.data && Array.isArray(result.data)) {
            historyData = result.data;
        } else if (result && result.history && Array.isArray(result.history)) {
            historyData = result.history;
        } else if (result && typeof result === 'object' && (result["Week ID"] || result.weekId)) {
            historyData = [result];
        }

        const currentWeekId = typeof getCurrentWeekId !== 'undefined' ? getCurrentWeekId() : '';
        if (!currentWeekId) return;

        const submittedReport = historyData.find(row => {
            const wId = row["Week ID"] || row.weekId || '';
            const status = row["Status"] || row.status || 'Submitted'; // Default to submitted if missing
            return wId === currentWeekId && (status.toLowerCase().includes('submitted') || status.toLowerCase().includes('late'));
        });

        if (submittedReport) {
            window._alreadySubmitted = true;

            // Cancel any import
            if (window._isImporting) {
                window._isImporting = false;
                if (window._importInterval) {
                    clearInterval(window._importInterval);
                }
            }

            const submitBtn = document.querySelector('#reportForm button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Already Submitted for this Week";
                submitBtn.style.background = "var(--text-muted)";
                submitBtn.style.cursor = "not-allowed";
                submitBtn.title = "You have already submitted your report for the current week.";
            }

            setFormFieldsDisabled(true);

            // Populate the textareas with the submitted report data
            document.getElementById("workDone").value =
                submittedReport["Work Done This Week"] || submittedReport.workDone || "";
            document.getElementById("achievements").value =
                submittedReport["Achievements"] || submittedReport.achievements || "";
            document.getElementById("wip").value =
                submittedReport["Work In Progress"] || submittedReport.wip || "";
            document.getElementById("nextWeekPlan").value =
                submittedReport["Plans For Next Week"] || submittedReport.nextWeekPlan || "";
        }
    } catch(e) {
        console.error("Error checking submission status:", e);
    }
}

// Call the aggressive check
setTimeout(checkSubmissionStatus, 1000); // Small delay to let the UI settle

// ===============================
// Form Submission
// ===============================

const reportForm =
    document.getElementById(
        "reportForm"
    );

if (reportForm) {

    reportForm.addEventListener(
        "submit",
        async function (e) {

            e.preventDefault();

            const sessionEmail = (typeof Auth !== 'undefined' ? Auth.getUser().email : '') ||
                                 sessionStorage.getItem('userEmail') || '';

            const rawTeam = document.getElementById("teamName").value.trim();

            const data = {

                weekId:
                    getCurrentWeekId(),

                teamName:
                    rawTeam === '__independent__' ? 'Independent' : rawTeam,

                leaderName:
                    document.getElementById("leaderName").value.trim(),

                leaderEmail:
                    document.getElementById("leaderEmail").value.trim() || sessionEmail,

                workDone:
                    document.getElementById(
                        "workDone"
                    ).value,

                Achievements:
                    document.getElementById(
                        "achievements"
                    ).value,

                wip:
                    document.getElementById(
                        "wip"
                    ).value,

                nextWeekPlan:
                    document.getElementById(
                        "nextWeekPlan"
                    ).value

            };


            console.log(
                "Submitting:",
                data
            );
            
            const submitBtn = reportForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn ? submitBtn.innerText : "Submit";
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "Submitting...";
            }

            try {

                const response =
                    await fetch(
                        "https://n8n.globalwavedynamics.com/webhook/weekly-report",
                        {
                            method: "POST",
                            headers: {
                                "Content-Type":
                                    "application/json"
                            },
                            body:
                                JSON.stringify(
                                    data
                                )
                        }
                    );

                if (!response.ok) {
                    throw new Error(
                        "Failed to submit report"
                    );
                }

                let result = {};

                try {
                    result =
                        await response.json();
                } catch (e) {
                    console.log(
                        "No JSON response returned"
                    );
                }

                if (
                    result.success === false
                ) {

                    alert(
                        result.message
                    );
                    
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerText = originalBtnText;
                    }

                    return;

                }

                // Show the success popup
                showSuccessPopup();

                // Clear the saved draft from server — report submitted, draft no longer needed
                clearDraftFromServer();

                window._alreadySubmitted = true;
                setFormFieldsDisabled(true);

                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerText = "Already Submitted for this Week";
                    submitBtn.style.background = "var(--text-muted)";
                    submitBtn.style.cursor = "not-allowed";
                }

            } catch (error) {

                console.error(
                    "Submit Error:",
                    error
                );

                alert(
                    "Error connecting to webhook."
                );
                
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerText = originalBtnText;
                }

            }

        }
    );

}
function logout() {
    sessionStorage.clear();
    window.location.href = "login.html";
}

// ── Success Popup ──
function showSuccessPopup() {
    const overlay = document.getElementById('successPopup');
    if (!overlay) return;
    overlay.classList.add('show');
}

function hideSuccessPopup() {
    const overlay = document.getElementById('successPopup');
    if (overlay) overlay.classList.remove('show');
}

document.getElementById('popupCloseBtn')?.addEventListener('click', hideSuccessPopup);
document.getElementById('successPopup')?.addEventListener('click', function (e) {
    // Close if clicking the dark backdrop (not the box itself)
    if (e.target === this) hideSuccessPopup();
});

// ── Draft System ──────────────────────────────────────────

function setDraftStatus(msg, color) {
    const el = document.getElementById('draftStatus');
    if (!el) return;
    el.textContent = msg;
    el.style.color = color || 'var(--text-muted)';
}

async function saveDraftToServer() {
    if (window._alreadySubmitted) return;
    const email = (typeof Auth !== 'undefined' ? Auth.getUser().email : '') ||
                  sessionStorage.getItem('userEmail') || '';
    if (!email) return;

    const rawTeam = document.getElementById('teamName')?.value || '';
    const draft = {
        email,
        weekId:       typeof getCurrentWeekId === 'function' ? getCurrentWeekId() : '',
        teamName:     rawTeam === '__independent__' ? 'Independent' : rawTeam,
        leaderName:   document.getElementById('leaderName')?.value || '',
        workDone:     document.getElementById('workDone')?.value || '',
        wip:          document.getElementById('wip')?.value || '',
        nextWeekPlan: document.getElementById('nextWeekPlan')?.value || '',
        achievements: document.getElementById('achievements')?.value || ''
    };

    const hasContent = draft.workDone || draft.wip || draft.nextWeekPlan || draft.achievements;
    if (!hasContent) {
        setDraftStatus('Nothing to save yet.', 'var(--text-muted)');
        setTimeout(() => setDraftStatus('', ''), 2500);
        return;
    }

    const btn = document.getElementById('saveDraftBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    setDraftStatus('Saving draft…', 'var(--text-muted)');

    try {
        await fetch('https://n8n.globalwavedynamics.com/webhook/save-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(draft)
        });
        setDraftStatus('Draft saved ✓', '#22c55e');
        setTimeout(() => setDraftStatus('', ''), 3000);
    } catch (err) {
        console.warn('Save draft failed:', err);
        setDraftStatus('Save failed — try again.', '#ef4444');
        setTimeout(() => setDraftStatus('', ''), 3000);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 4px; margin-top: -2px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Draft'; }
    }
}

async function clearDraftFromServer() {
    const email = (typeof Auth !== 'undefined' ? Auth.getUser().email : '') ||
                  sessionStorage.getItem('userEmail') || '';
    if (!email) return;

    try {
        await fetch('https://n8n.globalwavedynamics.com/webhook/save-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                weekId:       typeof getCurrentWeekId === 'function' ? getCurrentWeekId() : '',
                teamName:     '',
                leaderName:   '',
                workDone:     '',
                wip:          '',
                nextWeekPlan: '',
                achievements: ''
            })
        });
        console.info('[WeeklyTracker] Draft cleared after submit.');
    } catch (err) {
        console.warn('Could not clear draft:', err);
    }
}

// Wire up the Save Draft button
document.getElementById('saveDraftBtn')?.addEventListener('click', saveDraftToServer);

// ── Load Draft on Page Open (n8n) ─────────────────────────
async function loadDraftFromServer() {
    if (window._alreadySubmitted) return;
    if (window._isImporting) return;

    const email = (typeof Auth !== 'undefined' ? Auth.getUser()?.email : '') ||
                  sessionStorage.getItem('userEmail') || '';
    if (!email) return;

    const weekId = typeof getCurrentWeekId === 'function' ? getCurrentWeekId() : '';

    try {
        const res = await fetch('https://n8n.globalwavedynamics.com/webhook/load-draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, weekId })
        });

        const text = await res.text();
        if (!text || !text.trim()) return;

        let draft;
        try { draft = JSON.parse(text); } catch (e) { return; }

        if (Array.isArray(draft)) draft = draft[0];
        if (!draft || typeof draft !== 'object') return;

        // Only fill fields that are currently empty
        const fill = (id, val) => {
            const el = document.getElementById(id);
            if (el && val && !el.value) el.value = val;
        };

        const valWorkDone     = draft['Work Done This Week'] || draft['Work Done '] || draft['Work Done'] || draft.workDone || draft.work_done || '';
        const valWip          = draft['Work In Progress']    || draft['WIP ']       || draft['WIP']        || draft.wip || '';
        const valNextWeekPlan = draft['Plans For Next Week'] || draft['Next Week Plan '] || draft['Next Week Plan'] || draft.nextWeekPlan || draft.next_week_plan || '';
        const valAchievements = draft['Achievements']        || draft['Achievements ']   || draft.achievements   || '';

        fill('workDone',     valWorkDone);
        fill('wip',          valWip);
        fill('nextWeekPlan', valNextWeekPlan);
        fill('achievements', valAchievements);

        const hasDraft = valWorkDone || valWip || valNextWeekPlan || valAchievements;
        if (hasDraft) {
            setDraftStatus('Draft loaded ✓  —  click Save Draft to update it anytime.', '#22c55e');
            setTimeout(() => setDraftStatus('', ''), 5000);
            console.info('[WeeklyTracker] Draft loaded from server.');
        }

    } catch (err) {
        console.warn('Could not load draft:', err);
    }
}

// Auto-load draft once page is ready
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(loadDraftFromServer, 800);
});
