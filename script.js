// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  players: [],
  filteredPlayers: [],
  currentPage: 1,
  itemsPerPage: 15,
  timeframe: "last_5", // 'last_5' | 'last_10' | 'season'
  positionFilter: "All",
  selectedTeams: [],
  searchQuery: "",
  sortColumn: "xG",
  sortDirection: "desc",
  columnMaxes: {},
  nextGWs: [],
  currentGW: null,
  deadline: null,
  fetchedAt: null,
  schemaVersion: null,
  loadError: false,
  watchlist: new Set(),
  watchlistOnly: false,
  compareSet: [],
  priceMin: 3.0,
  priceMax: 15.0,
  fdrSortMode: "avg", // 'avg' | 'alpha'
};
const el = {};

const CMP = [
  { color: "#00d9a3", fill: "rgba(0,217,163,0.18)", cls: "slot-0" },
  { color: "#ffb84d", fill: "rgba(255,184,77,0.18)", cls: "slot-1" },
  { color: "#ff6b6b", fill: "rgba(255,107,107,0.18)", cls: "slot-2" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const pfxFor = () =>
  state.timeframe === "last_5"
    ? "last_5_"
    : state.timeframe === "last_10"
      ? "last_10_"
      : "season_";
const maxMFor = () =>
  state.timeframe === "last_5"
    ? 450
    : state.timeframe === "last_10"
      ? 900
      : (state.currentGW || 38) * 90;

// ═══════════════════════════════════════════════════════════════════════════════
// ─── THEMES ───────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const THEME_KEY = "fpl_theme_v1";
function applyTheme(t) {
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem(THEME_KEY, t);
  document
    .querySelectorAll(".theme-swatch")
    .forEach((s) => s.classList.toggle("active", s.dataset.theme === t));
}
function loadTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "green");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── COUNTDOWN ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

let countdownIntervalId = null;

function clearCountdown() {
  if (countdownIntervalId) clearInterval(countdownIntervalId);
  countdownIntervalId = null;
  document.getElementById("gw-num").textContent = "—";
  document.getElementById("cd-time").textContent = "—";
  document.getElementById("gw-countdown").classList.add("hidden");
}

function startCountdown(deadlineStr, gwNum) {
  const gwNumEl = document.getElementById("gw-num");
  const timeEl = document.getElementById("cd-time");
  const wrap = document.getElementById("gw-countdown");
  if (!gwNumEl || !timeEl) return;
  if (gwNum) gwNumEl.textContent = gwNum;
  function tick() {
    const diff = new Date(deadlineStr) - new Date();
    if (diff <= 0) {
      timeEl.textContent = "Open";
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    timeEl.textContent = d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`;
  }
  tick();
  if (countdownIntervalId) clearInterval(countdownIntervalId);
  countdownIntervalId = setInterval(tick, 1000);
  if (wrap) wrap.classList.remove("hidden");
}

async function initCountdown(storedDeadline, storedGW) {
  try {
    const r = await fetch(
      "https://fantasy.premierleague.com/api/bootstrap-static/",
      { cache: "no-store" },
    );
    if (r.ok) {
      const d = await r.json();
      const ev =
        d.events.find((e) => e.is_next) || d.events.find((e) => e.is_current);
      if (ev) {
        startCountdown(ev.deadline_time, ev.id);
        return;
      }
    }
  } catch (_) {}
  if (storedDeadline) startCountdown(storedDeadline, storedGW);
}

// ─── Data freshness ───────────────────────────────────────────────────────────

function renderFixtureSlotHTML(fixtures, gameweek) {
  const classifier = window.FPLFixtureUtils?.classifyFixtureSlot;
  const slot = classifier
    ? classifier(fixtures)
    : { status: fixtures?.length ? "known" : "unknown", fixtures: fixtures || [] };

  let html = '<div class="gw-slot">';
  if (slot.status === "unknown") {
    html += `<div class="fixture-unknown" title="GW${gameweek}: fixture data unavailable">TBC</div>`;
  } else {
    slot.fixtures.forEach((fixture) => {
      const homeAway = fixture.is_home ? "H" : "A";
      html += `<div class="fix-chip diff-${fixture.difficulty}" title="GW${gameweek} vs ${fixture.opponent} (${homeAway}) FDR:${fixture.difficulty}">
        <img src="${fixture.opponent_logo}" alt="${fixture.opponent}">
        <span class="fix-ha">${homeAway}</span>
      </div>`;
    });
  }
  html += "</div>";
  return html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── FDR HEATMAP ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function openFDRHeatmap() {
  document.getElementById("main-content").classList.add("hidden");
  document.querySelector(".controls-top").classList.add("hidden");
  document.querySelector(".search-wrap").classList.add("hidden");
  document.querySelector(".price-section").classList.add("hidden");
  document.querySelector(".summary-strip").classList.add("hidden");
  document.getElementById("btn-fdr").classList.add("hidden");
  document.getElementById("btn-fdr-close").classList.remove("hidden");
  document.getElementById("fdr-container").classList.remove("hidden");
  renderFDRHeatmap();
}

function closeFDRHeatmap() {
  document.getElementById("main-content").classList.remove("hidden");
  document.querySelector(".controls-top").classList.remove("hidden");
  document.querySelector(".search-wrap").classList.remove("hidden");
  document.querySelector(".price-section").classList.remove("hidden");
  document.querySelector(".summary-strip").classList.remove("hidden");
  document.getElementById("btn-fdr").classList.remove("hidden");
  document.getElementById("btn-fdr-close").classList.add("hidden");
  document.getElementById("fdr-container").classList.add("hidden");
}

function renderFDRHeatmap() {
  const theadRow = document.getElementById("fdr-thead-row");
  const tbody = document.getElementById("fdr-table-body");

  // Build a unique set of all upcoming fixtures by team
  const teamFixtures = {};
  const teamLogos = {};

  state.players.forEach((p) => {
    if (!teamFixtures[p.team]) {
      teamFixtures[p.team] = [];
      teamLogos[p.team] = p.logo;
    }
    // Just grab one player's fixtures per team (since they're the same for the team)
    if (teamFixtures[p.team].length === 0 && p.fixtures) {
      teamFixtures[p.team] = p.fixtures;
    }
  });

  // Render only gameweeks observed in the source data. Do not manufacture a
  // numeric range: absence of a fixture is not evidence of a blank gameweek.
  const allGWs = new Set();
  Object.values(teamFixtures).forEach((fixtures) => {
    fixtures.forEach((fixture) => allGWs.add(fixture.gw));
  });
  const gws = Array.from(allGWs).sort((a, b) => a - b);

  if (gws.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="100%">No upcoming fixtures available.</td></tr>';
    return;
  }

  // Setup header
  theadRow.innerHTML =
    '<th class="sticky-col" style="text-align:left;">Team</th>';
  gws.forEach((gw) => {
    theadRow.innerHTML += `<th>GW${gw}</th>`;
  });

  // Process data for sorting
  const teamsData = Object.keys(teamFixtures).map((team) => {
    const fixtures = teamFixtures[team];
    const byGW = {};
    let totalFDR = 0;
    let matchCount = 0;

    fixtures.forEach((f) => {
      if (!byGW[f.gw]) byGW[f.gw] = [];
      byGW[f.gw].push(f);
      totalFDR += f.difficulty;
      matchCount++;
    });

    const avgFDR = matchCount > 0 ? totalFDR / matchCount : 0;

    return {
      name: team,
      logo: teamLogos[team],
      byGW,
      avgFDR,
    };
  });

  // Apply Team Filter if any
  let filteredTeams = teamsData;
  if (state.selectedTeams && state.selectedTeams.length > 0) {
    filteredTeams = teamsData.filter((t) =>
      state.selectedTeams.includes(t.name),
    );
  }

  // Sort
  filteredTeams.sort((a, b) => {
    if (state.fdrSortMode === "avg") {
      return a.avgFDR - b.avgFDR; // easiest (lowest FDR) first
    } else {
      return a.name.localeCompare(b.name);
    }
  });

  // Render rows
  const frag = document.createDocumentFragment();
  filteredTeams.forEach((t) => {
    const tr = document.createElement("tr");

    // Sticky Team Col
    const tdTeam = document.createElement("td");
    tdTeam.className = "sticky-col";
    tdTeam.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <img src="${t.logo}" alt="${t.name}" style="width:24px; height:24px; object-fit:contain; background:#0d1117; border-radius:3px; padding:1px;">
        <span style="font-family:var(--f-d); font-size:1rem; font-weight:700;">${t.name}</span>
      </div>
    `;
    tr.appendChild(tdTeam);

    // GW Cols
    gws.forEach((gw) => {
      const td = document.createElement("td");
      const fixes = t.byGW[gw] || [];

      td.innerHTML = renderFixtureSlotHTML(fixes, gw);
      tr.appendChild(td);
    });

    frag.appendChild(tr);
  });

  tbody.innerHTML = "";
  tbody.appendChild(frag);
}

function clearFreshness() {
  const el = document.getElementById("s-updated");
  if (!el) return;
  el.textContent = "Updated —";
  el.removeAttribute("title");
}

function renderFreshness(fetchedAt) {
  const el = document.getElementById("s-updated");
  if (!el || !fetchedAt) return;
  const diff = Date.now() - new Date(fetchedAt).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  el.textContent = `Updated ${h > 0 ? `${h}h ${m}m` : `${m}m`} ago`;
  el.title = new Date(fetchedAt).toUTCString();
}

// ── Sparkline removed (too much vertical space in player cell) ──

// ═══════════════════════════════════════════════════════════════════════════════
// ─── FIXTURES ─────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function buildFixtureChipsHTML(player) {
  const fixtures = player.fixtures || [];

  // Group by GW to detect DGWs — only use what the FPL API actually returned.
  // Never infer blanks from nextGWs: nextGWs is just a number range and the
  // API often doesn't yet have a GW assigned even when the match is real.
  const byGW = {};
  fixtures.forEach((f) => {
    (byGW[f.gw] = byGW[f.gw] || []).push(f);
  });

  // Use only gameweeks present in source fixture data. Missing records remain
  // unknown and cannot be rendered as confirmed blank gameweeks.
  if (!state.actualGWs) {
    state.actualGWs = window.FPLFixtureUtils?.upcomingGameweeksFromPlayers(
      state.players,
      5,
    ) || [];
  }

  const gws = state.actualGWs;
  if (!gws.length) return "";

  let html = '<div class="fixture-chips">';
  gws.forEach((gw) => {
    html += renderFixtureSlotHTML(byGW[gw] || [], gw);
  });
  html += "</div>";
  return html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── WATCHLIST ────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const WL_KEY = "fpl_watchlist_v2";
const LEGACY_WL_KEY = "fpl_watchlist_v1";

function persistenceUtils() {
  return window.FPLPersistenceUtils;
}

function loadWatchlist() {
  try {
    const stored = JSON.parse(localStorage.getItem(WL_KEY) || "[]");
    state.watchlist = new Set(persistenceUtils()?.normalizeElementIds(stored) || []);
  } catch {
    state.watchlist = new Set();
  }
}

function migrateLegacyWatchlist() {
  if (localStorage.getItem(WL_KEY) !== null) return;

  let legacyNames;
  try {
    const rawLegacy = localStorage.getItem(LEGACY_WL_KEY);
    if (rawLegacy === null) return;
    legacyNames = JSON.parse(rawLegacy);
  } catch {
    return;
  }

  const resolved = persistenceUtils()?.resolveLegacyWatchlist(
    legacyNames,
    state.players,
  );
  if (!resolved?.complete) return;

  state.watchlist = new Set(resolved.elementIds);
  saveWatchlist();
}

function saveWatchlist() {
  localStorage.setItem(WL_KEY, JSON.stringify([...state.watchlist]));
}

function playerByElementId(elementId) {
  return state.players.find((player) => player.element_id === elementId);
}

function toggleWatch(elementId) {
  if (!persistenceUtils()?.isValidElementId(elementId)) return;
  state.watchlist.has(elementId)
    ? state.watchlist.delete(elementId)
    : state.watchlist.add(elementId);
  saveWatchlist();
  syncWatchlistHeader();
  renderWatchlistDrawer();
  document
    .querySelectorAll(`[data-watch="${elementId}"]`)
    .forEach((button) =>
      button.classList.toggle("active", state.watchlist.has(elementId)),
    );
}

function syncWatchlistHeader() {
  const badge = document.getElementById("wl-hdr-badge");
  const n = state.watchlist.size;
  if (!badge) return;
  badge.textContent = n;
  badge.classList.toggle("hidden", n === 0);
  if (n === 0 && state.watchlistOnly) {
    state.watchlistOnly = false;
    document.getElementById("btn-wl-only")?.classList.remove("active");
    applyFiltersAndSort();
  }
}
function openWatchlist() {
  renderWatchlistDrawer();
  document.getElementById("wl-drawer").classList.add("open");
  document.getElementById("wl-backdrop").classList.remove("hidden");
}
function closeWatchlist() {
  document.getElementById("wl-drawer").classList.remove("open");
  document.getElementById("wl-backdrop").classList.add("hidden");
}

function renderWatchlistDrawer() {
  const body = document.getElementById("wl-drawer-body");
  const countEl = document.getElementById("wl-drawer-count");
  const emptyEl = document.getElementById("wl-empty");
  if (!body) return;
  countEl.textContent = state.watchlist.size;
  body.querySelectorAll(".wl-card").forEach((c) => c.remove());
  if (!state.watchlist.size) {
    emptyEl?.classList.remove("hidden");
    return;
  }
  emptyEl?.classList.add("hidden");
  const pfx = pfxFor();
  const frag = document.createDocumentFragment();
  const playerMap =
    persistenceUtils()?.indexPlayersByElementId(state.players) || new Map();
  [...state.watchlist].forEach((elementId) => {
    const p = playerMap.get(elementId);
    if (!p) return;
    const pts = p[`${pfx}points`] ?? 0;
    const xgi = (p[`${pfx}xGI`] ?? 0).toFixed(2);
    const val = p.price > 0 ? (pts / p.price).toFixed(1) : "—";
    const card = document.createElement("div");
    card.className = "wl-card";
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
      ${buildFixtureChipsHTML(p) ? `<div class="wl-card-chips">${buildFixtureChipsHTML(p)}</div>` : ""}`;
    card
      .querySelector(".wl-card-remove")
      .addEventListener("click", () => toggleWatch(elementId));
    frag.appendChild(card);
  });
  body.appendChild(frag);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── COMPARISON ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const CMP_STAT_DEFS = [
  { key: "points", lbl: "Points", bestLow: false },
  { key: "goals", lbl: "Goals", bestLow: false },
  { key: "assists", lbl: "Assists", bestLow: false },
  { key: "clean_sheets", lbl: "CS", bestLow: false },
  { key: "ppg", lbl: "PPG", bestLow: false },
  { key: "xG", lbl: "xG", bestLow: false },
  { key: "xA", lbl: "xA", bestLow: false },
  { key: "xGI", lbl: "xGI", bestLow: false },
  { key: "creativity", lbl: "Creativity", bestLow: false },
  { key: "threat", lbl: "Threat", bestLow: false },
  { key: "influence", lbl: "Influence", bestLow: false },
  { key: "saves", lbl: "Saves", bestLow: false },
];

function toggleCompare(elementId) {
  if (!persistenceUtils()?.isValidElementId(elementId)) return;
  const idx = state.compareSet.indexOf(elementId);
  if (idx !== -1) state.compareSet.splice(idx, 1);
  else if (state.compareSet.length < 3) state.compareSet.push(elementId);
  else return;
  syncAllCmpButtons();
  syncCmpBar();
}

function syncAllCmpButtons() {
  document.querySelectorAll(".cmp-add-btn").forEach((btn) => {
    const elementId = Number(btn.dataset.cmp);
    const idx = state.compareSet.indexOf(elementId);
    btn.className = "cmp-add-btn";
    if (idx !== -1) {
      btn.classList.add(CMP[idx].cls);
      btn.textContent = idx + 1;
    } else {
      btn.textContent = "+";
      btn.disabled = state.compareSet.length >= 3;
    }
  });
}

function syncCmpBar() {
  const bar = document.getElementById("cmp-bar");
  const playersEl = document.getElementById("cmp-bar-players");
  const n = state.compareSet.length;
  if (n === 0) {
    bar.classList.add("hidden");
    return;
  }
  bar.classList.remove("hidden");
  playersEl.innerHTML = "";
  state.compareSet.forEach((elementId, i) => {
    const p = playerByElementId(elementId);
    if (!p) return;
    const chip = document.createElement("div");
    chip.className = "cmp-bar-chip";
    chip.style.borderColor = CMP[i].color;
    chip.innerHTML = `<img src="${p.logo}" alt="${p.team}">${p.name}`;
    playersEl.appendChild(chip);
  });
}

const RADAR_STATS = [
  { key: "points", lbl: "PTS" },
  { key: "goals", lbl: "GLS" },
  { key: "assists", lbl: "AST" },
  { key: "clean_sheets", lbl: "CS" },
  { key: "ppg", lbl: "PPG" },
  { key: "xG", lbl: "xG" },
  { key: "xA", lbl: "xA" },
  { key: "xGI", lbl: "xGI" },
  { key: "creativity", lbl: "CRE" },
  { key: "threat", lbl: "THR" },
  { key: "influence", lbl: "INF" },
  { key: "saves", lbl: "SVS" },
];

function buildRadarSVG(players, pfx) {
  const n = RADAR_STATS.length;
  const S = 200,
    cx = S / 2,
    cy = S / 2,
    r = 72;
  const angle = (i) => (i / n) * 2 * Math.PI - Math.PI / 2;
  const px = (i, sc) => (cx + r * sc * Math.cos(angle(i))).toFixed(1);
  const py = (i, sc) => (cy + r * sc * Math.sin(angle(i))).toFixed(1);
  const maxes = {};
  RADAR_STATS.forEach(({ key }) => {
    maxes[key] = Math.max(
      ...players.map((p) => parseFloat(p[`${pfx}${key}`] ?? 0)),
      0.01,
    );
  });
  let grid = [0.25, 0.5, 0.75, 1]
    .map((sc) => {
      const pts = RADAR_STATS.map((_, i) => `${px(i, sc)},${py(i, sc)}`).join(
        " ",
      );
      return `<polygon points="${pts}" fill="none" stroke="rgba(220,232,245,0.07)" stroke-width="0.8"/>`;
    })
    .join("");
  let axes = RADAR_STATS.map(
    (_, i) =>
      `<line x1="${cx}" y1="${cy}" x2="${px(i, 1)}" y2="${py(i, 1)}" stroke="rgba(220,232,245,0.07)" stroke-width="0.8"/>`,
  ).join("");
  let lbls = RADAR_STATS.map(({ lbl }, i) => {
    const lx = (cx + (r + 16) * Math.cos(angle(i))).toFixed(1);
    const ly = (cy + (r + 16) * Math.sin(angle(i))).toFixed(1);
    return `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="8" font-family="'JetBrains Mono',monospace" fill="rgba(78,102,133,0.9)">${lbl}</text>`;
  }).join("");
  let polys = "";
  [...players].reverse().forEach((p, ri) => {
    const i = players.length - 1 - ri;
    const c = CMP[i];
    const pts = RADAR_STATS.map(({ key }, si) => {
      const v = parseFloat(p[`${pfx}${key}`] ?? 0);
      const norm = Math.min(v / maxes[key], 1);
      return `${px(si, norm)},${py(si, norm)}`;
    }).join(" ");
    polys += `<polygon points="${pts}" fill="${c.fill}" stroke="${c.color}" stroke-width="1.6" stroke-linejoin="round"/>`;
    RADAR_STATS.forEach(({ key }, si) => {
      const v = parseFloat(p[`${pfx}${key}`] ?? 0);
      const norm = Math.min(v / maxes[key], 1);
      polys += `<circle cx="${px(si, norm)}" cy="${py(si, norm)}" r="2.5" fill="${c.color}"/>`;
    });
  });
  const legend = players
    .map(
      (p, i) =>
        `<g><circle cx="10" cy="${S - 24 + i * 14}" r="5" fill="${CMP[i].fill}" stroke="${CMP[i].color}" stroke-width="1.5"/>
    <text x="20" y="${S - 21 + i * 14}" font-size="8.5" font-family="'Barlow Condensed',sans-serif" font-weight="700" fill="${CMP[i].color}">${p.name}</text></g>`,
    )
    .join("");
  return `<svg viewBox="0 0 ${S} ${S}" xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" overflow="visible">${grid}${axes}${lbls}${polys}${legend}</svg>`;
}

function openCompareModal() {
  const players = state.compareSet
    .map((elementId) => playerByElementId(elementId))
    .filter(Boolean);
  if (players.length < 2) return;
  const pfx = pfxFor();
  const body = document.getElementById("cmp-modal-body");

  let colsHtml = '<div class="cmp-player-cols">';
  players.forEach((p, i) => {
    const c = CMP[i],
      pts = p[`${pfx}points`] ?? 0;
    const val = p.price > 0 ? (pts / p.price).toFixed(1) : "—";
    colsHtml += `<div class="cmp-player-col">
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
      </div></div>`;
  });
  colsHtml += "</div>";

  const statMaxes = {};
  CMP_STAT_DEFS.forEach(({ key, bestLow }) => {
    const vals = players.map((p) => parseFloat(p[`${pfx}${key}`] ?? 0));
    statMaxes[key] = bestLow ? Math.min(...vals) : Math.max(...vals, 0.01);
  });
  const cols = `120px ${players.map(() => "1fr").join(" ")} 14px`;

  let tableHtml = `<div class="cmp-stat-table">
    <div class="cmp-stat-row-header" style="grid-template-columns:${cols}">
      <div class="cmp-stat-key-cell"></div>
      ${players.map((p, i) => `<div style="font-family:var(--f-d);font-size:0.75rem;font-weight:700;color:${CMP[i].color};padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.name}</div>`).join("")}
      <div></div>
    </div>`;
  CMP_STAT_DEFS.forEach(
    ({ key, lbl, bestLow }) => {
      const vals = players.map((p) => parseFloat(p[`${pfx}${key}`] ?? 0));
      const max = statMaxes[key] || 0.01;
      const best = bestLow ? Math.min(...vals) : Math.max(...vals);
      tableHtml += `<div class="cmp-stat-row" style="grid-template-columns:${cols}">
      <div class="cmp-stat-key-cell">${lbl}</div>
      ${vals
        .map((v, i) => {
          const c = CMP[i];
          const pct =
            max > 0
              ? (bestLow ? (max / (v || 0.01)) * 100 : (v / max) * 100).toFixed(
                  1,
                )
              : "0";
          const disp = Number.isInteger(v) ? v : v.toFixed(2);
          return `<div class="cmp-stat-val-cell">
          <div class="cmp-stat-bar-wrap"><div class="cmp-stat-bar-fill" style="width:${pct}%;background:${c.color}"></div></div>
          <span class="cmp-stat-num" style="color:${c.color}">${disp}</span>
        </div>`;
        })
        .join("")}
      <div class="cmp-best-dot${vals.every((v) => v === best) ? " hidden-dot" : ""}" style="background:${CMP[vals.indexOf(best)].color}"></div>
    </div>`;
    },
  );
  tableHtml += "</div>";

  body.innerHTML = `<div class="cmp-layout">${colsHtml}<div class="cmp-radar-wrap">${buildRadarSVG(players, pfx)}</div>${tableHtml}</div>`;
  document.getElementById("cmp-overlay").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}
function closeCompareModal() {
  document.getElementById("cmp-overlay").classList.add("hidden");
  document.body.style.overflow = "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PLAYER DETAIL MODAL — Feature 6 ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function openPlayerModal(p) {
  const pfx = pfxFor();
  const body = document.getElementById("pd-body");

  // Availability badge
  let availHtml = "";
  if (p.status_pct < 100) {
    const cls =
      p.status_pct === 0
        ? "inj-0"
        : p.status_pct <= 25
          ? "inj-25"
          : p.status_pct <= 50
            ? "inj-50"
            : "inj-75";
    availHtml = `<span class="inj-badge ${cls}">&#9888; ${p.status_pct}% chance</span>`;
  } else {
    availHtml = `<span class="avail-ok">✓ Available</span>`;
  }

  // Season stats tiles
  const isSeason = state.timeframe === "season";
  const statTile = (label, value, sub) =>
    `<div class="pd-stat-tile">
      <span class="pd-stat-val">${value}</span>
      <span class="pd-stat-lbl">${label}</span>
      ${sub ? `<span class="pd-stat-sub">${sub}</span>` : ""}
    </div>`;

  const seasonTiles = `
    <div class="pd-season-grid">
      ${statTile("Goals", p.season_goals ?? "—")}
      ${statTile("Assists", p.season_assists ?? "—")}
      ${statTile("CS", p.season_clean_sheets ?? "—")}
      ${statTile("Total Pts", p.season_points ?? "—")}
      ${statTile("PPG", (p.season_ppg ?? 0).toFixed(2))}
      ${statTile("Form", (p.season_form ?? 0).toFixed(1))}
      ${statTile("xG", (p.season_xG ?? 0).toFixed(2))}
      ${statTile("xA", (p.season_xA ?? 0).toFixed(2))}
      ${statTile("xGI", (p.season_xGI ?? 0).toFixed(2))}
      ${statTile("ICT", (p.season_ict ?? 0).toFixed(1))}
      ${p.position === "GK" ? statTile("Saves", p.season_saves ?? "—") : statTile("Bonus", p.season_bonus ?? "—")}
      ${statTile("BPS", p.season_bps ?? "—")}
    </div>`;

  // Recent form: completed-match bar chart (with toggle). Schema v2 carries
  // full history; select the most recent 10 completed matches chronologically.
  const historyUtils = window.FPLHistoryUtils;
  const matchHist =
    state.schemaVersion >= 2 &&
    typeof historyUtils?.selectRecentMatches === "function"
      ? historyUtils.selectRecentMatches(p.match_history || [], { limit: 10 })
      : p.gw_history || [];
  const labelForMatch = historyUtils?.matchLabel || ((record) => `GW${record?.gw ?? "?"}`);

  // Attach the selected history to state for detail-chart consumers.
  state.currentPDMatchHist = matchHist;
  state.currentPDChartMetric = "pts"; // Default

  const formBarsHtml = () => {
    if (!matchHist.length)
      return '<p class="pd-empty">No match history available.</p>';
    const m = state.currentPDChartMetric;
    const maxVal = Math.max(...matchHist.map((g) => g[m] ?? 0), 0.01);

    return `<div class="pd-form-bars" id="pd-form-bars-inner">
      ${matchHist
        .map((g) => {
          const val = g[m] ?? 0;
          const pct = ((val / maxVal) * 100).toFixed(1);
          let barCls = "bar-low";
          if (m === "pts")
            barCls =
              val >= 9
                ? "bar-high"
                : val >= 6
                  ? "bar-med"
                  : val >= 2
                    ? "bar-low"
                    : "bar-zero";
          else if (m === "minutes")
            barCls = val >= 60 ? "bar-high" : val > 0 ? "bar-med" : "bar-zero";
          else
            barCls =
              val > maxVal * 0.6
                ? "bar-high"
                : val > maxVal * 0.2
                  ? "bar-med"
                  : val > 0
                    ? "bar-low"
                    : "bar-zero";

          const dispVal = Number.isInteger(val) ? val : val.toFixed(2);

          return `<div class="pd-form-col">
          <span class="pd-form-pts">${dispVal}</span>
          <div class="pd-form-bar ${barCls}" style="height:${pct}%" title="${labelForMatch(g)}: ${dispVal}"></div>
          <span class="pd-form-gw">${labelForMatch(g)}</span>
        </div>`;
        })
        .join("")}
    </div>`;
  };

  const chartMetrics = [
    { key: "pts", label: "Pts" },
    { key: "minutes", label: "Mins" },
    { key: "xG", label: "xG" },
    { key: "xA", label: "xA" },
    { key: "xGI", label: "xGI" },
    { key: "influence", label: "Inf" },
    { key: "creativity", label: "Cre" },
    { key: "threat", label: "Thr" },
    { key: "ict", label: "ICT" },
    { key: "bps", label: "BPS" },
    { key: "saves", label: "Svs" },
    { key: "defcon", label: "DefCon" },
    { key: "bonus", label: "Bns" },
  ];

  const chartToggleHtml = matchHist.length
    ? `
    <div class="pd-chart-toggles" style="display:flex; gap:4px; margin-bottom:12px; overflow-x:auto; padding-bottom:4px; scrollbar-width:none;">
      ${chartMetrics
        .map(
          (cm) => `
        <button class="pd-chart-toggle-btn ${cm.key === "pts" ? "active" : ""}" data-metric="${cm.key}" style="font-family:var(--f-m); font-size:0.65rem; padding:4px 8px; border:1px solid var(--border); border-radius:4px; background:var(--bg-2); color:var(--text-2); cursor:pointer; white-space:nowrap; flex-shrink:0;">
          ${cm.label}
        </button>
      `,
        )
        .join("")}
    </div>
  `
    : "";

  // Completed-match history table
  const histRows = matchHist
    .map(
      (g) => `
    <tr>
      <td>${labelForMatch(g)}</td>
      <td class="${g.pts >= 9 ? "pts-high" : g.pts >= 6 ? "pts-med" : ""}">${g.pts}</td>
      <td>${g.xG.toFixed(2)}</td>
      <td>${g.xA.toFixed(2)}</td>
      <td>${g.minutes}'</td>
      <td>${g.bonus ?? 0}</td>
    </tr>`,
    )
    .join("");
  const histTable = matchHist.length
    ? `<div class="pd-table-wrap">
        <table class="pd-hist-table">
          <thead><tr><th>Match</th><th>Pts</th><th>xG</th><th>xA</th><th>Mins</th><th>Bonus</th></tr></thead>
          <tbody>${histRows}</tbody>
        </table>
      </div>`
    : "";

  // Current period stats
  const curPts = p[`${pfx}points`] ?? 0;
  const curXGI = (p[`${pfx}xGI`] ?? 0).toFixed(2);
  const curMins = p[`${pfx}minutes`] ?? 0;
  const curMinPct = p[`${pfx}min_pct`] ?? 0;
  const curVal = p.price > 0 ? (curPts / p.price).toFixed(1) : "—";
  const periodLabel =
    state.timeframe === "last_5"
      ? "Last 5 Matches"
      : state.timeframe === "last_10"
        ? "Last 10 Matches"
        : "This Season";

  body.innerHTML = `
    <!-- Header -->
    <div class="pd-header">
      <img src="${p.logo}" alt="${p.team}" class="pd-logo">
      <div class="pd-header-info">
        <div class="pd-name-row">
          <span class="pos-badge pos-${p.position}">${p.position}</span>
          <span class="pd-name">${p.name}</span>
        </div>
        <div class="pd-sub-row">
          <span class="pd-team">${p.team}</span>
          <span class="pd-price">&pound;${p.price.toFixed(1)}m</span>
          <span class="pd-own">${p.ownership}% owned</span>
          ${availHtml}
        </div>
      </div>
    </div>

    <!-- Current period snapshot -->
    <div class="pd-section">
      <div class="pd-section-title">${periodLabel}</div>
      <div class="pd-period-row">
        ${statTile("Pts", curPts)}
        ${statTile("xGI", curXGI)}
        ${statTile("Mins", curMins, `${curMinPct}%`)}
        ${statTile("Pts/£m", curVal)}
      </div>
    </div>

    <!-- Season stats -->
    <div class="pd-section">
      <div class="pd-section-title">Season Stats</div>
      ${seasonTiles}
    </div>

    <!-- Form bars -->
    <div class="pd-section">
      <div class="pd-section-title">Recent History (Last ${matchHist.length} Matches)</div>
      ${chartToggleHtml}
      <div id="pd-chart-container">
        ${formBarsHtml()}
      </div>
    </div>

    <!-- Match history table -->
    ${histTable ? `<div class="pd-section"><div class="pd-section-title">Match Log</div>${histTable}</div>` : ""}

    <!-- Upcoming fixtures -->
    <div class="pd-section">
      <div class="pd-section-title">Upcoming Fixtures</div>
      ${buildFixtureChipsHTML(p) || '<p class="pd-empty">No upcoming fixtures.</p>'}
    </div>`;

  document.getElementById("pd-overlay").classList.remove("hidden");
  document.body.style.overflow = "hidden";

  // Attach event listeners to toggle buttons
  const toggleBtns = document.querySelectorAll(".pd-chart-toggle-btn");
  toggleBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      // update active state
      toggleBtns.forEach((b) => {
        b.classList.remove("active");
        b.style.color = "var(--text-2)";
        b.style.borderColor = "var(--border)";
        b.style.background = "var(--bg-2)";
      });
      const targetBtn = e.target;
      targetBtn.classList.add("active");
      targetBtn.style.color = "var(--teal)";
      targetBtn.style.borderColor = "var(--teal)";
      targetBtn.style.background = "var(--teal-dim)";

      state.currentPDChartMetric = targetBtn.getAttribute("data-metric");
      document.getElementById("pd-chart-container").innerHTML = formBarsHtml();
    });
  });

  // Style initially active button
  const initialActive = document.querySelector(".pd-chart-toggle-btn.active");
  if (initialActive) {
    initialActive.style.color = "var(--teal)";
    initialActive.style.borderColor = "var(--teal)";
    initialActive.style.background = "var(--teal-dim)";
  }
}

