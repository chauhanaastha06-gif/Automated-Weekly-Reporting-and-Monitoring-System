/* =========================================================
   login.js  –  Unified OTP login for both Team Leader & Admin
   Role values sent in payload: "User" | "Admin"
   ========================================================= */

// ── Helpers ──────────────────────────────────────────────
function showMessage(el, text, type) {
    if (!el) return;
    el.textContent = text;
    el.className = `login-message ${type}`;
    el.style.display = 'block';
}

function hideMessage(el) {
    if (el) el.style.display = 'none';
}

function setButtonLoading(btn, textEl, loading, label = '') {
    if (!btn) return;
    btn.disabled = loading;
    if (textEl) textEl.textContent = loading ? '' : label;
    let spinner = btn.querySelector('.btn-spinner');
    if (loading) {
        if (!spinner) {
            spinner = document.createElement('span');
            spinner.className = 'spinner spinner-sm btn-spinner';
            btn.appendChild(spinner);
        }
    } else {
        spinner?.remove();
    }
}


// ── OTP Modal ─────────────────────────────────────────────
const otpModal      = document.getElementById('otpModal');
const otpModalClose = document.getElementById('otpModalClose');

function openOtpModal(email) {
    const display = document.getElementById('otpEmailDisplay');
    if (display) display.textContent = email;
    document.getElementById('otp').value = '';
    hideMessage(document.getElementById('otpMessage'));
    otpModal.classList.add('open');
    setTimeout(() => document.getElementById('otp')?.focus(), 250);
    startResendCountdown();
}

function closeOtpModal() {
    otpModal.classList.remove('open');
}

otpModalClose?.addEventListener('click', closeOtpModal);
otpModal?.addEventListener('click', e => { if (e.target === otpModal) closeOtpModal(); });
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && otpModal?.classList.contains('open')) closeOtpModal();
});

// ── Resend countdown ──────────────────────────────────────
let resendTimer = null;

function startResendCountdown(seconds = 30) {
    const btn = document.getElementById('resendOtpBtn');
    if (!btn) return;
    btn.disabled = true;
    let remaining = seconds;
    btn.textContent = `Resend OTP (${remaining}s)`;
    clearInterval(resendTimer);
    resendTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(resendTimer);
            btn.textContent = 'Resend OTP';
            btn.disabled = false;
        } else {
            btn.textContent = `Resend OTP (${remaining}s)`;
        }
    }, 1000);
}

// ── Send OTP (works for both User & Admin) ────────────────
const sendOtpBtn  = document.getElementById('sendOtpBtn');
const sendOtpText = document.getElementById('sendOtpText');
const userMessage = document.getElementById('userMessage');

if (sendOtpBtn) {
    sendOtpBtn.addEventListener('click', async function () {
        const email = document.getElementById('email').value.trim();

        if (!email) {
            showMessage(userMessage, 'Please enter your email address.', 'error');
            return;
        }

        hideMessage(userMessage);
        setButtonLoading(sendOtpBtn, sendOtpText, true);

        try {
            const rolesToTry = ['User', 'Independent', 'Admin'];
            let successData = null;
            let successRole = null;

            // Try each role to find the one assigned to this email in Teams Data
            for (const role of rolesToTry) {
                const response = await fetch(
                    'https://n8n.globalwavedynamics.com/webhook/send-otp',
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, role })
                    }
                );
                const data = await response.json();
                if (data.success) {
                    successData = data;
                    successRole = role;
                    break;
                }
            }

            if (successData) {
                // Store the determined role so we can use it during verification
                sessionStorage.setItem('pendingRole', successRole);
                openOtpModal(email);
            } else {
                showMessage(userMessage, 'Invalid credentials.', 'error');
            }
        } catch {
            showMessage(userMessage, 'Failed to send OTP. Please try again.', 'error');
        }

        setButtonLoading(sendOtpBtn, sendOtpText, false, 'Send OTP');
    });
}

// ── Resend OTP ────────────────────────────────────────────
document.getElementById('resendOtpBtn')?.addEventListener('click', async function () {
    const email = document.getElementById('email').value.trim();
    const role = sessionStorage.getItem('pendingRole') || 'User';
    this.disabled = true;

    try {
    const response = await fetch(
        'https://n8n.globalwavedynamics.com/webhook/send-otp',
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, role })
        }
    );
    const data = await response.json();
    if (data.success) {
        showMessage(
            document.getElementById('otpMessage'),
            '✓ OTP sent — check your inbox.',
            'success'
        );
        startResendCountdown();
    } else {
        showMessage(
            document.getElementById('otpMessage'),
            data.message || 'Invalid credentials.',
            'error'
        );
    }
} catch (error) {
    showMessage(
        document.getElementById('otpMessage'),
        'Failed to send OTP. Try again.',
        'error'
    );
    console.error(error);
}

});

// ── Verify OTP (works for both User & Admin) ─────────────
const verifyOtpBtn  = document.getElementById('verifyOtpBtn');
const verifyOtpText = document.getElementById('verifyOtpText');

if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener('click', async function () {
        const email      = document.getElementById('email').value.trim();
        const otp        = document.getElementById('otp').value.trim();
        const role       = sessionStorage.getItem('pendingRole') || 'User';
        const otpMessage = document.getElementById('otpMessage');

        if (!otp) {
            showMessage(otpMessage, 'Please enter the OTP.', 'error');
            return;
        }

        hideMessage(otpMessage);
        setButtonLoading(verifyOtpBtn, verifyOtpText, true);

        try {
            const response = await fetch(
                'https://n8n.globalwavedynamics.com/webhook/verify-otp',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp, role })
                }
            );

            const result = await response.json();
            console.log('OTP verify result:', result);

            if (result.success === true && result.token) {
                // Extract role from backend response, defaulting to 'User'
                const assignedRole = result.role || (result.user && result.user.role) || 'User';

                // Store session
                sessionStorage.setItem('userEmail', email);
                Auth.login(result.token, result.user || {}, assignedRole);

                showMessage(otpMessage, '✓ Authenticated — redirecting…', 'success');

                // Admin → dashboard, User/Independent → history dashboard
                setTimeout(() => {
                    window.location.href = assignedRole === 'Admin' ? 'index.html' : 'history.html';
                }, 700);

            } else {
                showMessage(otpMessage, 'Invalid or expired OTP. Please try again.', 'error');
            }

                } catch (error) {
    console.error(error);

    showMessage(
        otpMessage,
        'Verification failed. Please try again.',
        'error'
    );
}

setButtonLoading(
    verifyOtpBtn,
    verifyOtpText,
    false,
    'Verify & Sign In'
);
});
}
