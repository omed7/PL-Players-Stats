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
  personalFdrRatings: new Map(),
  personalFdrDrafts: new Map(),
  personalFdrEditorOpen: false,
  personalFdrSaveInFlight: false,
  usesPersonalFdr: false,
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
const personalFdrUtils = () => window.FPLPersonalFdrUtils;
const comparisonViewUtils = () => window.FPLComparisonViewUtils;
const playerDetailChartUtils = () => window.FPLPlayerDetailChartUtils;
const watchlistViewUtils = () => window.FPLWatchlistViewUtils;
const playerDetailSnapshotUtils = () => window.FPLPlayerDetailSnapshotUtils;
const accountSyncUtils = () => window.FPLAccountSyncUtils;
const teamProfileUtils = () => window.FPLTeamProfileUtils;
const teamProfileControlsViewUtils = () => window.FPLTeamProfileControlsViewUtils;
const teamFilterViewUtils = () => window.FPLTeamFilterViewUtils;

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
  renderPersonalFdrEditor();
  if (state.players.length) applyFiltersAndSort();
  if (!document.getElementById("fdr-container")?.classList.contains("hidden")) {
    renderFDRHeatmap();
  }
}

async function applyAccountSession(session) {
  state.accountSession = session || null;
  renderAccountControls();
  syncTeamProfileUI();
  if (!state.accountSession || !accountSync) {
    state.usesPersonalFdr = false;
    state.personalFdrRatings = new Map();
    state.personalFdrDrafts = new Map();
    refreshAccountDependentUI();
    return;
  }

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
    state.personalFdrRatings = synced.personalFdrRatings || new Map();
    state.personalFdrDrafts = new Map(state.personalFdrRatings);
    state.usesPersonalFdr = true;
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

  accountSync = syncApi.createAccountSync({
    client: accountAuth.client,
    utils,
    personalFdrUtils: personalFdrUtils(),
  });
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

function personalDifficultyForFixture(fixture) {
  if (!state.usesPersonalFdr) return null;
  return personalFdrUtils()?.resolvePersonalFixtureDifficulty(
    fixture,
    state.personalFdrRatings,
  ) ?? null;
}

function displayDifficultyForFixture(fixture) {
  if (Object.prototype.hasOwnProperty.call(fixture || {}, "displayDifficulty")) {
    return fixture.displayDifficulty;
  }
  return state.usesPersonalFdr ? personalDifficultyForFixture(fixture) : fixture?.difficulty;
}

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
      const difficulty = Number(displayDifficultyForFixture(fixture));
      const maxDifficulty = state.usesPersonalFdr || Object.prototype.hasOwnProperty.call(fixture, "displayDifficulty") ? 7 : 5;
      const safeDifficulty = Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= maxDifficulty
        ? difficulty
        : "unknown";
      const difficultyLabel = safeDifficulty === "unknown" ? "—" : safeDifficulty;
      const ratingKind = state.usesPersonalFdr || Object.prototype.hasOwnProperty.call(fixture, "displayDifficulty")
        ? "Personal FDR"
        : "FDR";
      html += `<div class="fix-chip diff-${safeDifficulty}" title="GW${safeGameweek} vs ${opponent} (${homeAway}) ${ratingKind}:${difficultyLabel}">
        <img src="${opponentLogo}" alt="${opponent}">
        <span class="fix-ha">${homeAway}${difficultyLabel}</span>
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
  renderPersonalFdrEditor();
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

function personalFdrRows() {
  return personalFdrUtils()?.buildPersonalFdrEditorRows(
    state.players,
    state.personalFdrDrafts,
  ) || [];
}

function personalFdrChanges() {
  return personalFdrRows()
    .filter((row) => {
      const saved = state.personalFdrRatings.get(row.teamId);
      return (
        row.homeRating !== (saved?.homeRating ?? null) ||
        row.awayRating !== (saved?.awayRating ?? null)
      );
    })
    .map((row) => ({
      teamId: row.teamId,
      homeRating: row.homeRating,
      awayRating: row.awayRating,
    }));
}

function setPersonalFdrStatus(message = "", isError = false) {
  const status = document.getElementById("fdr-personal-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function updatePersonalFdrDraft(teamId, field, rating) {
  const current = state.personalFdrDrafts.get(teamId) || {
    teamId,
    homeRating: null,
    awayRating: null,
  };
  state.personalFdrDrafts.set(teamId, { ...current, [field]: rating });
  renderPersonalFdrEditor();
}

function buildPersonalFdrRatingControl({ team, field, rating }) {
  const group = document.createElement("div");
  group.className = "fdr-rating-control";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", `${team.name} ${field === "homeRating" ? "their Home" : "their Away"} difficulty`);

  [null, 1, 2, 3, 4, 5, 6, 7].forEach((value) => {
    const button = document.createElement("button");
    const isSelected = value === rating;
    button.type = "button";
    button.className = `fdr-rating-btn${value === null ? " clear" : ""}${isSelected ? " selected" : ""}`;
    button.textContent = value === null ? "—" : String(value);
    button.setAttribute("aria-pressed", String(isSelected));
    button.title = value === null
      ? `Clear ${team.name} ${field === "homeRating" ? "Home" : "Away"} difficulty`
      : `Set ${team.name} ${field === "homeRating" ? "Home" : "Away"} difficulty to ${value} of 7`;
    button.addEventListener("click", () => updatePersonalFdrDraft(team.teamId, field, value));
    group.appendChild(button);
  });
  return group;
}

function renderPersonalFdrEditor() {
  const editor = document.getElementById("fdr-personal-editor");
  const toggle = document.getElementById("btn-fdr-customize");
  const body = document.getElementById("fdr-personal-editor-body");
  const saveButton = document.getElementById("btn-fdr-personal-save");
  if (!editor || !toggle || !body || !saveButton) return;

  editor.classList.toggle("hidden", !state.personalFdrEditorOpen);
  toggle.setAttribute("aria-expanded", String(state.personalFdrEditorOpen));
  toggle.classList.toggle("active", state.personalFdrEditorOpen);
  if (!state.personalFdrEditorOpen) return;

  body.innerHTML = "";
  saveButton.disabled = true;
  if (!state.accountSession || !accountSync) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "fdr-personal-empty";
    cell.textContent = "Sign in with Google to set and synchronise your personal FDR ratings.";
    row.appendChild(cell);
    body.appendChild(row);
    setPersonalFdrStatus("Personal ratings are available only to signed-in users.");
    return;
  }

  const rows = personalFdrRows();
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "fdr-personal-empty";
    cell.textContent = "Team data is not available yet, so personal ratings cannot be edited.";
    row.appendChild(cell);
    body.appendChild(row);
    setPersonalFdrStatus("Waiting for validated team data.");
    return;
  }

  rows.forEach((team) => {
    const row = document.createElement("tr");
    const teamCell = document.createElement("td");
    teamCell.className = "fdr-personal-team";
    if (team.logo) {
      const logo = document.createElement("img");
      logo.src = safePublicImageURL(team.logo);
      logo.alt = "";
      logo.width = 24;
      logo.height = 24;
      teamCell.appendChild(logo);
    }
    const name = document.createElement("span");
    name.textContent = team.name;
    teamCell.appendChild(name);
    row.appendChild(teamCell);

    const homeCell = document.createElement("td");
    homeCell.appendChild(buildPersonalFdrRatingControl({ team, field: "homeRating", rating: team.homeRating }));
    row.appendChild(homeCell);

    const awayCell = document.createElement("td");
    awayCell.appendChild(buildPersonalFdrRatingControl({ team, field: "awayRating", rating: team.awayRating }));
    row.appendChild(awayCell);
    body.appendChild(row);
  });

  const changes = personalFdrChanges();
  saveButton.disabled = state.personalFdrSaveInFlight || changes.length === 0;
  saveButton.textContent = state.personalFdrSaveInFlight
    ? "Saving personal ratings…"
    : changes.length
      ? `Save ${changes.length} team rating${changes.length === 1 ? "" : "s"}`
      : "Personal ratings saved";
  setPersonalFdrStatus(
    changes.length
      ? `${changes.length} team rating${changes.length === 1 ? "" : "s"} ready to save.`
      : "All personal ratings are saved.",
  );
}

async function savePersonalFdrRatings() {
  if (!state.accountSession || !accountSync) {
    setPersonalFdrStatus("Sign in with Google before saving personal ratings.", true);
    return;
  }
  const changes = personalFdrChanges();
  if (!changes.length) return;

  state.personalFdrSaveInFlight = true;
  renderPersonalFdrEditor();
  try {
    const savedChanges = await accountSync.savePersonalFdrChanges({
      session: state.accountSession,
      changes,
    });
    const nextRatings = new Map(state.personalFdrRatings);
    savedChanges.forEach((rating, teamId) => nextRatings.set(teamId, rating));
    state.personalFdrRatings = nextRatings;
    state.personalFdrDrafts = new Map(nextRatings);
    state.usesPersonalFdr = true;
    renderFDRHeatmap();
    if (state.players.length) applyFiltersAndSort();
    setPersonalFdrStatus("Personal ratings saved and synchronized.");
  } catch (error) {
    setPersonalFdrStatus(error?.message || "Personal rating synchronization is unavailable.", true);
  } finally {
    state.personalFdrSaveInFlight = false;
    renderPersonalFdrEditor();
  }
}

function renderFDRHeatmap() {
  const theadRow = document.getElementById("fdr-thead-row");
  const tbody = document.getElementById("fdr-table-body");

  const { gameweeks: gws, teams: filteredTeams } =
    fdrViewUtils().buildFdrViewModel({
      players: state.players,
      selectedTeams: state.selectedTeams,
      sortMode: state.fdrSortMode,
      resolveDifficulty: state.usesPersonalFdr ? personalDifficultyForFixture : null,
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
  const controlsModel = teamProfileControlsViewUtils()?.buildTeamProfileControlsViewModel({
    teamId: state.teamProfile?.teamId,
    isSignedIn: Boolean(state.accountSession),
    hasSquad: state.squadElementIds.size > 0,
    mySquadOnly: state.mySquadOnly,
  });
  if (!controlsModel) return;

  if (input && controlsModel.teamIdInputValue !== null) {
    input.value = controlsModel.teamIdInputValue;
  }
  if (note) note.textContent = controlsModel.note;
  actions?.classList.toggle("hidden", controlsModel.actionsHidden);
  if (connectButton) connectButton.textContent = controlsModel.connectLabel;
  if (mySquadButton) {
    mySquadButton.disabled = controlsModel.mySquad.disabled;
    mySquadButton.classList.toggle("active", controlsModel.mySquad.active);
    mySquadButton.setAttribute("aria-pressed", controlsModel.mySquad.ariaPressed);
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
  const watchlistModel = watchlistViewUtils()?.buildWatchlistViewModel({
    players: state.players,
    watchlistElementIds: [...state.watchlist],
    prefix: pfxFor(),
  });
  const cards = watchlistModel?.cards || [];
  countEl.textContent = watchlistModel?.count || 0;
  body.querySelectorAll(".wl-card").forEach((c) => c.remove());
  if (!cards.length) {
    emptyEl?.classList.remove("hidden");
    return;
  }
  emptyEl?.classList.add("hidden");
  const frag = document.createDocumentFragment();
  cards.forEach(({ elementId, player: p, points, xgiDisplay, pointsPerMillion }) => {
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
          <div class="wl-card-sub">&pound;${p.price.toFixed(1)}m &middot; ${p.ownership}% owned &middot; ${points} pts &middot; ${pointsPerMillion} pts/&pound;m &middot; xGI ${xgiDisplay}</div>
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
  const transition = comparisonViewUtils()?.updateComparisonSelection({
    selectedElementIds: state.compareSet,
    elementId,
  });
  if (!transition || transition.action === "ignored" || transition.action === "full") return;
  state.compareSet = transition.selectedElementIds;
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

function buildRadarSVG({ radar, selectedPlayers }) {
  const pointList = (points) =>
    points.map(({ x, y }) => `${x},${y}`).join(" ");
  const { size, center, grid, axes, players: radarPlayers } = radar;
  const gridHtml = grid
    .map(
      (points) =>
        `<polygon points="${pointList(points)}" fill="none" stroke="rgba(220,232,245,0.07)" stroke-width="0.8"/>`,
    )
    .join("");
  const axesHtml = axes
    .map(
      ({ end }) =>
        `<line x1="${center.x}" y1="${center.y}" x2="${end.x}" y2="${end.y}" stroke="rgba(220,232,245,0.07)" stroke-width="0.8"/>`,
    )
    .join("");
  const labelsHtml = axes
    .map(
      ({ label, labelPosition }) =>
        `<text x="${labelPosition.x}" y="${labelPosition.y}" text-anchor="middle" dominant-baseline="middle" font-size="8" font-family="'JetBrains Mono',monospace" fill="rgba(78,102,133,0.9)">${label}</text>`,
    )
    .join("");
  const polygonsHtml = [...radarPlayers]
    .reverse()
    .map(({ slotIndex, points }) => {
      const color = CMP[slotIndex];
      return `<polygon points="${pointList(points)}" fill="${color.fill}" stroke="${color.color}" stroke-width="1.6" stroke-linejoin="round"/>${points
        .map(
          ({ x, y }) =>
            `<circle cx="${x}" cy="${y}" r="2.5" fill="${color.color}"/>`,
        )
        .join("")}`;
    })
    .join("");
  const legendHtml = selectedPlayers
    .map(({ slotIndex, player }, index) => {
      const color = CMP[slotIndex];
      return `<g><circle cx="10" cy="${size - 24 + index * 14}" r="5" fill="${color.fill}" stroke="${color.color}" stroke-width="1.5"/>
    <text x="20" y="${size - 21 + index * 14}" font-size="8.5" font-family="'Barlow Condensed',sans-serif" font-weight="700" fill="${color.color}">${escapePublicHTML(player.name)}</text></g>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" overflow="visible">${gridHtml}${axesHtml}${labelsHtml}${polygonsHtml}${legendHtml}</svg>`;
}

