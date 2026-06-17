// ===== ADMIN PANEL =====

let adminTeams = {};
let adminMatches = {};
let adminRounds = {};
let adminTimetable = {};

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.remove('hidden');
  event.currentTarget.classList.add('active');

  if (tab === 'matches') renderMatchesByJudge();
  if (tab === 'stats') renderStats();
  if (tab === 'judges') loadJudgesList();
  if (tab === 'rounds') renderRoundsTab();
  if (tab === 'timetable-admin') renderTimetableAdminTab();
}

async function initAdmin() {
  await loadAdminData();
  renderTeamsList();
}

async function loadAdminData() {
  try {
    const [teamsSnap, matchesSnap, roundsSnap, ttSnap] = await Promise.all([
      db.ref('teams').get(),
      db.ref('matches').get(),
      db.ref('rounds').get(),
      db.ref('timetable').get()
    ]);
    adminTeams = teamsSnap.exists() ? teamsSnap.val() : {};
    adminMatches = matchesSnap.exists() ? matchesSnap.val() : {};
    adminRounds = roundsSnap.exists() ? roundsSnap.val() : {};
    adminTimetable = ttSnap.exists() ? ttSnap.val() : {};
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

// ===== ROUNDS =====

function renderRoundsTab() {
  renderRoundTeamCheckboxes();
  renderRoundsList();
}

function renderRoundTeamCheckboxes() {
  const container = document.getElementById('roundTeamCheckboxes');
  const teams = Object.entries(adminTeams);
  if (!teams.length) {
    container.innerHTML = '<p class="empty-state" style="padding:1rem 0">No teams available.</p>';
    return;
  }
  container.innerHTML = teams.map(([id, t]) => `
    <label class="team-checkbox-item">
      <input type="checkbox" class="round-team-cb" value="${id}" />
      <span>${esc(t.name)}</span>
    </label>
  `).join('');
}

async function createRound() {
  const errEl = document.getElementById('roundFormError');
  const successEl = document.getElementById('roundFormSuccess');
  const name = document.getElementById('roundName').value.trim();

  if (!name) { showError(errEl, 'Round name is required.'); return; }

  const checked = document.querySelectorAll('.round-team-cb:checked');
  if (checked.length < 2) { showError(errEl, 'Select at least 2 teams.'); return; }

  const teamIds = {};
  checked.forEach(cb => { teamIds[cb.value] = true; });

  try {
    await db.ref('rounds').push({
      name,
      teamIds,
      closed: false,
      createdAt: Date.now()
    });
    showSuccess(successEl, `Round "${name}" created!`);
    document.getElementById('roundName').value = '';
    document.querySelectorAll('.round-team-cb').forEach(cb => cb.checked = false);
    await loadAdminData();
    renderRoundsList();
  } catch (e) {
    showError(errEl, 'Error: ' + e.message);
  }
}

function renderRoundsList() {
  const container = document.getElementById('roundsList');
  const rounds = Object.entries(adminRounds).sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));

  if (!rounds.length) {
    container.innerHTML = '<p class="empty-state">No rounds yet.</p>';
    return;
  }

  container.innerHTML = rounds.map(([id, r]) => {
    const teamNames = Object.keys(r.teamIds || {})
      .map(tid => adminTeams[tid]?.name || tid)
      .join(', ');

    return `
      <div class="team-item">
        <div class="team-item-header">
          <div>
            <span class="team-item-name">${esc(r.name)}</span>
            ${r.closed
              ? '<span class="judge-badge" style="margin-left:8px;font-size:0.7rem;background:rgba(255,71,87,0.1);color:var(--danger);border-color:rgba(255,71,87,0.3)">Lezárt</span>'
              : '<span class="judge-badge" style="margin-left:8px;font-size:0.7rem;background:rgba(46,213,115,0.1);color:var(--success);border-color:rgba(46,213,115,0.3)">Aktív</span>'
            }
          </div>
          <div class="team-item-actions">
            ${!r.closed
              ? `<button class="btn btn-danger btn-sm" onclick="closeRound('${id}')">Lezárás</button>`
              : `<button class="btn btn-ghost btn-sm" onclick="reopenRound('${id}')">Újranyitás</button>`
            }
            <button class="btn btn-danger btn-sm" onclick="deleteRound('${id}')">✕</button>
          </div>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem;font-family:var(--font-mono)">
          Teams: ${esc(teamNames)}
        </div>
      </div>
    `;
  }).join('');
}

