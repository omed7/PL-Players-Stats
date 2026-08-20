(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLTeamProfileUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const TEAM_PROFILE_KEY = "fpl_team_profile_v1";
  const PROFILE_VERSION = 1;
  const FDR_SORT_MODES = new Set(["avg", "alpha"]);

  function isValidTeamId(value) {
    const normalized = typeof value === "string" ? value.trim() : value;
    if (normalized === "") return false;
    const numeric = Number(normalized);
    return Number.isSafeInteger(numeric) && numeric > 0;
  }

  function normalizeTeamId(value) {
    return isValidTeamId(value) ? Number(value) : null;
  }

  function normalizePick(pick) {
    if (!pick || typeof pick !== "object") return null;
    const element = Number(pick.element);
    const position = Number(pick.position);
    const multiplier = Number(pick.multiplier);
    if (!Number.isSafeInteger(element) || element <= 0) return null;
    if (!Number.isSafeInteger(position) || position < 1 || position > 15) return null;
    if (!Number.isFinite(multiplier) || multiplier < 0 || multiplier > 3) return null;

    return {
      element,
      position,
      multiplier,
      is_captain: Boolean(pick.is_captain),
      is_vice_captain: Boolean(pick.is_vice_captain),
    };
  }

  function normalizeTeamPicks(picks) {
    if (!Array.isArray(picks)) return [];
    const byElement = new Map();
    picks.forEach((pick) => {
      const normalized = normalizePick(pick);
      if (normalized && !byElement.has(normalized.element)) {
        byElement.set(normalized.element, normalized);
      }
    });
    return [...byElement.values()].sort((a, b) => a.position - b.position);
  }

  function normalizeElementIds(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  }

  function filterPlayersByElementIds(players, elementIds) {
    if (!Array.isArray(players)) return [];
    const ids = new Set(normalizeElementIds(elementIds));
    return players.filter((player) => ids.has(Number(player?.element_id)));
  }

  function normalizeProfile(profile) {
    if (!profile || typeof profile !== "object") return null;
    const teamId = normalizeTeamId(profile.teamId);
    if (profile.version !== PROFILE_VERSION || !teamId) return null;

    return {
      version: PROFILE_VERSION,
      teamId,
      watchlistElementIds: normalizeElementIds(profile.watchlistElementIds),
      fdrSortMode: FDR_SORT_MODES.has(profile.fdrSortMode) ? profile.fdrSortMode : "avg",
    };
  }

  function createProfile({ teamId, watchlistElementIds = [], fdrSortMode = "avg" } = {}) {
    return normalizeProfile({
      version: PROFILE_VERSION,
      teamId,
      watchlistElementIds,
      fdrSortMode,
    });
  }

  return {
    TEAM_PROFILE_KEY,
    PROFILE_VERSION,
    isValidTeamId,
    normalizeTeamId,
    normalizePick,
    normalizeTeamPicks,
    filterPlayersByElementIds,
    normalizeProfile,
    createProfile,
  };
});
