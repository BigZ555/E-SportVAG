// ===== JUDGE PANEL =====

let currentSession = null;
let allTeams = {};
let allRounds = {};
let activeRound = null; // The currently active (non-closed) round
let selectedRound = null; // The round currently chosen in the round selector (defaults to activeRound)

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

      populateRoundSelect();
      // Default to the active round
      selectedRound = activeRound;

      // Set badge
      const badge = document.getElementById('activeRoundBadge');
      if (badge) badge.textContent = activeRound.name;

      // Populate teams — only teams in the selected round
      populateTeamSelects();
    }

  } catch (e) {
    console.error('Failed to load data', e);
  }

  loadJudgeHistory();
}

function populateRoundSelect() {
  const select = document.getElementById('roundSelect');
  if (!select) return;

  select.innerHTML = '';

  // All rounds, sorted newest first; active round labeled
  const entries = Object.entries(allRounds)
    .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0));

  entries.forEach(([id, r]) => {
    const isActive = activeRound && id === activeRound.id;
    const label = `${r.name}${r.closed ? ' (lezárt)' : ''}${isActive ? ' — aktív' : ''}`;
    const opt = new Option(label, id);
    select.add(opt);
  });

  if (activeRound) select.value = activeRound.id;
}

function onRoundChange() {
  const select = document.getElementById('roundSelect');
  const roundId = select?.value;
  if (!roundId || !allRounds[roundId]) return;

  selectedRound = { id: roundId, ...allRounds[roundId] };

  const badge = document.getElementById('activeRoundBadge');
  if (badge) badge.textContent = selectedRound.name + (selectedRound.closed ? ' (lezárt)' : '');

  populateTeamSelects();
  resetMatchForm({ keepRoundAndFormat: true });
}

function onFormatChange() {
  // Re-render the score inputs for whichever teams are already selected
  fillTeamPlayers('A');
  fillTeamPlayers('B');
}

function getMatchFormat() {
  const sel = document.getElementById('matchFormatSelect');
  return sel && sel.value === '2' ? 2 : 1;
}

function populateTeamSelects() {
  const selectA = document.getElementById('teamASelect');
  const selectB = document.getElementById('teamBSelect');

  // Reset
  selectA.innerHTML = '<option value="">— Choose team —</option>';
  selectB.innerHTML = '<option value="">— Choose team —</option>';

  const round = selectedRound || activeRound;
  if (!round) return;

  const teamIds = round.teamIds || {};
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
  const labelEl = document.getElementById(`team${side}ScoresLabel`);
  const teamLabel = side === 'A' ? 'Team A' : 'Team B';

  if (!teamId || !allTeams[teamId]) {
    playersDiv.innerHTML = '';
    scoresDiv.innerHTML = '';
    if (labelEl) labelEl.textContent = `${teamLabel} — Player Scores`;
    updatePreview();
    return;
  }

  const team = allTeams[teamId];
  const players = team.players || [];
  const format = getMatchFormat();

  playersDiv.innerHTML = players.map(p =>
    `<div class="player-chip">${esc(p)}</div>`
  ).join('');

  if (format === 2) {
    if (labelEl) labelEl.textContent = `${teamLabel} — Pontszámok (1. és 2. forduló)`;
    scoresDiv.innerHTML = `
      <div class="score-round-block">
        <div class="score-round-title">1. forduló</div>
        ${players.map((p, i) => `
          <div class="score-row">
            <span class="score-player-name">${esc(p)}</span>
            <input type="number" class="score-input" id="score${side}${i}_r1"
                   min="0" max="25000" placeholder="0" onchange="updatePreview()" />
          </div>
        `).join('')}
      </div>
      <div class="score-round-block">
        <div class="score-round-title">2. forduló</div>
        ${players.map((p, i) => `
          <div class="score-row">
            <span class="score-player-name">${esc(p)}</span>
            <input type="number" class="score-input" id="score${side}${i}_r2"
                   min="0" max="25000" placeholder="0" onchange="updatePreview()" />
          </div>
        `).join('')}
      </div>
    `;
  } else {
    if (labelEl) labelEl.textContent = `${teamLabel} — Player Scores`;
    scoresDiv.innerHTML = players.map((p, i) => `
      <div class="score-row">
        <span class="score-player-name">${esc(p)}</span>
        <input type="number" class="score-input" id="score${side}${i}"
               min="0" max="25000" placeholder="0" onchange="updatePreview()" />
      </div>
    `).join('');
  }

  updatePreview();
}

