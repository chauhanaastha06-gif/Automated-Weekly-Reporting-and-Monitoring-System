/* =========================================================
   auth.js  –  Central authentication & role-based access
   =========================================================
   Auth.guard()       – any authenticated user (redirects to login if not)
   Auth.adminOnly()   – Admin only; User role → redirected to form.html
   Auth.userOnly()    – User role only; Admin role → redirected to index.html
   Auth.getUser()     – returns { name, department, email, role, token }
   Auth.isAdmin()     – true if role === 'Admin'
   Auth.applyRoleUI() – hides/shows nav items & buttons based on role
   ========================================================= */

const Auth = (() => {

    const TOKEN_KEY = 'wt_token';
    const USER_KEY  = 'wt_user';
    const ROLE_KEY  = 'wt_role';

    /* ── Store session after successful login ── */
    function login(token, user, role) {
        sessionStorage.setItem(TOKEN_KEY, token);
        sessionStorage.setItem(USER_KEY,  JSON.stringify(user));
        sessionStorage.setItem(ROLE_KEY,  role);
    }

    /* ── Clear session on logout ── */
    function logout() {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(ROLE_KEY);
        sessionStorage.removeItem('userEmail');
        window.location.href = 'login.html';
    }

    /* ── Check if a valid session exists ── */
    function isAuthenticated() {
        return !!sessionStorage.getItem(TOKEN_KEY);
    }

    /* ── Role helpers ── */
    function getRole() {
        return sessionStorage.getItem(ROLE_KEY) || '';
    }

    // Role stored as "Admin" or "User" (capitalised, matching API payload)
    function isAdmin() {
        return getRole() === 'Admin';
    }

    function isUser() {
        return getRole() === 'User' || getRole() === 'Independent';
    }

    /* ── Get stored user object ── */
    function getUser() {
        try {
            const user = JSON.parse(sessionStorage.getItem(USER_KEY)) || {};
            user.email = sessionStorage.getItem('userEmail') || '';
            user.role  = getRole();
            user.token = sessionStorage.getItem(TOKEN_KEY);
            return user;
        } catch {
            return {};
        }
    }

    /* ─────────────────────────────────────────────────────────
       guard()
       Any authenticated user can proceed.
       Unauthenticated → login.html
    ───────────────────────────────────────────────────────── */
    function guard() {
        if (!isAuthenticated()) {
            window.location.replace('login.html');
            return false;
        }
        document.body.classList.add('ready');
        return true;
    }

    /* ─────────────────────────────────────────────────────────
       adminOnly()
       Only Admin role can access.
       Not logged in → login.html
       User role     → history.html  (their home page)
    ───────────────────────────────────────────────────────── */
    function adminOnly() {
        if (!isAuthenticated()) {
            window.location.replace('login.html');
            return false;
        }
        if (!isAdmin()) {
            window.location.replace('history.html');
            return false;
        }
        document.body.classList.add('ready');
        return true;
    }

    /* ─────────────────────────────────────────────────────────
       userOnly()
       Only User (Team Leader) role can access.
       Not logged in → login.html
       Admin role    → index.html (their home page)
    ───────────────────────────────────────────────────────── */
    function userOnly() {
        if (!isAuthenticated()) {
            window.location.replace('login.html');
            return false;
        }
        if (isAdmin()) {
            window.location.replace('index.html');
            return false;
        }
        document.body.classList.add('ready');
        return true;
    }

    function applyRoleUI() {
        const admin = isAdmin();
        const user  = isUser();

        /* ── Director Report button: Admin only ── */
        document.querySelectorAll('#sendReportBtn').forEach(btn => {
            btn.style.display = admin ? '' : 'none';
        });

        if (admin) {
            /* ── Hide "Submit Report" nav link for Admin ── */
            document.querySelectorAll('a[href="form.html"]').forEach(link => {
                if (link.closest('.nav-links')) link.style.display = 'none';
            });

            /* ── Hide "My Dashboard" (history) nav link for Admin ── */
            document.querySelectorAll('a[href="history.html"]').forEach(link => {
                if (link.closest('.nav-links')) link.style.display = 'none';
            });

            /* ── Lock submit form for Admin ── */
            const reportForm = document.getElementById('reportForm');
            if (reportForm) {
                reportForm.querySelectorAll('input, textarea, select, button[type="submit"]')
                    .forEach(el => el.disabled = true);

                const banner = document.createElement('div');
                banner.style.cssText = `
                    padding: 12px 16px;
                    background: rgba(239,68,68,0.12);
                    color: #ef4444;
                    border: 1px solid rgba(239,68,68,0.3);
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    margin-bottom: 16px;
                `;
                banner.textContent = '⚠ Admin accounts cannot submit reports. Use Director Report to export team data.';
                reportForm.parentElement.insertBefore(banner, reportForm);
            }
        }

        if (user) {
            /* ── Hide Dashboard nav link for User ── */
            document.querySelectorAll('a[href="index.html"]').forEach(link => {
                if (link.closest('.nav-links')) link.style.display = 'none';
            });

            /* ── Hide Tracker nav link for User ── */
            document.querySelectorAll('a[href="tracker.html"]').forEach(link => {
                if (link.closest('.nav-links')) link.style.display = 'none';
            });

            /* ── Hide Teams nav link for User ── */
            document.querySelectorAll('a[href="teams.html"]').forEach(link => {
                if (link.closest('.nav-links')) link.style.display = 'none';
            });


        }
    }

    return {
        login, logout,
        isAuthenticated, isAdmin, isUser, getRole, getUser,
        guard, adminOnly, userOnly,
        applyRoleUI
    };

})();
