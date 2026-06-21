// ===== TEAM DETAIL MODAL =====
// Reusable popup: click any team name anywhere (standings, matches, timetable, judge history)
// to see that team's scheduled matches, played matches, and total points.
// Self-contained: fetches its own data from Firebase, so it works on any page
// that has loaded firebase-config.js (db must be defined).

let _teamModalRoundFilter = 'all';
let _teamModalCurrentTeamId = null;

function _ensureTeamModalDom() {
  if (document.getElementById('teamModalOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'teamModalOverlay';
  overlay.className = 'team-modal-overlay hidden';
  overlay.innerHTML = `
    <div class="team-modal" id="teamModalBox">
      <button class="team-modal-close" id="teamModalCloseBtn" aria-label="Close">&times;</button>
      <div id="teamModalBody">
        <p class="empty-state" style="padding:2rem;text-align:center">Loading…</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTeamModal();
  });
  document.getElementById('teamModalCloseBtn').addEventListener('click', closeTeamModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeTeamModal();
  });
}

function closeTeamModal() {
  const overlay = document.getElementById('teamModalOverlay');
  if (overlay) overlay.classList.add('hidden');
}

async function openTeamModal(teamId) {
  if (!teamId || !db) return;
  _ensureTeamModalDom();
  _teamModalRoundFilter = 'all';
  _teamModalCurrentTeamId = teamId;

  const overlay = document.getElementById('teamModalOverlay');
  const body = document.getElementById('teamModalBody');
  overlay.classList.remove('hidden');
  body.innerHTML = '<p class="empty-state" style="padding:2rem;text-align:center">Loading…</p>';

  try {
    const [teamSnap, timetableSnap, matchesSnap, roundsSnap] = await Promise.all([
      db.ref(`teams/${teamId}`).get(),
      db.ref('timetable').get(),
      db.ref('matches').get(),
      db.ref('rounds').get()
    ]);

    const team = teamSnap.exists() ? teamSnap.val() : null;
    const allTimetable = timetableSnap.exists() ? timetableSnap.val() : {};
    const allMatches = matchesSnap.exists() ? matchesSnap.val() : {};
    const allRounds = roundsSnap.exists() ? roundsSnap.val() : {};

    if (!team) {
      body.innerHTML = '<p class="empty-state" style="padding:2rem;text-align:center">Csapat nem található.</p>';
      return;
    }

    _renderTeamModal(teamId, team, allTimetable, allMatches, allRounds);
  } catch (e) {
    body.innerHTML = `<p class="empty-state" style="padding:2rem;text-align:center">Hiba: ${_tmEsc(e.message)}</p>`;
  }
}

function _renderTeamModal(teamId, team, allTimetable, allMatches, allRounds) {
  const body = document.getElementById('teamModalBody');

  // All scheduled timetable entries for this team
  const scheduledAll = Object.entries(allTimetable)
    .filter(([, e]) => e.team1Id === teamId || e.team2Id === teamId);

  // All played matches for this team
  const playedAll = Object.entries(allMatches)
    .filter(([, m]) => m.teamAId === teamId || m.teamBId === teamId);

  // Round filter options — every round this team appears in, via timetable or matches
  const roundIdSet = new Set();
  scheduledAll.forEach(([, e]) => { if (e.roundId) roundIdSet.add(e.roundId); });
  playedAll.forEach(([, m]) => { if (m.roundId) roundIdSet.add(m.roundId); });

  const roundOptions = Array.from(roundIdSet)
    .map(rid => ({ id: rid, name: allRounds[rid]?.name || rid, createdAt: allRounds[rid]?.createdAt || 0 }))
    .sort((a, b) => a.createdAt - b.createdAt);

  const filter = _teamModalRoundFilter;

  const scheduled = filter === 'all' ? scheduledAll : scheduledAll.filter(([, e]) => e.roundId === filter);
  const played = filter === 'all' ? playedAll : playedAll.filter(([, m]) => m.roundId === filter);

  // Hide scheduled entries that have already been played (defensive — normally auto-removed on save)
  const playedPairs = new Set(played.map(([, m]) => [m.teamAId, m.teamBId, m.roundId].sort().join('|')));
  const upcoming = scheduled.filter(([, e]) => {
    const key = [e.team1Id, e.team2Id, e.roundId].sort().join('|');
    return !playedPairs.has(key);
  });

  // Totals
  let totalPoints = 0, wins = 0, draws = 0, losses = 0;
  played.forEach(([, m]) => {
    const isA = m.teamAId === teamId;
    totalPoints += (isA ? m.scoreA : m.scoreB) || 0;
    if (m.winner === 'draw') draws++;
    else if ((m.winner === 'A' && isA) || (m.winner === 'B' && !isA)) wins++;
    else losses++;
  });

  played.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
  upcoming.sort((a, b) => (a[1].datetime || '').localeCompare(b[1].datetime || ''));

  const roundFilterHtml = roundOptions.length
    ? `<select id="teamModalRoundFilter" class="form-input form-select" style="max-width:220px" onchange="_teamModalOnRoundChange(this.value)">
        <option value="all" ${filter === 'all' ? 'selected' : ''}>Összes forduló</option>
        ${roundOptions.map(r => `<option value="${r.id}" ${filter === r.id ? 'selected' : ''}>${_tmEsc(r.name)}</option>`).join('')}
      </select>`
    : '';

  body.innerHTML = `
    <div class="team-modal-header">
      <h2 class="team-modal-title">${_tmEsc(team.name)}</h2>
      ${roundFilterHtml}
    </div>

    <div class="team-modal-stats">
      <div class="team-modal-stat"><span class="team-modal-stat-val">${totalPoints.toLocaleString()}</span><span class="team-modal-stat-label">Pont</span></div>
      <div class="team-modal-stat"><span class="team-modal-stat-val">${wins}</span><span class="team-modal-stat-label">Győzelem</span></div>
      <div class="team-modal-stat"><span class="team-modal-stat-val">${draws}</span><span class="team-modal-stat-label">Döntetlen</span></div>
      <div class="team-modal-stat"><span class="team-modal-stat-val">${losses}</span><span class="team-modal-stat-label">Vereség</span></div>
    </div>

    <div class="team-modal-section">
      <h3 class="team-modal-section-title">Ütemezett meccsek (${upcoming.length})</h3>
      ${upcoming.length === 0
        ? '<p class="empty-state" style="padding:1rem 0">Nincs ütemezett meccs.</p>'
        : `<div class="team-modal-list">
            ${upcoming.map(([, e]) => {
              const isTeam1 = e.team1Id === teamId;
              const opponent = isTeam1 ? e.team2 : e.team1;
              const roundName = allRounds[e.roundId]?.name || '';
              return `<div class="team-modal-row">
                <span class="team-modal-row-time">${_tmEsc(e.datetime || '—')}</span>
                <span class="team-modal-row-main">vs <strong>${_tmEsc(opponent)}</strong></span>
                <span class="team-modal-row-room">Terem: ${_tmEsc(e.room || '—')}</span>
                ${roundName ? `<span class="judge-badge" style="font-size:0.7rem">${_tmEsc(roundName)}</span>` : ''}
              </div>`;
            }).join('')}
          </div>`
      }
    </div>

    <div class="team-modal-section">
      <h3 class="team-modal-section-title">Lejátszott meccsek (${played.length})</h3>
      ${played.length === 0
        ? '<p class="empty-state" style="padding:1rem 0">Nincs lejátszott meccs.</p>'
        : `<div class="team-modal-list">
            ${played.map(([, m]) => {
              const isA = m.teamAId === teamId;
              const opponent = isA ? m.teamB : m.teamA;
              const myScore = isA ? m.scoreA : m.scoreB;
              const oppScore = isA ? m.scoreB : m.scoreA;
              const result = m.winner === 'draw' ? 'draw' : ((m.winner === 'A' && isA) || (m.winner === 'B' && !isA)) ? 'win' : 'loss';
              const resultLabel = result === 'win' ? 'Győzelem' : result === 'loss' ? 'Vereség' : 'Döntetlen';
              const resultClass = result === 'win' ? 'tag-win' : result === 'loss' ? 'tag-loss' : 'tag-draw';
              const roundName = allRounds[m.roundId]?.name || m.roundName || '';
              const formatBadge = m.format === 2 ? '<span class="judge-badge" style="font-size:0.7rem">2 fordulós</span>' : '';
              return `<div class="team-modal-row">
                <span class="team-modal-row-main">vs <strong>${_tmEsc(opponent)}</strong></span>
                <span class="team-modal-row-score">${(myScore||0).toLocaleString()} — ${(oppScore||0).toLocaleString()}</span>
                <span class="match-result-tag ${resultClass}">${resultLabel}</span>
                ${roundName ? `<span class="judge-badge" style="font-size:0.7rem">${_tmEsc(roundName)}</span>` : ''}
                ${formatBadge}
              </div>`;
            }).join('')}
          </div>`
      }
    </div>
  `;
}

async function _teamModalOnRoundChange(value) {
  _teamModalRoundFilter = value;
  if (!_teamModalCurrentTeamId) return;
  // Re-fetch quickly (cheap) and re-render with the same filter
  try {
    const [teamSnap, timetableSnap, matchesSnap, roundsSnap] = await Promise.all([
      db.ref(`teams/${_teamModalCurrentTeamId}`).get(),
      db.ref('timetable').get(),
      db.ref('matches').get(),
      db.ref('rounds').get()
    ]);
    const team = teamSnap.exists() ? teamSnap.val() : null;
    if (!team) return;
    _renderTeamModal(
      _teamModalCurrentTeamId,
      team,
      timetableSnap.exists() ? timetableSnap.val() : {},
      matchesSnap.exists() ? matchesSnap.val() : {},
      roundsSnap.exists() ? roundsSnap.val() : {}
    );
  } catch (e) {
    console.error('Failed to refresh team modal', e);
  }
}

function _tmEsc(str = '') {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
