// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  players:          [],
  filteredPlayers:  [],
  currentPage:      1,
  itemsPerPage:     15,
  timeframe:        'last_5',
  positionFilter:   'All',
  selectedTeams:    [],
  searchQuery:      '',
  sortColumn:       'xG',
  sortDirection:    'desc',
  columnMaxes:      {},
  nextGWs:          [],
  currentGW:        null,
  watchlist:        new Set(),
  watchlistVisible: false,
  watchlistOnly:    false,
  compareSet:       [],   // ordered array, max 3 — order matters for colours
};

const el = {};

// Accent colours per compare slot
const CMP_COLORS = ['#00d9a3', '#ffb84d', '#ff6b6b'];

// ═══════════════════════════════════════════════════════════════════════════════
// ─── WATCHLIST ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const WL_KEY = 'fpl_watchlist_v1';

function loadWatchlist() {
  try { state.watchlist = new Set(JSON.parse(localStorage.getItem(WL_KEY) || '[]')); }
  catch { state.watchlist = new Set(); }
}
function saveWatchlist() {
  localStorage.setItem(WL_KEY, JSON.stringify([...state.watchlist]));
}

function toggleWatch(name) {
  if (state.watchlist.has(name)) state.watchlist.delete(name);
  else                            state.watchlist.add(name);
  saveWatchlist();
  syncWatchlistStrip();
  renderWatchlistPanel();
  // Sync star buttons
  document.querySelectorAll(`[data-watch]`).forEach(b => {
    if (b.dataset.watch === name)
      b.classList.toggle('active', state.watchlist.has(name));
  });
}

function syncWatchlistStrip() {
  const n    = state.watchlist.size;
  const strip = document.getElementById('wl-strip');
  const countEl = document.getElementById('s-wl-count');
  if (!strip) return;
  if (n === 0) {
    strip.classList.add('hidden');
    // If only mode was on and watchlist is now empty, turn it off
    if (state.watchlistOnly) {
      state.watchlistOnly = false;
      document.getElementById('btn-wl-only')?.classList.remove('active');
      applyFiltersAndSort();
    }
  } else {
    strip.classList.remove('hidden');
    countEl.textContent = n;
  }
}

