// ===== JUDGE PANEL =====

let currentSession = null;
let allTeams = {};

document.addEventListener('DOMContentLoaded', () => {
  if (!db) return;
  currentSession = requireJudgeAuth();
  if (!currentSession) return;

  // Show judge info
  const badge = document.getElementById('judgeNameBadge');
  const label = document.getElementById('judgeLabel');
  if (badge) badge.textContent = currentSession.displayName;
  if (label) label.textContent = `Judge: ${currentSession.displayName}`;

  loadTeamsForJudge();
  loadJudgeHistory();

  // Live preview on score change
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('score-input')) updatePreview();
  });
});

async function loadTeamsForJudge() {
  try {
    const snap = await db.ref('teams').get();
    if (!snap.exists()) return;
    allTeams = snap.val();

    const selectA = document.getElementById('teamASelect');
    const selectB = document.getElementById('teamBSelect');

    Object.entries(allTeams).forEach(([id, team]) => {
      const optA = new Option(team.name, id);
      const optB = new Option(team.name, id);
      selectA.add(optA);
      selectB.add(optB);
    });
  } catch (e) {
    console.error('Failed to load teams', e);
  }
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

  const teamAId = document.getElementById('teamASelect')?.value;
  const teamBId = document.getElementById('teamBSelect')?.value;

  if (!teamAId || !teamBId) { showError(errEl, 'Please select both teams.'); return; }
  if (teamAId === teamBId) { showError(errEl, 'Teams must be different.'); return; }

  const teamA = allTeams[teamAId];
  const teamB = allTeams[teamBId];

  // Collect player scores
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

      return `<div class="match-card">
        <div>
          <div class="match-card-teams">
            <span>${esc(m.teamA)}</span>
            <span class="match-card-score">${(m.scoreA||0).toLocaleString()} — ${(m.scoreB||0).toLocaleString()}</span>
            <span>${esc(m.teamB)}</span>
          </div>
          <div class="match-card-meta">${formatDate(m.timestamp)}</div>
        </div>
        ${winnerLabel}
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
