// ===== SESSION =====
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
  window.location.href = 'index.html';
}

// ===== NAV RENDER =====
// Call this on every page to render the right nav buttons
function renderNav() {
  const sess = getSession();
  const navLinks = document.querySelector('.nav-links');
  if (!navLinks) return;

  // Remove old auth buttons if any
  navLinks.querySelectorAll('.nav-auth').forEach(el => el.remove());

  if (!sess) {
    // Not logged in -> show Login button
    const loginBtn = document.createElement('a');
    loginBtn.href = 'login.html';
    loginBtn.className = 'btn btn-ghost btn-sm nav-auth';
    loginBtn.textContent = 'Login';
    navLinks.appendChild(loginBtn);
  } else {
    // Logged in -> show role badge
    const badge = document.createElement('span');
    badge.className = 'nav-link judge-badge nav-auth';
    badge.textContent = sess.displayName || sess.username;
    navLinks.appendChild(badge);

    // Judge Panel button (visible for judge AND admin)
    if (sess.role === 'judge' || sess.role === 'admin') {
      const judgeBtn = document.createElement('a');
      judgeBtn.href = 'judge.html';
      judgeBtn.className = 'btn btn-ghost btn-sm nav-auth';
      judgeBtn.textContent = 'Judge Panel';
      navLinks.appendChild(judgeBtn);
    }

    // Admin Panel button (only for admin)
    if (sess.role === 'admin') {
      const adminBtn = document.createElement('a');
      adminBtn.href = 'admin.html';
      adminBtn.className = 'btn btn-ghost btn-sm nav-auth';
      adminBtn.textContent = 'Admin Panel';
      navLinks.appendChild(adminBtn);
    }

    // Logout button
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'btn btn-ghost btn-sm nav-auth';
    logoutBtn.textContent = 'Logout';
    logoutBtn.onclick = handleLogout;
    navLinks.appendChild(logoutBtn);
  }
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
    // Redirect based on role
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

// ===== GUARDS =====
function requireJudgeAuth() {
  const sess = getSession();
  if (!sess || (sess.role !== 'judge' && sess.role !== 'admin')) {
    window.location.href = 'login.html';
    return null;
  }
  return sess;
}

function requireAdminAuth() {
  const sess = getSession();
  if (!sess || sess.role !== 'admin') {
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

// Enter key on login form
document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  const pw = document.getElementById('loginPassword');
  if (pw) pw.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
});