function renderWatchlistPanel() {
  const panel  = document.getElementById('watchlist-panel');
  const chips  = document.getElementById('watchlist-chips');
  const badge  = document.getElementById('wl-count-badge');
  if (!panel) return;

  badge.textContent = state.watchlist.size;

  // Panel visibility is controlled by watchlistVisible
  panel.classList.toggle('hidden', !state.watchlistVisible || state.watchlist.size === 0);

  const pfx = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
  chips.innerHTML = '';

  [...state.watchlist].forEach(name => {
    const p = state.players.find(pl => pl.name === name);
    if (!p) return;
    const pts = p[`${pfx}points`] ?? 0;
    const xgi = (p[`${pfx}xGI`]  ?? 0).toFixed(2);

    const chip = document.createElement('div');
    chip.className = 'wl-chip';
    chip.innerHTML = `
      <img src="${p.logo}" alt="${p.team}" class="wl-logo">
      <div class="wl-info">
        <span class="wl-name">${p.name}</span>
        <span class="wl-stat">${pts} pts &middot; xGI ${xgi} &middot; &pound;${p.price.toFixed(1)}m</span>
      </div>
      <button class="wl-remove" title="Remove">&times;</button>`;
    chip.querySelector('.wl-remove').addEventListener('click', () => toggleWatch(name));
    chips.appendChild(chip);
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── FIXTURES ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function buildFixtureChipsHTML(player) {
  const fixtures = player.fixtures;
  if (!fixtures || fixtures.length === 0) return '';

  // Group by GW
  const byGW = {};
  fixtures.forEach(f => {
    if (!byGW[f.gw]) byGW[f.gw] = [];
    byGW[f.gw].push(f);
  });

  // Use global next_gws (5 GWs) if available for blank GW detection
  const gws = state.nextGWs.length
    ? state.nextGWs.slice(0, 5)
    : Object.keys(byGW).map(Number).sort((a, b) => a - b).slice(0, 5);

  let html = '<div class="fixture-chips">';
  gws.forEach(gw => {
    const fixes = byGW[gw] || [];
    html += `<div class="gw-slot${fixes.length === 0 ? ' bgw' : ''}">`;
    if (fixes.length === 0) {
      html += `<div class="fix-chip blank" title="GW${gw}: No fixture">&mdash;</div>`;
    } else {
      fixes.forEach(f => {
        const ha    = f.is_home ? 'H' : 'A';
        const away  = f.is_home ? '' : ' away';
        const title = `GW${gw} vs ${f.opponent} (${ha}) · FDR ${f.difficulty}`;
        html += `<div class="fix-chip diff-${f.difficulty}${away}" title="${title}">
          <img src="${f.opponent_logo}" alt="${f.opponent}">
        </div>`;
      });
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── COMPARISON DRAWER ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const CMP_STATS = [
  { key: 'points',     label: 'Pts',    bestLow: false },
  { key: 'xG',        label: 'xG',     bestLow: false },
  { key: 'xA',        label: 'xA',     bestLow: false },
  { key: 'xGI',       label: 'xGI',    bestLow: false },
  { key: 'ict',       label: 'ICT',    bestLow: false },
  { key: 'xGC',       label: 'xGC',    bestLow: true  }, // lower is better
  { key: 'creativity',label: 'Creat',  bestLow: false },
  { key: 'bps',       label: 'BPS',    bestLow: false },
];

function toggleCompare(name) {
  const idx = state.compareSet.indexOf(name);
  if (idx !== -1) {
    state.compareSet.splice(idx, 1);
  } else if (state.compareSet.length < 3) {
    state.compareSet.push(name);
  } else {
    return; // max 3 — ignore
  }

  // Sync ⊕ buttons
  document.querySelectorAll('.cmp-add-btn').forEach(btn => {
    if (btn.dataset.cmp !== name) return;
    const inSet = state.compareSet.includes(name);
    btn.classList.toggle('active', inSet);
    btn.textContent = inSet ? '✕' : '⊕';
  });

  syncCompareDrawer();
}

function syncCompareDrawer() {
  const drawer = document.getElementById('compare-drawer');
  const countEl = document.getElementById('cmp-drawer-count');
  if (!drawer) return;

  const n = state.compareSet.length;
  countEl.textContent = n;

  if (n === 0) {
    drawer.classList.remove('open');
  } else {
    drawer.classList.add('open');
    renderCompareDrawer();
  }
}

function renderCompareDrawer() {
  const body = document.getElementById('cmp-drawer-body');
  const pfx  = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
  body.innerHTML = '';

  // For each stat, find the best value across selected players (to draw relative bars)
  const players = state.compareSet
    .map(name => state.players.find(p => p.name === name))
    .filter(Boolean);

  const statMaxes = {};
  CMP_STATS.forEach(({ key, bestLow }) => {
    const vals = players.map(p => parseFloat(p[`${pfx}${key}`] ?? 0));
    statMaxes[key] = bestLow
      ? Math.min(...vals)     // for xGC: lowest = best
      : Math.max(...vals, 0.01);
  });
  // value pts/£m
  const valVals  = players.map(p => p.price > 0 ? (p[`${pfx}points`] ?? 0) / p.price : 0);
  const valMax   = Math.max(...valVals, 0.01);

  const frag = document.createDocumentFragment();

  players.forEach((p, i) => {
    const color = CMP_COLORS[i];
    const pts   = p[`${pfx}points`]  ?? 0;
    const val   = p.price > 0 ? (pts / p.price).toFixed(1) : '—';

    const card = document.createElement('div');
    card.className = 'cmp-card';

    // Accent bar
    const accentBar = document.createElement('div');
    accentBar.className = 'cmp-card-accent';
    accentBar.style.background = color;
    card.appendChild(accentBar);

    // Top section
    const topDiv = document.createElement('div');
    topDiv.className = 'cmp-card-top';
    topDiv.innerHTML = `
      <img src="${p.logo}" alt="${p.team}" class="cmp-card-logo">
      <div class="cmp-card-info">
        <div class="cmp-card-name">
          <span class="pos-badge pos-${p.position}">${p.position}</span>
          ${p.name}
        </div>
        <div class="cmp-card-sub">&pound;${p.price.toFixed(1)}m &middot; ${p.ownership}% &middot; ${pts} pts &middot; ${val} pts/&pound;m</div>
      </div>
      <button class="cmp-card-remove" title="Remove from compare">&times;</button>`;
    topDiv.querySelector('.cmp-card-remove').addEventListener('click', () => toggleCompare(p.name));
    card.appendChild(topDiv);

    // Stats
    const statsDiv = document.createElement('div');
    statsDiv.className = 'cmp-stats';

    CMP_STATS.forEach(({ key, label, bestLow }) => {
      const raw    = parseFloat(p[`${pfx}${key}`] ?? 0);
      const max    = statMaxes[key];
      const pct    = max > 0
        ? bestLow
          ? ((max / (raw || 0.01)) * 100).toFixed(1) // invert for lower-is-better
          : ((raw / max) * 100).toFixed(1)
        : '0';
      const disp   = Number.isInteger(raw) ? raw : raw.toFixed(2);

      // Is this player the best for this stat?
      const allVals = players.map(pp => parseFloat(pp[`${pfx}${key}`] ?? 0));
      const isBest  = bestLow
        ? raw === Math.min(...allVals)
        : raw === Math.max(...allVals);

      const line = document.createElement('div');
      line.className = 'cmp-stat-line';
      line.innerHTML = `
        <span class="cmp-stat-key">${label}</span>
        <div class="cmp-stat-bar-wrap">
          <div class="cmp-stat-bar-fill" style="width:${pct}%;background:${color};"></div>
        </div>
        <span class="cmp-stat-num" style="color:${color}">${disp}</span>
        <div class="cmp-best-dot${isBest ? '' : ' hidden-dot'}"></div>`;
      statsDiv.appendChild(line);
    });

    // Pts/£m row
    const valRaw = p.price > 0 ? (pts / p.price) : 0;
    const valPct = valMax > 0 ? ((valRaw / valMax) * 100).toFixed(1) : '0';
    const allValVals = players.map(pp => pp.price > 0 ? ((pp[`${pfx}points`] ?? 0) / pp.price) : 0);
    const isValBest  = valRaw === Math.max(...allValVals);
    const valLine = document.createElement('div');
    valLine.className = 'cmp-stat-line';
    valLine.innerHTML = `
      <span class="cmp-stat-key">Pts/£m</span>
      <div class="cmp-stat-bar-wrap">
        <div class="cmp-stat-bar-fill" style="width:${valPct}%;background:${color};"></div>
      </div>
      <span class="cmp-stat-num" style="color:${color}">${val}</span>
      <div class="cmp-best-dot${isValBest ? '' : ' hidden-dot'}"></div>`;
    statsDiv.appendChild(valLine);

    card.appendChild(statsDiv);
    frag.appendChild(card);
  });

  body.appendChild(frag);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DATA FETCH ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchPlayers() {
  try {
    const res  = await fetch('players.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Handle both old flat-array format and new {players, next_gws, current_gw}
    if (Array.isArray(data)) {
      state.players   = data;
      state.nextGWs   = [];
      state.currentGW = null;
    } else {
      state.players   = data.players   || [];
      state.nextGWs   = data.next_gws  || [];
      state.currentGW = data.current_gw || null;
    }

    populateTeamFilter();
    applyFiltersAndSort();
  } catch (e) {
    console.error(e);
    el.error?.classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TEAM FILTER ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

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
        if (!state.selectedTeams.length)
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
  const n   = state.selectedTeams.length;
  const lbl = document.getElementById('team-filter-label');
  const cnt = document.getElementById('team-selection-count');
  el.teamToggleBtn.classList.toggle('has-selection', n > 0);
  if      (n === 0) { lbl.textContent = 'Filter by Team'; cnt.textContent = ''; }
  else if (n === 1) { lbl.textContent = `Team: ${state.selectedTeams[0]}`; cnt.textContent = ''; }
  else              { lbl.textContent = 'Filter by Team'; cnt.textContent = `${n} selected`; }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── FILTER + SORT ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function applyFiltersAndSort() {
  const qLow  = state.searchQuery.toLowerCase();
  const isPct = el.minsToggle.checked;
  const sld   = parseInt(el.minsSlider.value, 10);
  const pfx   = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
  const maxM  = state.timeframe === 'last_5' ? 450 : 900;

  if (state.watchlistOnly && state.watchlist.size > 0) {
    // Watchlist-only mode ignores other filters — show all starred players
    state.filteredPlayers = state.players.filter(p => state.watchlist.has(p.name));
  } else {
    const allT  = state.selectedTeams.length === 0;
    const allP  = state.positionFilter === 'All';

    state.filteredPlayers = state.players.filter(p => {
      const mins = p[`${pfx}minutes`] ?? 0;
      if (!mins) return false;
      if (isPct ? Math.round((mins / maxM) * 100) < sld : mins < sld) return false;
      return (
        p.name.toLowerCase().includes(qLow) &&
        (allT || state.selectedTeams.includes(p.team)) &&
        (allP || p.position === state.positionFilter)
      );
    });
  }

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

  state.currentPage = 1;
  updateSummary(pfx);
  updatePagination();
  renderTable(pfx);
  renderWatchlistPanel();
}

// ─── Summary ──────────────────────────────────────────────────────────────────
function updateSummary(pfx) {
  const n = state.filteredPlayers.length;
  document.getElementById('s-count').textContent = `${n} player${n !== 1 ? 's' : ''}`;
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function updatePagination() {
  const total = Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1;
  if (state.currentPage > total) state.currentPage = total;
  el.pageInfo.textContent = `Page ${state.currentPage} of ${total}`;
  el.btnPrev.disabled = state.currentPage === 1;
  el.btnNext.disabled = state.currentPage === total;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDER TABLE ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderTable(pfxArg) {
  el.tbody.innerHTML = '';
  const pfx   = pfxArg || (state.timeframe === 'last_5' ? 'last_5_' : 'last_10_');
  const maxM  = state.timeframe === 'last_5' ? 450 : 900;
  const isGK  = state.positionFilter === 'GK';
  const maxes = state.columnMaxes;

  // Column header visibility
  const vis = (id, show) => document.getElementById(id)?.classList.toggle('hidden', !show);
  vis('col-saves',      isGK);
  vis('col-xg',         !isGK);
  vis('col-xa',         !isGK);
  vis('col-xgi',        !isGK);
  vis('col-creativity', !isGK);
  vis('col-threat',     !isGK);
  vis('col-ict',        !isGK);
  vis('col-defcon',     !isGK);

  if (!state.filteredPlayers.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="14" style="text-align:center;color:var(--text-2);padding:36px;font-family:var(--f-mono);font-size:0.82rem;">No players match the current filters.</td>`;
    el.tbody.appendChild(tr);
    return;
  }

  const start = (state.currentPage - 1) * state.itemsPerPage;
  const page  = state.filteredPlayers.slice(start, start + state.itemsPerPage);
  const bar   = (v, max) => max > 0 ? `${Math.min(v / max * 100, 100).toFixed(1)}%` : '0%';
  const frag  = document.createDocumentFragment();

  page.forEach((p, i) => {
    const mins   = p[`${pfx}minutes`]     ?? 0;
    const minPct = Math.round((mins / maxM) * 100);
    const saves  = p[`${pfx}saves`]       ?? 0;
    const defcon = p[`${pfx}defcon`]      ?? 0;
    const xG     = (p[`${pfx}xG`]         ?? 0).toFixed(2);
    const xA     = (p[`${pfx}xA`]         ?? 0).toFixed(2);
    const xGI    = (p[`${pfx}xGI`]        ?? 0).toFixed(2);
    const xGC    = (p[`${pfx}xGC`]        ?? 0).toFixed(2);
    const creat  = (p[`${pfx}creativity`] ?? 0).toFixed(1);
    const threat = (p[`${pfx}threat`]     ?? 0).toFixed(1);
    const ict    = (p[`${pfx}ict`]        ?? 0).toFixed(1);
    const bps    = p[`${pfx}bps`]         ?? 0;
    const bonus  = p[`${pfx}bonus`]       ?? 0;
    const pts    = p[`${pfx}points`]      ?? 0;
    const val    = p.price > 0 ? (pts / p.price).toFixed(1) : '0.0';
    const own    = p.ownership             ?? '0.0';

    let injHtml = '';
    if (p.status_pct < 100) {
      const cls = p.status_pct === 0 ? 'inj-0'
                : p.status_pct === 25 ? 'inj-25'
                : p.status_pct === 50 ? 'inj-50' : 'inj-75';
      injHtml = `<span class="inj-badge ${cls}">&#9888; ${p.status_pct}%</span>`;
    }

    const watched  = state.watchlist.has(p.name);
    const compared = state.compareSet.includes(p.name);
    const fixChips = buildFixtureChipsHTML(p);
    const cmpFull  = state.compareSet.length >= 3 && !compared;

    const tr = document.createElement('tr');
    tr.style.setProperty('--ri', i);

    // ── Sticky player cell ──────────────────────────────────────────────────
    const playerTd = document.createElement('td');
    playerTd.className = 'sticky-col';
    playerTd.innerHTML = `
      <div class="player-cell">
        <div class="team-logo-wrap">
          <img src="${p.logo}" alt="${p.team}" class="team-logo">
          <span class="player-price">&pound;${p.price.toFixed(1)}m</span>
        </div>
        <div class="player-info">
          <div class="player-name-row">
            <span class="pos-badge pos-${p.position}">${p.position}</span>
            <span class="player-name-text">${p.name}</span>
            <button class="star-btn ${watched ? 'active' : ''}"
              data-watch="${p.name}" title="Add to watchlist">&#9733;</button>
            <button class="cmp-add-btn ${compared ? 'active' : ''}"
              data-cmp="${p.name}" title="Add to comparison"
              ${cmpFull ? 'disabled' : ''}>${compared ? '&#10005;' : '&#8853;'}</button>
          </div>
          <div class="player-meta-row">
            <span class="own-badge">${own}%</span>
            <span class="mins-badge">${mins}m (${minPct}%)</span>
            ${injHtml}
          </div>
          ${fixChips}
        </div>
      </div>`;

    playerTd.querySelector('.star-btn').addEventListener('click', () => toggleWatch(p.name));
    playerTd.querySelector('.cmp-add-btn').addEventListener('click', () => {
      if (!cmpFull || compared) toggleCompare(p.name);
    });

    tr.appendChild(playerTd);

    // ── Stat cells (in order: Pts, xG, xA, xGI, xGC, Creat, Threat, ICT, DefCon, BPS, Bonus, Pts/£m)
    const statTd = (value, max, hidden = false) => {
      const td = document.createElement('td');
      if (hidden) td.classList.add('hidden');
      td.style.setProperty('--bar', bar(parseFloat(value), max));
      td.textContent = value;
      return td;
    };

    tr.appendChild(statTd(saves,  maxes.saves,       !isGK));   // Saves (GK only)
    tr.appendChild(statTd(pts,    maxes.points));                // Pts — FIRST stat
    tr.appendChild(statTd(xG,     maxes.xG,           isGK));   // xG
    tr.appendChild(statTd(xA,     maxes.xA,           isGK));   // xA
    tr.appendChild(statTd(xGI,    maxes.xGI,          isGK));   // xGI
    const xgcTd = document.createElement('td');
    xgcTd.textContent = xGC;
    tr.appendChild(xgcTd);                                       // xGC (no bar)
    tr.appendChild(statTd(creat,  maxes.creativity,   isGK));   // Creativity
    tr.appendChild(statTd(threat, maxes.threat,       isGK));   // Threat
    tr.appendChild(statTd(ict,    maxes.ict,          isGK));   // ICT
    tr.appendChild(statTd(defcon, maxes.defcon,       isGK));   // DefCon — after ICT
    tr.appendChild(statTd(bps,    maxes.bps));                  // BPS
    tr.appendChild(statTd(bonus,  maxes.bonus));                 // Bonus
    tr.appendChild(statTd(val,    10));                          // Pts/£m

    frag.appendChild(tr);
  });
  el.tbody.appendChild(frag);
}

// ─── Sort headers ─────────────────────────────────────────────────────────────
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

function syncSliderUI() {
  const isPct = el.minsToggle.checked;
  el.minsSlider.max = isPct ? 100 : (state.timeframe === 'last_5' ? 450 : 900);
  el.minsLabel.textContent = isPct
    ? `Min Minutes: ${el.minsSlider.value}%`
    : `Min Minutes: ${el.minsSlider.value}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── INIT ─────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  el.tbody         = document.getElementById('table-body');
  el.headers       = document.querySelectorAll('th');
  el.btnPrev       = document.getElementById('btn-prev');
  el.btnNext       = document.getElementById('btn-next');
  el.pageInfo      = document.getElementById('page-info');
  el.error         = document.getElementById('error-message');
  el.minsSlider    = document.getElementById('minutes-slider');
  el.minsToggle    = document.getElementById('minutes-toggle');
  el.minsLabel     = document.getElementById('minutes-label');
  el.searchInput   = document.getElementById('search-input');
  el.teamGrid      = document.getElementById('team-filter-row');
  el.teamToggleBtn = document.getElementById('team-filter-toggle-btn');
  el.teamPanel     = document.getElementById('team-filter-panel');
  el.positionBtns  = document.querySelectorAll('#position-group button');

  // ── Watchlist buttons ──
  document.getElementById('btn-wl-show').addEventListener('click', () => {
    state.watchlistVisible = !state.watchlistVisible;
    document.getElementById('btn-wl-show').textContent = state.watchlistVisible ? 'Hide' : 'Show';
    renderWatchlistPanel();
  });

  document.getElementById('btn-wl-only').addEventListener('click', () => {
    state.watchlistOnly = !state.watchlistOnly;
    document.getElementById('btn-wl-only').classList.toggle('active', state.watchlistOnly);
    state.currentPage = 1;
    applyFiltersAndSort();
  });

  document.getElementById('wl-clear-all').addEventListener('click', () => {
    state.watchlist.clear();
    saveWatchlist();
    document.querySelectorAll('[data-watch]').forEach(b => b.classList.remove('active'));
    state.watchlistVisible = false;
    state.watchlistOnly    = false;
    document.getElementById('btn-wl-show').textContent = 'Show';
    document.getElementById('btn-wl-only').classList.remove('active');
    syncWatchlistStrip();
    renderWatchlistPanel();
    applyFiltersAndSort();
  });

  // ── Compare drawer ──
  document.getElementById('btn-clear-compare').addEventListener('click', () => {
    state.compareSet = [];
    document.querySelectorAll('.cmp-add-btn').forEach(btn => {
      btn.classList.remove('active');
      btn.textContent = '⊕';
      btn.disabled = false;
    });
    syncCompareDrawer();
  });

  // ── Team filter ──
  el.teamToggleBtn.addEventListener('click', () => {
    const open = el.teamPanel.classList.toggle('open');
    el.teamToggleBtn.classList.toggle('open', open);
  });
  document.getElementById('btn-select-all-teams').addEventListener('click', () => {
    state.selectedTeams = [];
    document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
    state.currentPage = 1; syncTeamFilterUI(); applyFiltersAndSort();
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
        state.sortColumn    = col;
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

  // ── Load persisted watchlist ──
  loadWatchlist();

  // ── Fetch ──
  fetchPlayers();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { state, fetchPlayers, applyFiltersAndSort, renderTable };
}