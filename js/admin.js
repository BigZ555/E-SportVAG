// ===== ADMIN PANEL - UPDATED WITH ROUNDS =====

let adminTeams = {};
let adminMatches = {};
let adminRounds = {};
let adminSchedule = {};

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.remove('hidden');
  event.currentTarget.classList.add('active');

  if (tab === 'matches') renderMatchesByJudge();
  if (tab === 'stats') renderStats();
  if (tab === 'judges') loadJudgesList();
  if (tab === 'rounds') {
    loadRounds();
    loadSchedule();
  }
}

async function initAdmin() {
  await loadAdminData();
  renderTeamsList();
}

async function loadAdminData() {
  const [teamsSnap, matchesSnap, roundsSnap, scheduleSnap] = await Promise.all([
    db.ref('teams').get(),
    db.ref('matches').get(),
    db.ref('rounds').get(),
    db.ref('schedule').get()
  ]);
  adminTeams = teamsSnap.exists() ? teamsSnap.val() : {};
  adminMatches = matchesSnap.exists() ? matchesSnap.val() : {};
  adminRounds = roundsSnap.exists() ? roundsSnap.val() : {};
  adminSchedule = scheduleSnap.exists() ? scheduleSnap.val() : {};
}

// ===== ROUNDS =====
async function createRound() {
  const name = document.getElementById('roundName').value.trim() || `Round ${Object.keys(adminRounds).length + 1}`;
  await db.ref('rounds').push({ name, status: 'open', createdAt: Date.now() });
  loadRounds();
}

async function loadRounds() {
  const container = document.getElementById('roundsList');
  const rounds = Object.entries(adminRounds);
  let html = '<h3>Active Rounds</h3>';
  rounds.forEach(([id, r]) => {
    const closed = r.status === 'closed';
    html += `
      <div class="team-item">
        <span>${r.name} <span style="color:${closed?'#ff4757':'#2ed573'}">(${r.status})</span></span>
        <button onclick="toggleRound('${id}')" class="btn btn-sm ${closed?'btn-primary':'btn-danger'}">${closed?'Reopen':'Close'}</button>
      </div>`;
  });
  container.innerHTML = html || '<p class="empty-state">No rounds yet.</p>';
}

async function toggleRound(id) {
  const round = adminRounds[id];
  const newStatus = round.status === 'open' ? 'closed' : 'open';
  await db.ref(`rounds/${id}/status`).set(newStatus);
  loadRounds();
}

// ===== SCHEDULE =====
async function addToSchedule() {
  const roundId = document.getElementById('scheduleRoundSelect').value;
  const time = document.getElementById('scheduleTime').value;
  const teamAId = document.getElementById('scheduleTeamA').value;
  const teamBId = document.getElementById('scheduleTeamB').value;
  const room = document.getElementById('scheduleRoom').value;

  if (!roundId || !teamAId || !teamBId) return alert("Missing fields");

  await db.ref('schedule').push({
    roundId,
    time,
    teamAId,
    teamBId,
    teamA: adminTeams[teamAId]?.name,
    teamB: adminTeams[teamBId]?.name,
    room,
    createdAt: Date.now()
  });
  loadSchedule();
}

async function loadSchedule() {
  // Populate selects
  const roundSelect = document.getElementById('scheduleRoundSelect');
  roundSelect.innerHTML = Object.entries(adminRounds).map(([id,r]) => 
    `<option value="${id}">${r.name}</option>`).join('');

  const teamSelectA = document.getElementById('scheduleTeamA');
  teamSelectA.innerHTML = Object.entries(adminTeams).map(([id,t]) => 
    `<option value="${id}">${t.name}</option>`).join('');
  document.getElementById('scheduleTeamB').innerHTML = teamSelectA.innerHTML;

  // List
  // ... (hasonlóan rendereld)
}

// További függvények (saveTeam, stb.) maradnak az eredetiből
