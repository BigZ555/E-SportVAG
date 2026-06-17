// ===== AUTH HELPERS =====

function getSession() {
  try { return JSON.parse(localStorage.getItem('geocamp_user')) || null; } 
  catch { return null; }
}

function setSession(user) {
  localStorage.setItem('geocamp_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('geocamp_user');
}

function handleLogout() {
  clearSession();
  window.location.href = 'login.html';
}

// ===== LOGIN PAGE =====
async function handleLogin() {
  const username = document.getElementById('loginUsername')?.value.trim();
  const password = document.getElementById('loginPassword')?.value.trim();
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  if (!username || !password) {
    showError(errEl, 'Please enter username and password.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    const snap = await db.ref(`users/${username}`).get();
    if (!snap.exists()) {
      showError(errEl, 'User not found.');
      btn.disabled = false; btn.textContent = 'Sign In';
      return;
    }
    const user = snap.val();
    if (user.password !== password) {
      showError(errEl, 'Incorrect password.');
      btn.disabled = false; btn.textContent = 'Sign In';
      return;
    }
    setSession({ username, role: user.role, displayName: user.displayName || username });
    if (user.role === 'admin') {
      window.location.href = 'admin.html';
    } else {
      window.location.href = 'judge.html';
    }
  } catch (e) {
    showError(errEl, 'Connection error: ' + e.message);
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

// ===== ADMIN LOGIN =====
async function handleAdminLogin() {
  const username = document.getElementById('adminUsername')?.value.trim();
  const password = document.getElementById('adminPassword')?.value.trim();
  const errEl = document.getElementById('adminLoginError');

  if (!username || !password) { showError(errEl, 'Fill in all fields.'); return; }

  try {
    const snap = await db.ref(`users/${username}`).get();
    if (!snap.exists()) { showError(errEl, 'User not found.'); return; }
    const user = snap.val();
    if (user.password !== password) { showError(errEl, 'Wrong password.'); return; }
    if (user.role !== 'admin') { showError(errEl, 'Admin access required.'); return; }

    setSession({ username, role: 'admin', displayName: user.displayName || username });
    document.getElementById('adminLoginGate').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    initAdmin();
  } catch (e) {
    showError(errEl, 'Error: ' + e.message);
  }
}

// ===== GUARD for judge.html =====
function requireJudgeAuth() {
  const sess = getSession();
  if (!sess || (sess.role !== 'judge' && sess.role !== 'admin')) {
    window.location.href = 'login.html';
    return null;
  }
  return sess;
}

// ===== UTILS =====
function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

function showSuccess(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4000);
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Allow login form to submit on Enter key
document.addEventListener('DOMContentLoaded', () => {
  const pw = document.getElementById('loginPassword');
  if (pw) pw.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  const adpw = document.getElementById('adminPassword');
  if (adpw) adpw.addEventListener('keydown', e => { if (e.key === 'Enter') handleAdminLogin(); });
});
