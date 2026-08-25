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
  dataSource: null,
  loadError: false,
  isPreseasonDataset: false,
  watchlist: new Set(),
  watchlistOnly: false,
  compareSet: [],
  priceMin: 3.0,
  priceMax: 15.0,
  fdrSortMode: "avg", // 'avg' | 'alpha'
  accountSession: null,
  teamProfile: null,
  teamPicks: [],
  squadElementIds: new Set(),
  mySquadOnly: false,
  teamRequestToken: 0,
};
const el = {};
let activeDialog = null;
let accountAuth = null;
let accountSync = null;
let accountUnsubscribe = null;
let teamDataLoader = null;

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
const uiStateUtils = () => window.FPLUIStateUtils;
const dashboardDataUtils = () => window.FPLDashboardDataUtils;
const renderUtils = () => window.FPLRenderUtils;
const escapePublicHTML = (value) => renderUtils()?.escapeHTML(value) ?? "";
const safePublicImageURL = (value) => renderUtils()?.safeImageURL(value) ?? "";
const safePublicPositionClass = (value) => renderUtils()?.safePositionClass(value) ?? "UNK";
const safePublicPlayer = (player) => ({
  name: escapePublicHTML(player?.name),
  team: escapePublicHTML(player?.team),
  logo: safePublicImageURL(player?.logo),
  position: escapePublicHTML(player?.position),
  positionClass: safePublicPositionClass(player?.position),
});
const playerTableUtils = () => window.FPLPlayerTableUtils;
const playerQueryUtils = () => window.FPLPlayerQueryUtils;
const fdrViewUtils = () => window.FPLFdrViewUtils;
const accountSyncUtils = () => window.FPLAccountSyncUtils;
const teamProfileUtils = () => window.FPLTeamProfileUtils;

const focusableSelector = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function activateDialog(containerId, initialFocusSelector) {
  const container = document.getElementById(containerId);
  if (!container) return;

  activeDialog = {
    container,
    invoker:
      document.activeElement instanceof HTMLElement ? document.activeElement : null,
  };
  container.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  const initialFocus = container.querySelector(initialFocusSelector);
  (initialFocus || container).focus();
}

function deactivateDialog(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  const invoker =
    activeDialog?.container === container ? activeDialog.invoker : null;
  activeDialog = null;
  if (invoker?.isConnected) invoker.focus();
}

function handleDialogKeyboard(event) {
  if (!activeDialog) return;

  if (event.key === "Escape") {
    event.preventDefault();
    const { id } = activeDialog.container;
    if (id === "wl-drawer") closeWatchlist();
    if (id === "cmp-overlay") closeCompareModal();
    if (id === "pd-overlay") closePlayerModal();
    return;
  }

  if (event.key !== "Tab") return;
  const focusable = [
    ...activeDialog.container.querySelectorAll(focusableSelector),
  ];
  if (!focusable.length) {
    event.preventDefault();
    activeDialog.container.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── THEMES ───────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const THEME_KEY = "fpl_theme_v1";
function applyTheme(t, { sync = true } = {}) {
  const normalisedTheme = accountSyncUtils()?.normalizeTheme(t) || "green";
  document.documentElement.setAttribute("data-theme", normalisedTheme);
  localStorage.setItem(THEME_KEY, normalisedTheme);
  document
    .querySelectorAll(".theme-swatch")
    .forEach((s) => s.classList.toggle("active", s.dataset.theme === normalisedTheme));
  if (sync) syncThemeToAccount(normalisedTheme);
}
function loadTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "green", { sync: false });
}

function setAccountStatus(message, kind = "neutral") {
  const controls = document.getElementById("account-controls");
  const status = document.getElementById("account-status");
  if (!controls || !status) return;
  status.textContent = message;
  controls.classList.toggle("is-signed-in", kind === "signed-in");
  controls.classList.toggle("is-error", kind === "error");
}

function renderAccountControls() {
  const controls = document.getElementById("account-controls");
  const signInButton = document.getElementById("btn-account-sign-in");
  const signOutButton = document.getElementById("btn-account-sign-out");
  if (!controls || !signInButton || !signOutButton) return;

  const enabled = accountAuth?.isEnabled?.() === true;
  controls.classList.toggle("hidden", !enabled);
  if (!enabled) return;

  const signedIn = Boolean(state.accountSession?.user?.id);
  signInButton.classList.toggle("hidden", signedIn);
  signOutButton.classList.toggle("hidden", !signedIn);
  setAccountStatus(signedIn ? "Signed in" : "Signed out", signedIn ? "signed-in" : "neutral");
}

function syncThemeToAccount(theme) {
  if (!state.accountSession || !accountSync) return;
  accountSync.saveTheme({ session: state.accountSession, theme }).catch(() => {
    setAccountStatus("Signed in — theme sync unavailable", "error");
  });
}

function syncFdrSortModeToAccount(fdrSortMode) {
  if (!state.accountSession || !accountSync) return;
  accountSync.saveFdrSortMode({ session: state.accountSession, fdrSortMode }).catch(() => {
    setAccountStatus("Signed in — FDR preference sync unavailable", "error");
  });
}

