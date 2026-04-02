const state = {
  players: [], filteredPlayers: [], currentPage: 1, itemsPerPage: 15, timeframe: 'last_5',
  positionFilter: 'All', selectedTeams: [], searchQuery: '', sortColumn: 'xG', sortDirection: 'desc',
  columnMaxes: {}, nextGWs: [], currentGW: null, deadline: null, watchlist: new Set(), watchlistOnly: false,
  priceMin: 3.0, priceMax: 15.0
};
const el = {};

function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('fpl_theme_v1', t);
  document.querySelectorAll('.theme-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === t);
  });
}
function loadTheme() {
  const saved = localStorage.getItem('fpl_theme_v1') || 'teal';
  applyTheme(saved);
}

function startCountdown(deadlineStr, gwNum) {
  const gwNumEl = document.getElementById('gw-num'), timeEl = document.getElementById('cd-time'), wrap = document.getElementById('gw-countdown');
  if (!gwNumEl || !timeEl) return;
  if (gwNum) gwNumEl.textContent = gwNum;
  function tick() {
    const diff = new Date(deadlineStr) - new Date();
    if (diff <= 0) { timeEl.textContent = 'Open'; return; }
    const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
    timeEl.textContent = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
  }
  tick(); setInterval(tick, 1000);
  if (wrap) wrap.classList.remove('hidden');
}

async function initCountdown(storedDeadline, storedGW) {
  try {
    const r = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/', {cache: 'no-store'});
    if (r.ok) {
      const d = await r.json(), ev = d.events.find(e => e.is_next) || d.events.find(e => e.is_current);
      if (ev) { startCountdown(ev.deadline_time, ev.id); return; }
    }
  } catch (_) {}
  if (storedDeadline) startCountdown(storedDeadline, storedGW);
}

function loadWatchlist() { try { state.watchlist = new Set(JSON.parse(localStorage.getItem('fpl_wl') || '[]')); } catch { state.watchlist = new Set(); } }
function saveWatchlist() { localStorage.setItem('fpl_wl', JSON.stringify([...state.watchlist])); }
function toggleWatch(name) {
  state.watchlist.has(name) ? state.watchlist.delete(name) : state.watchlist.add(name);
  saveWatchlist(); syncWatchlistHeader(); renderWatchlistDrawer();
  document.querySelectorAll(`[data-watch="${name}"]`).forEach(b => b.classList.toggle('active', state.watchlist.has(name)));
}

function syncWatchlistHeader() {
  const badge = document.getElementById('wl-hdr-badge'), n = state.watchlist.size;
  if (!badge) return;
  badge.textContent = n; badge.classList.toggle('hidden', n === 0);
  if (n === 0 && state.watchlistOnly) { state.watchlistOnly = false; document.getElementById('btn-wl-only')?.classList.remove('active'); applyFiltersAndSort(); }
}

function openWatchlist() { document.getElementById('wl-drawer').classList.add('open'); document.getElementById('wl-backdrop').classList.remove('hidden'); }
function closeWatchlist() { document.getElementById('wl-drawer').classList.remove('open'); document.getElementById('wl-backdrop').classList.add('hidden'); }

