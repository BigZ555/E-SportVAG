// ===== PUBLIC LEADERBOARD =====

let allTeamsPublic = {};
let allMatchesPublic = {};
let allRoundsPublic = {};
let currentRoundFilter = 'overall';

document.addEventListener('DOMContentLoaded', () => {
  if (!db) {
    document.getElementById('leaderboardBody').innerHTML =
      '<tr><td colspan="7" class="loading-row">⚠️ Database not configured. See js/firebase-config.js</td></tr>';
    return;
  }
  loadLeaderboard();
});

async function loadLeaderboard() {
  const tbody = document.getElementById('leaderboardBody');

  try {
    const [teamsSnap, matchesSnap, roundsSnap] = await Promise.all([
      db.ref('teams').get(),
      db.ref('matches').get(),
      db.ref('rounds').get()
    ]);

    allTeamsPublic = teamsSnap.exists() ? teamsSnap.val() : {};
    allMatchesPublic = matchesSnap.exists() ? matchesSnap.val() : {};
    allRoundsPublic = roundsSnap.exists() ? roundsSnap.val() : {};

    buildRoundSelector();
    renderStandings();

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row">Error loading data: ${e.message}</td></tr>`;
  }
}

function buildRoundSelector() {
  const container = document.getElementById('roundSelectorBtns');
  if (!container) return;

  // Keep Overall button
  let html = `<button class="round-btn ${currentRoundFilter === 'overall' ? 'active' : ''}" onclick="selectRound('overall')" id="btn-overall">Overall</button>`;

  // Add closed rounds
  const rounds = Object.entries(allRoundsPublic).sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
  rounds.forEach(([id, round]) => {
    const isActive = currentRoundFilter === id;
    html += `<button class="round-btn ${isActive ? 'active' : ''}" onclick="selectRound('${id}')">${esc(round.name)}</button>`;
  });

  container.innerHTML = html;
}

function selectRound(roundId) {
  currentRoundFilter = roundId;
  buildRoundSelector();
  renderStandings();
}

function renderStandings() {
  const tbody = document.getElementById('leaderboardBody');

  // Determine which teams and matches to include
  let teamsToShow = {};
  let matchesToConsider = {};

  if (currentRoundFilter === 'overall') {
    teamsToShow = { ...allTeamsPublic };
    matchesToConsider = { ...allMatchesPublic };
  } else {
    const round = allRoundsPublic[currentRoundFilter];
    if (!round) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">Round not found.</td></tr>';
      return;
    }
    // Only teams in this round
    const roundTeamIds = round.teamIds || {};
    Object.keys(roundTeamIds).forEach(tid => {
      if (allTeamsPublic[tid]) teamsToShow[tid] = allTeamsPublic[tid];
    });
    // Only matches in this round
    Object.entries(allMatchesPublic).forEach(([id, m]) => {
      if (m.roundId === currentRoundFilter) matchesToConsider[id] = m;
    });
  }

  // Build stats
  const stats = {};
  Object.entries(teamsToShow).forEach(([id, team]) => {
    stats[id] = { id, name: team.name, mp: 0, w: 0, d: 0, l: 0, pts: 0 };
  });

  Object.values(matchesToConsider).forEach(match => {
    const aId = match.teamAId;
    const bId = match.teamBId;

    if (!stats[aId]) stats[aId] = { id: aId, name: match.teamA, mp: 0, w: 0, d: 0, l: 0, pts: 0 };
    if (!stats[bId]) stats[bId] = { id: bId, name: match.teamB, mp: 0, w: 0, d: 0, l: 0, pts: 0 };

    stats[aId].mp++;
    stats[bId].mp++;
    stats[aId].pts += match.scoreA || 0;
    stats[bId].pts += match.scoreB || 0;

    if (match.winner === 'A') {
      stats[aId].w++; stats[bId].l++;
    } else if (match.winner === 'B') {
      stats[bId].w++; stats[aId].l++;
    } else {
      stats[aId].d++; stats[bId].d++;
    }
  });

  const sorted = Object.values(stats).sort((a, b) => {
    if (b.w !== a.w) return b.w - a.w;
    return b.pts - a.pts;
  });

  // Update stat bar
  document.getElementById('totalTeams').textContent = sorted.length || '0';
  const matchCount = currentRoundFilter === 'overall'
    ? Object.keys(allMatchesPublic).length
    : Object.keys(matchesToConsider).length;
  document.getElementById('totalMatches').textContent = matchCount || '0';
  document.getElementById('topTeam').textContent = sorted.length ? sorted[0].name : '—';

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No teams registered yet.</td></tr>';
    return;
  }

  renderMatches();

  tbody.innerHTML = sorted.map((t, i) => {
    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n';
    return `<tr>
      <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
      <td><strong class="team-name-link" onclick="openTeamModal('${t.id}')">${esc(t.name)}</strong></td>
      <td style="color:var(--text-muted)">${t.mp}</td>
      <td class="w-badge">${t.w}</td>
      <td class="d-badge">${t.d}</td>
      <td class="l-badge">${t.l}</td>
      <td class="points-badge">${t.pts.toLocaleString()}</td>
    </tr>`;
  }).join('');
}

function renderMatches() {
  const container = document.getElementById('matchesList');
  if (!container) return;

  let matchEntries = [];

  if (currentRoundFilter === 'overall') {
    // All matches, grouped by round
    Object.entries(allMatchesPublic).forEach(([id, m]) => {
      const round = allRoundsPublic[m.roundId];
      matchEntries.push({ id, match: m, roundName: round ? round.name : 'Unknown Round' });
    });
  } else {
    // Only matches from this round
    Object.entries(allMatchesPublic).forEach(([id, m]) => {
      if (m.roundId === currentRoundFilter) {
        matchEntries.push({ id, match: m, roundName: null });
      }
    });
  }

  // Sort newest first
  matchEntries.sort((a, b) => (b.match.createdAt || 0) - (a.match.createdAt || 0));

  if (matchEntries.length === 0) {
    container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-muted);font-family:var(--font-mono)">No matches played yet.</p>';
    return;
  }

  container.innerHTML = matchEntries.map(({ match: m, roundName }) => {
    const winnerA = m.winner === 'A';
    const winnerB = m.winner === 'B';
    const draw = m.winner === 'D' || (!winnerA && !winnerB);
    return `
    <div class="match-result-row">
      ${roundName ? `<span class="match-round-tag">${esc(roundName)}</span>` : ''}
      <span class="match-team team-name-link ${winnerA ? 'match-winner' : ''}" onclick="openTeamModal('${esc(m.teamAId || '')}')">${esc(m.teamA)}</span>
      <span class="match-score">${m.scoreA ?? 0} <span class="match-vs">:</span> ${m.scoreB ?? 0}</span>
      <span class="match-team match-team-right team-name-link ${winnerB ? 'match-winner' : ''}" onclick="openTeamModal('${esc(m.teamBId || '')}')">${esc(m.teamB)}</span>
      <span class="match-result-tag ${winnerA ? 'tag-win' : winnerB ? 'tag-loss' : 'tag-draw'}">${winnerA ? `${esc(m.teamA)} wins` : winnerB ? `${esc(m.teamB)} wins` : 'Draw'}</span>
    </div>`;
  }).join('');
}

function esc(str = '') {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