function syncTeamPreferencesToAccount(teamId) {
  if (!state.accountSession || !accountSync) return;
  accountSync
    .saveTeamPreferences({
      session: state.accountSession,
      teamId,
      fdrSortMode: state.fdrSortMode,
    })
    .catch(() => {
      setAccountStatus("Signed in — Team ID sync unavailable", "error");
      setTeamStatus("Team is saved on this device; account sync is temporarily unavailable.", true);
    });
}

function restoreTeamProfileFromAccount(teamId, fdrSortMode) {
  const utils = teamProfileUtils();
  if (!utils || !teamId) return;
  const profile = utils.createProfile({
    teamId,
    watchlistElementIds: [...state.watchlist],
    fdrSortMode,
  });
  if (!profile) return;
  state.teamRequestToken += 1;
  state.teamProfile = profile;
  state.teamPicks = [];
  state.squadElementIds = new Set();
  state.mySquadOnly = false;
  saveTeamProfile();
  syncTeamProfileUI();
  if (teamDataLoader) connectFPLTeam(profile.teamId, { isRefresh: true, syncAccount: false });
}

function refreshAccountDependentUI() {
  syncWatchlistHeader();
  renderWatchlistDrawer();
  if (state.players.length) applyFiltersAndSort();
}

async function applyAccountSession(session) {
  state.accountSession = session || null;
  renderAccountControls();
  syncTeamProfileUI();
  if (!state.accountSession || !accountSync) return;

  try {
    const synced = await accountSync.syncInitialPreferences({
      session: state.accountSession,
      localWatchlistElementIds: [...state.watchlist],
      localTheme: localStorage.getItem(THEME_KEY) || "green",
      localTeamId: state.teamProfile?.teamId || null,
      localFdrSortMode: state.teamProfile?.fdrSortMode || state.fdrSortMode,
    });
    state.watchlist = new Set(synced.watchlistElementIds);
    state.fdrSortMode = synced.effectiveFdrSortMode;
    saveWatchlist({ sync: false });
    applyTheme(synced.effectiveTheme, { sync: false });
    if (synced.effectiveTeamId) {
      restoreTeamProfileFromAccount(synced.effectiveTeamId, synced.effectiveFdrSortMode);
    }
    refreshAccountDependentUI();
    setAccountStatus("Signed in", "signed-in");
  } catch (_) {
    setAccountStatus("Signed in — account sync unavailable", "error");
  }
}

