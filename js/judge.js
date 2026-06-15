// ===== JUDGE PANEL =====

let currentSession = null;
let allTeams = {};
let allRounds = {};
let activeRound = null; // The currently active (non-closed) round

document.addEventListener('DOMContentLoaded', () => {
  if (!db) return;
  currentSession = requireJudgeAuth();
  if (!currentSession) return;

  // Show judge info
  const badge = document.getElementById('judgeNameBadge');
  const label = document.getElementById('judgeLabel');
  if (badge) badge.textContent = currentSession.displayName;
  if (label) label.textContent = `Judge: ${currentSession.displayName}`;

  loadJudgeInit();

  // Live preview on score change
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('score-input')) updatePreview();
  });
});

async function loadJudgeInit() {
  try {
    const [teamsSnap, roundsSnap] = await Promise.all([
      db.ref('teams').get(),
      db.ref('rounds').get()
    ]);

    allTeams = teamsSnap.exists() ? teamsSnap.val() : {};
    allRounds = roundsSnap.exists() ? roundsSnap.val() : {};

    // Find the active (non-closed) round
    // Prefer the most recently created open round
    const openRounds = Object.entries(allRounds)
      .filter(([, r]) => !r.closed)
      .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

    if (openRounds.length === 0) {
      // No active round — show warning, hide form
      document.getElementById('noActiveRoundWarning').classList.remove('hidden');
      document.getElementById('matchFormCard').style.display = 'none';
    } else {
      activeRound = { id: openRounds[0][0], ...openRounds[0][1] };
      document.getElementById('noActiveRoundWarning').classList.add('hidden');
      document.getElementById('matchFormCard').style.display = '';

      // Set badge
      const badge = document.getElementById('activeRoundBadge');
      if (badge) badge.textContent = activeRound.name;

      // Populate teams — only teams in this round
      populateTeamSelects();
    }

  } catch (e) {
    console.error('Failed to load data', e);
  }

  loadJudgeHistory();
}

function populateTeamSelects() {
  const selectA = document.getElementById('teamASelect');
  const selectB = document.getElementById('teamBSelect');

  // Reset
  selectA.innerHTML = '<option value="">— Choose team —</option>';
  selectB.innerHTML = '<option value="">— Choose team —</option>';

  if (!activeRound) return;

  const teamIds = activeRound.teamIds || {};
  Object.keys(teamIds).forEach(tid => {
    if (!allTeams[tid]) return;
    const name = allTeams[tid].name;
    selectA.add(new Option(name, tid));
    selectB.add(new Option(name, tid));
  });
}

function fillTeamPlayers(side) {
  const select = document.getElementById(`team${side}Select`);
  const teamId = select.value;
  const playersDiv = document.getElementById(`team${side}Players`);
  const scoresDiv = document.getElementById(`team${side}Scores`);

  if (!teamId || !allTeams[teamId]) {
    playersDiv.innerHTML = '';
    scoresDiv.innerHTML = '';
    updatePreview();
    return;
  }

  const team = allTeams[teamId];
  const players = team.players || [];

  playersDiv.innerHTML = players.map(p =>
    `<div class="player-chip">${esc(p)}</div>`
  ).join('');

  scoresDiv.innerHTML = players.map((p, i) => `
    <div class="score-row">
      <span class="score-player-name">${esc(p)}</span>
      <input type="number" class="score-input" id="score${side}${i}" 
             min="0" max="25000" placeholder="0" onchange="updatePreview()" />
    </div>
  `).join('');

  updatePreview();
}

function getTeamTotalScore(side) {
  const select = document.getElementById(`team${side}Select`);
  const teamId = select?.value;
  if (!teamId || !allTeams[teamId]) return 0;

  const players = allTeams[teamId].players || [];
  let total = 0;
  players.forEach((_, i) => {
    const val = parseInt(document.getElementById(`score${side}${i}`)?.value || '0', 10);
    total += isNaN(val) ? 0 : val;
  });
  return total;
}

function updatePreview() {
  const teamAId = document.getElementById('teamASelect')?.value;
  const teamBId = document.getElementById('teamBSelect')?.value;
  const preview = document.getElementById('matchPreview');

  if (!teamAId || !teamBId) { if (preview) preview.style.display = 'none'; return; }

  const scoreA = getTeamTotalScore('A');
  const scoreB = getTeamTotalScore('B');

  document.getElementById('previewScoreA').textContent = scoreA.toLocaleString();
  document.getElementById('previewScoreB').textContent = scoreB.toLocaleString();
  document.getElementById('previewA').innerHTML = `<strong>${esc(allTeams[teamAId]?.name || '')}</strong>: ${scoreA.toLocaleString()}`;
  document.getElementById('previewB').innerHTML = `<strong>${esc(allTeams[teamBId]?.name || '')}</strong>: ${scoreB.toLocaleString()}`;

  const winnerEl = document.getElementById('previewWinner');
  if (scoreA > scoreB) {
    winnerEl.textContent = allTeams[teamAId]?.name + ' WINS';
    winnerEl.style.color = 'var(--success)';
  } else if (scoreB > scoreA) {
    winnerEl.textContent = allTeams[teamBId]?.name + ' WINS';
    winnerEl.style.color = 'var(--success)';
  } else {
    winnerEl.textContent = 'DRAW';
    winnerEl.style.color = 'var(--text-muted)';
  }

  preview.style.display = 'flex';
}