function openCompareModal() {
  const pfx = pfxFor();
  const comparisonModel = comparisonViewUtils()?.buildComparisonViewModel({
    selectedElementIds: state.compareSet,
    players: state.players,
    prefix: pfx,
    statDefinitions: CMP_STAT_DEFS.map(({ key, lbl, bestLow }) => ({
      key,
      label: lbl,
      bestLow,
    })),
    radarStats: RADAR_STATS.map(({ key, lbl }) => ({ key, label: lbl })),
  });
  if (!comparisonModel) return;

  const { selectedPlayers, statRows, radar } = comparisonModel;
  const body = document.getElementById("cmp-modal-body");

  const pointsByElementId = new Map(
    (statRows.find(({ key }) => key === "points")?.values || []).map(
      ({ elementId, value }) => [elementId, value],
    ),
  );
  let colsHtml = '<div class="cmp-player-cols">';
  selectedPlayers.forEach(({ elementId, slotIndex, player }) => {
    const c = CMP[slotIndex],
      pts = pointsByElementId.get(elementId) ?? 0;
    const val = player.price > 0 ? (pts / player.price).toFixed(1) : "—";
    const display = safePublicPlayer(player);
    colsHtml += `<div class="cmp-player-col">
      <div class="cmp-col-accent" style="background:${c.color}"></div>
      <div class="cmp-col-hdr">
        <img src="${display.logo}" alt="${display.team}" class="cmp-col-logo">
        <div>
          <div style="display:flex;align-items:center;gap:5px;">
            <span class="pos-badge pos-${display.positionClass}">${display.position}</span>
            <span class="cmp-col-name">${display.name}</span>
          </div>
          <div class="cmp-col-sub">&pound;${player.price.toFixed(1)}m &middot; ${player.ownership}% &middot; ${pts} pts &middot; ${val} pts/&pound;m</div>
        </div>
      </div></div>`;
  });
  colsHtml += "</div>";

  const cols = `120px ${selectedPlayers.map(() => "1fr").join(" ")} 14px`;

  let tableHtml = `<div class="cmp-stat-table">
    <div class="cmp-stat-row-header" style="grid-template-columns:${cols}">
      <div class="cmp-stat-key-cell"></div>
      ${selectedPlayers.map(({ player, slotIndex }) => `<div style="font-family:var(--f-d);font-size:0.75rem;font-weight:700;color:${CMP[slotIndex].color};padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapePublicHTML(player.name)}</div>`).join("")}
      <div></div>
    </div>`;
  statRows.forEach(({ label, bestIndex, allTied, values }) => {
    tableHtml += `<div class="cmp-stat-row" style="grid-template-columns:${cols}">
      <div class="cmp-stat-key-cell">${label}</div>
      ${values
        .map(({ value, barPercent, slotIndex }) => {
          const color = CMP[slotIndex];
          const displayValue = Number.isInteger(value) ? value : value.toFixed(2);
          return `<div class="cmp-stat-val-cell">
          <div class="cmp-stat-bar-wrap"><div class="cmp-stat-bar-fill" style="width:${barPercent}%;background:${color.color}"></div></div>
          <span class="cmp-stat-num" style="color:${color.color}">${displayValue}</span>
        </div>`;
        })
        .join("")}
      <div class="cmp-best-dot${allTied ? " hidden-dot" : ""}" style="background:${CMP[selectedPlayers[bestIndex].slotIndex].color}"></div>
    </div>`;
  });
  tableHtml += "</div>";

  body.innerHTML = `<div class="cmp-layout">${colsHtml}<div class="cmp-radar-wrap">${buildRadarSVG({ radar, selectedPlayers })}</div>${tableHtml}</div>`;
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

  // Keep player-detail markup and HTML escaping in the controller.
  const statTile = (label, value, sub) =>
    `<div class="pd-stat-tile">
      <span class="pd-stat-val">${escapePublicHTML(value)}</span>
      <span class="pd-stat-lbl">${escapePublicHTML(label)}</span>
      ${sub ? `<span class="pd-stat-sub">${escapePublicHTML(sub)}</span>` : ""}
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
  const snapshot = playerDetailSnapshotUtils()?.buildPlayerDetailSnapshot({
    player: p,
    prefix: pfx,
    timeframe: state.timeframe,
    matchHistory: matchHist,
  });
  if (!snapshot) throw new Error("Player-detail snapshot helper is unavailable");

  // Attach the selected history to state for detail-chart consumers.
  state.currentPDMatchHist = matchHist;
  state.currentPDChartMetric = "pts"; // Default

  const formBarsHtml = () => {
    if (!matchHist.length)
      return '<p class="pd-empty">No match history available.</p>';
    const chartModel = playerDetailChartUtils()?.buildFormChart({
      matches: matchHist,
      metric: state.currentPDChartMetric,
    });
    if (!chartModel) return '<p class="pd-empty">No match history available.</p>';

    return `<div class="pd-form-bars" id="pd-form-bars-inner">
      ${chartModel.bars
        .map(
          ({ record, heightPercent, barClass, displayValue }) =>
            `<div class="pd-form-col">
          <span class="pd-form-pts">${displayValue}</span>
          <div class="pd-form-bar ${barClass}" style="height:${heightPercent}%" title="${safeLabelForMatch(record)}: ${displayValue}"></div>
          <span class="pd-form-gw">${safeLabelForMatch(record)}</span>
        </div>`,
        )
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
  const histRows = snapshot.matchLogRows
    .map(
      ({ record, points, pointsClass, xgDisplay, xaDisplay, minutesDisplay, bonus }) => `
    <tr>
      <td>${safeLabelForMatch(record)}</td>
      <td class="${pointsClass}">${points}</td>
      <td>${xgDisplay}</td>
      <td>${xaDisplay}</td>
      <td>${minutesDisplay}</td>
      <td>${bonus}</td>
    </tr>`,
    )
    .join("");
  const histTable = snapshot.matchLogRows.length
    ? `<div class="pd-table-wrap">
        <table class="pd-hist-table">
          <thead><tr><th>Match</th><th>Pts</th><th>xG</th><th>xA</th><th>Mins</th><th>Bonus</th></tr></thead>
          <tbody>${histRows}</tbody>
        </table>
      </div>`
    : "";
  const availabilityHtml =
    snapshot.availability.kind === "injured"
      ? `<span class="inj-badge ${snapshot.availability.className}">&#9888; ${snapshot.availability.percent}% chance</span>`
      : '<span class="avail-ok">✓ Available</span>';
  const seasonTiles = `
    <div class="pd-season-grid">
      ${snapshot.seasonTiles
        .map((tile) => statTile(tile.label, tile.displayValue))
        .join("")}
    </div>`;

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
          ${availabilityHtml}
        </div>
      </div>
    </div>

    <!-- Current period snapshot -->
    <div class="pd-section">
      <div class="pd-section-title">${snapshot.periodLabel}</div>
      <div class="pd-period-row">
        ${statTile("Pts", snapshot.period.points)}
        ${statTile("xGI", snapshot.period.xgiDisplay)}
        ${statTile("Mins", snapshot.period.minutes, `${snapshot.period.minutesPercent}%`)}
        ${statTile("Pts/£m", snapshot.period.pointsPerMillionDisplay)}
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
  const teamFilterModel = teamFilterViewUtils()?.buildTeamFilterViewModel({
    players: state.players,
    selectedTeams: state.selectedTeams,
  });
  if (!teamFilterModel) return;

  el.teamGrid.innerHTML = "";
  const frag = document.createDocumentFragment();
  teamFilterModel.teams.forEach(({ name, logo, selected }) => {
    const safeName = escapePublicHTML(name);
    const safeLogo = safePublicImageURL(logo);
    const btn = document.createElement("button");
    btn.className = "team-logo-btn" + (selected ? " selected" : "");
    btn.title = name;
    btn.innerHTML = `<img src="${safeLogo}" alt="${safeName}"><span class="team-abbr">${safeName}</span>`;
    btn.addEventListener("click", () => {
      const previousSelection = state.selectedTeams;
      const transition = teamFilterViewUtils()?.toggleTeamFilterSelection({
        selectedTeams: previousSelection,
        teamName: name,
      });
      if (!transition) return;

      state.selectedTeams = transition.selectedTeams;
      if (!previousSelection.length) {
        document
          .querySelectorAll(".team-logo-btn")
          .forEach((button) => button.classList.remove("selected"));
        btn.classList.add("selected");
      } else if (previousSelection.includes(name)) {
        btn.classList.remove("selected");
        if (!state.selectedTeams.length)
          document
            .querySelectorAll(".team-logo-btn")
            .forEach((button) => button.classList.remove("selected"));
      } else {
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
  const teamFilterModel = teamFilterViewUtils()?.buildTeamFilterViewModel({
    selectedTeams: state.selectedTeams,
  });
  const selection = teamFilterModel?.selection;
  if (!selection) return;

  const lbl = document.getElementById("team-filter-label");
  const cnt = document.getElementById("team-selection-count");
  el.teamToggleBtn.classList.toggle("has-selection", selection.hasSelection);
  lbl.textContent = selection.label;
  cnt.textContent = selection.countLabel;
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
  document.getElementById("btn-fdr-customize").addEventListener("click", () => {
    state.personalFdrEditorOpen = !state.personalFdrEditorOpen;
    renderPersonalFdrEditor();
  });
  document.getElementById("btn-fdr-personal-save").addEventListener("click", () => {
    savePersonalFdrRatings();
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