function closePlayerModal() {
  document.getElementById("pd-overlay").classList.add("hidden");
  document.body.style.overflow = "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DATA FETCH ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function isPreseasonEmptyDataset() {
  const deadlineTime = Date.parse(state.deadline || "");
  return (
    state.players.length === 0 &&
    state.currentGW === 1 &&
    Number.isFinite(deadlineTime) &&
    deadlineTime > Date.now()
  );
}

function clearLoadedDataset() {
  state.players = [];
  state.filteredPlayers = [];
  state.nextGWs = [];
  state.currentGW = null;
  state.deadline = null;
  state.fetchedAt = null;
  state.schemaVersion = null;
  state.actualGWs = null;
  clearCountdown();
  clearFreshness();
}

function setLoadError(message) {
  state.loadError = true;
  if (el.errorText) el.errorText.textContent = message;
  el.error?.classList.remove("hidden");
}

async function fetchPlayers() {
  state.loadError = false;
  el.error?.classList.add("hidden");

  try {
    const res = await fetch("players.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    const classified = window.FPLSchemaUtils?.classifyPlayerDataset(payload);

    if (!classified?.compatible) {
      clearLoadedDataset();
      setLoadError(
        "Player data format is temporarily incompatible. Please try again shortly.",
      );
      applyFiltersAndSort();
      return;
    }

    const data = classified.dataset;
    state.players = data.players;
    migrateLegacyWatchlist();
    syncWatchlistHeader();
    state.nextGWs = data.next_gws || [];
    state.currentGW = data.current_gw || null;
    state.deadline = data.deadline || null;
    state.fetchedAt = data.fetched_at || null;
    state.schemaVersion = classified.schemaVersion;
    state.actualGWs = null;

    // Derive price slider range from actual data.
    const prices = state.players.map((p) => p.price).filter(Boolean);
    const minPrice = Math.floor(Math.min(...prices, 3.0) * 10);
    const maxPrice = Math.ceil(Math.max(...prices, 15.0) * 10);
    el.priceMinSlider.min = minPrice;
    el.priceMinSlider.value = minPrice;
    el.priceMaxSlider.max = maxPrice;
    el.priceMaxSlider.value = maxPrice;
    state.priceMin = minPrice / 10;
    state.priceMax = maxPrice / 10;
    updatePriceFill();

    renderFreshness(state.fetchedAt);
    populateTeamFilter();
    applyFiltersAndSort();
    initCountdown(state.deadline, state.currentGW);
  } catch (error) {
    console.error(error);
    clearLoadedDataset();
    setLoadError("Player data is temporarily unavailable. Please try again shortly.");
    applyFiltersAndSort();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PRICE RANGE ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function updatePriceFill() {
  const minV = parseInt(el.priceMinSlider.value);
  const maxV = parseInt(el.priceMaxSlider.value);
  const lo = parseInt(el.priceMinSlider.min);
  const hi = parseInt(el.priceMaxSlider.max);
  const total = hi - lo;
  const minPct = ((minV - lo) / total) * 100;
  const maxPct = ((maxV - lo) / total) * 100;
  document.getElementById("price-fill").style.left = minPct + "%";
  document.getElementById("price-fill").style.right = 100 - maxPct + "%";
  document.getElementById("price-min-disp").textContent = (minV / 10).toFixed(
    1,
  );
  document.getElementById("price-max-disp").textContent = (maxV / 10).toFixed(
    1,
  );
  state.priceMin = minV / 10;
  state.priceMax = maxV / 10;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── TEAM FILTER ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function populateTeamFilter() {
  el.teamGrid.innerHTML = "";
  const teams = Array.from(
    new Map(
      state.players.map((p) => [p.team, { name: p.team, logo: p.logo }]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));
  const frag = document.createDocumentFragment();
  teams.forEach(({ name, logo }) => {
    const btn = document.createElement("button");
    btn.className =
      "team-logo-btn" + (state.selectedTeams.includes(name) ? " selected" : "");
    btn.title = name;
    btn.innerHTML = `<img src="${logo}" alt="${name}"><span class="team-abbr">${name}</span>`;
    btn.addEventListener("click", () => {
      if (state.selectedTeams.length === 0) {
        state.selectedTeams = [name];
        document
          .querySelectorAll(".team-logo-btn")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
      } else if (state.selectedTeams.includes(name)) {
        state.selectedTeams = state.selectedTeams.filter((t) => t !== name);
        btn.classList.remove("selected");
        if (!state.selectedTeams.length)
          document
            .querySelectorAll(".team-logo-btn")
            .forEach((b) => b.classList.remove("selected"));
      } else {
        state.selectedTeams.push(name);
        btn.classList.add("selected");
      }
      state.currentPage = 1;
      syncTeamFilterUI();
      applyFiltersAndSort();
      if (
        !document.getElementById("fdr-container").classList.contains("hidden")
      )
        renderFDRHeatmap();
    });
    frag.appendChild(btn);
  });
  el.teamGrid.appendChild(frag);
  syncTeamFilterUI();
}

function syncTeamFilterUI() {
  const n = state.selectedTeams.length;
  const lbl = document.getElementById("team-filter-label");
  const cnt = document.getElementById("team-selection-count");
  el.teamToggleBtn.classList.toggle("has-selection", n > 0);
  lbl.textContent =
    n === 0
      ? "Filter by Team"
      : n === 1
        ? `Team: ${state.selectedTeams[0]}`
        : "Filter by Team";
  cnt.textContent = n > 1 ? `${n} selected` : "";
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── FILTER + SORT ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function baseFilter(p, pfx, maxM) {
  const isPct = el.minsToggle.checked;
  const sld = parseInt(el.minsSlider.value, 10);
  const qLow = state.searchQuery.toLowerCase();
  const mins = p[`${pfx}minutes`] ?? 0;
  if (!mins) return false;
  if (isPct ? Math.round((mins / maxM) * 100) < sld : mins < sld) return false;
  if (p.price < state.priceMin || p.price > state.priceMax) return false;
  if (!p.name.toLowerCase().includes(qLow)) return false;
  if (state.selectedTeams.length && !state.selectedTeams.includes(p.team))
    return false;
  if (state.positionFilter !== "All" && p.position !== state.positionFilter)
    return false;
  return true;
}

function applyFiltersAndSort() {
  const pfx = pfxFor();
  const maxM = maxMFor();

  // watchlistOnly restricts the pool but all other filters still apply
  const pool =
    state.watchlistOnly && state.watchlist.size > 0
      ? state.players.filter((p) => state.watchlist.has(p.element_id))
      : state.players;

  state.filteredPlayers = pool.filter((p) => baseFilter(p, pfx, maxM));

  state.filteredPlayers.sort((a, b) => {
    if (state.sortColumn === "name") {
      const na = a.name.toLowerCase(),
        nb = b.name.toLowerCase();
      return state.sortDirection === "asc"
        ? na.localeCompare(nb)
        : nb.localeCompare(na);
    }
    let va, vb;
    if (state.sortColumn === "value") {
      va = a.price > 0 ? (a[`${pfx}points`] ?? 0) / a.price : 0;
      vb = b.price > 0 ? (b[`${pfx}points`] ?? 0) / b.price : 0;
    } else {
      va = a[`${pfx}${state.sortColumn}`] ?? 0;
      vb = b[`${pfx}${state.sortColumn}`] ?? 0;
    }
    return state.sortDirection === "asc" ? va - vb : vb - va;
  });

  // Compute column maxes including new season columns
  const allCols = [
    "xG",
    "xA",
    "xGI",
    "influence",
    "creativity",
    "threat",
    "ict",
    "bps",
    "bonus",
    "points",
    "saves",
    "defcon",
    "goals",
    "assists",
    "clean_sheets",
    "ppg",
  ];
  allCols.forEach((c) => {
    state.columnMaxes[c] = Math.max(
      ...state.filteredPlayers.map((p) => parseFloat(p[`${pfx}${c}`] ?? 0)),
      0.01,
    );
  });
  state.columnMaxes.value = Math.max(
    ...state.filteredPlayers.map((p) =>
      p.price > 0 ? (p[`${pfx}points`] ?? 0) / p.price : 0,
    ),
    0.01,
  );

  state.currentPage = 1;
  document.getElementById("s-count").textContent =
    `${state.filteredPlayers.length}`;
  updatePagination();
  renderTable(pfx);
}

function updatePagination() {
  const total =
    Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1;
  if (state.currentPage > total) state.currentPage = total;
  el.pageInfo.textContent = `Page ${state.currentPage} of ${total}`;
  el.btnPrev.disabled = state.currentPage === 1;
  el.btnNext.disabled = state.currentPage === total;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDER TABLE ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderTable(pfxArg) {
  el.tbody.innerHTML = "";
  const pfx = pfxArg || pfxFor();
  const maxM = maxMFor();
  const isGK = state.positionFilter === "GK";
  const isSeason = state.timeframe === "season";
  const maxes = state.columnMaxes;

  // Column visibility
  const vis = (id, show) =>
    document.getElementById(id)?.classList.toggle("hidden", !show);
  vis("col-saves", isGK);
  vis("col-xg", !isGK);
  vis("col-xa", !isGK);
  vis("col-xgi", !isGK);
  vis("col-influence", !isGK);
  vis("col-creativity", !isGK);
  vis("col-threat", !isGK);
  vis("col-ict", !isGK);
  vis("col-defcon", !isGK && !isSeason); // DefCon hidden in season (no data)
  // Season-only columns
  vis("col-goals", !isGK);
  vis("col-assists", !isGK);
  vis("col-cs", isSeason);
  vis("col-ppg", isSeason);

  if (!state.filteredPlayers.length) {
    const tr = document.createElement("tr");
    const emptyMessage = state.loadError
      ? "Player data is temporarily unavailable. Use “Try again” above to reload."
      : isPreseasonEmptyDataset()
        ? "The season has not started yet. Player statistics will appear after the opening matches."
        : "No players match the current filters.";
    tr.innerHTML = `<td colspan="20" style="text-align:center;color:var(--text-2);padding:36px;font-family:var(--f-m);font-size:0.82rem;">${emptyMessage}</td>`;
    el.tbody.appendChild(tr);
    return;
  }

  const start = (state.currentPage - 1) * state.itemsPerPage;
  const page = state.filteredPlayers.slice(start, start + state.itemsPerPage);
  const valMax = maxes.value || 0.01;
  const bar = (v, max) =>
    max > 0 ? `${Math.min((v / max) * 100, 100).toFixed(1)}%` : "0%";
  const frag = document.createDocumentFragment();

  page.forEach((p, i) => {
    const mins = p[`${pfx}minutes`] ?? 0;
    const minPct = p[`${pfx}min_pct`] ?? Math.round((mins / maxM) * 100);
    const saves = p[`${pfx}saves`] ?? 0;
    const defcon = p[`${pfx}defcon`] ?? 0;
    const xG = (p[`${pfx}xG`] ?? 0).toFixed(2);
    const xA = (p[`${pfx}xA`] ?? 0).toFixed(2);
    const xGI = (p[`${pfx}xGI`] ?? 0).toFixed(2);
    const influence = (p[`${pfx}influence`] ?? 0).toFixed(1);
    const creat = (p[`${pfx}creativity`] ?? 0).toFixed(1);
    const threat = (p[`${pfx}threat`] ?? 0).toFixed(1);
    const ict = (p[`${pfx}ict`] ?? 0).toFixed(1);
    const bps = p[`${pfx}bps`] ?? 0;
    const bonus = p[`${pfx}bonus`] ?? 0;
    const pts = p[`${pfx}points`] ?? 0;
    const goals = p[`${pfx}goals`] ?? 0;
    const assists = p[`${pfx}assists`] ?? 0;
    const cs = p[`${pfx}clean_sheets`] ?? 0;
    const ppg = (p[`${pfx}ppg`] ?? 0).toFixed(2);
    const val = p.price > 0 ? (pts / p.price).toFixed(1) : "0.0";
    const own = p.ownership ?? "0.0";

    // Injury badge
    let injHtml = "";
    if (p.status_pct < 100) {
      const cls =
        p.status_pct === 0
          ? "inj-0"
          : p.status_pct <= 25
            ? "inj-25"
            : p.status_pct <= 50
              ? "inj-50"
              : "inj-75";
      injHtml = `<span class="inj-badge ${cls}">&#9888; ${p.status_pct}%</span>`;
    }

    const watched = state.watchlist.has(p.element_id);
    const cmpIdx = state.compareSet.indexOf(p.element_id);
    const cmpFull = state.compareSet.length >= 3 && cmpIdx === -1;
    const fixChips = buildFixtureChipsHTML(p);

    const tr = document.createElement("tr");
    tr.style.setProperty("--ri", i);
    tr.style.cursor = "pointer"; // signals clickability for Feature 6

    let cmpClass = "cmp-add-btn",
      cmpTxt = "+";
    if (cmpIdx !== -1) {
      cmpClass += ` ${CMP[cmpIdx].cls}`;
      cmpTxt = cmpIdx + 1;
    }

    let trendHtml = "";
    if (p.net_transfers > 50000) {
      trendHtml = `<span class="transfer-trend" title="Hot: +${p.net_transfers.toLocaleString()} transfers">❤️‍🩹</span>`;
    } else if (p.net_transfers < -50000) {
      trendHtml = `<span class="transfer-trend" title="Cold: ${p.net_transfers.toLocaleString()} transfers">💔</span>`;
    }

    const td = document.createElement("td");
    td.className = "sticky-col";
    td.innerHTML = `
      <div class="player-cell">
        <div class="team-logo-wrap">
          <img src="${p.logo}" alt="${p.team}" class="team-logo">
          <span class="player-price">&pound;${p.price.toFixed(1)}m</span>
          ${trendHtml}
        </div>
        <div class="player-info">
          <div class="player-name-row">
            <span class="pos-badge pos-${p.position}">${p.position}</span>
            <span class="player-name-text">${p.name}</span>
            <button class="star-btn ${watched ? "active" : ""}" data-watch="${p.element_id}" title="Watchlist">&#9733;</button>
            <button class="${cmpClass}" data-cmp="${p.element_id}" title="Compare" ${cmpFull ? "disabled" : ""}>${cmpTxt}</button>
          </div>
          <div class="player-meta-row">
            <span class="own-badge">${own}%</span>
            <span class="mins-badge">${mins}m (${minPct}%)</span>
            ${injHtml}
          </div>
          ${fixChips}
        </div>
      </div>`;

    td.querySelector(".star-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleWatch(p.element_id);
    });
    td.querySelector(".cmp-add-btn").addEventListener("click", function (e) {
      e.stopPropagation();
      if (!this.disabled) toggleCompare(p.element_id);
    });
    tr.appendChild(td);

    // Feature 6: row click → player modal (ignore clicks on buttons/chips)
    tr.addEventListener("click", (e) => {
      if (e.target.closest(".star-btn, .cmp-add-btn, .fix-chip, .fixture-unknown"))
        return;
      openPlayerModal(p);
    });

    const statTd = (value, max, hidden = false) => {
      const cell = document.createElement("td");
      if (hidden) cell.classList.add("hidden");
      cell.style.setProperty("--bar", bar(parseFloat(value), max));
      cell.textContent = value;
      return cell;
    };

    tr.appendChild(statTd(saves, maxes.saves, !isGK));
    tr.appendChild(statTd(pts, maxes.points));
    // Season-only columns (hidden unless season mode)
    tr.appendChild(statTd(goals, maxes.goals, isGK));
    tr.appendChild(statTd(assists, maxes.assists, isGK));
    tr.appendChild(statTd(cs, maxes.clean_sheets, !isSeason));
    tr.appendChild(statTd(ppg, maxes.ppg, !isSeason));
    // Standard columns
    tr.appendChild(statTd(xG, maxes.xG, isGK));
    tr.appendChild(statTd(xA, maxes.xA, isGK));
    tr.appendChild(statTd(xGI, maxes.xGI, isGK));
    tr.appendChild(statTd(influence, maxes.influence, isGK));
    tr.appendChild(statTd(creat, maxes.creativity, isGK));
    tr.appendChild(statTd(threat, maxes.threat, isGK));
    tr.appendChild(statTd(ict, maxes.ict, isGK));
    tr.appendChild(statTd(defcon, maxes.defcon, isGK || isSeason));
    tr.appendChild(statTd(bps, maxes.bps));
    tr.appendChild(statTd(bonus, maxes.bonus));
    tr.appendChild(statTd(val, valMax));

    frag.appendChild(tr);
  });
  el.tbody.appendChild(frag);
}

function syncSortHeaders() {
  el.headers.forEach((th) => {
    const col = th.getAttribute("data-sort");
    th.classList.remove("active-sort", "asc", "desc");
    const icon = th.querySelector(".sort-icon");
    if (icon) icon.textContent = "";
    if (col === state.sortColumn) {
      th.classList.add("active-sort", state.sortDirection);
      if (icon) {
        icon.textContent = state.sortDirection === "asc" ? "▲" : "▼";
      }
    }
  });
}

function syncSliderUI() {
  const isPct = el.minsToggle.checked;
  el.minsSlider.max = isPct ? 100 : maxMFor();
  el.minsLabel.textContent = isPct
    ? `Min Mins: ${el.minsSlider.value}%`
    : `Min Mins: ${el.minsSlider.value}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── INIT ─────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  el.tbody = document.getElementById("table-body");
  el.headers = document.querySelectorAll("#players-table th");
  el.btnPrev = document.getElementById("btn-prev");
  el.btnNext = document.getElementById("btn-next");
  el.pageInfo = document.getElementById("page-info");
  el.error = document.getElementById("error-message");
  el.errorText = document.getElementById("error-message-text");
  el.btnRetryLoad = document.getElementById("btn-retry-load");
  el.minsSlider = document.getElementById("minutes-slider");
  el.minsToggle = document.getElementById("minutes-toggle");
  el.minsLabel = document.getElementById("minutes-label");
  el.searchInput = document.getElementById("search-input");
  el.teamGrid = document.getElementById("team-filter-row");
  el.teamToggleBtn = document.getElementById("team-filter-toggle-btn");
  el.teamPanel = document.getElementById("team-filter-panel");
  el.positionBtns = document.querySelectorAll("#position-group button");
  el.priceMinSlider = document.getElementById("price-min-slider");
  el.priceMaxSlider = document.getElementById("price-max-slider");

  document.getElementById("gw-countdown").classList.add("hidden");

  // ── FDR Heatmap ──
  document.getElementById("btn-fdr").addEventListener("click", openFDRHeatmap);
  document
    .getElementById("btn-fdr-close")
    .addEventListener("click", closeFDRHeatmap);
  document.getElementById("btn-fdr-sort-avg").addEventListener("click", (e) => {
    state.fdrSortMode = "avg";
    document.getElementById("btn-fdr-sort-avg").classList.add("active");
    document.getElementById("btn-fdr-sort-alpha").classList.remove("active");
    renderFDRHeatmap();
  });
  document
    .getElementById("btn-fdr-sort-alpha")
    .addEventListener("click", (e) => {
      state.fdrSortMode = "alpha";
      document.getElementById("btn-fdr-sort-alpha").classList.add("active");
      document.getElementById("btn-fdr-sort-avg").classList.remove("active");
      renderFDRHeatmap();
    });

  // ── Theme ──
  loadTheme();
  document.getElementById("btn-gear").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("theme-panel").classList.toggle("hidden");
  });
  document.addEventListener("click", () =>
    document.getElementById("theme-panel").classList.add("hidden"),
  );
  document
    .getElementById("theme-panel")
    .addEventListener("click", (e) => e.stopPropagation());
  document
    .querySelectorAll(".theme-swatch")
    .forEach((s) =>
      s.addEventListener("click", () => applyTheme(s.dataset.theme)),
    );

  // ── Watchlist ──
  document
    .getElementById("btn-wl-open")
    .addEventListener("click", openWatchlist);
  document
    .getElementById("btn-wl-close")
    .addEventListener("click", closeWatchlist);
  document
    .getElementById("wl-backdrop")
    .addEventListener("click", closeWatchlist);
  document.getElementById("btn-wl-only").addEventListener("click", () => {
    state.watchlistOnly = !state.watchlistOnly;
    document
      .getElementById("btn-wl-only")
      .classList.toggle("active", state.watchlistOnly);
    state.currentPage = 1;
    applyFiltersAndSort();
  });
  document.getElementById("btn-wl-clear").addEventListener("click", () => {
    state.watchlist.clear();
    saveWatchlist();
    state.watchlistOnly = false;
    document.getElementById("btn-wl-only").classList.remove("active");
    syncWatchlistHeader();
    renderWatchlistDrawer();
    document
      .querySelectorAll("[data-watch]")
      .forEach((b) => b.classList.remove("active"));
    applyFiltersAndSort();
  });

  // ── Comparison ──
  document
    .getElementById("btn-cmp-open")
    .addEventListener("click", openCompareModal);
  document
    .getElementById("btn-cmp-modal-close")
    .addEventListener("click", closeCompareModal);
  document.getElementById("cmp-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeCompareModal();
  });
  document.getElementById("btn-cmp-clear").addEventListener("click", () => {
    state.compareSet = [];
    syncAllCmpButtons();
    syncCmpBar();
  });

  // ── Player detail modal ──
  document
    .getElementById("btn-pd-close")
    .addEventListener("click", closePlayerModal);
  document.getElementById("pd-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closePlayerModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePlayerModal();
  });

  // ── Price range ──
  el.priceMinSlider.addEventListener("input", () => {
    if (
      parseInt(el.priceMinSlider.value) >
      parseInt(el.priceMaxSlider.value) - 5
    )
      el.priceMinSlider.value = parseInt(el.priceMaxSlider.value) - 5;
    updatePriceFill();
    state.currentPage = 1;
    applyFiltersAndSort();
  });
  el.priceMaxSlider.addEventListener("input", () => {
    if (
      parseInt(el.priceMaxSlider.value) <
      parseInt(el.priceMinSlider.value) + 5
    )
      el.priceMaxSlider.value = parseInt(el.priceMinSlider.value) + 5;
    updatePriceFill();
    state.currentPage = 1;
    applyFiltersAndSort();
  });
  updatePriceFill();

  // ── Team filter ──
  el.teamToggleBtn.addEventListener("click", () => {
    const open = el.teamPanel.classList.toggle("open");
    el.teamToggleBtn.classList.toggle("open", open);
  });
  document
    .getElementById("btn-select-all-teams")
    .addEventListener("click", () => {
      state.selectedTeams = [];
      document
        .querySelectorAll(".team-logo-btn")
        .forEach((b) => b.classList.remove("selected"));
      state.currentPage = 1;
      syncTeamFilterUI();
      applyFiltersAndSort();
      if (
        !document.getElementById("fdr-container").classList.contains("hidden")
      )
        renderFDRHeatmap();
    });

  // ── Timeframe (Last 5 / Last 10 / Season) ──
  function setTimeframe(tf, activeBtn) {
    state.timeframe = tf;
    state.currentPage = 1;
    document
      .querySelectorAll('.seg-group button[id^="btn-last"], #btn-season')
      .forEach((b) => b.classList.remove("active"));
    activeBtn.classList.add("active");
    el.minsSlider.value = 0;
    syncSliderUI();
    applyFiltersAndSort();
  }
  document.getElementById("btn-last5").addEventListener("click", function () {
    setTimeframe("last_5", this);
  });
  document.getElementById("btn-last10").addEventListener("click", function () {
    setTimeframe("last_10", this);
  });
  document.getElementById("btn-season").addEventListener("click", function () {
    setTimeframe("season", this);
  });

  // ── Minutes ──
  el.minsToggle.addEventListener("change", () => {
    el.minsSlider.value = 0;
    syncSliderUI();
    state.currentPage = 1;
    applyFiltersAndSort();
  });
  el.minsSlider.addEventListener("input", () => {
    syncSliderUI();
    state.currentPage = 1;
    applyFiltersAndSort();
  });

  // ── Search ──
  el.searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    state.currentPage = 1;
    applyFiltersAndSort();
  });

  // ── Sort ──
  el.headers.forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-sort");
      if (!col) return;
      if (state.sortColumn === col)
        state.sortDirection = state.sortDirection === "asc" ? "desc" : "asc";
      else {
        state.sortColumn = col;
        state.sortDirection = "desc";
      }
      state.currentPage = 1;
      syncSortHeaders();
      applyFiltersAndSort();
    });
  });

  // ── Position ──
  el.positionBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      el.positionBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.positionFilter = btn.getAttribute("data-pos");
      state.currentPage = 1;
      applyFiltersAndSort();
    });
  });

  // ── Pagination ──
  el.btnPrev.addEventListener("click", () => {
    if (state.currentPage > 1) {
      state.currentPage--;
      updatePagination();
      renderTable();
    }
  });
  el.btnNext.addEventListener("click", () => {
    const total =
      Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1;
    if (state.currentPage < total) {
      state.currentPage++;
      updatePagination();
      renderTable();
    }
  });

  el.btnRetryLoad.addEventListener("click", () => {
    fetchPlayers();
  });

  // ── Boot ──
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(console.error);
  }
  loadWatchlist();
  syncWatchlistHeader();
  fetchPlayers();
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = { state, fetchPlayers, applyFiltersAndSort, renderTable };
}
