// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  players:         [],
  filteredPlayers: [],
  currentPage:     1,
  itemsPerPage:    15,
  timeframe:       'last_5',
  positionFilter:  'All',
  selectedTeams:   [],
  searchQuery:     '',
  sortColumn:      'xG',
  sortDirection:   'desc',
  columnMaxes:     {},
  nextGWs:         [],
  currentGW:       null,
  deadline:        null,
  watchlist:       new Set(),
  watchlistOnly:   false,
  compareSet:      [],  // ordered array [name, name, name] — max 3
  priceMin:        3.0,
  priceMax:        15.0,
};
const el = {};

const CMP = [
  { color: '#00d9a3', fill: 'rgba(0,217,163,0.18)', cls: 'slot-0' },
  { color: '#ffb84d', fill: 'rgba(255,184,77,0.18)',  cls: 'slot-1' },
  { color: '#ff6b6b', fill: 'rgba(255,107,107,0.18)', cls: 'slot-2' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// ─── THEMES ───────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const THEME_KEY = 'fpl_theme_v1';

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(THEME_KEY, t);
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === t);
  });
}
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'teal';
  applyTheme(saved);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── GW DEADLINE COUNTDOWN ────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function startCountdown(deadlineStr, gwNum) {
  const gwNumEl = document.getElementById('gw-num');
  const timeEl  = document.getElementById('cd-time');
  const wrap    = document.getElementById('gw-countdown');
  if (!gwNumEl || !timeEl) return;

  if (gwNum) gwNumEl.textContent = gwNum;

  function tick() {
    const diff = new Date(deadlineStr) - new Date();
    if (diff <= 0) { timeEl.textContent = 'Open'; return; }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    timeEl.textContent = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
  }
  tick();
  setInterval(tick, 1000);
  if (wrap) wrap.classList.remove('hidden');
}

async function initCountdown(storedDeadline, storedGW) {
  // Try live FPL API first (CORS is allowed by the FPL API)
  try {
    const r = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {cache: 'no-store'});
    if (r.ok) {
      const d = await r.json();
      const ev = d.events.find(e => e.is_next) || d.events.find(e => e.is_current);
      if (ev) { startCountdown(ev.deadline_time, ev.id); return; }
    }
  } catch (_) { /* fallback */ }
  // Fallback: use stored deadline from players.json
  if (storedDeadline) startCountdown(storedDeadline, storedGW);
}

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
  state.watchlist.has(name) ? state.watchlist.delete(name) : state.watchlist.add(name);
  saveWatchlist();
  syncWatchlistHeader();
  renderWatchlistDrawer();
  document.querySelectorAll(`[data-watch="${name}"]`).forEach(b =>
    b.classList.toggle('active', state.watchlist.has(name))
  );
}

function syncWatchlistHeader() {
  const badge = document.getElementById('wl-hdr-badge');
  const n = state.watchlist.size;
  if (!badge) return;
  badge.textContent = n;
  badge.classList.toggle('hidden', n === 0);
  // If watchlist becomes empty while in Only mode — exit Only mode
  if (n === 0 && state.watchlistOnly) {
    state.watchlistOnly = false;
    document.getElementById('btn-wl-only')?.classList.remove('active');
    applyFiltersAndSort();
  }
}

function openWatchlist() {
  document.getElementById('wl-drawer').classList.add('open');
  document.getElementById('wl-backdrop').classList.remove('hidden');
}
function closeWatchlist() {
  document.getElementById('wl-drawer').classList.remove('open');
  document.getElementById('wl-backdrop').classList.add('hidden');
}