async function closeRound(id) {
  if (!confirm('Close this round? Judges will no longer be able to add matches to other rounds.')) return;
  try {
    await db.ref(`rounds/${id}/closed`).set(true);
    await loadAdminData();
    renderRoundsList();
  } catch (e) { alert('Error: ' + e.message); }
}

async function reopenRound(id) {
  if (!confirm('Reopen this round?')) return;
  try {
    await db.ref(`rounds/${id}/closed`).set(false);
    await loadAdminData();
    renderRoundsList();
  } catch (e) { alert('Error: ' + e.message); }
}

async function deleteRound(id) {
  if (!confirm('Delete this round? This cannot be undone.')) return;
  try {
    await db.ref(`rounds/${id}`).remove();
    await loadAdminData();
    renderRoundsList();
  } catch (e) { alert('Error: ' + e.message); }
}

// ===== TIMETABLE ADMIN =====

function renderTimetableAdminTab() {
  populateTTRoundSelects();
  renderTimetableAdmin();
}

function populateTTRoundSelects() {
  const selects = ['ttRoundSelect', 'ttFilterRound'];
  const rounds = Object.entries(adminRounds).sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));

  selects.forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const isFilter = selId === 'ttFilterRound';
    sel.innerHTML = isFilter ? '<option value="">All Rounds</option>' : '<option value="">— Select round —</option>';
    rounds.forEach(([id, r]) => {
      sel.innerHTML += `<option value="${id}">${esc(r.name)}</option>`;
    });
  });
}

function onTTRoundChange() {
  const roundId = document.getElementById('ttRoundSelect').value;
  const team1Sel = document.getElementById('ttTeam1');
  const team2Sel = document.getElementById('ttTeam2');

  team1Sel.innerHTML = '<option value="">— Select team —</option>';
  team2Sel.innerHTML = '<option value="">— Select team —</option>';

  if (!roundId || !adminRounds[roundId]) return;

  const teamIds = adminRounds[roundId].teamIds || {};
  Object.keys(teamIds).forEach(tid => {
    const teamName = adminTeams[tid]?.name || tid;
    team1Sel.innerHTML += `<option value="${tid}">${esc(teamName)}</option>`;
    team2Sel.innerHTML += `<option value="${tid}">${esc(teamName)}</option>`;
  });
}

async function saveTimetableEntry() {
  const errEl = document.getElementById('ttFormError');
  const successEl = document.getElementById('ttFormSuccess');

  const roundId = document.getElementById('ttRoundSelect').value;
  const time = document.getElementById('ttTime').value;
  const team1Id = document.getElementById('ttTeam1').value;
  const team2Id = document.getElementById('ttTeam2').value;
  const room = document.getElementById('ttRoom').value.trim();

  if (!roundId) { showError(errEl, 'Select a round.'); return; }
  if (!time) { showError(errEl, 'Time is required.'); return; }
  if (!team1Id || !team2Id) { showError(errEl, 'Select both teams.'); return; }
  if (team1Id === team2Id) { showError(errEl, 'Teams must be different.'); return; }
  if (!room) { showError(errEl, 'Room number is required.'); return; }

  const team1Name = adminTeams[team1Id]?.name || team1Id;
  const team2Name = adminTeams[team2Id]?.name || team2Id;
  const roundName = adminRounds[roundId]?.name || roundId;

  try {
    await db.ref('timetable').push({
      roundId, roundName,
      datetime: time,
      team1Id, team1: team1Name,
      team2Id, team2: team2Name,
      room,
      createdAt: Date.now()
    });
    showSuccess(successEl, 'Timetable entry added!');
    document.getElementById('ttTime').value = '';
    document.getElementById('ttTeam1').value = '';
    document.getElementById('ttTeam2').value = '';
    document.getElementById('ttRoom').value = '';
    await loadAdminData();
    renderTimetableAdmin();
  } catch (e) {
    showError(errEl, 'Error: ' + e.message);
  }
}