function getTeamRoundScore(side, roundSuffix) {
  const select = document.getElementById(`team${side}Select`);
  const teamId = select?.value;
  if (!teamId || !allTeams[teamId]) return 0;

  const players = allTeams[teamId].players || [];
  let total = 0;
  players.forEach((_, i) => {
    const elId = roundSuffix ? `score${side}${i}${roundSuffix}` : `score${side}${i}`;
    const val = parseInt(document.getElementById(elId)?.value || '0', 10);
    total += isNaN(val) ? 0 : val;
  });
  return total;
}

function getTeamTotalScore(side) {
  const format = getMatchFormat();
  if (format === 2) {
    return getTeamRoundScore(side, '_r1') + getTeamRoundScore(side, '_r2');
  }
  return getTeamRoundScore(side, '');
}

function updatePreview() {
  const teamAId = document.getElementById('teamASelect')?.value;
  const teamBId = document.getElementById('teamBSelect')?.value;
  const preview = document.getElementById('matchPreview');
  const breakdown = document.getElementById('matchRoundsBreakdown');

  if (!teamAId || !teamBId) {
    if (preview) preview.style.display = 'none';
    if (breakdown) breakdown.classList.add('hidden');
    return;
  }

  const format = getMatchFormat();
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

  if (format === 2 && breakdown) {
    const a1 = getTeamRoundScore('A', '_r1');
    const a2 = getTeamRoundScore('A', '_r2');
    const b1 = getTeamRoundScore('B', '_r1');
    const b2 = getTeamRoundScore('B', '_r2');
    breakdown.classList.remove('hidden');
    breakdown.innerHTML = `1. forduló: ${a1.toLocaleString()} — ${b1.toLocaleString()} &nbsp;|&nbsp; 2. forduló: ${a2.toLocaleString()} — ${b2.toLocaleString()}`;
  } else if (breakdown) {
    breakdown.classList.add('hidden');
    breakdown.innerHTML = '';
  }
}

async function saveMatch() {
  const errEl = document.getElementById('matchError');
  const successEl = document.getElementById('matchSuccess');

  const round = selectedRound || activeRound;

  if (!round) {
    showError(errEl, 'Nincs kiválasztott forduló. Kérlek válassz egy fordulót.');
    return;
  }

  const teamAId = document.getElementById('teamASelect')?.value;
  const teamBId = document.getElementById('teamBSelect')?.value;

  if (!teamAId || !teamBId) { showError(errEl, 'Please select both teams.'); return; }
  if (teamAId === teamBId) { showError(errEl, 'Teams must be different.'); return; }

  const teamA = allTeams[teamAId];
  const teamB = allTeams[teamBId];
  const format = getMatchFormat();

  let playerScoresA, playerScoresB, scoreA, scoreB, roundScores;

  if (format === 2) {
    const psA1 = {}, psA2 = {}, psB1 = {}, psB2 = {};
    (teamA.players || []).forEach((p, i) => {
      psA1[p] = parseInt(document.getElementById(`scoreA${i}_r1`)?.value || '0', 10) || 0;
      psA2[p] = parseInt(document.getElementById(`scoreA${i}_r2`)?.value || '0', 10) || 0;
    });
    (teamB.players || []).forEach((p, i) => {
      psB1[p] = parseInt(document.getElementById(`scoreB${i}_r1`)?.value || '0', 10) || 0;
      psB2[p] = parseInt(document.getElementById(`scoreB${i}_r2`)?.value || '0', 10) || 0;
    });

    playerScoresA = {};
    Object.keys(psA1).forEach(p => { playerScoresA[p] = (psA1[p] || 0) + (psA2[p] || 0); });
    playerScoresB = {};
    Object.keys(psB1).forEach(p => { playerScoresB[p] = (psB1[p] || 0) + (psB2[p] || 0); });

    scoreA = Object.values(playerScoresA).reduce((s, v) => s + v, 0);
    scoreB = Object.values(playerScoresB).reduce((s, v) => s + v, 0);

    roundScores = {
      round1: {
        scoreA: Object.values(psA1).reduce((s, v) => s + v, 0),
        scoreB: Object.values(psB1).reduce((s, v) => s + v, 0),
        playerScoresA: psA1,
        playerScoresB: psB1
      },
      round2: {
        scoreA: Object.values(psA2).reduce((s, v) => s + v, 0),
        scoreB: Object.values(psB2).reduce((s, v) => s + v, 0),
        playerScoresA: psA2,
        playerScoresB: psB2
      }
    };
  } else {
    playerScoresA = {};
    (teamA.players || []).forEach((p, i) => {
      const val = parseInt(document.getElementById(`scoreA${i}`)?.value || '0', 10);
      playerScoresA[p] = isNaN(val) ? 0 : val;
    });
    playerScoresB = {};
    (teamB.players || []).forEach((p, i) => {
      const val = parseInt(document.getElementById(`scoreB${i}`)?.value || '0', 10);
      playerScoresB[p] = isNaN(val) ? 0 : val;
    });

    scoreA = Object.values(playerScoresA).reduce((s, v) => s + v, 0);
    scoreB = Object.values(playerScoresB).reduce((s, v) => s + v, 0);
  }

  let winner = 'draw';
  if (scoreA > scoreB) winner = 'A';
  else if (scoreB > scoreA) winner = 'B';

  const matchData = {
    judgeId: currentSession.username,
    judgeName: currentSession.displayName,
    roundId: round.id,
    roundName: round.name,
    teamAId, teamBId,
    teamA: teamA.name,
    teamB: teamB.name,
    scoreA, scoreB,
    playerScoresA, playerScoresB,
    winner,
    format,
    timestamp: Date.now()
  };

  if (format === 2) matchData.roundScores = roundScores;

  try {
    await db.ref('matches').push(matchData);
    await removeMatchedTimetableEntry(round.id, teamAId, teamBId);
    showSuccess(successEl, `Match saved! ${winner === 'A' ? teamA.name : winner === 'B' ? teamB.name : 'Draw'} ${winner === 'draw' ? '' : 'wins!'}`);
    resetMatchForm({ keepRoundAndFormat: true });
    loadJudgeHistory();
  } catch (e) {
    showError(errEl, 'Failed to save: ' + e.message);
  }
}

