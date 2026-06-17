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

// ===== NAVBAR AUTH STATE =====
// Call this on every page to show Login or Logout button dynamically

function initNavAuth() {
  const sess = getSession();
  const navLinks = document.getElementById('navAuthArea');
  if (!navLinks) return;

  if (!sess) {
    navLinks.innerHTML = `<a href="login.html" class="btn btn-ghost btn-sm">Login</a>`;
  } else {
    let badge = '';
    if (sess.role === 'admin') badge = `<span class="judge-badge" style="background:rgba(255,80,80,0.12);color:#ff5050;border-color:rgba(255,80,80,0.25)">Admin</span>`;
    else if (sess.role === 'judge') badge = `<span class="judge-badge">Judge</span>`;
    navLinks.innerHTML = `
      ${badge}
      <span style="font-size:0.8rem;color:var(--text-muted);padding:0 4px">${sess.displayName || sess.username}</span>
      <button class="btn btn-ghost btn-sm" onclick="handleLogout()">Logout</button>
    `;
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

    if (user.role === 'admin') {
      window.location.href = 'admin.html';
    } else if (user.role === 'judge') {
      window.location.href = 'judge.html';
    } else {
      window.location.href = 'index.html';
    }
  } catch (e) {
    showError(errEl, 'Connection error: ' + e.message);
    btn.disabled = false; btn.textContent = 'Sign In';
  }
}

// ===== ROUTE GUARDS =====

function requireRole(role) {
  const sess = getSession();
  if (!sess) {
    window.location.href = 'login.html';
    return null;
  }
  // Admin can access everything
  if (sess.role === 'admin') return sess;
  if (sess.role !== role) {
    window.location.href = sess.role === 'judge' ? 'judge.html' : 'index.html';
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

// Enter key support on login form
document.addEventListener('DOMContentLoaded', () => {
  const pw = document.getElementById('loginPassword');
  if (pw) pw.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  const un = document.getElementById('loginUsername');
  if (un) un.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
});