function renderTimetableAdmin() {
  const container = document.getElementById('ttAdminList');
  const filterRound = document.getElementById('ttFilterRound')?.value || '';

  let entries = Object.entries(adminTimetable);
  if (filterRound) {
    entries = entries.filter(([, e]) => e.roundId === filterRound);
  }
  entries.sort((a, b) => {
    const ta = a[1].datetime || '';
    const tb = b[1].datetime || '';
    return ta.localeCompare(tb);
  });

  if (!entries.length) {
    container.innerHTML = '<p class="empty-state">No entries yet.</p>';
    return;
  }

  container.innerHTML = entries.map(([id, e]) => `
    <div class="team-item">
      <div class="team-item-header">
        <div>
          <span class="team-item-name">${esc(e.team1)} vs ${esc(e.team2)}</span>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteTimetableEntry('${id}')">✕</button>
      </div>
      <div style="font-size:0.8rem;color:var(--text-muted);font-family:var(--font-mono);margin-top:0.4rem">
        🕐 ${formatTTDateTime(e.datetime)} · 📍 Terem: ${esc(e.room)} · 🔄 ${esc(e.roundName || e.roundId)}
      </div>
    </div>
  `).join('');
}

async function deleteTimetableEntry(id) {
  if (!confirm('Delete this timetable entry?')) return;
  try {
    await db.ref(`timetable/${id}`).remove();
    await loadAdminData();
    renderTimetableAdmin();
  } catch (e) { alert('Error: ' + e.message); }
}

function formatTTDateTime(dtString) {
  if (!dtString) return '—';
  // Support both old datetime-local format and new time-only format (HH:MM)
  if (dtString.includes('T') || dtString.includes('-')) {
    const d = new Date(dtString);
    return d.toLocaleString('hu-HU', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }
  return dtString; // already HH:MM
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
            const roundLabel = m.roundId && adminRounds[m.roundId]
              ? `<span class="judge-badge" style="font-size:0.7rem">${esc(adminRounds[m.roundId].name)}</span>`
              : '';

            return `<div class="match-card" style="flex-direction:column;align-items:flex-start;gap:0.5rem">
              <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
                <div class="match-card-teams">
                  <span>${esc(m.teamA)}</span>
                  <span class="match-card-score">${(m.scoreA||0).toLocaleString()} — ${(m.scoreB||0).toLocaleString()}</span>
                  <span>${esc(m.teamB)}</span>
                </div>
                <div style="display:flex;gap:0.5rem;align-items:center">
                  ${roundLabel}
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

  const teamWins = {};
  const teamTotalScore = {};
  const playerTotalScore = {};

  matches.forEach(m => {
    if (m.winner === 'A') teamWins[m.teamA] = (teamWins[m.teamA] || 0) + 1;
    if (m.winner === 'B') teamWins[m.teamB] = (teamWins[m.teamB] || 0) + 1;

    teamTotalScore[m.teamA] = (teamTotalScore[m.teamA] || 0) + (m.scoreA || 0);
    teamTotalScore[m.teamB] = (teamTotalScore[m.teamB] || 0) + (m.scoreB || 0);

    if (m.playerScoresA) Object.entries(m.playerScoresA).forEach(([p, s]) => {
      playerTotalScore[p] = (playerTotalScore[p] || 0) + s;
    });
    if (m.playerScoresB) Object.entries(m.playerScoresB).forEach(([p, s]) => {
      playerTotalScore[p] = (playerTotalScore[p] || 0) + s;
    });
  });

  const topWinner = Object.entries(teamWins).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('statMostWins').innerHTML = topWinner
    ? `${esc(topWinner[0])}<span class="stat-sub">${topWinner[1]} wins</span>`
    : '—';

  const topTeamScore = Object.entries(teamTotalScore).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('statHighestTeamScore').innerHTML = topTeamScore
    ? `${esc(topTeamScore[0])}<span class="stat-sub">${topTeamScore[1].toLocaleString()} pts</span>`
    : '—';

  const topPlayer = Object.entries(playerTotalScore).sort((a, b) => b[1] - a[1])[0];
  document.getElementById('statHighestPlayerScore').innerHTML = topPlayer
    ? `${esc(topPlayer[0])}<span class="stat-sub">${topPlayer[1].toLocaleString()} pts</span>`
    : '—';

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
