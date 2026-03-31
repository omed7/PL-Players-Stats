// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  players:         [],
  filteredPlayers: [],
  currentPage:     1,
  trendPage:       1,
  itemsPerPage:    15,
  trendPerPage:    24,
  timeframe:       'last_5',
  positionFilter:  'All',
  selectedTeams:   [],
  searchQuery:     '',
  sortColumn:      'xG',
  sortDirection:   'desc',
  columnMaxes:     {},
  nextGWs:         [],      // global next GW numbers for BGW detection
  currentGW:       null,
  view:            'table', // 'table' | 'trend'
  trendStat:       'pts',
  watchlist:       new Set(),
  compareSet:      new Set(),
};

const el = {};

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
  renderWatchlist();
  // Sync all star buttons for this player across table + trend
  document.querySelectorAll(`[data-watch="${CSS.escape(name)}"]`).forEach(b => {
    b.classList.toggle('active', state.watchlist.has(name));
  });
}

function renderWatchlist() {
  const panel = document.getElementById('watchlist-panel');
  const chips = document.getElementById('watchlist-chips');
  const badge = document.getElementById('wl-count-badge');
  const strip = document.getElementById('wl-summary');
  const stripCount = document.getElementById('s-wl-count');
  const n = state.watchlist.size;

  if (n === 0) {
    panel.classList.add('hidden');
    strip.classList.add('hidden');
    return;
  }
  panel.classList.remove('hidden');
  strip.classList.remove('hidden');
  badge.textContent = n;
  stripCount.textContent = n;

  const pfx = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
  chips.innerHTML = '';

  [...state.watchlist].forEach(name => {
    const p = state.players.find(pl => pl.name === name);
    if (!p) return;
    const pts = p[`${pfx}points`] ?? 0;
    const xgi = (p[`${pfx}xGI`] ?? 0).toFixed(2);

    const chip = document.createElement('div');
    chip.className = 'wl-chip';
    chip.innerHTML = `
      <img src="${p.logo}" alt="${p.team}" class="wl-logo">
      <div class="wl-info">
        <span class="wl-name">${p.name}</span>
        <span class="wl-stat">${pts} pts · xGI ${xgi} · £${p.price.toFixed(1)}m</span>
      </div>
      <button class="wl-remove" title="Remove">&#10005;</button>`;
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

  // Use global next GWs to detect blank GWs; fall back to player's own GWs
  const gws = state.nextGWs.length
    ? state.nextGWs.slice(0, 3)
    : Object.keys(byGW).map(Number).sort((a, b) => a - b).slice(0, 3);

  let html = '<div class="fixture-chips">';
  gws.forEach(gw => {
    const fixes = byGW[gw] || [];
    html += '<div class="gw-slot' + (fixes.length === 0 ? ' bgw' : '') + '">';
    if (fixes.length === 0) {
      // Blank gameweek
      html += `<div class="fix-chip blank" title="GW${gw}: Blank Gameweek">—</div>`;
    } else {
      fixes.forEach(f => {
        const ha    = f.is_home ? 'H' : 'A';
        const away  = f.is_home ? '' : ' away';
        const title = `GW${gw} vs ${f.opponent} (${ha}) · FDR ${f.difficulty}`;
        html += `<div class="fix-chip diff-${f.difficulty}${away}" title="${title}">
          <img src="${f.opponent_logo}" alt="${f.opponent}" style="background:#0d1117;border-radius:2px;padding:1px;">
        </div>`;
      });
    }
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── COMPARISON ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const CMP_COLORS = ['var(--cmp-0)', 'var(--cmp-1)', 'var(--cmp-2)'];
const CMP_FILL   = ['#00d9a3',    '#ffb84d',     '#ff6b6b'];

function toggleCompare(name) {
  if (state.compareSet.has(name)) {
    state.compareSet.delete(name);
  } else if (state.compareSet.size < 3) {
    state.compareSet.add(name);
  } else {
    return; // max 3 reached
  }
  syncCompareBar();
  // Sync checkboxes
  document.querySelectorAll('.cmp-check').forEach(cb => {
    if (cb.dataset.name === name) cb.checked = state.compareSet.has(name);
  });
}

function syncCompareBar() {
  const bar = document.getElementById('compare-bar');
  const n   = state.compareSet.size;
  if (n >= 2) {
    bar.classList.remove('hidden');
    document.getElementById('cmp-count-label').textContent = `${n} player${n > 1 ? 's' : ''} selected`;
  } else {
    bar.classList.add('hidden');
  }
}

function openCompareModal() {
  const players = [...state.compareSet]
    .map(name => state.players.find(p => p.name === name))
    .filter(Boolean);
  if (players.length < 2) return;

  const pfx = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
  const STATS = [
    { key: 'xG',         label: 'xG' },
    { key: 'xA',         label: 'xA' },
    { key: 'xGI',        label: 'xGI' },
    { key: 'xGC',        label: 'xGC' },
    { key: 'creativity', label: 'Creat.' },
    { key: 'threat',     label: 'Threat' },
    { key: 'ict',        label: 'ICT' },
    { key: 'bps',        label: 'BPS' },
    { key: 'bonus',      label: 'Bonus' },
    { key: 'points',     label: 'Points' },
  ];

  // ── Player header strip ──
  let html = '<div class="cmp-player-strip">';
  players.forEach((p, i) => {
    const pts = p[`${pfx}points`] ?? 0;
    const val = p.price > 0 ? (pts / p.price).toFixed(1) : '—';
    html += `
      <div class="cmp-player-card">
        <div class="cmp-p-top">
          <img src="${p.logo}" alt="${p.team}" class="team-logo">
          <div>
            <span class="pos-badge pos-${p.position}">${p.position}</span>
            <span class="cmp-p-name">${p.name}</span>
          </div>
        </div>
        <div class="cmp-p-meta">£${p.price.toFixed(1)}m · ${p.ownership}% owned · ${pts} pts · ${val} pts/£m</div>
        <div class="cmp-color-bar" style="background:${CMP_FILL[i]};"></div>
      </div>`;
  });
  html += '</div>';

  // ── Stats grid ──
  html += '<div class="cmp-stats-grid">';
  STATS.forEach(({ key, label }) => {
    const vals = players.map(p => {
      const v = p[`${pfx}${key}`] ?? 0;
      return typeof v === 'number' ? v : parseFloat(v) || 0;
    });
    const max = Math.max(...vals, 0.01);

    html += `<div class="cmp-stat-row">
      <div class="cmp-stat-label">${label}</div>
      <div class="cmp-stat-bars">`;

    vals.forEach((v, i) => {
      const pct   = ((v / max) * 100).toFixed(1);
      const disp  = Number.isInteger(v) ? v : v.toFixed(2);
      html += `
        <div class="cmp-bar-row">
          <div class="cmp-bar-track">
            <div class="cmp-bar-fill" style="width:${pct}%;background:${CMP_FILL[i]};"></div>
          </div>
          <span class="cmp-bar-val" style="color:${CMP_FILL[i]}">${disp}</span>
        </div>`;
    });
    html += '</div></div>';
  });
  html += '</div>';

  document.getElementById('compare-content').innerHTML = html;
  document.getElementById('compare-modal').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCompareModal() {
  document.getElementById('compare-modal').classList.add('hidden');
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TREND VIEW ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function buildSparkline(player, statKey) {
  const history = player.gw_history;
  if (!history || history.length < 2) {
    return '<div class="sparkline-empty">Re-run fpl_fetcher.py to load trend data</div>';
  }

  const values = history.map(h => {
    if (statKey === 'pts')     return h.pts     ?? 0;
    if (statKey === 'xG')      return h.xG      ?? 0;
    if (statKey === 'xA')      return h.xA      ?? 0;
    if (statKey === 'minutes') return h.minutes ?? 0;
    return 0;
  });

  const W = 240, H = 56, PAD = 6;
  const n    = values.length;
  const max  = Math.max(...values, 0.01);
  const min  = Math.min(...values, 0);
  const rng  = max - min || 1;

  const cx = i => PAD + (i / (n - 1)) * (W - PAD * 2);
  const cy = v => H - PAD - ((v - min) / rng) * (H - PAD * 2);

  const pts    = values.map((v, i) => `${cx(i).toFixed(1)},${cy(v).toFixed(1)}`).join(' ');
  const maxIdx = values.indexOf(Math.max(...values));
  const lastX  = cx(n - 1).toFixed(1);
  const lastY  = cy(values[n - 1]).toFixed(1);
  const maxX   = cx(maxIdx).toFixed(1);
  const maxY   = cy(values[maxIdx]).toFixed(1);

  // Area polygon: line points + bottom-right + bottom-left
  const areaExtra = ` ${cx(n-1).toFixed(1)},${H} ${cx(0).toFixed(1)},${H}`;

  return `
    <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="sparkline-svg" preserveAspectRatio="none">
      <polygon points="${pts} ${areaExtra}" fill="rgba(0,217,163,0.1)"/>
      <polyline points="${pts}" fill="none" stroke="#00d9a3" stroke-width="1.8"
        stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${maxX}" cy="${maxY}" r="3.5" fill="#00d9a3" opacity="0.9"/>
      <circle cx="${lastX}" cy="${lastY}" r="2.5" fill="#dce8f5" opacity="0.75"/>
    </svg>`;
}

function renderTrendView() {
  const container  = document.getElementById('trend-container');
  const noteEl     = document.getElementById('trend-note');
  const pagEl      = document.getElementById('trend-page-info');
  const btnTP      = document.getElementById('btn-trend-prev');
  const btnTN      = document.getElementById('btn-trend-next');
  const stat       = state.trendStat;
  const pfx        = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';

  container.innerHTML = '';

  if (state.filteredPlayers.length === 0) {
    container.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--text-2);padding:48px;font-family:var(--f-mono);font-size:0.82rem;">No players match the current filters.</div>';
    return;
  }

  // Check if any player has gw_history
  const hasHistory = state.filteredPlayers.some(p => p.gw_history && p.gw_history.length > 0);
  noteEl.textContent = hasHistory ? '' : '⚠ Re-run fpl_fetcher.py to unlock sparklines';

  // Trend pagination
  const total = Math.ceil(state.filteredPlayers.length / state.trendPerPage) || 1;
  if (state.trendPage > total) state.trendPage = total;
  pagEl.textContent    = `Page ${state.trendPage} of ${total}`;
  btnTP.disabled       = state.trendPage === 1;
  btnTN.disabled       = state.trendPage === total;

  const start   = (state.trendPage - 1) * state.trendPerPage;
  const players = state.filteredPlayers.slice(start, start + state.trendPerPage);

  const frag = document.createDocumentFragment();

  players.forEach((p, i) => {
    const pts   = p[`${pfx}points`]     ?? 0;
    const xgi   = (p[`${pfx}xGI`]      ?? 0).toFixed(2);
    const xg    = (p[`${pfx}xG`]       ?? 0).toFixed(2);
    const val   = p.price > 0 ? (pts / p.price).toFixed(1) : '—';
    const spark = buildSparkline(p, stat);
    const fixChips = buildFixtureChipsHTML(p);
    const watched  = state.watchlist.has(p.name);
    const compared = state.compareSet.has(p.name);

    const card = document.createElement('div');
    card.className = 'trend-card' + (watched ? ' watched' : '');
    card.style.setProperty('--ci', i);
    card.innerHTML = `
      <div class="tc-header">
        <img src="${p.logo}" alt="${p.team}" class="tc-logo">
        <div class="tc-info">
          <div class="tc-name-row">
            <span class="pos-badge pos-${p.position}">${p.position}</span>
            <span class="tc-name">${p.name}</span>
          </div>
          <span class="tc-sub">£${p.price.toFixed(1)}m · ${p.team} · ${p.ownership}% owned</span>
        </div>
        <button class="tc-star ${watched ? 'active' : ''}" data-watch="${p.name}" title="Watchlist">★</button>
      </div>
      <div class="tc-sparkline">${spark}</div>
      <div class="tc-stats">
        <span class="tc-stat"><span class="tc-stat-l">Pts</span> ${pts}</span>
        <span class="tc-stat"><span class="tc-stat-l">xG</span> ${xg}</span>
        <span class="tc-stat"><span class="tc-stat-l">xGI</span> ${xgi}</span>
        <span class="tc-stat"><span class="tc-stat-l">Pts/£m</span> ${val}</span>
      </div>
      ${fixChips}
      <label class="tc-cmp-check">
        <input type="checkbox" class="cmp-check" data-name="${p.name}" ${compared ? 'checked' : ''}>
        Add to comparison
      </label>`;

    card.querySelector('.tc-star').addEventListener('click', () => toggleWatch(p.name));
    card.querySelector('.cmp-check').addEventListener('change', e => {
      toggleCompare(p.name);
    });

    frag.appendChild(card);
  });

  container.appendChild(frag);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DATA FETCH ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchPlayers() {
  try {
    const res  = await fetch('players.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Handle both old format (array) and new format ({players, next_gws, current_gw})
    if (Array.isArray(data)) {
      state.players   = data;
      state.nextGWs   = [];
      state.currentGW = null;
    } else {
      state.players   = data.players  || [];
      state.nextGWs   = data.next_gws || [];
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
  const allT  = state.selectedTeams.length === 0;
  const allP  = state.positionFilter === 'All';
  const isPct = el.minsToggle.checked;
  const sld   = parseInt(el.minsSlider.value, 10);
  const pfx   = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
  const maxM  = state.timeframe === 'last_5' ? 450 : 900;

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

  const cols = ['xG','xA','xGI','creativity','threat','ict','bps','bonus','points','saves','defcon'];
  cols.forEach(c => {
    state.columnMaxes[c] = Math.max(...state.filteredPlayers.map(p => p[`${pfx}${c}`] ?? 0), 0.01);
  });

  state.currentPage = 1;
  state.trendPage   = 1;
  updateSummary(pfx);

  if (state.view === 'table') {
    updatePagination();
    renderTable(pfx);
  } else {
    renderTrendView();
  }
  renderWatchlist();
}

// ─── Summary ──────────────────────────────────────────────────────────────────
function updateSummary(pfx) {
  const fp = state.filteredPlayers;
  if (!fp.length) {
    document.getElementById('s-count').textContent   = '0 players';
    document.getElementById('s-avg-xg').textContent  = '—';
    document.getElementById('s-top-xg').textContent  = '—';
    document.getElementById('s-top-pts').textContent = '—';
    return;
  }
  const avgXg  = (fp.reduce((a, p) => a + (p[`${pfx}xG`] ?? 0), 0) / fp.length).toFixed(2);
  const topXgP = fp.reduce((a, b) => (b[`${pfx}xG`] ?? 0) > (a[`${pfx}xG`] ?? 0) ? b : a);
  const topPts = fp.reduce((a, b) => (b[`${pfx}points`] ?? 0) > (a[`${pfx}points`] ?? 0) ? b : a);
  document.getElementById('s-count').textContent   = `${fp.length} players`;
  document.getElementById('s-avg-xg').textContent  = avgXg;
  document.getElementById('s-top-xg').textContent  = `${topXgP.name} ${topXgP[`${pfx}xG`].toFixed(2)}`;
  document.getElementById('s-top-pts').textContent = `${topPts.name} ${topPts[`${pfx}points`]}`;
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

  const vis = (id, show) => document.getElementById(id)?.classList.toggle('hidden', !show);
  vis('col-saves', isGK); vis('col-defcon', !isGK); vis('col-xg', !isGK);
  vis('col-xa', !isGK);   vis('col-xgi', !isGK);    vis('col-creativity', !isGK);
  vis('col-threat', !isGK); vis('col-ict', !isGK);

  if (!state.filteredPlayers.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="14" style="text-align:center;color:var(--text-2);padding:36px;font-family:var(--f-mono);font-size:0.82rem;">No players match the current filters.</td>`;
    el.tbody.appendChild(tr);
    return;
  }

  const start   = (state.currentPage - 1) * state.itemsPerPage;
  const page    = state.filteredPlayers.slice(start, start + state.itemsPerPage);
  const bar     = (v, max) => max > 0 ? `${Math.min(v / max * 100, 100).toFixed(1)}%` : '0%';
  const frag    = document.createDocumentFragment();

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
    const own    = p.ownership           ?? '0.0';

    let injHtml = '';
    if (p.status_pct < 100) {
      const cls = p.status_pct === 0 ? 'inj-0' : p.status_pct === 25 ? 'inj-25' : p.status_pct === 50 ? 'inj-50' : 'inj-75';
      injHtml = `<span class="inj-badge ${cls}">&#9888; ${p.status_pct}%</span>`;
    }

    const watched  = state.watchlist.has(p.name);
    const compared = state.compareSet.has(p.name);
    const fixChips = buildFixtureChipsHTML(p);

    const tr = document.createElement('tr');
    tr.style.setProperty('--ri', i);

    // ── Sticky player cell ──
    const playerTd = document.createElement('td');
    playerTd.className = 'sticky-col';
    playerTd.innerHTML = `
      <div class="player-cell">
        <input type="checkbox" class="cmp-check" data-name="${p.name}" title="Add to comparison" ${compared ? 'checked' : ''}>
        <div class="team-logo-wrap">
          <img src="${p.logo}" alt="${p.team}" class="team-logo">
          <span class="player-price">&#163;${p.price.toFixed(1)}m</span>
        </div>
        <div class="player-info">
          <div class="player-name-row">
            <span class="pos-badge pos-${p.position}">${p.position}</span>
            <span class="player-name-text">${p.name}</span>
            <button class="star-btn ${watched ? 'active' : ''}" data-watch="${p.name}" title="Add to watchlist">&#9733;</button>
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
    playerTd.querySelector('.cmp-check').addEventListener('change', () => toggleCompare(p.name));
    tr.appendChild(playerTd);

    const statTd = (value, max, hidden = false) => {
      const td = document.createElement('td');
      if (hidden) td.classList.add('hidden');
      td.style.setProperty('--bar', bar(parseFloat(value), max));
      td.textContent = value;
      return td;
    };

    tr.appendChild(statTd(saves,  maxes.saves,      !isGK));
    tr.appendChild(statTd(defcon, maxes.defcon,      isGK));
    tr.appendChild(statTd(xG,     maxes.xG,          isGK));
    tr.appendChild(statTd(xA,     maxes.xA,          isGK));
    tr.appendChild(statTd(xGI,    maxes.xGI,         isGK));
    const xgcTd = document.createElement('td');
    xgcTd.textContent = xGC; tr.appendChild(xgcTd);
    tr.appendChild(statTd(creat,  maxes.creativity,  isGK));
    tr.appendChild(statTd(threat, maxes.threat,      isGK));
    tr.appendChild(statTd(ict,    maxes.ict,         isGK));
    tr.appendChild(statTd(bps,    maxes.bps));
    tr.appendChild(statTd(bonus,  maxes.bonus));
    tr.appendChild(statTd(pts,    maxes.points));
    tr.appendChild(statTd(val,    10));

    frag.appendChild(tr);
  });
  el.tbody.appendChild(frag);
}

// ─── Sort headers ──────────────────────────────────────────────────────────────
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

  // Refs
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

  // ── View Toggle ──
  document.getElementById('btn-view-table').addEventListener('click', () => {
    state.view = 'table';
    document.getElementById('btn-view-table').classList.add('active');
    document.getElementById('btn-view-trend').classList.remove('active');
    document.getElementById('table-view').classList.remove('hidden');
    document.getElementById('trend-view').classList.add('hidden');
    updatePagination();
    renderTable();
  });
  document.getElementById('btn-view-trend').addEventListener('click', () => {
    state.view = 'trend';
    document.getElementById('btn-view-trend').classList.add('active');
    document.getElementById('btn-view-table').classList.remove('active');
    document.getElementById('trend-view').classList.remove('hidden');
    document.getElementById('table-view').classList.add('hidden');
    renderTrendView();
  });

  // ── Trend stat selector ──
  document.querySelectorAll('#trend-stat-group button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#trend-stat-group button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.trendStat = btn.dataset.stat;
      state.trendPage = 1;
      renderTrendView();
    });
  });

  // Trend pagination
  document.getElementById('btn-trend-prev').addEventListener('click', () => {
    if (state.trendPage > 1) { state.trendPage--; renderTrendView(); }
  });
  document.getElementById('btn-trend-next').addEventListener('click', () => {
    const total = Math.ceil(state.filteredPlayers.length / state.trendPerPage) || 1;
    if (state.trendPage < total) { state.trendPage++; renderTrendView(); }
  });

  // ── Watchlist ──
  document.getElementById('wl-clear-all').addEventListener('click', () => {
    state.watchlist.clear();
    saveWatchlist();
    document.querySelectorAll('[data-watch]').forEach(b => b.classList.remove('active'));
    renderWatchlist();
  });

  // ── Team filter panel ──
  el.teamToggleBtn.addEventListener('click', () => {
    const open = el.teamPanel.classList.toggle('open');
    el.teamToggleBtn.classList.toggle('open', open);
  });
  document.getElementById('btn-select-all-teams').addEventListener('click', () => {
    state.selectedTeams = [];
    document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
    state.currentPage = 1; syncTeamFilterUI(); applyFiltersAndSort();
  });
  document.getElementById('btn-clear-teams').addEventListener('click', () => {
    state.selectedTeams = [];
    document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
    state.currentPage = 1; syncTeamFilterUI(); applyFiltersAndSort();
  });

  // ── Timeframe ──
  document.getElementById('btn-last5').addEventListener('click', function () {
    state.timeframe = 'last_5'; state.currentPage = 1;
    this.classList.add('active');
    document.getElementById('btn-last10').classList.remove('active');
    el.minsSlider.value = 0; syncSliderUI(); applyFiltersAndSort();
  });
  document.getElementById('btn-last10').addEventListener('click', function () {
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

  // ── Table Pagination ──
  el.btnPrev.addEventListener('click', () => {
    if (state.currentPage > 1) { state.currentPage--; updatePagination(); renderTable(); }
  });
  el.btnNext.addEventListener('click', () => {
    const total = Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1;
    if (state.currentPage < total) { state.currentPage++; updatePagination(); renderTable(); }
  });

  // ── Compare modal ──
  document.getElementById('btn-open-compare').addEventListener('click', openCompareModal);
  document.getElementById('btn-close-compare').addEventListener('click', closeCompareModal);
  document.getElementById('cmp-backdrop').addEventListener('click', closeCompareModal);
  document.getElementById('btn-clear-compare').addEventListener('click', () => {
    state.compareSet.clear();
    document.querySelectorAll('.cmp-check').forEach(cb => cb.checked = false);
    syncCompareBar();
  });

  // ── Load watchlist from localStorage ──
  loadWatchlist();

  // ── Fetch data ──
  fetchPlayers();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { state, fetchPlayers, applyFiltersAndSort, renderTable, renderTrendView };
}