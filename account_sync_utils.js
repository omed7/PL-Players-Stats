(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLAccountSyncUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ACCOUNT_THEMES = ["green", "orange", "lightblue", "yellow", "softred"];
  const FDR_SORT_MODES = ["avg", "alpha"];

  function normalizeElementIds(value) {
    if (!Array.isArray(value)) return [];
    return [
      ...new Set(
        value.map(Number).filter((elementId) => Number.isSafeInteger(elementId) && elementId > 0),
      ),
    ];
  }

  function normalizeTheme(value) {
    return ACCOUNT_THEMES.includes(value) ? value : null;
  }

  function normalizePublicTeamId(value) {
    const numeric = Number(typeof value === "string" ? value.trim() : value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
  }

  function normalizeFdrSortMode(value) {
    return FDR_SORT_MODES.includes(value) ? value : null;
  }

  function mergeWatchlistElementIds(localIds, cloudIds) {
    return normalizeElementIds([...normalizeElementIds(localIds), ...normalizeElementIds(cloudIds)]);
  }

  function planInitialPreferenceSync({
    localWatchlistElementIds = [],
    cloudWatchlistElementIds = [],
    localTheme,
    cloudTheme,
    localTeamId,
    cloudTeamId,
    localFdrSortMode,
    cloudFdrSortMode,
  } = {}) {
    const validCloudIds = normalizeElementIds(cloudWatchlistElementIds);
    const watchlistElementIds = mergeWatchlistElementIds(
      localWatchlistElementIds,
      validCloudIds,
    );
    const cloudIdSet = new Set(validCloudIds);
    const normalisedCloudTheme = normalizeTheme(cloudTheme);
    const normalisedLocalTheme = normalizeTheme(localTheme) || "green";
    const normalisedCloudTeamId = normalizePublicTeamId(cloudTeamId);
    const normalisedLocalTeamId = normalizePublicTeamId(localTeamId);
    const normalisedCloudFdrSortMode = normalizeFdrSortMode(cloudFdrSortMode);
    const normalisedLocalFdrSortMode = normalizeFdrSortMode(localFdrSortMode) || "avg";

    return {
      watchlistElementIds,
      watchlistElementIdsToInsert: watchlistElementIds.filter(
        (elementId) => !cloudIdSet.has(elementId),
      ),
      effectiveTheme: normalisedCloudTheme || normalisedLocalTheme,
      themeToPersist: normalisedCloudTheme ? null : normalisedLocalTheme,
      effectiveTeamId: normalisedCloudTeamId || normalisedLocalTeamId,
      teamIdToPersist: normalisedCloudTeamId ? null : normalisedLocalTeamId,
      effectiveFdrSortMode: normalisedCloudFdrSortMode || normalisedLocalFdrSortMode,
      fdrSortModeToPersist: normalisedCloudFdrSortMode ? null : normalisedLocalFdrSortMode,
    };
  }

  return {
    ACCOUNT_THEMES,
    FDR_SORT_MODES,
    normalizeTheme,
    normalizePublicTeamId,
    normalizeFdrSortMode,
    normalizeElementIds,
    mergeWatchlistElementIds,
    planInitialPreferenceSync,
  };
});