async function saveMatch() {
  const errEl = document.getElementById('matchError');
  const successEl = document.getElementById('matchSuccess');

  // Re-check active round
  if (!activeRound || activeRound.closed) {
    showError(errEl, 'No active round. An admin must open a round first.');
    return;
  }

  const teamAId = document.getElementById('teamASelect')?.value;
  const teamBId = document.getElementById('teamBSelect')?.value;

  if (!teamAId || !teamBId) { showError(errEl, 'Please select both teams.'); return; }
  if (teamAId === teamBId) { showError(errEl, 'Teams must be different.'); return; }

  const teamA = allTeams[teamAId];
  const teamB = allTeams[teamBId];

  const playerScoresA = {};
  (teamA.players || []).forEach((p, i) => {
    const val = parseInt(document.getElementById(`scoreA${i}`)?.value || '0', 10);
    playerScoresA[p] = isNaN(val) ? 0 : val;
  });
  const playerScoresB = {};
  (teamB.players || []).forEach((p, i) => {
    const val = parseInt(document.getElementById(`scoreB${i}`)?.value || '0', 10);
    playerScoresB[p] = isNaN(val) ? 0 : val;
  });

  const scoreA = Object.values(playerScoresA).reduce((s, v) => s + v, 0);
  const scoreB = Object.values(playerScoresB).reduce((s, v) => s + v, 0);

  let winner = 'draw';
  if (scoreA > scoreB) winner = 'A';
  else if (scoreB > scoreA) winner = 'B';

  const matchData = {
    judgeId: currentSession.username,
    judgeName: currentSession.displayName,
    roundId: activeRound.id,
    roundName: activeRound.name,
    teamAId, teamBId,
    teamA: teamA.name,
    teamB: teamB.name,
    scoreA, scoreB,
    playerScoresA, playerScoresB,
    winner,
    timestamp: Date.now()
  };

  try {
    await db.ref('matches').push(matchData);
    showSuccess(successEl, `Match saved! ${winner === 'A' ? teamA.name : winner === 'B' ? teamB.name : 'Draw'} ${winner === 'draw' ? '' : 'wins!'}`);
    resetMatchForm();
    loadJudgeHistory();
  } catch (e) {
    showError(errEl, 'Failed to save: ' + e.message);
  }
}

function resetMatchForm() {
  document.getElementById('teamASelect').value = '';
  document.getElementById('teamBSelect').value = '';
  document.getElementById('teamAPlayers').innerHTML = '';
  document.getElementById('teamBPlayers').innerHTML = '';
  document.getElementById('teamAScores').innerHTML = '';
  document.getElementById('teamBScores').innerHTML = '';
  const preview = document.getElementById('matchPreview');
  if (preview) preview.style.display = 'none';
}

async function loadJudgeHistory() {
  const container = document.getElementById('judgeMatchHistory');
  try {
    const snap = await db.ref('matches').orderByChild('judgeId').equalTo(currentSession.username).get();
    if (!snap.exists()) { container.innerHTML = '<p class="empty-state">No matches recorded yet.</p>'; return; }

    const matches = Object.entries(snap.val()).sort((a, b) => b[1].timestamp - a[1].timestamp);

    container.innerHTML = matches.map(([id, m]) => {
      const winnerLabel = m.winner === 'A'
        ? `<span class="match-winner-label winner-a">${esc(m.teamA)} wins</span>`
        : m.winner === 'B'
        ? `<span class="match-winner-label winner-b">${esc(m.teamB)} wins</span>`
        : `<span class="match-winner-label winner-draw">Draw</span>`;

      const roundLabel = m.roundName
        ? `<span class="judge-badge" style="font-size:0.7rem">${esc(m.roundName)}</span>`
        : '';

      return `<div class="match-card" style="flex-direction:column;align-items:flex-start;gap:0.4rem">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
          <div class="match-card-teams">
            <span>${esc(m.teamA)}</span>
            <span class="match-card-score">${(m.scoreA||0).toLocaleString()} — ${(m.scoreB||0).toLocaleString()}</span>
            <span>${esc(m.teamB)}</span>
          </div>
          <div style="display:flex;gap:0.5rem;align-items:center">
            ${roundLabel}
            ${winnerLabel}
          </div>
        </div>
        <div class="match-card-meta">${formatDate(m.timestamp)}</div>
      </div>`;
    }).join('');
  } catch (e) {
    container.innerHTML = `<p class="empty-state">Error loading history.</p>`;
  }
}

function esc(str = '') {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