// Removes the timetable entry for this round/team-pair, if one exists —
// the match has now been played, so it shouldn't show as "upcoming" anymore.
async function removeMatchedTimetableEntry(roundId, teamAId, teamBId) {
  try {
    const snap = await db.ref('timetable').get();
    if (!snap.exists()) return;
    const entries = snap.val();
    const deletions = [];
    Object.entries(entries).forEach(([id, e]) => {
      if (e.roundId !== roundId) return;
      const isMatch =
        (e.team1Id === teamAId && e.team2Id === teamBId) ||
        (e.team1Id === teamBId && e.team2Id === teamAId);
      if (isMatch) deletions.push(db.ref(`timetable/${id}`).remove());
    });
    await Promise.all(deletions);
  } catch (e) {
    console.error('Failed to clean up timetable entry', e);
  }
}

function resetMatchForm(opts = {}) {
  document.getElementById('teamASelect').value = '';
  document.getElementById('teamBSelect').value = '';
  document.getElementById('teamAPlayers').innerHTML = '';
  document.getElementById('teamBPlayers').innerHTML = '';
  document.getElementById('teamAScores').innerHTML = '';
  document.getElementById('teamBScores').innerHTML = '';

  const labelA = document.getElementById('teamAScoresLabel');
  const labelB = document.getElementById('teamBScoresLabel');
  if (labelA) labelA.textContent = 'Team A — Player Scores';
  if (labelB) labelB.textContent = 'Team B — Player Scores';

  if (!opts.keepRoundAndFormat) {
    const roundSelect = document.getElementById('roundSelect');
    if (roundSelect && activeRound) roundSelect.value = activeRound.id;
    selectedRound = activeRound;
    const formatSelect = document.getElementById('matchFormatSelect');
    if (formatSelect) formatSelect.value = '1';
  }

  const preview = document.getElementById('matchPreview');
  if (preview) preview.style.display = 'none';
  const breakdown = document.getElementById('matchRoundsBreakdown');
  if (breakdown) { breakdown.classList.add('hidden'); breakdown.innerHTML = ''; }
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

      const formatLabel = m.format === 2
        ? `<span class="judge-badge" style="font-size:0.7rem">2 fordulós</span>`
        : '';

      return `<div class="match-card" style="flex-direction:column;align-items:flex-start;gap:0.4rem">
        <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
          <div class="match-card-teams">
            <span class="team-name-link" onclick="openTeamModal('${esc(m.teamAId || '')}')">${esc(m.teamA)}</span>
            <span class="match-card-score">${(m.scoreA||0).toLocaleString()} — ${(m.scoreB||0).toLocaleString()}</span>
            <span class="team-name-link" onclick="openTeamModal('${esc(m.teamBId || '')}')">${esc(m.teamB)}</span>
          </div>
          <div style="display:flex;gap:0.5rem;align-items:center">
            ${roundLabel}
            ${formatLabel}
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
