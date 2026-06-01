// ===== ADMIN PANEL =====

let adminTeams = {};
let adminMatches = {};

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.remove('hidden');
  event.currentTarget.classList.add('active');

  if (tab === 'matches') renderMatchesByJudge();
  if (tab === 'stats') renderStats();
  if (tab === 'judges') loadJudgesList();
}

async function initAdmin() {
  await loadAdminData();
  renderTeamsList();
}

async function loadAdminData() {
  try {
    const [teamsSnap, matchesSnap] = await Promise.all([
      db.ref('teams').get(),
      db.ref('matches').get()
    ]);
    adminTeams = teamsSnap.exists() ? teamsSnap.val() : {};
    adminMatches = matchesSnap.exists() ? matchesSnap.val() : {};
  } catch (e) {
    console.error('Failed to load data', e);
  }
}

// ===== TEAMS =====

async function saveTeam() {
  const errEl = document.getElementById('teamFormError');
  const successEl = document.getElementById('teamFormSuccess');
  const name = document.getElementById('teamName').value.trim();
  const p1 = document.getElementById('player1').value.trim();
  const p2 = document.getElementById('player2').value.trim();
  const p3 = document.getElementById('player3').value.trim();
  const editId = document.getElementById('editTeamId').value;

  if (!name || !p1 || !p2 || !p3) { showError(errEl, 'All fields are required.'); return; }

  const data = { name, players: [p1, p2, p3] };

  try {
    if (editId) {
      await db.ref(`teams/${editId}`).set(data);
      showSuccess(successEl, 'Team updated!');
    } else {
      await db.ref('teams').push(data);
      showSuccess(successEl, 'Team added!');
    }
    await loadAdminData();
    renderTeamsList();
    resetTeamForm();
  } catch (e) {
    showError(errEl, 'Error: ' + e.message);
  }
}

function editTeam(id) {
  const team = adminTeams[id];
  if (!team) return;
  document.getElementById('editTeamId').value = id;
  document.getElementById('teamName').value = team.name || '';
  document.getElementById('player1').value = team.players?.[0] || '';
  document.getElementById('player2').value = team.players?.[1] || '';
  document.getElementById('player3').value = team.players?.[2] || '';
  document.querySelector('[onclick="switchTab(\'teams\')"]')?.click();
  document.getElementById('teamName').focus();
}

async function deleteTeam(id) {
  if (!confirm('Delete this team? This cannot be undone.')) return;
  try {
    await db.ref(`teams/${id}`).remove();
    await loadAdminData();
    renderTeamsList();
  } catch (e) { alert('Error: ' + e.message); }
}

function resetTeamForm() {
  document.getElementById('editTeamId').value = '';
  document.getElementById('teamName').value = '';
  document.getElementById('player1').value = '';
  document.getElementById('player2').value = '';
  document.getElementById('player3').value = '';
}