function renderWatchlistDrawer() {
  const body    = document.getElementById('wl-drawer-body');
  const countEl = document.getElementById('wl-drawer-count');
  const emptyEl = document.getElementById('wl-empty');
  if (!body) return;

  const n = state.watchlist.size;
  countEl.textContent = n;

  // Remove all cards (keep empty message)
  body.querySelectorAll('.wl-card').forEach(c => c.remove());

  if (n === 0) {
    emptyEl?.classList.remove('hidden');
    return;
  }
  emptyEl?.classList.add('hidden');

  const pfx  = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
  const frag = document.createDocumentFragment();

  [...state.watchlist].forEach(name => {
    const p = state.players.find(pl => pl.name === name);
    if (!p) return;
    const pts = p[`${pfx}points`] ?? 0;
    const xgi = (p[`${pfx}xGI`] ?? 0).toFixed(2);
    const val = p.price > 0 ? (pts / p.price).toFixed(1) : '—';
    const fixChips = buildFixtureChipsHTML(p);

    const card = document.createElement('div');
    card.className = 'wl-card';
    card.innerHTML = `
      <div class="wl-card-top">
        <img src="${p.logo}" alt="${p.team}" class="wl-card-logo">
        <div class="wl-card-info">
          <div class="wl-card-name-row">
            <span class="pos-badge pos-${p.position}">${p.position}</span>
            <span class="wl-card-name">${p.name}</span>
          </div>
          <div class="wl-card-sub">&pound;${p.price.toFixed(1)}m &middot; ${p.ownership}% owned &middot; ${pts} pts &middot; ${val} pts/&pound;m &middot; xGI ${xgi}</div>
        </div>
        <button class="wl-card-remove" title="Remove">&times;</button>
      </div>
      ${fixChips ? `<div class="wl-card-chips">${fixChips}</div>` : ''}`;

    card.querySelector('.wl-card-remove').addEventListener('click', () => toggleWatch(name));
    frag.appendChild(card);
  });
  body.appendChild(frag);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── FIXTURES ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function buildFixtureChipsHTML(player) {
  const fixtures = player.fixtures;
  if (!fixtures || fixtures.length === 0) return '';

  // Always show the next 5 actual PL fixtures — ignore cup-game GWs (they
  // don't appear in the FPL fixture list at all, so we never get a blank slot
  // caused by a cup week).  DGW teams get 2 chips in the same visual group.
  const byGW = {};
  fixtures.forEach(f => { (byGW[f.gw] = byGW[f.gw] || []).push(f); });

  // Collect up to 5 unique GWs that have at least one PL fixture
  const gws = Object.keys(byGW)
    .map(Number)
    .sort((a, b) => a - b)
    .slice(0, 5);

  if (!gws.length) return '';

  let html = '<div class="fixture-chips">';
  gws.forEach(gw => {
    const fixes = byGW[gw];
    html += '<div class="gw-slot">';
    fixes.forEach(f => {
      const ha    = f.is_home ? 'H' : 'A';
      const title = `GW${gw} vs ${f.opponent} (${ha}) FDR:${f.difficulty}`;
      html += `<div class="fix-chip diff-${f.difficulty}" title="${title}">
        <img src="${f.opponent_logo}" alt="${f.opponent}">
        <span class="fix-ha">${ha}</span>
      </div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── COMPARISON ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const CMP_STAT_DEFS = [
  {key:'points',    lbl:'Points',     bestLow:false},
  {key:'xG',        lbl:'xG',         bestLow:false},
  {key:'xA',        lbl:'xA',         bestLow:false},
  {key:'xGI',       lbl:'xGI',        bestLow:false},
  {key:'ict',       lbl:'ICT',        bestLow:false},
  {key:'creativity',lbl:'Creativity', bestLow:false},
  {key:'threat',    lbl:'Threat',     bestLow:false},
  {key:'bps',       lbl:'BPS',        bestLow:false},
  {key:'xGC',       lbl:'xGC',        bestLow:true },
];

function toggleCompare(name) {
  const idx = state.compareSet.indexOf(name);
  if (idx !== -1) {
    state.compareSet.splice(idx, 1);
  } else if (state.compareSet.length < 3) {
    state.compareSet.push(name);
  } else {
    return;
  }
  syncAllCmpButtons();
  syncCmpBar();
}

function syncAllCmpButtons() {
  document.querySelectorAll('.cmp-add-btn').forEach(btn => {
    const name = btn.dataset.cmp;
    const idx  = state.compareSet.indexOf(name);
    btn.className = 'cmp-add-btn';
    if (idx !== -1) {
      btn.classList.add(CMP[idx].cls);
      btn.textContent = idx + 1;
    } else {
      btn.textContent = '+';
      btn.disabled = state.compareSet.length >= 3;
    }
  });
}

function syncCmpBar() {
  const bar     = document.getElementById('cmp-bar');
  const players = document.getElementById('cmp-bar-players');
  const n       = state.compareSet.length;

  if (n === 0) { bar.classList.add('hidden'); return; }
  bar.classList.remove('hidden');
  players.innerHTML = '';

  state.compareSet.forEach((name, i) => {
    const p = state.players.find(pl => pl.name === name);
    if (!p) return;
    const chip = document.createElement('div');
    chip.className = 'cmp-bar-chip';
    chip.style.borderColor = CMP[i].color;
    chip.innerHTML = `<img src="${p.logo}" alt="${p.team}">${p.name}`;
    players.appendChild(chip);
  });
}

// ── Radar chart (shared, overlaid polygons) ────────────────────────────────

const RADAR_STATS = [
  {key:'points',    lbl:'PTS'},
  {key:'xG',        lbl:'xG'},
  {key:'xGI',       lbl:'xGI'},
  {key:'creativity',lbl:'CRE'},
  {key:'bps',       lbl:'BPS'},
  {key:'threat',    lbl:'THR'},
  {key:'ict',       lbl:'ICT'},
  {key:'xA',        lbl:'xA'},
];

function buildRadarSVG(players, pfx) {
  const n = RADAR_STATS.length;
  const S = 200, cx = S/2, cy = S/2, r = 72;
  const angle = i => (i / n) * 2 * Math.PI - Math.PI / 2;
  const px = (i, scale) => (cx + r * scale * Math.cos(angle(i))).toFixed(1);
  const py = (i, scale) => (cy + r * scale * Math.sin(angle(i))).toFixed(1);

  // maxes across all selected players
  const maxes = {};
  RADAR_STATS.forEach(({key}) => {
    maxes[key] = Math.max(...players.map(p => parseFloat(p[`${pfx}${key}`] ?? 0)), 0.01);
  });

  // Grid rings
  let grid = '';
  [0.25, 0.5, 0.75, 1].forEach(sc => {
    const pts = RADAR_STATS.map((_, i) => `${px(i,sc)},${py(i,sc)}`).join(' ');
    grid += `<polygon points="${pts}" fill="none" stroke="rgba(220,232,245,0.07)" stroke-width="0.8"/>`;
  });

  // Axis lines
  let axes = RADAR_STATS.map((_, i) =>
    `<line x1="${cx}" y1="${cy}" x2="${px(i,1)}" y2="${py(i,1)}" stroke="rgba(220,232,245,0.07)" stroke-width="0.8"/>`
  ).join('');

  // Labels — push outward from center
  let lbls = RADAR_STATS.map(({lbl}, i) => {
    const LX = (cx + (r + 16) * Math.cos(angle(i))).toFixed(1);
    const LY = (cy + (r + 16) * Math.sin(angle(i))).toFixed(1);
    return `<text x="${LX}" y="${LY}" text-anchor="middle" dominant-baseline="middle"
      font-size="8" font-family="'JetBrains Mono',monospace" fill="rgba(78,102,133,0.9)">${lbl}</text>`;
  }).join('');

  // Player polygons (drawn back-to-front for proper layering)
  let polys = '';
  [...players].reverse().forEach((p, ri) => {
    const i  = players.length - 1 - ri;
    const c  = CMP[i];
    const pts = RADAR_STATS.map(({key}, si) => {
      const v    = parseFloat(p[`${pfx}${key}`] ?? 0);
      const norm = Math.min(v / maxes[key], 1);
      return `${px(si, norm)},${py(si, norm)}`;
    }).join(' ');
    polys += `<polygon points="${pts}" fill="${c.fill}" stroke="${c.color}" stroke-width="1.6" stroke-linejoin="round"/>`;
    RADAR_STATS.forEach(({key}, si) => {
      const v    = parseFloat(p[`${pfx}${key}`] ?? 0);
      const norm = Math.min(v / maxes[key], 1);
      polys += `<circle cx="${px(si,norm)}" cy="${py(si,norm)}" r="2.5" fill="${c.color}"/>`;
    });
  });

  // Legend
  const legendItems = players.map((p, i) =>
    `<g>
      <circle cx="${10}" cy="${S - 24 + i*14}" r="5" fill="${CMP[i].fill}" stroke="${CMP[i].color}" stroke-width="1.5"/>
      <text x="20" y="${S - 21 + i*14}" font-size="8.5" font-family="'Barlow Condensed',sans-serif"
        font-weight="700" fill="${CMP[i].color}">${p.name}</text>
    </g>`
  ).join('');

  return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" overflow="visible">
    ${grid}${axes}${lbls}${polys}${legendItems}
  </svg>`;
}

function openCompareModal() {
  const players = state.compareSet
    .map(name => state.players.find(p => p.name === name))
    .filter(Boolean);
  if (players.length < 2) return;

  const pfx  = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
  const body = document.getElementById('cmp-modal-body');

  // ── Player column headers ──
  let colsHtml = '<div class="cmp-player-cols">';
  players.forEach((p, i) => {
    const c   = CMP[i];
    const pts = p[`${pfx}points`] ?? 0;
    const val = p.price > 0 ? (pts / p.price).toFixed(1) : '—';
    colsHtml += `
      <div class="cmp-player-col">
        <div class="cmp-col-accent" style="background:${c.color}"></div>
        <div class="cmp-col-hdr">
          <img src="${p.logo}" alt="${p.team}" class="cmp-col-logo">
          <div>
            <div style="display:flex;align-items:center;gap:5px;">
              <span class="pos-badge pos-${p.position}">${p.position}</span>
              <span class="cmp-col-name">${p.name}</span>
            </div>
            <div class="cmp-col-sub">&pound;${p.price.toFixed(1)}m &middot; ${p.ownership}% &middot; ${pts} pts &middot; ${val} pts/&pound;m</div>
          </div>
        </div>
      </div>`;
  });
  colsHtml += '</div>';

  // ── Radar SVG ──
  const radarHtml = `<div class="cmp-radar-wrap">${buildRadarSVG(players, pfx)}</div>`;

  // ── Stats table ──
  // Compute per-stat maxes
  const statMaxes = {};
  CMP_STAT_DEFS.forEach(({key, bestLow}) => {
    const vals = players.map(p => parseFloat(p[`${pfx}${key}`] ?? 0));
    statMaxes[key] = bestLow ? Math.min(...vals) : Math.max(...vals, 0.01);
  });
  // Also value
  const valVals = players.map(p => p.price > 0 ? (p[`${pfx}points`] ?? 0) / p.price : 0);
  const valMax  = Math.max(...valVals, 0.01);

  // Build grid columns: 1 label col + N player cols
  const cols = `120px ${players.map(() => '1fr').join(' ')} 14px`;

  let tableHtml = `<div class="cmp-stat-table">`;
  // Header row
  tableHtml += `<div class="cmp-stat-row-header" style="grid-template-columns:${cols}">
    <div class="cmp-stat-key-cell"></div>
    ${players.map((p,i) => `<div style="font-family:var(--f-d);font-size:0.75rem;font-weight:700;color:${CMP[i].color};padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>`).join('')}
    <div></div>
  </div>`;

  // Stat rows
  [...CMP_STAT_DEFS, {key:'value', lbl:'Pts/£m', bestLow:false}].forEach(({key, lbl, bestLow}) => {
    const vals = players.map(p => {
      if (key === 'value') return p.price > 0 ? (p[`${pfx}points`] ?? 0) / p.price : 0;
      return parseFloat(p[`${pfx}${key}`] ?? 0);
    });
    const max = key === 'value' ? valMax : (statMaxes[key] || 0.01);
    const best = bestLow ? Math.min(...vals) : Math.max(...vals);

    tableHtml += `<div class="cmp-stat-row" style="grid-template-columns:${cols}">
      <div class="cmp-stat-key-cell">${lbl}</div>
      ${vals.map((v, i) => {
        const c    = CMP[i];
        const pct  = max > 0 ? bestLow
          ? ((max / (v || 0.01)) * 100).toFixed(1)
          : ((v / max) * 100).toFixed(1) : '0';
        const disp = Number.isInteger(v) ? v : v.toFixed(2);
        const best_this = (v === best);
        return `<div class="cmp-stat-val-cell">
          <div class="cmp-stat-bar-wrap">
            <div class="cmp-stat-bar-fill" style="width:${pct}%;background:${c.color}"></div>
          </div>
          <span class="cmp-stat-num" style="color:${c.color}">${disp}</span>
        </div>`;
      }).join('')}
      <div class="cmp-best-dot${vals.every(v => v === best) ? ' hidden-dot' : ''}" style="background:${CMP[vals.indexOf(best)].color}"></div>
    </div>`;
  });
  tableHtml += '</div>';

  body.innerHTML = `<div class="cmp-layout">${colsHtml}${radarHtml}${tableHtml}</div>`;
  document.getElementById('cmp-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeCompareModal() {
  document.getElementById('cmp-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DATA FETCH ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchPlayers() {
  try {
    const res  = await fetch('players.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (Array.isArray(data)) {
      state.players   = data;
      state.nextGWs   = [];
      state.currentGW = null;
      state.deadline  = null;
    } else {
      state.players   = data.players   || [];
      state.nextGWs   = data.next_gws  || [];
      state.currentGW = data.current_gw || null;
      state.deadline  = data.deadline   || null;
    }

    // Price range: set max to highest player price + 0.5
    const maxPrice = Math.max(...state.players.map(p => p.price), 15);
    state.priceMax = maxPrice;
    el.priceMaxSlider.max = Math.ceil(maxPrice * 10);
    el.priceMaxSlider.value = Math.ceil(maxPrice * 10);
    updatePriceFill();

    populateTeamFilter();
    applyFiltersAndSort();
    initCountdown(state.deadline, state.currentGW);
  } catch (e) {
    console.error(e);
    el.error?.classList.remove('hidden');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PRICE RANGE ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function updatePriceFill() {
  const minV  = parseInt(el.priceMinSlider.value);
  const maxV  = parseInt(el.priceMaxSlider.value);
  const total = parseInt(el.priceMaxSlider.max) - parseInt(el.priceMinSlider.min);
  const minPct = ((minV - parseInt(el.priceMinSlider.min)) / total) * 100;
  const maxPct = ((maxV - parseInt(el.priceMinSlider.min)) / total) * 100;

  document.getElementById('price-fill').style.left  = minPct + '%';
  document.getElementById('price-fill').style.right = (100 - maxPct) + '%';
  document.getElementById('price-min-disp').textContent = (minV / 10).toFixed(1);
  document.getElementById('price-max-disp').textContent = (maxV / 10).toFixed(1);
  state.priceMin = minV / 10;
  state.priceMax = maxV / 10;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TEAM FILTER ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function populateTeamFilter() {
  el.teamGrid.innerHTML = '';
  const teams = Array.from(
    new Map(state.players.map(p => [p.team, {name: p.team, logo: p.logo}])).values()
  ).sort((a,b) => a.name.localeCompare(b.name));

  const frag = document.createDocumentFragment();
  teams.forEach(({name, logo}) => {
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
  lbl.textContent = n === 0 ? 'Filter by Team' : n === 1 ? `Team: ${state.selectedTeams[0]}` : 'Filter by Team';
  cnt.textContent = n > 1 ? `${n} selected` : '';
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
    state.filteredPlayers = state.players.filter(p => state.watchlist.has(p.name));
  } else {
    const allT  = state.selectedTeams.length === 0;
    const allP  = state.positionFilter === 'All';

    state.filteredPlayers = state.players.filter(p => {
      const mins = p[`${pfx}minutes`] ?? 0;
      if (!mins) return false;
      if (isPct ? Math.round((mins / maxM) * 100) < sld : mins < sld) return false;
      if (p.price < state.priceMin || p.price > state.priceMax) return false;
      return (
        p.name.toLowerCase().includes(qLow) &&
        (allT || state.selectedTeams.includes(p.team)) &&
        (allP || p.position === state.positionFilter)
      );
    });
  }

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
  document.getElementById('s-count').textContent = `${state.filteredPlayers.length}`;
  updatePagination();
  renderTable(pfx);
}

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
  vis('col-saves',      isGK);
  vis('col-xg',         !isGK); vis('col-xa',         !isGK); vis('col-xgi',        !isGK);
  vis('col-creativity', !isGK); vis('col-threat',     !isGK); vis('col-ict',         !isGK);
  vis('col-defcon',     !isGK);

  if (!state.filteredPlayers.length) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="14" style="text-align:center;color:var(--text-2);padding:36px;font-family:var(--f-m);font-size:0.82rem;">No players match the current filters.</td>`;
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
      const cls = p.status_pct === 0 ? 'inj-0' : p.status_pct === 25 ? 'inj-25' : p.status_pct === 50 ? 'inj-50' : 'inj-75';
      injHtml = `<span class="inj-badge ${cls}">&#9888; ${p.status_pct}%</span>`;
    }

    const watched  = state.watchlist.has(p.name);
    const cmpIdx   = state.compareSet.indexOf(p.name);
    const cmpFull  = state.compareSet.length >= 3 && cmpIdx === -1;
    const fixChips = buildFixtureChipsHTML(p);

    const tr = document.createElement('tr');
    tr.style.setProperty('--ri', i);

    // ── Sticky player cell ───────────────────────────────────────────────
    const td = document.createElement('td');
    td.className = 'sticky-col';

    let cmpClass = 'cmp-add-btn';
    let cmpTxt   = '+';
    if (cmpIdx !== -1) { cmpClass += ` ${CMP[cmpIdx].cls}`; cmpTxt = cmpIdx + 1; }

    td.innerHTML = `
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
              data-watch="${p.name}" title="Watchlist">&#9733;</button>
            <button class="${cmpClass}" data-cmp="${p.name}"
              title="Compare" ${cmpFull ? 'disabled' : ''}>${cmpTxt}</button>
          </div>
          <div class="player-meta-row">
            <span class="own-badge">${own}%</span>
            <span class="mins-badge">${mins}m (${minPct}%)</span>
            ${injHtml}
          </div>
          ${fixChips}
        </div>
      </div>`;

    td.querySelector('.star-btn').addEventListener('click', () => toggleWatch(p.name));
    td.querySelector('.cmp-add-btn').addEventListener('click', function() {
      if (!this.disabled) toggleCompare(p.name);
    });
    tr.appendChild(td);

    // ── Stat cells ────────────────────────────────────────────────────────
    const statTd = (value, max, hidden = false) => {
      const cell = document.createElement('td');
      if (hidden) cell.classList.add('hidden');
      cell.style.setProperty('--bar', bar(parseFloat(value), max));
      cell.textContent = value;
      return cell;
    };

    tr.appendChild(statTd(saves,  maxes.saves,      !isGK));
    tr.appendChild(statTd(pts,    maxes.points));
    tr.appendChild(statTd(xG,     maxes.xG,          isGK));
    tr.appendChild(statTd(xA,     maxes.xA,          isGK));
    tr.appendChild(statTd(xGI,    maxes.xGI,         isGK));
    const xgcTd = document.createElement('td'); xgcTd.textContent = xGC;
    tr.appendChild(xgcTd);
    tr.appendChild(statTd(creat,  maxes.creativity,  isGK));
    tr.appendChild(statTd(threat, maxes.threat,      isGK));
    tr.appendChild(statTd(ict,    maxes.ict,         isGK));
    tr.appendChild(statTd(defcon, maxes.defcon,      isGK));
    tr.appendChild(statTd(bps,    maxes.bps));
    tr.appendChild(statTd(bonus,  maxes.bonus));
    tr.appendChild(statTd(val,    10));

    frag.appendChild(tr);
  });
  el.tbody.appendChild(frag);
}

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
    ? `Min Mins: ${el.minsSlider.value}%`
    : `Min Mins: ${el.minsSlider.value}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── INIT ─────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  // DOM refs
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
  el.priceMinSlider = document.getElementById('price-min-slider');
  el.priceMaxSlider = document.getElementById('price-max-slider');

  // Hide countdown until data loaded
  document.getElementById('gw-countdown').classList.add('hidden');

  // ── Theme ──
  loadTheme();
  document.getElementById('btn-gear').addEventListener('click', (e) => {
    e.stopPropagation();
    document.getElementById('theme-panel').classList.toggle('hidden');
  });
  document.addEventListener('click', () => document.getElementById('theme-panel').classList.add('hidden'));
  document.getElementById('theme-panel').addEventListener('click', e => e.stopPropagation());
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.addEventListener('click', () => applyTheme(s.dataset.theme));
  });

  // ── Watchlist ──
  document.getElementById('btn-wl-open').addEventListener('click', openWatchlist);
  document.getElementById('btn-wl-close').addEventListener('click', closeWatchlist);
  document.getElementById('wl-backdrop').addEventListener('click', closeWatchlist);
  document.getElementById('btn-wl-only').addEventListener('click', () => {
    state.watchlistOnly = !state.watchlistOnly;
    document.getElementById('btn-wl-only').classList.toggle('active', state.watchlistOnly);
    state.currentPage = 1;
    applyFiltersAndSort();
  });
  document.getElementById('btn-wl-clear').addEventListener('click', () => {
    state.watchlist.clear();
    saveWatchlist();
    state.watchlistOnly = false;
    document.getElementById('btn-wl-only').classList.remove('active');
    syncWatchlistHeader();
    renderWatchlistDrawer();
    document.querySelectorAll('[data-watch]').forEach(b => b.classList.remove('active'));
    applyFiltersAndSort();
  });

  // ── Comparison ──
  document.getElementById('btn-cmp-open').addEventListener('click', openCompareModal);
  document.getElementById('btn-cmp-modal-close').addEventListener('click', closeCompareModal);
  document.getElementById('cmp-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeCompareModal();
  });
  document.getElementById('btn-cmp-clear').addEventListener('click', () => {
    state.compareSet = [];
    syncAllCmpButtons();
    syncCmpBar();
  });

  // ── Price range ──
  el.priceMinSlider.addEventListener('input', () => {
    if (parseInt(el.priceMinSlider.value) > parseInt(el.priceMaxSlider.value) - 5)
      el.priceMinSlider.value = parseInt(el.priceMaxSlider.value) - 5;
    updatePriceFill();
    state.currentPage = 1; applyFiltersAndSort();
  });
  el.priceMaxSlider.addEventListener('input', () => {
    if (parseInt(el.priceMaxSlider.value) < parseInt(el.priceMinSlider.value) + 5)
      el.priceMaxSlider.value = parseInt(el.priceMinSlider.value) + 5;
    updatePriceFill();
    state.currentPage = 1; applyFiltersAndSort();
  });
  updatePriceFill();

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
    this.classList.add('active'); document.getElementById('btn-last10').classList.remove('active');
    el.minsSlider.value = 0; syncSliderUI(); applyFiltersAndSort();
  });
  document.getElementById('btn-last10').addEventListener('click', function() {
    state.timeframe = 'last_10'; state.currentPage = 1;
    this.classList.add('active'); document.getElementById('btn-last5').classList.remove('active');
    el.minsSlider.value = 0; syncSliderUI(); applyFiltersAndSort();
  });

  // ── Minutes ──
  el.minsToggle.addEventListener('change', () => {
    el.minsSlider.value = 0; syncSliderUI(); state.currentPage = 1; applyFiltersAndSort();
  });
  el.minsSlider.addEventListener('input', () => {
    syncSliderUI(); state.currentPage = 1; applyFiltersAndSort();
  });

  // ── Search ──
  el.searchInput.addEventListener('input', e => {
    state.searchQuery = e.target.value; state.currentPage = 1; applyFiltersAndSort();
  });

  // ── Sort ──
  el.headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort');
      if (!col) return;
      if (state.sortColumn === col) state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      else { state.sortColumn = col; state.sortDirection = 'desc'; }
      state.currentPage = 1; syncSortHeaders(); applyFiltersAndSort();
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

  // ── Init ──
  loadWatchlist();
  syncWatchlistHeader();
  fetchPlayers();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { state, fetchPlayers, applyFiltersAndSort, renderTable };
}