// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  players: [],
  filteredPlayers: [],
  currentPage: 1,
  itemsPerPage: 15,
  timeframe: 'last_5',
  positionFilter: 'All',
  selectedTeams: [],
  searchQuery: '',
  sortColumn: 'xG',
  sortDirection: 'desc',
  columnMaxes: {}
};

const el = {};

// ─── Fetch ────────────────────────────────────────────────────────────────────
async function fetchPlayers() {
  try {
    const res = await fetch('players.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    state.players = await res.json();
    populateTeamFilter();
    applyFiltersAndSort();
  } catch (e) {
    console.error(e);
    el.error?.classList.remove('hidden');
  }
}

// ─── Team Filter ──────────────────────────────────────────────────────────────
function populateTeamFilter() {
  el.teamGrid.innerHTML = '';

  const teams = Array.from(
    new Map(state.players.map(p => [p.team, { name: p.team, logo: p.logo }])).values()
  ).sort((a, b) => a.name.localeCompare(b.name));

  const frag = document.createDocumentFragment();
  teams.forEach(({ name, logo }) => {
    const btn = document.createElement('button');
    btn.className = 'team-logo-btn' + (state.selectedTeams.includes(name) ? ' selected' : '');
    btn.title = name;
    btn.innerHTML = `<img src="${logo}" alt="${name}"><span class="team-abbr">${name}</span>`;
    btn.addEventListener('click', () => {
      if (state.selectedTeams.length === 0) {
        state.selectedTeams = [name];
        document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
      } else if (state.selectedTeams.includes(name)) {
        state.selectedTeams = state.selectedTeams.filter(t => t !== name);
        btn.classList.remove('selected');
        if (state.selectedTeams.length === 0)
          document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
      } else {
        state.selectedTeams.push(name);
        btn.classList.add('selected');
      }
      state.currentPage = 1;
      syncTeamFilterUI();
      applyFiltersAndSort();
    });
    frag.appendChild(btn);
  });

  el.teamGrid.appendChild(frag);
  syncTeamFilterUI();
}

function syncTeamFilterUI() {
  const n = state.selectedTeams.length;
  const label = document.getElementById('team-filter-label');
  const count = document.getElementById('team-selection-count');
  const btn   = el.teamToggleBtn;

  if (n === 0) {
    label.textContent = 'Filter by Team';
    btn.classList.remove('has-selection');
    count.textContent = '';
  } else if (n === 1) {
    label.textContent = `Team: ${state.selectedTeams[0]}`;
    btn.classList.add('has-selection');
    count.textContent = '';
  } else {
    label.textContent = 'Filter by Team';
    btn.classList.add('has-selection');
    count.textContent = `${n} selected`;
  }
}

// ─── Filters + Sort ───────────────────────────────────────────────────────────
function applyFiltersAndSort() {
  const qLow   = state.searchQuery.toLowerCase();
  const allT   = state.selectedTeams.length === 0;
  const allP   = state.positionFilter === 'All';
  const isPct  = el.minsToggle.checked;
  const slider = parseInt(el.minsSlider.value, 10);
  const pfx    = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
  const maxM   = state.timeframe === 'last_5' ? 450 : 900;

  state.filteredPlayers = state.players.filter(p => {
    const mins = p[`${pfx}minutes`] ?? 0;
    if (mins === 0) return false;
    if (isPct  ? Math.round((mins / maxM) * 100) < slider : mins < slider) return false;
    return (
      p.name.toLowerCase().includes(qLow) &&
      (allT || state.selectedTeams.includes(p.team)) &&
      (allP || p.position === state.positionFilter)
    );
  });

  // Sort
  state.filteredPlayers.sort((a, b) => {
    if (state.sortColumn === 'name') {
      const na = a.name.toLowerCase(), nb = b.name.toLowerCase();
      return state.sortDirection === 'asc' ? na.localeCompare(nb) : nb.localeCompare(na);
    }
    let va, vb;
    if (state.sortColumn === 'value') {
      va = a.price > 0 ? (a[`${pfx}points`] ?? 0) / a.price : 0;
      vb = b.price > 0 ? (b[`${pfx}points`] ?? 0) / b.price : 0;
    } else {
      va = a[`${pfx}${state.sortColumn}`] ?? 0;
      vb = b[`${pfx}${state.sortColumn}`] ?? 0;
    }
    return state.sortDirection === 'asc' ? va - vb : vb - va;
  });

  // Column maxes for inline bars
  const cols = ['xG','xA','xGI','creativity','threat','ict','bps','bonus','points','saves','defcon'];
  cols.forEach(c => {
    state.columnMaxes[c] = Math.max(...state.filteredPlayers.map(p => p[`${pfx}${c}`] ?? 0), 0.01);
  });

  updateSummary(pfx);
  updatePagination();
  renderTable(pfx);
}

// ─── Summary Strip ────────────────────────────────────────────────────────────
function updateSummary(pfx) {
  const fp = state.filteredPlayers;
  if (!fp.length) {
    document.getElementById('s-count').textContent  = '0 players';
    document.getElementById('s-avg-xg').textContent = '—';
    document.getElementById('s-top-xg').textContent = '—';
    document.getElementById('s-top-pts').textContent= '—';
    return;
  }
  const xgs = fp.map(p => p[`${pfx}xG`] ?? 0);
  const pts = fp.map(p => p[`${pfx}points`] ?? 0);
  const avgXg = (xgs.reduce((a,b) => a+b, 0) / xgs.length).toFixed(2);
  const topXgP = fp.reduce((a,b) => (b[`${pfx}xG`] ?? 0) > (a[`${pfx}xG`] ?? 0) ? b : a);
  const topPtsP= fp.reduce((a,b) => (b[`${pfx}points`] ?? 0) > (a[`${pfx}points`] ?? 0) ? b : a);

  document.getElementById('s-count').textContent   = `${fp.length} players`;
  document.getElementById('s-avg-xg').textContent  = avgXg;
  document.getElementById('s-top-xg').textContent  = `${topXgP.name} ${topXgP[`${pfx}xG`].toFixed(2)}`;
  document.getElementById('s-top-pts').textContent = `${topPtsP.name} ${topPtsP[`${pfx}points`]}`;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function updatePagination() {
  const total = Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1;
  if (state.currentPage > total) state.currentPage = total;
  el.pageInfo.textContent = `Page ${state.currentPage} of ${total}`;
  el.btnPrev.disabled = state.currentPage === 1;
  el.btnNext.disabled = state.currentPage === total;
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderTable(pfxArg) {
  el.tbody.innerHTML = '';
  const pfx    = pfxArg || (state.timeframe === 'last_5' ? 'last_5_' : 'last_10_');
  const maxM   = state.timeframe === 'last_5' ? 450 : 900;
  const isGK   = state.positionFilter === 'GK';
  const maxes  = state.columnMaxes;

  // Column visibility
  const vis = (id, show) => document.getElementById(id)?.classList.toggle('hidden', !show);
  vis('col-saves',      isGK);
  vis('col-defcon',     !isGK);
  vis('col-xg',         !isGK);
  vis('col-xa',         !isGK);
  vis('col-xgi',        !isGK);
  vis('col-creativity', !isGK);
  vis('col-threat',     !isGK);
  vis('col-ict',        !isGK);

  if (state.filteredPlayers.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="14" style="text-align:center;color:var(--text-2);padding:32px;">No players match the current filters.</td>`;
    el.tbody.appendChild(tr);
    return;
  }

  const start = (state.currentPage - 1) * state.itemsPerPage;
  const page  = state.filteredPlayers.slice(start, start + state.itemsPerPage);

  const frag = document.createDocumentFragment();

  page.forEach((p, i) => {
    const mins   = p[`${pfx}minutes`] ?? 0;
    const minPct = Math.round((mins / maxM) * 100);
    const saves  = p[`${pfx}saves`]      ?? 0;
    const defcon = p[`${pfx}defcon`]     ?? 0;
    const xG     = (p[`${pfx}xG`]        ?? 0).toFixed(2);
    const xA     = (p[`${pfx}xA`]        ?? 0).toFixed(2);
    const xGI    = (p[`${pfx}xGI`]       ?? 0).toFixed(2);
    const xGC    = (p[`${pfx}xGC`]       ?? 0).toFixed(2);
    const creat  = (p[`${pfx}creativity`]?? 0).toFixed(1);
    const threat = (p[`${pfx}threat`]    ?? 0).toFixed(1);
    const ict    = (p[`${pfx}ict`]       ?? 0).toFixed(1);
    const bps    = p[`${pfx}bps`]        ?? 0;
    const bonus  = p[`${pfx}bonus`]      ?? 0;
    const pts    = p[`${pfx}points`]     ?? 0;
    const val    = p.price > 0 ? (pts / p.price).toFixed(1) : '0.0';
    const own    = p.ownership ?? '0.0';

    // Injury badge
    let injHtml = '';
    if (p.status_pct < 100) {
      const cls = p.status_pct === 0 ? 'inj-0' : p.status_pct === 25 ? 'inj-25' : p.status_pct === 50 ? 'inj-50' : 'inj-75';
      injHtml = `<span class="inj-badge ${cls}">&#9888; ${p.status_pct}%</span>`;
    }

    // Bar % helper
    const bar = (v, max) => max > 0 ? `${Math.min(v / max * 100, 100).toFixed(1)}%` : '0%';

    const tr = document.createElement('tr');
    tr.style.setProperty('--ri', i);

    // Build player sticky cell
    const playerTd = document.createElement('td');
    playerTd.className = 'sticky-col';
    playerTd.innerHTML = `
      <div class="player-cell">
        <div class="team-logo-wrap">
          <img src="${p.logo}" alt="${p.team}" class="team-logo">
          <span class="player-price">&#163;${p.price.toFixed(1)}m</span>
        </div>
        <div class="player-info">
          <div class="player-name-row">
            <span class="pos-badge pos-${p.position}">${p.position}</span>
            <span class="player-name-text">${p.name}</span>
          </div>
          <div class="player-meta-row">
            <span class="own-badge">${own}%</span>
            <span class="mins-badge">${mins}m (${minPct}%)</span>
            ${injHtml}
          </div>
        </div>
      </div>`;

    tr.appendChild(playerTd);

    // Helper: create a stat td with inline bar
    const statTd = (value, max, hidden = false) => {
      const td = document.createElement('td');
      if (hidden) td.className = 'hidden';
      td.style.setProperty('--bar', bar(parseFloat(value), max));
      td.textContent = value;
      return td;
    };

    // Saves (GK only)
    tr.appendChild(statTd(saves, maxes.saves, !isGK));
    // DefCon
    tr.appendChild(statTd(defcon, maxes.defcon, isGK));
    // xG
    tr.appendChild(statTd(xG, maxes.xG, isGK));
    // xA
    tr.appendChild(statTd(xA, maxes.xA, isGK));
    // xGI
    tr.appendChild(statTd(xGI, maxes.xGI, isGK));
    // xGC — no bar (lower is better)
    const xgcTd = document.createElement('td');
    xgcTd.textContent = xGC;
    tr.appendChild(xgcTd);
    // Creativity
    tr.appendChild(statTd(creat, maxes.creativity, isGK));
    // Threat
    tr.appendChild(statTd(threat, maxes.threat, isGK));
    // ICT
    tr.appendChild(statTd(ict, maxes.ict, isGK));
    // BPS
    tr.appendChild(statTd(bps, maxes.bps));
    // Bonus
    tr.appendChild(statTd(bonus, maxes.bonus));
    // Points
    tr.appendChild(statTd(pts, maxes.points));
    // Value — bar capped at 10 pts/£m
    tr.appendChild(statTd(val, 10));

    frag.appendChild(tr);
  });

  el.tbody.appendChild(frag);
}

// ─── Sort Headers ─────────────────────────────────────────────────────────────
function syncSortHeaders() {
  el.headers.forEach(th => {
    const col = th.getAttribute('data-sort');
    th.classList.remove('active-sort', 'asc', 'desc');
    th.querySelector('.sort-icon').textContent = '';
    if (col === state.sortColumn) {
      th.classList.add('active-sort', state.sortDirection);
      th.querySelector('.sort-icon').textContent = state.sortDirection === 'asc' ? '▲' : '▼';
    }
  });
}

// ─── Slider UI ────────────────────────────────────────────────────────────────
function syncSliderUI() {
  const isPct = el.minsToggle.checked;
  el.minsSlider.max = isPct ? 100 : (state.timeframe === 'last_5' ? 450 : 900);
  el.minsLabel.textContent = isPct
    ? `Min Minutes: ${el.minsSlider.value}%`
    : `Min Minutes: ${el.minsSlider.value}`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  el.tbody          = document.getElementById('table-body');
  el.headers        = document.querySelectorAll('th');
  el.btnPrev        = document.getElementById('btn-prev');
  el.btnNext        = document.getElementById('btn-next');
  el.pageInfo       = document.getElementById('page-info');
  el.error          = document.getElementById('error-message');
  el.minsSlider     = document.getElementById('minutes-slider');
  el.minsToggle     = document.getElementById('minutes-toggle');
  el.minsLabel      = document.getElementById('minutes-label');
  el.searchInput    = document.getElementById('search-input');
  el.teamGrid       = document.getElementById('team-filter-row');
  el.teamToggleBtn  = document.getElementById('team-filter-toggle-btn');
  el.teamPanel      = document.getElementById('team-filter-panel');
  el.positionBtns   = document.querySelectorAll('#position-group button');

  // ── Team panel toggle ──
  el.teamToggleBtn.addEventListener('click', () => {
    const open = el.teamPanel.classList.toggle('open');
    el.teamToggleBtn.classList.toggle('open', open);
  });
  document.getElementById('btn-select-all-teams').addEventListener('click', () => {
    state.selectedTeams = [];
    document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
    state.currentPage = 1;
    syncTeamFilterUI();
    applyFiltersAndSort();
  });
  document.getElementById('btn-clear-teams').addEventListener('click', () => {
    state.selectedTeams = [];
    document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
    state.currentPage = 1;
    syncTeamFilterUI();
    applyFiltersAndSort();
  });

  // ── Timeframe ──
  document.getElementById('btn-last5').addEventListener('click', function() {
    state.timeframe = 'last_5'; state.currentPage = 1;
    this.classList.add('active');
    document.getElementById('btn-last10').classList.remove('active');
    el.minsSlider.value = 0; syncSliderUI(); applyFiltersAndSort();
  });
  document.getElementById('btn-last10').addEventListener('click', function() {
    state.timeframe = 'last_10'; state.currentPage = 1;
    this.classList.add('active');
    document.getElementById('btn-last5').classList.remove('active');
    el.minsSlider.value = 0; syncSliderUI(); applyFiltersAndSort();
  });

  // ── Minutes ──
  el.minsToggle.addEventListener('change', () => {
    el.minsSlider.value = 0; syncSliderUI();
    state.currentPage = 1; applyFiltersAndSort();
  });
  el.minsSlider.addEventListener('input', () => {
    syncSliderUI(); state.currentPage = 1; applyFiltersAndSort();
  });

  // ── Search ──
  el.searchInput.addEventListener('input', e => {
    state.searchQuery = e.target.value;
    state.currentPage = 1; applyFiltersAndSort();
  });

  // ── Sort ──
  el.headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (!col) return;
      if (state.sortColumn === col) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortColumn = col;
        state.sortDirection = 'desc';
      }
      state.currentPage = 1;
      syncSortHeaders();
      applyFiltersAndSort();
    });
  });

  // ── Position ──
  el.positionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      el.positionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.positionFilter = btn.getAttribute('data-pos');
      state.currentPage = 1; applyFiltersAndSort();
    });
  });

  // ── Pagination ──
  el.btnPrev.addEventListener('click', () => {
    if (state.currentPage > 1) { state.currentPage--; updatePagination(); renderTable(); }
  });
  el.btnNext.addEventListener('click', () => {
    const total = Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1;
    if (state.currentPage < total) { state.currentPage++; updatePagination(); renderTable(); }
  });

  fetchPlayers();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { state, fetchPlayers, applyFiltersAndSort, renderTable };
}