function initialiseAccount() {
  const publicConfig = window.FPLPublicDataConfig;
  const authApi = window.FPLAccountAuth;
  const syncApi = window.FPLAccountSync;
  const utils = accountSyncUtils();
  if (!publicConfig || !authApi || !syncApi || !utils) return;

  accountAuth = authApi.createAccountAuth({
    ...publicConfig.account,
    supabaseUrl: publicConfig.supabaseUrl,
    supabasePublishableKey: publicConfig.supabasePublishableKey,
  });
  if (!accountAuth.isEnabled()) {
    renderAccountControls();
    return;
  }

  accountSync = syncApi.createAccountSync({ client: accountAuth.client, utils });
  const signInButton = document.getElementById("btn-account-sign-in");
  const signOutButton = document.getElementById("btn-account-sign-out");
  signInButton?.addEventListener("click", async () => {
    setAccountStatus("Redirecting to Google");
    try {
      await accountAuth.signInWithGoogle();
    } catch (_) {
      setAccountStatus("Google sign-in is unavailable", "error");
    }
  });
  signOutButton?.addEventListener("click", async () => {
    setAccountStatus("Signing out");
    try {
      await accountAuth.signOut();
    } catch (_) {
      setAccountStatus("Sign-out is unavailable", "error");
    }
  });

  accountUnsubscribe?.();
  accountUnsubscribe = accountAuth.onAuthStateChange((_event, session) => {
    applyAccountSession(session);
  });
  accountAuth
    .getSession()
    .then((session) => applyAccountSession(session))
    .catch(() => setAccountStatus("Account status unavailable", "error"));
  renderAccountControls();
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

  const safeGameweek = escapePublicHTML(gameweek);
  let html = '<div class="gw-slot">';
  if (slot.status === "unknown") {
    html += `<div class="fixture-unknown" title="GW${safeGameweek}: fixture data unavailable">TBC</div>`;
  } else {
    slot.fixtures.forEach((fixture) => {
      const homeAway = fixture.is_home ? "H" : "A";
      const opponent = escapePublicHTML(fixture.opponent);
      const opponentLogo = safePublicImageURL(fixture.opponent_logo);
      const difficulty = Number(fixture.difficulty);
      const safeDifficulty = Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= 5
        ? difficulty
        : "unknown";
      html += `<div class="fix-chip diff-${safeDifficulty}" title="GW${safeGameweek} vs ${opponent} (${homeAway}) FDR:${safeDifficulty}">
        <img src="${opponentLogo}" alt="${opponent}">
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
  document.querySelector(".fpl-team-section")?.classList.add("hidden");
  document.querySelector(".summary-strip").classList.add("hidden");
  document.getElementById("btn-fdr").classList.add("hidden");
  document.getElementById("btn-fdr-close").classList.remove("hidden");
  document.getElementById("fdr-container").classList.remove("hidden");
  document.getElementById("btn-fdr-sort-avg").classList.toggle("active", state.fdrSortMode === "avg");
  document.getElementById("btn-fdr-sort-alpha").classList.toggle("active", state.fdrSortMode === "alpha");
  renderFDRHeatmap();
}

function closeFDRHeatmap() {
  document.getElementById("main-content").classList.remove("hidden");
  document.querySelector(".controls-top").classList.remove("hidden");
  document.querySelector(".search-wrap").classList.remove("hidden");
  document.querySelector(".price-section").classList.remove("hidden");
  document.querySelector(".fpl-team-section")?.classList.remove("hidden");
  document.querySelector(".summary-strip").classList.remove("hidden");
  document.getElementById("btn-fdr").classList.remove("hidden");
  document.getElementById("btn-fdr-close").classList.add("hidden");
  document.getElementById("fdr-container").classList.add("hidden");
}

function renderFDRHeatmap() {
  const theadRow = document.getElementById("fdr-thead-row");
  const tbody = document.getElementById("fdr-table-body");

  const { gameweeks: gws, teams: filteredTeams } =
    fdrViewUtils().buildFdrViewModel({
      players: state.players,
      selectedTeams: state.selectedTeams,
      sortMode: state.fdrSortMode,
    });

  if (gws.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="100%">No upcoming fixtures available.</td></tr>';
    return;
  }

  // Setup header
  theadRow.innerHTML =
    '<th class="sticky-col" style="text-align:left;">Team</th>';
  gws.forEach((gw) => {
    theadRow.innerHTML += `<th>GW${escapePublicHTML(gw)}</th>`;
  });

  // Render rows
  const frag = document.createDocumentFragment();
  filteredTeams.forEach((t) => {
    const tr = document.createElement("tr");

    // Sticky Team Col
    const tdTeam = document.createElement("td");
    tdTeam.className = "sticky-col";
    const safeTeamName = escapePublicHTML(t.name);
    const safeTeamLogo = safePublicImageURL(t.logo);
    tdTeam.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <img src="${safeTeamLogo}" alt="${safeTeamName}" style="width:24px; height:24px; object-fit:contain; background:#0d1117; border-radius:3px; padding:1px;">
        <span style="font-family:var(--f-d); font-size:1rem; font-weight:700;">${safeTeamName}</span>
      </div>
    `;
    tr.appendChild(tdTeam);

    // GW Cols
    gws.forEach((gw) => {
      const td = document.createElement("td");
      const fixes = t.fixturesByGameweek[gw] || [];

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

function loadTeamProfile() {
  const utils = teamProfileUtils();
  if (!utils) return;
  try {
    const stored = JSON.parse(localStorage.getItem(utils.TEAM_PROFILE_KEY) || "null");
    const profile = utils.normalizeProfile(stored);
    if (!profile) return;
    state.teamProfile = profile;
    state.watchlist = new Set(profile.watchlistElementIds);
    state.fdrSortMode = profile.fdrSortMode;
  } catch {
    state.teamProfile = null;
  }
}

function saveTeamProfile() {
  const utils = teamProfileUtils();
  if (!utils || !state.teamProfile?.teamId) return;
  const profile = utils.createProfile({
    teamId: state.teamProfile.teamId,
    watchlistElementIds: [...state.watchlist],
    fdrSortMode: state.fdrSortMode,
  });
  if (!profile) return;
  state.teamProfile = profile;
  localStorage.setItem(utils.TEAM_PROFILE_KEY, JSON.stringify(profile));
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

function saveWatchlist({ elementId = null, watched = null, sync = true } = {}) {
  localStorage.setItem(WL_KEY, JSON.stringify([...state.watchlist]));
  saveTeamProfile();
  if (
    sync &&
    state.accountSession &&
    accountSync &&
    persistenceUtils()?.isValidElementId(elementId) &&
    typeof watched === "boolean"
  ) {
    accountSync
      .setWatchlistMembership({
        session: state.accountSession,
        elementId,
        watched,
      })
      .catch(() => setAccountStatus("Signed in — watchlist sync unavailable", "error"));
  }
}

function playerByElementId(elementId) {
  return state.players.find((player) => player.element_id === elementId);
}

function toggleWatch(elementId) {
  if (!persistenceUtils()?.isValidElementId(elementId)) return;
  state.watchlist.has(elementId)
    ? state.watchlist.delete(elementId)
    : state.watchlist.add(elementId);
  saveWatchlist({ elementId, watched: state.watchlist.has(elementId) });
  syncWatchlistHeader();
  renderWatchlistDrawer();
  const playerName = playerByElementId(elementId)?.name || "player";
  const watched = state.watchlist.has(elementId);
  document.querySelectorAll(`[data-watch="${elementId}"]`).forEach((button) => {
    button.classList.toggle("active", watched);
    button.setAttribute("aria-pressed", String(watched));
    button.setAttribute(
      "aria-label",
      `${watched ? "Remove" : "Add"} ${playerName} ${watched ? "from" : "to"} watchlist`,
    );
  });
}

function setTeamStatus(message = "", isError = false) {
  const status = document.getElementById("fpl-team-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function syncTeamProfileUI() {
  const input = document.getElementById("fpl-team-id");
  const actions = document.getElementById("fpl-team-actions");
  const connectButton = document.getElementById("btn-fpl-team-connect");
  const mySquadButton = document.getElementById("btn-my-squad");
  const note = document.getElementById("fpl-team-note");
  const connected = Boolean(state.teamProfile?.teamId);
  const hasSquad = state.squadElementIds.size > 0;
  if (input && connected) input.value = String(state.teamProfile.teamId);
  if (note) {
    note.textContent = state.accountSession
      ? "Public lookup only. Team ID and supported preferences sync with this Google account."
      : "Public lookup only. Team and preferences stay on this device.";
  }
  actions?.classList.toggle("hidden", !connected);
  if (connectButton) connectButton.textContent = connected ? "Update" : "Connect";
  if (mySquadButton) {
    mySquadButton.disabled = !hasSquad;
    mySquadButton.classList.toggle("active", state.mySquadOnly);
    mySquadButton.setAttribute("aria-pressed", String(state.mySquadOnly));
  }
}

function applyTeamPayload(payload, successMessage, { syncAccount = true } = {}) {
  const utils = teamProfileUtils();
  if (!utils) return;
  const profile = utils.createProfile({
    teamId: payload.teamId,
    watchlistElementIds: [...state.watchlist],
    fdrSortMode: state.fdrSortMode,
  });
  if (!profile) return;
  state.teamProfile = profile;
  state.teamPicks = payload.picks;
  state.squadElementIds = new Set(payload.picks.map((pick) => pick.element));
  saveTeamProfile();
  if (syncAccount) syncTeamPreferencesToAccount(profile.teamId);
  syncTeamProfileUI();
  setTeamStatus(successMessage);
  applyFiltersAndSort();
}

async function connectFPLTeam(teamIdInput, { isRefresh = false, syncAccount = !isRefresh } = {}) {
  if (!teamDataLoader) return;
  const requestToken = ++state.teamRequestToken;
  const submitButton = document.getElementById("btn-fpl-team-connect");
  const refreshButton = document.getElementById("btn-fpl-team-refresh");
  const activeButton = isRefresh ? refreshButton : submitButton;
  if (activeButton) activeButton.disabled = true;
  setTeamStatus(isRefresh ? "Refreshing public squad…" : "Connecting public team…");
  try {
    const payload = await teamDataLoader.load(teamIdInput);
    if (requestToken !== state.teamRequestToken) return;
    applyTeamPayload(
      payload,
      `Squad ready for public Team ID ${payload.teamId}.`,
      { syncAccount },
    );
  } catch (error) {
    setTeamStatus(
      error?.message || "FPL team data is temporarily unavailable. Try again shortly.",
      true,
    );
  } finally {
    if (activeButton) activeButton.disabled = false;
  }
}

async function disconnectFPLTeam() {
  if (!state.teamProfile) return;
  const confirmed = window.confirm(
    "Disconnect this public FPL Team ID? This removes the Team ID and this-device Team profile settings.",
  );
  if (!confirmed) return;
  if (state.accountSession && accountSync) {
    setTeamStatus("Disconnecting Team ID from this Google account…");
    try {
      await accountSync.clearTeamId({ session: state.accountSession });
    } catch (_) {
      setAccountStatus("Signed in — Team ID sync unavailable", "error");
      setTeamStatus("Team ID remains connected because account sync is temporarily unavailable.", true);
      return;
    }
  }
  const utils = teamProfileUtils();
  if (utils) localStorage.removeItem(utils.TEAM_PROFILE_KEY);
  state.teamRequestToken += 1;
  state.teamProfile = null;
  state.teamPicks = [];
  state.squadElementIds = new Set();
  state.mySquadOnly = false;
  const input = document.getElementById("fpl-team-id");
  if (input) input.value = "";
  syncTeamProfileUI();
  setTeamStatus(
    state.accountSession
      ? "Public Team ID disconnected from this Google account."
      : "Public Team ID disconnected from this device.",
  );
  applyFiltersAndSort();
}

function initialiseTeamProfileControls() {
  const loaderApi = window.FPLTeamDataLoader;
  const utils = teamProfileUtils();
  if (!loaderApi || !utils) return;
  teamDataLoader = loaderApi.createTeamDataLoader({
    fetchImpl: window.fetch.bind(window),
    profileUtils: utils,
  });

  document.getElementById("fpl-team-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    connectFPLTeam(document.getElementById("fpl-team-id")?.value || "");
  });
  document.getElementById("btn-fpl-team-refresh")?.addEventListener("click", () => {
    if (state.teamProfile?.teamId) {
      connectFPLTeam(state.teamProfile.teamId, { isRefresh: true });
    }
  });
  document.getElementById("btn-fpl-team-disconnect")?.addEventListener("click", disconnectFPLTeam);
  document.getElementById("btn-my-squad")?.addEventListener("click", () => {
    if (!state.squadElementIds.size) return;
    state.mySquadOnly = !state.mySquadOnly;
    state.currentPage = 1;
    syncTeamProfileUI();
    applyFiltersAndSort();
  });

  syncTeamProfileUI();
  if (state.teamProfile?.teamId) {
    connectFPLTeam(state.teamProfile.teamId, { isRefresh: true });
  }
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
  const drawer = document.getElementById("wl-drawer");
  drawer.inert = false;
  drawer.classList.add("open");
  const backdrop = document.getElementById("wl-backdrop");
  backdrop.classList.remove("hidden");
  backdrop.setAttribute("aria-hidden", "false");
  activateDialog("wl-drawer", "#btn-wl-close");
}
function closeWatchlist() {
  const drawer = document.getElementById("wl-drawer");
  drawer.classList.remove("open");
  drawer.inert = true;
  const backdrop = document.getElementById("wl-backdrop");
  backdrop.classList.add("hidden");
  backdrop.setAttribute("aria-hidden", "true");
  deactivateDialog("wl-drawer");
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
    const display = safePublicPlayer(p);
    const fixtureChips = buildFixtureChipsHTML(p);
    const card = document.createElement("div");
    card.className = "wl-card";
    card.innerHTML = `
      <div class="wl-card-top">
        <img src="${display.logo}" alt="${display.team}" class="wl-card-logo">
        <div class="wl-card-info">
          <div class="wl-card-name-row">
            <span class="pos-badge pos-${display.positionClass}">${display.position}</span>
            <span class="wl-card-name">${display.name}</span>
          </div>
          <div class="wl-card-sub">&pound;${p.price.toFixed(1)}m &middot; ${p.ownership}% owned &middot; ${pts} pts &middot; ${val} pts/&pound;m &middot; xGI ${xgi}</div>
        </div>
        <button type="button" class="wl-card-remove" title="Remove" aria-label="Remove ${display.name} from watchlist">&times;</button>
      </div>
      ${fixtureChips ? `<div class="wl-card-chips">${fixtureChips}</div>` : ""}`;
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
    const playerName = playerByElementId(elementId)?.name || "player";
    const idx = state.compareSet.indexOf(elementId);
    const selected = idx !== -1;
    btn.className = "cmp-add-btn";
    btn.disabled = !selected && state.compareSet.length >= 3;
    btn.setAttribute("aria-pressed", String(selected));
    btn.setAttribute(
      "aria-label",
      selected
        ? `Remove ${playerName} from comparison`
        : btn.disabled
          ? `Comparison is full; ${playerName} is not selected`
          : `Add ${playerName} to comparison`,
    );
    if (selected) {
      btn.classList.add(CMP[idx].cls);
      btn.textContent = idx + 1;
    } else {
      btn.textContent = "+";
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
    const display = safePublicPlayer(p);
    const chip = document.createElement("div");
    chip.className = "cmp-bar-chip";
    chip.style.borderColor = CMP[i].color;
    chip.innerHTML = `<img src="${display.logo}" alt="${display.team}">${display.name}`;
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
    <text x="20" y="${S - 21 + i * 14}" font-size="8.5" font-family="'Barlow Condensed',sans-serif" font-weight="700" fill="${CMP[i].color}">${escapePublicHTML(p.name)}</text></g>`,
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
    const display = safePublicPlayer(p);
    colsHtml += `<div class="cmp-player-col">
      <div class="cmp-col-accent" style="background:${c.color}"></div>
      <div class="cmp-col-hdr">
        <img src="${display.logo}" alt="${display.team}" class="cmp-col-logo">
        <div>
          <div style="display:flex;align-items:center;gap:5px;">
            <span class="pos-badge pos-${display.positionClass}">${display.position}</span>
            <span class="cmp-col-name">${display.name}</span>
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
      ${players.map((p, i) => `<div style="font-family:var(--f-d);font-size:0.75rem;font-weight:700;color:${CMP[i].color};padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapePublicHTML(p.name)}</div>`).join("")}
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
  activateDialog("cmp-overlay", "#btn-cmp-modal-close");
}
function closeCompareModal() {
  document.getElementById("cmp-overlay").classList.add("hidden");
  deactivateDialog("cmp-overlay");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── PLAYER DETAIL MODAL — Feature 6 ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function openPlayerModal(p) {
  const pfx = pfxFor();
  const body = document.getElementById("pd-body");
  const display = safePublicPlayer(p);

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
      <span class="pd-stat-val">${escapePublicHTML(value)}</span>
      <span class="pd-stat-lbl">${escapePublicHTML(label)}</span>
      ${sub ? `<span class="pd-stat-sub">${escapePublicHTML(sub)}</span>` : ""}
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
  const supportsMatchControls =
    state.schemaVersion >= 2 &&
    typeof historyUtils?.selectRecentMatches === "function";
  const historyVenue = ["all", "home", "away"].includes(state.currentPDVenue)
    ? state.currentPDVenue
    : "all";
  const historyLimit = [5, 10].includes(state.currentPDMatchLimit)
    ? state.currentPDMatchLimit
    : 10;
  const matchHist = supportsMatchControls
    ? historyUtils.selectRecentMatches(p.match_history || [], {
        venue: historyVenue,
        limit: historyLimit,
      })
    : p.gw_history || [];
  const labelForMatch =
    historyUtils?.matchLabel || ((record) => `GW${record?.gw ?? "?"}`);
  const safeLabelForMatch = (record) => escapePublicHTML(labelForMatch(record));

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
          <div class="pd-form-bar ${barCls}" style="height:${pct}%" title="${safeLabelForMatch(g)}: ${dispVal}"></div>
          <span class="pd-form-gw">${safeLabelForMatch(g)}</span>
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

  const historyControlsHtml = supportsMatchControls
    ? `<div class="pd-history-controls" aria-label="Match history controls" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <div class="seg-group" aria-label="Match count">
          <button type="button" data-history-limit="5" aria-pressed="${historyLimit === 5}">Last 5 Matches</button>
          <button type="button" data-history-limit="10" aria-pressed="${historyLimit === 10}">Last 10 Matches</button>
        </div>
        <div class="seg-group" aria-label="Venue">
          <button type="button" data-history-venue="all" aria-pressed="${historyVenue === "all"}">All Venues</button>
          <button type="button" data-history-venue="home" aria-pressed="${historyVenue === "home"}">Home</button>
          <button type="button" data-history-venue="away" aria-pressed="${historyVenue === "away"}">Away</button>
        </div>
      </div>`
    : "";

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
      <td>${safeLabelForMatch(g)}</td>
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
      <img src="${display.logo}" alt="${display.team}" class="pd-logo">
      <div class="pd-header-info">
        <div class="pd-name-row">
          <span class="pos-badge pos-${display.positionClass}">${display.position}</span>
          <span class="pd-name">${display.name}</span>
        </div>
        <div class="pd-sub-row">
          <span class="pd-team">${display.team}</span>
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
      <div class="pd-section-title">Recent History (${historyVenue === "all" ? "All Venues" : historyVenue === "home" ? "Home" : "Away"} · Last ${matchHist.length} Matches)</div>
      ${historyControlsHtml}
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

  document.querySelectorAll("[data-history-limit]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentPDMatchLimit = Number(button.dataset.historyLimit);
      openPlayerModal(p);
    });
  });
  document.querySelectorAll("[data-history-venue]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentPDVenue = button.dataset.historyVenue;
      openPlayerModal(p);
    });
  });

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

  activateDialog("pd-overlay", "#btn-pd-close");
}

function closePlayerModal() {
  document.getElementById("pd-overlay").classList.add("hidden");
  deactivateDialog("pd-overlay");
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── DATA FETCH ───────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function isPreseasonEmptyDataset() {
  return state.isPreseasonDataset;
}

function clearLoadedDataset() {
  state.players = [];
  state.filteredPlayers = [];
  state.nextGWs = [];
  state.currentGW = null;
  state.deadline = null;
  state.fetchedAt = null;
  state.schemaVersion = null;
  state.dataSource = null;
  state.isPreseasonDataset = false;
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
    const loader = window.FPLPublicDataLoader?.loadPlayerDataset;
    const classified = await loader?.({
      config: window.FPLPublicDataConfig,
      classifyDataset: window.FPLSchemaUtils?.classifyPlayerDataset,
    });

    if (!classified?.compatible) {
      clearLoadedDataset();
      setLoadError(
        "Player data format is temporarily incompatible. Please try again shortly.",
      );
      applyFiltersAndSort();
      return;
    }

    const dashboardData = dashboardDataUtils()?.prepareDashboardData({ classified });
    if (!dashboardData) throw new Error("Dashboard data helper is unavailable");

    state.dataSource = dashboardData.source;
    if (dashboardData.source === "static" && classified.fallbackReason) {
      console.warn(`Using temporary static player-data fallback: ${classified.fallbackReason}`);
    }
    state.players = dashboardData.players;
    migrateLegacyWatchlist();
    syncWatchlistHeader();
    state.nextGWs = dashboardData.nextGWs;
    state.currentGW = dashboardData.currentGW;
    state.deadline = dashboardData.deadline;
    state.fetchedAt = dashboardData.fetchedAt;
    state.schemaVersion = dashboardData.schemaVersion;
    state.isPreseasonDataset = dashboardData.isPreseason;
    state.actualGWs = null;

    el.priceMinSlider.min = dashboardData.minPriceSlider;
    el.priceMinSlider.value = dashboardData.minPriceSlider;
    el.priceMaxSlider.max = dashboardData.maxPriceSlider;
    el.priceMaxSlider.value = dashboardData.maxPriceSlider;
    state.priceMin = dashboardData.minPriceSlider / 10;
    state.priceMax = dashboardData.maxPriceSlider / 10;
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
    const safeName = escapePublicHTML(name);
    const safeLogo = safePublicImageURL(logo);
    const btn = document.createElement("button");
    btn.className =
      "team-logo-btn" + (state.selectedTeams.includes(name) ? " selected" : "");
    btn.title = name;
    btn.innerHTML = `<img src="${safeLogo}" alt="${safeName}"><span class="team-abbr">${safeName}</span>`;
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

function applyFiltersAndSort() {
  const pfx = pfxFor();
  const query = playerQueryUtils().queryPlayers({
    players: state.players,
    prefix: pfx,
    maxMinutes: maxMFor(),
    criteria: {
      minutesMode: el.minsToggle.checked ? "percent" : "raw",
      minMinutes: parseInt(el.minsSlider.value, 10),
      priceMin: state.priceMin,
      priceMax: state.priceMax,
      searchQuery: state.searchQuery,
      selectedTeams: state.selectedTeams,
      positionFilter: state.positionFilter,
      watchlistOnly: state.watchlistOnly,
      watchlistElementIds: [...state.watchlist],
      mySquadOnly: state.mySquadOnly,
      squadElementIds: [...state.squadElementIds],
      sortColumn: state.sortColumn,
      sortDirection: state.sortDirection,
    },
  });

  state.filteredPlayers = query.players;
  state.columnMaxes = query.columnMaxes;
  state.currentPage = 1;
  document.getElementById("s-count").textContent =
    `${state.filteredPlayers.length}`;
  updatePagination();
  renderTable(pfx);
}

function updatePagination() {
  const pagination = playerQueryUtils().getPagination({
    totalItems: state.filteredPlayers.length,
    itemsPerPage: state.itemsPerPage,
    currentPage: state.currentPage,
  });
  state.currentPage = pagination.currentPage;
  el.pageInfo.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages}`;
  el.btnPrev.disabled = pagination.currentPage === 1;
  el.btnNext.disabled = pagination.currentPage === pagination.totalPages;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ─── RENDER TABLE ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

function renderTable(pfxArg) {
  el.tbody.innerHTML = "";
  const pfx = pfxArg || pfxFor();
  const maxM = maxMFor();
  const columnVisibility = playerTableUtils().getTableColumnVisibility({
    positionFilter: state.positionFilter,
    timeframe: state.timeframe,
  });
  const maxes = state.columnMaxes;

  // Column visibility
  const vis = (id, show) =>
    document.getElementById(id)?.classList.toggle("hidden", !show);
  vis("col-saves", columnVisibility.saves);
  vis("col-xg", columnVisibility.xG);
  vis("col-xa", columnVisibility.xA);
  vis("col-xgi", columnVisibility.xGI);
  vis("col-influence", columnVisibility.influence);
  vis("col-creativity", columnVisibility.creativity);
  vis("col-threat", columnVisibility.threat);
  vis("col-ict", columnVisibility.ict);
  vis("col-defcon", columnVisibility.defcon);
  vis("col-goals", columnVisibility.goals);
  vis("col-assists", columnVisibility.assists);
  vis("col-cs", columnVisibility.cleanSheets);
  vis("col-ppg", columnVisibility.ppg);

  if (!state.filteredPlayers.length) {
    const dashboardState = uiStateUtils()?.classifyDashboardState({
      loadError: state.loadError,
      isPreseason: isPreseasonEmptyDataset(),
      filteredPlayerCount: state.filteredPlayers.length,
    });
    const emptyMessages = {
      error: "Player data is temporarily unavailable. Use “Try again” above to reload.",
      preseason:
        "The season has not started yet. Player statistics will appear after the opening matches.",
      no_results: "No players match the current filters.",
    };
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="20" style="text-align:center;color:var(--text-2);padding:36px;font-family:var(--f-m);font-size:0.82rem;">${emptyMessages[dashboardState] || emptyMessages.no_results}</td>`;
    el.tbody.appendChild(tr);
    return;
  }

  const pagination = playerQueryUtils().getPagination({
    totalItems: state.filteredPlayers.length,
    itemsPerPage: state.itemsPerPage,
    currentPage: state.currentPage,
  });
  const page = state.filteredPlayers.slice(
    pagination.startIndex,
    pagination.endIndex,
  );
  const valMax = maxes.value || 0.01;
  const bar = (v, max) =>
    max > 0 ? `${Math.min((v / max) * 100, 100).toFixed(1)}%` : "0%";
  const frag = document.createDocumentFragment();

  page.forEach((p, i) => {
    const metrics = playerTableUtils().buildPlayerTableRowMetrics({
      prefix: pfx,
      maxMinutes: maxM,
      player: p,
    });
    const {
      minutes: mins,
      minPct,
      saves,
      defcon,
      xG,
      xA,
      xGI,
      influence,
      creativity: creat,
      threat,
      ict,
      bps,
      bonus,
      points: pts,
      goals,
      assists,
      cleanSheets: cs,
      ppg,
      value: val,
      ownership: own,
    } = metrics;
    const display = safePublicPlayer(p);

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
    const inSquad = state.squadElementIds.has(p.element_id);
    const cmpIdx = state.compareSet.indexOf(p.element_id);
    const cmpFull = state.compareSet.length >= 3 && cmpIdx === -1;
    const fixChips = buildFixtureChipsHTML(p);

    const tr = document.createElement("tr");
    tr.tabIndex = -1;
    tr.style.setProperty("--ri", i);
    tr.style.cursor = "pointer"; // signals clickability for Feature 6
    tr.classList.toggle("squad-player", inSquad);

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
          <img src="${display.logo}" alt="${display.team}" class="team-logo">
          <span class="player-price">&pound;${p.price.toFixed(1)}m</span>
          ${trendHtml}
        </div>
        <div class="player-info">
          <div class="player-name-row">
            <span class="pos-badge pos-${display.positionClass}">${display.position}</span>
            <span class="player-name-text">${display.name}</span>
            ${inSquad ? '<span class="squad-badge">Squad</span>' : ""}
            <button type="button" class="star-btn ${watched ? "active" : ""}" data-watch="${p.element_id}" title="Watchlist" aria-label="${watched ? "Remove" : "Add"} ${display.name} ${watched ? "from" : "to"} watchlist" aria-pressed="${watched}">&#9733;</button>
            <button type="button" class="${cmpClass}" data-cmp="${p.element_id}" title="Compare" aria-label="${cmpIdx !== -1 ? `Remove ${display.name} from comparison` : cmpFull ? `Comparison is full; ${display.name} is not selected` : `Add ${display.name} to comparison`}" aria-pressed="${cmpIdx !== -1}" ${cmpFull ? "disabled" : ""}>${cmpTxt}</button>
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
      tr.focus();
      openPlayerModal(p);
    });

    const statTd = (value, max, hidden = false) => {
      const cell = document.createElement("td");
      if (hidden) cell.classList.add("hidden");
      cell.style.setProperty("--bar", bar(parseFloat(value), max));
      cell.textContent = value;
      return cell;
    };

    tr.appendChild(statTd(saves, maxes.saves, !columnVisibility.saves));
    tr.appendChild(statTd(pts, maxes.points));
    // Season-only columns (hidden unless season mode)
    tr.appendChild(statTd(goals, maxes.goals, !columnVisibility.goals));
    tr.appendChild(statTd(assists, maxes.assists, !columnVisibility.assists));
    tr.appendChild(statTd(cs, maxes.clean_sheets, !columnVisibility.cleanSheets));
    tr.appendChild(statTd(ppg, maxes.ppg, !columnVisibility.ppg));
    // Standard columns
    tr.appendChild(statTd(xG, maxes.xG, !columnVisibility.xG));
    tr.appendChild(statTd(xA, maxes.xA, !columnVisibility.xA));
    tr.appendChild(statTd(xGI, maxes.xGI, !columnVisibility.xGI));
    tr.appendChild(statTd(influence, maxes.influence, !columnVisibility.influence));
    tr.appendChild(statTd(creat, maxes.creativity, !columnVisibility.creativity));
    tr.appendChild(statTd(threat, maxes.threat, !columnVisibility.threat));
    tr.appendChild(statTd(ict, maxes.ict, !columnVisibility.ict));
    tr.appendChild(statTd(defcon, maxes.defcon, !columnVisibility.defcon));
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
    const active = col === state.sortColumn;
    th.classList.remove("active-sort", "asc", "desc");
    th.setAttribute(
      "aria-sort",
      active ? (state.sortDirection === "asc" ? "ascending" : "descending") : "none",
    );
    const icon = th.querySelector(".sort-icon");
    if (icon) icon.textContent = "";
    if (active) {
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
  el.headers = document.querySelectorAll("#players-table th[data-sort]");
  el.sortButtons = document.querySelectorAll("#players-table .sort-btn");
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
    saveTeamProfile();
    syncFdrSortModeToAccount(state.fdrSortMode);
    document.getElementById("btn-fdr-sort-avg").classList.add("active");
    document.getElementById("btn-fdr-sort-alpha").classList.remove("active");
    renderFDRHeatmap();
  });
  document
    .getElementById("btn-fdr-sort-alpha")
    .addEventListener("click", (e) => {
      state.fdrSortMode = "alpha";
      saveTeamProfile();
      syncFdrSortModeToAccount(state.fdrSortMode);
      document.getElementById("btn-fdr-sort-alpha").classList.add("active");
      document.getElementById("btn-fdr-sort-avg").classList.remove("active");
      renderFDRHeatmap();
    });

  // ── Theme + local personalisation ──
  loadTheme();
  loadWatchlist();
  loadTeamProfile();
  syncWatchlistHeader();
  initialiseAccount();
  initialiseTeamProfileControls();
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
    const idsToRemove = [...state.watchlist];
    state.watchlist.clear();
    saveWatchlist({ sync: false });
    if (state.accountSession && accountSync) {
      Promise.all(
        idsToRemove.map((elementId) =>
          accountSync.setWatchlistMembership({
            session: state.accountSession,
            elementId,
            watched: false,
          }),
        ),
      ).catch(() => setAccountStatus("Signed in — watchlist sync unavailable", "error"));
    }
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
  document.addEventListener("keydown", handleDialogKeyboard);

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
  el.sortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const col = button.closest("th")?.getAttribute("data-sort");
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
    const { totalPages } = playerQueryUtils().getPagination({
      totalItems: state.filteredPlayers.length,
      itemsPerPage: state.itemsPerPage,
      currentPage: state.currentPage,
    });
    if (state.currentPage < totalPages) {
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
  fetchPlayers();
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = { state, fetchPlayers, applyFiltersAndSort, renderTable };
}
