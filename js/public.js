// ===== PUBLIC LEADERBOARD =====

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
    const [teamsSnap, matchesSnap] = await Promise.all([
      db.ref('teams').get(),
      db.ref('matches').get()
    ]);

    const teams = teamsSnap.exists() ? teamsSnap.val() : {};
    const matches = matchesSnap.exists() ? matchesSnap.val() : {};

    // Build stats for each team
    const stats = {};
    Object.entries(teams).forEach(([id, team]) => {
      stats[id] = { id, name: team.name, mp: 0, w: 0, d: 0, l: 0, pts: 0 };
    });

    Object.values(matches).forEach(match => {
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
    document.getElementById('totalMatches').textContent = Object.keys(matches).length || '0';
    document.getElementById('topTeam').textContent = sorted.length ? sorted[0].name : '—';

    // Render table
    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="loading-row">No teams registered yet.</td></tr>';
      return;
    }

    tbody.innerHTML = sorted.map((t, i) => {
      const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'rank-n';
      return `<tr>
        <td><span class="rank-badge ${rankClass}">${i + 1}</span></td>
        <td><strong>${esc(t.name)}</strong></td>
        <td style="color:var(--text-muted)">${t.mp}</td>
        <td class="w-badge">${t.w}</td>
        <td class="d-badge">${t.d}</td>
        <td class="l-badge">${t.l}</td>
        <td class="points-badge">${t.pts.toLocaleString()}</td>
      </tr>`;
    }).join('');

  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="7" class="loading-row">Error loading data: ${e.message}</td></tr>`;
  }
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