function buildFixtureChipsHTML(player) {
  const fixtures = player.fixtures;
  if (!fixtures || fixtures.length === 0) return '';
  const byGW = {};
  fixtures.forEach(f => { (byGW[f.gw] = byGW[f.gw] || []).push(f); });
  const gws = state.nextGWs.length ? state.nextGWs.slice(0, 5) : Object.keys(byGW).map(Number).sort((a,b) => a-b).slice(0, 5);
  if (!gws.length) return '';
  let html = '<div class="fixture-chips">';
  gws.forEach(gw => {
    const fixes = byGW[gw] || [];
    html += '<div class="gw-slot">';
    fixes.forEach(f => {
      const ha = f.is_home ? 'H' : 'A';
      html += `<div class="fix-chip diff-${f.difficulty}" title="GW${gw} vs ${f.opponent} (${ha}) FDR:${f.difficulty}"><img src="${f.opponent_logo}" alt="${f.opponent}"><span class="fix-ha">${ha}</span></div>`;
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function renderWatchlistDrawer() {
  const body = document.getElementById('wl-drawer-body'), countEl = document.getElementById('wl-drawer-count'), emptyEl = document.getElementById('wl-empty');
  if (!body) return;
  const n = state.watchlist.size; countEl.textContent = n;
  body.querySelectorAll('.wl-card').forEach(c => c.remove());
  if (n === 0) { emptyEl?.classList.remove('hidden'); return; }
  emptyEl?.classList.add('hidden');
  const pfx = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_', frag = document.createDocumentFragment();
  [...state.watchlist].forEach(name => {
    const p = state.players.find(pl => pl.name === name); if (!p) return;
    const pts = p[`${pfx}points`] ?? 0, xgi = (p[`${pfx}xGI`] ?? 0).toFixed(2);
    const fixChips = buildFixtureChipsHTML(p);
    const card = document.createElement('div'); card.className = 'wl-card';
    card.innerHTML = `<div class="wl-card-top"><img src="${p.logo}" alt="${p.team}" class="wl-card-logo"><div class="wl-card-info"><div class="wl-card-name-row"><span class="pos-badge pos-${p.position}">${p.position}</span><span class="wl-card-name">${p.name}</span></div><div class="wl-card-sub">&pound;${p.price.toFixed(1)}m &middot; ${p.ownership}% &middot; ${pts} pts &middot; xGI ${xgi}</div></div><button class="wl-card-remove">&times;</button></div>${fixChips ? `<div class="wl-card-chips">${fixChips}</div>` : ''}`;
    card.querySelector('.wl-card-remove').addEventListener('click', () => toggleWatch(name));
    frag.appendChild(card);
  });
  body.appendChild(frag);
}

async function fetchPlayers() {
  try {
    const res = await fetch('players.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) { state.players = data; } else { state.players = data.players || []; state.nextGWs = data.next_gws || []; state.currentGW = data.current_gw || null; state.deadline = data.deadline || null; }
    const maxPrice = Math.max(...state.players.map(p => p.price), 15);
    state.priceMax = maxPrice; el.priceMaxSlider.max = Math.ceil(maxPrice * 10); el.priceMaxSlider.value = Math.ceil(maxPrice * 10);
    updatePriceFill(); populateTeamFilter(); applyFiltersAndSort(); initCountdown(state.deadline, state.currentGW);
  } catch (e) { el.error?.classList.remove('hidden'); }
}

function updatePriceFill() {
  const minV = parseInt(el.priceMinSlider.value), maxV = parseInt(el.priceMaxSlider.value), total = parseInt(el.priceMaxSlider.max) - parseInt(el.priceMinSlider.min);
  const minPct = ((minV - parseInt(el.priceMinSlider.min)) / total) * 100, maxPct = ((maxV - parseInt(el.priceMinSlider.min)) / total) * 100;
  document.getElementById('price-fill').style.left = minPct + '%'; document.getElementById('price-fill').style.right = (100 - maxPct) + '%';
  document.getElementById('price-min-disp').textContent = (minV / 10).toFixed(1); document.getElementById('price-max-disp').textContent = (maxV / 10).toFixed(1);
  state.priceMin = minV / 10; state.priceMax = maxV / 10;
}

function populateTeamFilter() {
  el.teamGrid.innerHTML = '';
  const teams = Array.from(new Map(state.players.map(p => [p.team, {name: p.team, logo: p.logo}])).values()).sort((a,b) => a.name.localeCompare(b.name));
  const frag = document.createDocumentFragment();
  teams.forEach(({name, logo}) => {
    const btn = document.createElement('button'); btn.className = 'team-logo-btn' + (state.selectedTeams.includes(name) ? ' selected' : '');
    btn.innerHTML = `<img src="${logo}" alt="${name}"><span class="team-abbr">${name}</span>`;
    btn.addEventListener('click', () => {
      if (state.selectedTeams.length === 0) { state.selectedTeams = [name]; document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); }
      else if (state.selectedTeams.includes(name)) { state.selectedTeams = state.selectedTeams.filter(t => t !== name); btn.classList.remove('selected'); if (!state.selectedTeams.length) document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected')); }
      else { state.selectedTeams.push(name); btn.classList.add('selected'); }
      state.currentPage = 1; syncTeamFilterUI(); applyFiltersAndSort();
    });
    frag.appendChild(btn);
  });
  el.teamGrid.appendChild(frag); syncTeamFilterUI();
}

function syncTeamFilterUI() {
  const n = state.selectedTeams.length, lbl = document.getElementById('team-filter-label'), cnt = document.getElementById('team-selection-count');
  el.teamToggleBtn.classList.toggle('has-selection', n > 0);
  lbl.textContent = n === 0 ? 'Filter by Team' : n === 1 ? `Team: ${state.selectedTeams[0]}` : 'Filter by Team';
  cnt.textContent = n > 1 ? `${n} selected` : '';
}

function applyFiltersAndSort() {
  const qLow = state.searchQuery.toLowerCase(), isPct = el.minsToggle.checked, sld = parseInt(el.minsSlider.value, 10);
  const pfx = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_', maxM = state.timeframe === 'last_5' ? 450 : 900;
  if (state.watchlistOnly && state.watchlist.size > 0) { state.filteredPlayers = state.players.filter(p => state.watchlist.has(p.name)); }
  else {
    const allT = state.selectedTeams.length === 0, allP = state.positionFilter === 'All';
    state.filteredPlayers = state.players.filter(p => {
      const mins = p[`${pfx}minutes`] ?? 0;
      if (!mins) return false; 
      if (isPct ? Math.round((mins / maxM) * 100) < sld : mins < sld) return false;
      if (p.price < state.priceMin || p.price > state.priceMax) return false;
      return p.name.toLowerCase().includes(qLow) && (allT || state.selectedTeams.includes(p.team)) && (allP || p.position === state.positionFilter);
    });
  }
  state.filteredPlayers.sort((a, b) => {
    if (state.sortColumn === 'name') { const na = a.name.toLowerCase(), nb = b.name.toLowerCase(); return state.sortDirection === 'asc' ? na.localeCompare(nb) : nb.localeCompare(na); }
    let va = state.sortColumn === 'value' ? (a.price > 0 ? (a[`${pfx}points`] ?? 0) / a.price : 0) : (a[`${pfx}${state.sortColumn}`] ?? 0);
    let vb = state.sortColumn === 'value' ? (b.price > 0 ? (b[`${pfx}points`] ?? 0) / b.price : 0) : (b[`${pfx}${state.sortColumn}`] ?? 0);
    return state.sortDirection === 'asc' ? va - vb : vb - va;
  });
  const cols = ['xG','xA','xGI','creativity','threat','ict','bps','bonus','points','saves','defcon'];
  cols.forEach(c => { state.columnMaxes[c] = Math.max(...state.filteredPlayers.map(p => p[`${pfx}${c}`] ?? 0), 0.01); });
  state.currentPage = 1; document.getElementById('s-count').textContent = `${state.filteredPlayers.length}`;
  updatePagination(); renderTable(pfx);
}

function updatePagination() {
  const total = Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1;
  if (state.currentPage > total) state.currentPage = total;
  el.pageInfo.textContent = `Page ${state.currentPage} of ${total}`;
  el.btnPrev.disabled = state.currentPage === 1; el.btnNext.disabled = state.currentPage === total;
}

function renderTable(pfxArg) {
  el.tbody.innerHTML = '';
  const pfx = pfxArg || (state.timeframe === 'last_5' ? 'last_5_' : 'last_10_'), maxM = state.timeframe === 'last_5' ? 450 : 900;
  const isGK = state.positionFilter === 'GK', maxes = state.columnMaxes;
  const vis = (id, show) => document.getElementById(id)?.classList.toggle('hidden', !show);
  
  vis('col-saves', isGK); vis('col-xg', !isGK); vis('col-xa', !isGK); vis('col-xgi', !isGK);
  vis('col-creativity', !isGK); vis('col-threat', !isGK); vis('col-ict', !isGK); vis('col-defcon', !isGK);

  if (!state.filteredPlayers.length) {
    el.tbody.innerHTML = `<tr><td colspan="14" style="text-align:center;color:var(--text-2);padding:36px;">No players match the current filters.</td></tr>`; return;
  }

  const start = (state.currentPage - 1) * state.itemsPerPage, page = state.filteredPlayers.slice(start, start + state.itemsPerPage);
  const bar = (v, max) => max > 0 ? `${Math.min(v / max * 100, 100).toFixed(1)}%` : '0%';
  const frag = document.createDocumentFragment();

  page.forEach((p, i) => {
    const mins = p[`${pfx}minutes`] ?? 0, minPct = Math.round((mins / maxM) * 100), saves = p[`${pfx}saves`] ?? 0, defcon = p[`${pfx}defcon`] ?? 0;
    const xG = (p[`${pfx}xG`] ?? 0).toFixed(2), xA = (p[`${pfx}xA`] ?? 0).toFixed(2), xGI = (p[`${pfx}xGI`] ?? 0).toFixed(2), xGC = (p[`${pfx}xGC`] ?? 0).toFixed(2);
    const creat = (p[`${pfx}creativity`] ?? 0).toFixed(1), threat = (p[`${pfx}threat`] ?? 0).toFixed(1), ict = (p[`${pfx}ict`] ?? 0).toFixed(1);
    const bps = p[`${pfx}bps`] ?? 0, bonus = p[`${pfx}bonus`] ?? 0, pts = p[`${pfx}points`] ?? 0, val = p.price > 0 ? (pts / p.price).toFixed(1) : '0.0', own = p.ownership ?? '0.0';
    
    let injHtml = '';
    if (p.status_pct < 100) {
      const cls = p.status_pct === 0 ? 'inj-0' : p.status_pct === 25 ? 'inj-25' : p.status_pct === 50 ? 'inj-50' : 'inj-75';
      injHtml = `<span class="inj-badge ${cls}">&#9888; ${p.status_pct}%</span>`;
    }

    const watched = state.watchlist.has(p.name);
    const fixChips = buildFixtureChipsHTML(p);

    const tr = document.createElement('tr'); tr.style.setProperty('--ri', i);
    const td = document.createElement('td'); td.className = 'sticky-col';

    td.innerHTML = `
      <div class="player-cell">
        <span class="own-badge-corner">${own}%</span>
        <div class="team-logo-wrap">
          <img src="${p.logo}" alt="${p.team}" class="team-logo">
          <span class="player-price">&pound;${p.price.toFixed(1)}m</span>
        </div>
        <div class="player-info">
          <div class="player-name-row">
            <span class="pos-badge pos-${p.position}">${p.position}</span>
            <span class="player-name-text">${p.name}</span>
            <button class="star-btn ${watched ? 'active' : ''}" data-watch="${p.name}">&#9733;</button>
            ${injHtml}
          </div>
          ${fixChips}
        </div>
        <div class="mins-corner">Mins: ${mins} %${minPct}</div>
      </div>`;

    td.querySelector('.star-btn').addEventListener('click', () => toggleWatch(p.name));
    tr.appendChild(td);

    const statTd = (value, max, hidden = false) => {
      const cell = document.createElement('td'); if (hidden) cell.classList.add('hidden');
      cell.style.setProperty('--bar', bar(parseFloat(value), max)); cell.textContent = value; return cell;
    };

    tr.appendChild(statTd(saves, maxes.saves, !isGK));
    tr.appendChild(statTd(pts, maxes.points));
    tr.appendChild(statTd(xG, maxes.xG, isGK));
    tr.appendChild(statTd(xA, maxes.xA, isGK));
    tr.appendChild(statTd(xGI, maxes.xGI, isGK));
    const xgcTd = document.createElement('td'); xgcTd.textContent = xGC; tr.appendChild(xgcTd);
    tr.appendChild(statTd(creat, maxes.creativity, isGK));
    tr.appendChild(statTd(threat, maxes.threat, isGK));
    tr.appendChild(statTd(ict, maxes.ict, isGK));
    tr.appendChild(statTd(defcon, maxes.defcon, isGK));
    tr.appendChild(statTd(bps, maxes.bps));
    tr.appendChild(statTd(bonus, maxes.bonus));
    tr.appendChild(statTd(val, 10));

    frag.appendChild(tr);
  });
  el.tbody.appendChild(frag);
}

function syncSortHeaders() {
  el.headers.forEach(th => {
    const col = th.getAttribute('data-sort'); th.classList.remove('active-sort', 'asc', 'desc');
    th.querySelector('.sort-icon').textContent = '';
    if (col === state.sortColumn) { th.classList.add('active-sort', state.sortDirection); th.querySelector('.sort-icon').textContent = state.sortDirection === 'asc' ? '▲' : '▼'; }
  });
}

function syncSliderUI() {
  const isPct = el.minsToggle.checked; el.minsSlider.max = isPct ? 100 : (state.timeframe === 'last_5' ? 450 : 900);
  el.minsLabel.textContent = isPct ? `Min Mins: ${el.minsSlider.value}%` : `Min Mins: ${el.minsSlider.value}`;
}

document.addEventListener('DOMContentLoaded', () => {
  el.tbody = document.getElementById('table-body'); el.headers = document.querySelectorAll('th');
  el.btnPrev = document.getElementById('btn-prev'); el.btnNext = document.getElementById('btn-next');
  el.pageInfo = document.getElementById('page-info'); el.error = document.getElementById('error-message');
  el.minsSlider = document.getElementById('minutes-slider'); el.minsToggle = document.getElementById('minutes-toggle'); el.minsLabel = document.getElementById('minutes-label');
  el.searchInput = document.getElementById('search-input'); el.teamGrid = document.getElementById('team-filter-row');
  el.teamToggleBtn = document.getElementById('team-filter-toggle-btn'); el.teamPanel = document.getElementById('team-filter-panel');
  el.positionBtns = document.querySelectorAll('#position-group button');
  el.priceMinSlider = document.getElementById('price-min-slider'); el.priceMaxSlider = document.getElementById('price-max-slider');

  loadTheme();
  document.getElementById('btn-gear').addEventListener('click', (e) => { e.stopPropagation(); document.getElementById('theme-panel').classList.toggle('hidden'); });
  document.addEventListener('click', () => document.getElementById('theme-panel').classList.add('hidden'));
  document.getElementById('theme-panel').addEventListener('click', e => e.stopPropagation());
  document.querySelectorAll('.theme-swatch').forEach(s => { s.addEventListener('click', () => applyTheme(s.dataset.theme)); });

  document.getElementById('btn-wl-open').addEventListener('click', openWatchlist); document.getElementById('btn-wl-close').addEventListener('click', closeWatchlist);
  document.getElementById('wl-backdrop').addEventListener('click', closeWatchlist);
  document.getElementById('btn-wl-only').addEventListener('click', () => { state.watchlistOnly = !state.watchlistOnly; document.getElementById('btn-wl-only').classList.toggle('active', state.watchlistOnly); state.currentPage = 1; applyFiltersAndSort(); });
  document.getElementById('btn-wl-clear').addEventListener('click', () => { state.watchlist.clear(); saveWatchlist(); state.watchlistOnly = false; document.getElementById('btn-wl-only').classList.remove('active'); syncWatchlistHeader(); renderWatchlistDrawer(); document.querySelectorAll('[data-watch]').forEach(b => b.classList.remove('active')); applyFiltersAndSort(); });

  el.priceMinSlider.addEventListener('input', () => { if (parseInt(el.priceMinSlider.value) > parseInt(el.priceMaxSlider.value) - 5) el.priceMinSlider.value = parseInt(el.priceMaxSlider.value) - 5; updatePriceFill(); state.currentPage = 1; applyFiltersAndSort(); });
  el.priceMaxSlider.addEventListener('input', () => { if (parseInt(el.priceMaxSlider.value) < parseInt(el.priceMinSlider.value) + 5) el.priceMaxSlider.value = parseInt(el.priceMinSlider.value) + 5; updatePriceFill(); state.currentPage = 1; applyFiltersAndSort(); });

  el.teamToggleBtn.addEventListener('click', () => { const open = el.teamPanel.classList.toggle('open'); el.teamToggleBtn.classList.toggle('open', open); });
  document.getElementById('btn-select-all-teams').addEventListener('click', () => { state.selectedTeams = []; document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected')); state.currentPage = 1; syncTeamFilterUI(); applyFiltersAndSort(); });

  document.getElementById('btn-last5').addEventListener('click', function() { state.timeframe = 'last_5'; state.currentPage = 1; this.classList.add('active'); document.getElementById('btn-last10').classList.remove('active'); el.minsSlider.value = 0; syncSliderUI(); applyFiltersAndSort(); });
  document.getElementById('btn-last10').addEventListener('click', function() { state.timeframe = 'last_10'; state.currentPage = 1; this.classList.add('active'); document.getElementById('btn-last5').classList.remove('active'); el.minsSlider.value = 0; syncSliderUI(); applyFiltersAndSort(); });

  el.minsToggle.addEventListener('change', () => { el.minsSlider.value = 0; syncSliderUI(); state.currentPage = 1; applyFiltersAndSort(); });
  el.minsSlider.addEventListener('input', () => { syncSliderUI(); state.currentPage = 1; applyFiltersAndSort(); });
  el.searchInput.addEventListener('input', e => { state.searchQuery = e.target.value; state.currentPage = 1; applyFiltersAndSort(); });

  el.headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.getAttribute('data-sort'); if (!col) return;
      if (state.sortColumn === col) state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      else { state.sortColumn = col; state.sortDirection = 'desc'; }
      state.currentPage = 1; syncSortHeaders(); applyFiltersAndSort();
    });
  });

  el.positionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      el.positionBtns.forEach(b => b.classList.remove('active')); btn.classList.add('active');
      state.positionFilter = btn.getAttribute('data-pos'); state.currentPage = 1; applyFiltersAndSort();
    });
  });

  el.btnPrev.addEventListener('click', () => { if (state.currentPage > 1) { state.currentPage--; updatePagination(); renderTable(); } });
  el.btnNext.addEventListener('click', () => { const total = Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1; if (state.currentPage < total) { state.currentPage++; updatePagination(); renderTable(); } });

  loadWatchlist(); syncWatchlistHeader(); fetchPlayers();
});