function renderTeamsList() {
  const container = document.getElementById('teamsList');
  const teams = Object.entries(adminTeams);
  if (!teams.length) { container.innerHTML = '<p class="empty-state">No teams yet.</p>'; return; }

  container.innerHTML = teams.map(([id, t]) => `
    <div class="team-item">
      <div class="team-item-header">
        <span class="team-item-name">${esc(t.name)}</span>
        <div class="team-item-actions">
          <button class="btn btn-ghost btn-sm" onclick="editTeam('${id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTeam('${id}')">Delete</button>
        </div>
      </div>
      <div class="team-item-players">
        ${(t.players || []).map(p => `<span class="player-tag">${esc(p)}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

// ===== MATCHES =====

function renderMatchesByJudge() {
  const container = document.getElementById('judgeGroups');
  const matches = Object.entries(adminMatches);
  if (!matches.length) { container.innerHTML = '<p class="empty-state">No matches yet.</p>'; return; }

  // Group by judge
  const groups = {};
  matches.forEach(([id, m]) => {
    const key = m.judgeId || 'unknown';
    if (!groups[key]) groups[key] = { name: m.judgeName || key, matches: [] };
    groups[key].matches.push([id, m]);
  });

  container.innerHTML = Object.entries(groups).map(([judgeId, group]) => {
    const sorted = group.matches.sort((a, b) => b[1].timestamp - a[1].timestamp);
    return `
      <div class="card">
        <div class="judge-group-title">${esc(group.name)}</div>
        <div class="match-history-list">
          ${sorted.map(([id, m]) => {
            const wl = m.winner === 'A'
              ? `<span class="match-winner-label winner-a">${esc(m.teamA)} wins</span>`
              : m.winner === 'B'
              ? `<span class="match-winner-label winner-b">${esc(m.teamB)} wins</span>`
              : `<span class="match-winner-label winner-draw">Draw</span>`;

            const playerScores = buildPlayerScoreString(m);

            return `<div class="match-card" style="flex-direction:column;align-items:flex-start;gap:0.5rem">
              <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
                <div class="match-card-teams">
                  <span>${esc(m.teamA)}</span>
                  <span class="match-card-score">${(m.scoreA||0).toLocaleString()} — ${(m.scoreB||0).toLocaleString()}</span>
                  <span>${esc(m.teamB)}</span>
                </div>
                <div style="display:flex;gap:0.5rem;align-items:center">
                  ${wl}
                  <button class="btn btn-danger btn-sm" onclick="deleteMatch('${id}')">✕</button>
                </div>
              </div>
              <div style="font-size:0.75rem;color:var(--text-dim);font-family:var(--font-mono)">${playerScores}</div>
              <div class="match-card-meta">${formatDate(m.timestamp)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function buildPlayerScoreString(m) {
  const parts = [];
  if (m.playerScoresA) {
    Object.entries(m.playerScoresA).forEach(([p, s]) => parts.push(`${esc(p)}: ${s.toLocaleString()}`));
  }
  if (m.playerScoresB) {
    Object.entries(m.playerScoresB).forEach(([p, s]) => parts.push(`${esc(p)}: ${s.toLocaleString()}`));
  }
  return parts.join(' · ');
}

async function deleteMatch(id) {
  if (!confirm('Delete this match?')) return;
  try {
    await db.ref(`matches/${id}`).remove();
    await loadAdminData();
    renderMatchesByJudge();
  } catch (e) { alert('Error: ' + e.message); }
}

// ===== STATS =====

function renderStats() {
  const matches = Object.values(adminMatches);

  // Team win count
  const teamWins = {};
  const teamTotalScore = {};
  const playerTotalScore = {};

  matches.forEach(m => {
    // Track wins
    if (m.winner === 'A') teamWins[m.teamA] = (teamWins[m.teamA] || 0) + 1;
    if (m.winner === 'B') teamWins[m.teamB] = (teamWins[m.teamB] || 0) + 1;

    // Track team scores
    teamTotalScore[m.teamA] = (teamTotalScore[m.teamA] || 0) + (m.scoreA || 0);
    teamTotalScore[m.teamB] = (teamTotalScore[m.teamB] || 0) + (m.scoreB || 0);

    // Track player scores
    if (m.playerScoresA) Object.entries(m.playerScoresA).forEach(([p, s]) => {
      playerTotalScore[p] = (playerTotalScore[p] || 0) + s;
    });
    if (m.playerScoresB) Object.entries(m.playerScoresB).forEach(([p, s]) => {
      playerTotalScore[p] = (playerTotalScore[p] || 0) + s;
    });
  });

  // Most wins
  const topWinner = Object.entries(teamWins).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('statMostWins').innerHTML = topWinner
    ? `${esc(topWinner[0])}<span class="stat-sub">${topWinner[1]} wins</span>`
    : '—';

  // Highest team score
  const topTeamScore = Object.entries(teamTotalScore).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('statHighestTeamScore').innerHTML = topTeamScore
    ? `${esc(topTeamScore[0])}<span class="stat-sub">${topTeamScore[1].toLocaleString()} pts</span>`
    : '—';

  // Highest player score
  const topPlayer = Object.entries(playerTotalScore).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('statHighestPlayerScore').innerHTML = topPlayer
    ? `${esc(topPlayer[0])}<span class="stat-sub">${topPlayer[1].toLocaleString()} pts</span>`
    : '—';

  // Team rankings
  const teamRankContainer = document.getElementById('statsTeamRankings');
  const sortedTeams = Object.entries(teamTotalScore).sort((a, b) => b[1] - a[1]);
  teamRankContainer.innerHTML = sortedTeams.length
    ? `<div class="ranking-list">${sortedTeams.slice(0, 10).map(([name, pts], i) => `
        <div class="ranking-item">
          <span class="ranking-pos">${i + 1}</span>
          <span class="ranking-name">${esc(name)}</span>
          <span class="ranking-score">${pts.toLocaleString()}</span>
        </div>`).join('')}</div>`
    : '<p class="empty-state">No data yet.</p>';

  // Player rankings
  const playerRankContainer = document.getElementById('statsPlayerRankings');
  const sortedPlayers = Object.entries(playerTotalScore).sort((a, b) => b[1] - a[1]);
  playerRankContainer.innerHTML = sortedPlayers.length
    ? `<div class="ranking-list">${sortedPlayers.slice(0, 10).map(([name, pts], i) => `
        <div class="ranking-item">
          <span class="ranking-pos">${i + 1}</span>
          <span class="ranking-name">${esc(name)}</span>
          <span class="ranking-score">${pts.toLocaleString()}</span>
        </div>`).join('')}</div>`
    : '<p class="empty-state">No data yet.</p>';
}

// ===== JUDGES =====

async function createJudge() {
  const errEl = document.getElementById('judgeFormError');
  const successEl = document.getElementById('judgeFormSuccess');
  const username = document.getElementById('judgeUsername').value.trim();
  const password = document.getElementById('judgePassword').value.trim();
  const displayName = document.getElementById('judgeDisplayName').value.trim();

  if (!username || !password || !displayName) { showError(errEl, 'All fields required.'); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { showError(errEl, 'Username: letters, numbers, underscore only.'); return; }

  try {
    const existing = await db.ref(`users/${username}`).get();
    if (existing.exists()) { showError(errEl, 'Username already taken.'); return; }

    await db.ref(`users/${username}`).set({ password, role: 'judge', displayName });
    showSuccess(successEl, `Judge "${displayName}" created!`);
    document.getElementById('judgeUsername').value = '';
    document.getElementById('judgePassword').value = '';
    document.getElementById('judgeDisplayName').value = '';
    loadJudgesList();
  } catch (e) {
    showError(errEl, 'Error: ' + e.message);
  }
}

async function loadJudgesList() {
  const container = document.getElementById('judgesList');
  try {
    const snap = await db.ref('users').get();
    if (!snap.exists()) { container.innerHTML = '<p class="empty-state">No accounts yet.</p>'; return; }

    const users = Object.entries(snap.val()).filter(([, u]) => u.role === 'judge' || u.role === 'admin');
    if (!users.length) { container.innerHTML = '<p class="empty-state">No judges yet.</p>'; return; }

    container.innerHTML = users.map(([id, u]) => `
      <div class="team-item">
        <div class="team-item-header">
          <div>
            <span class="team-item-name">${esc(u.displayName || id)}</span>
            <span class="judge-badge" style="margin-left:8px;font-size:0.7rem">${u.role}</span>
          </div>
          <div class="team-item-actions">
            ${u.role !== 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteJudge('${id}')">Delete</button>` : ''}
          </div>
        </div>
        <div style="font-family:var(--font-mono);font-size:0.75rem;color:var(--text-dim)">@${esc(id)}</div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<p class="empty-state">Error loading judges.</p>`;
  }
}

async function deleteJudge(id) {
  if (!confirm(`Delete judge account "${id}"?`)) return;
  try {
    await db.ref(`users/${id}`).remove();
    loadJudgesList();
  } catch (e) { alert('Error: ' + e.message); }
}

// ===== UTILS =====

function esc(str = '') {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
