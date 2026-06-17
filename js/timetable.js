// ===== PUBLIC TIMETABLE =====

document.addEventListener('DOMContentLoaded', () => {
  if (!db) {
    document.getElementById('timetableContent').innerHTML =
      '<p style="text-align:center;padding:3rem;color:var(--danger);font-family:var(--font-mono)">⚠️ Database not configured.</p>';
    return;
  }
  loadTimetable();
});

async function loadTimetable() {
  const content = document.getElementById('timetableContent');

  try {
    const [timetableSnap, roundsSnap] = await Promise.all([
      db.ref('timetable').get(),
      db.ref('rounds').get()
    ]);

    const entries = timetableSnap.exists() ? timetableSnap.val() : {};
    const rounds = roundsSnap.exists() ? roundsSnap.val() : {};

    const allEntries = Object.entries(entries).sort((a, b) => {
      const ta = a[1].datetime || '';
      const tb = b[1].datetime || '';
      // Support both old datetime strings and new time-only HH:MM
      if (ta.includes('T') || ta.includes('-')) {
        return new Date(ta).getTime() - new Date(tb).getTime();
      }
      return ta.localeCompare(tb);
    });

    if (!allEntries.length) {
      content.innerHTML = '<p class="empty-state" style="padding:3rem">No matches scheduled yet.</p>';
      return;
    }

    // Group by round
    const byRound = {};
    allEntries.forEach(([id, entry]) => {
      const rId = entry.roundId || '__none__';
      if (!byRound[rId]) byRound[rId] = [];
      byRound[rId].push([id, entry]);
    });

    let html = '';
    Object.entries(byRound).forEach(([roundId, roundEntries]) => {
      const roundName = rounds[roundId]?.name || (roundId === '__none__' ? 'General' : roundId);
      const roundClosed = rounds[roundId]?.closed || false;

      html += `
        <div class="card" style="margin-bottom:2rem">
          <h3 class="card-title" style="display:flex;align-items:center;gap:12px">
            ${esc(roundName)}
            ${roundClosed
              ? '<span class="judge-badge" style="font-size:0.7rem;background:rgba(255,71,87,0.1);color:var(--danger);border-color:rgba(255,71,87,0.3)">Closed</span>'
              : '<span class="judge-badge" style="font-size:0.7rem;background:rgba(46,213,115,0.1);color:var(--success);border-color:rgba(46,213,115,0.3)">Active</span>'
            }
          </h3>
          <div class="timetable-list">
            ${roundEntries.map(([id, entry]) => `
              <div class="timetable-row">
                <div class="tt-time">
                  <svg viewBox="0 0 20 20" fill="none" width="14" style="flex-shrink:0"><circle cx="10" cy="10" r="8" stroke="var(--accent)" stroke-width="1.5"/><path d="M10 6v4l3 2" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round"/></svg>
                  ${formatTTDate(entry.datetime)}
                </div>
                <div class="tt-teams">
                  <span class="tt-team">${esc(entry.team1)}</span>
                  <span class="tt-vs">VS</span>
                  <span class="tt-team">${esc(entry.team2)}</span>
                </div>
                <div class="tt-room">
                  <svg viewBox="0 0 20 20" fill="none" width="14" style="flex-shrink:0"><rect x="3" y="3" width="14" height="14" rx="2" stroke="var(--text-dim)" stroke-width="1.5"/><path d="M7 10h6M10 7v6" stroke="var(--text-dim)" stroke-width="1.5" stroke-linecap="round"/></svg>
                  Terem: <strong>${esc(entry.room)}</strong>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    content.innerHTML = html;

  } catch (e) {
    content.innerHTML = `<p class="empty-state">Error: ${e.message}</p>`;
  }
}

function formatTTDate(dtString) {
  if (!dtString) return '—';
  // New format: just HH:MM
  if (!dtString.includes('T') && !dtString.includes('-')) {
    return dtString;
  }
  // Old format: full datetime string
  const d = new Date(dtString);
  return d.toLocaleString('hu-HU', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

function esc(str = '') {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
