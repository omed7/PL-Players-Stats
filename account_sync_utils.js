(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLAccountSyncUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ACCOUNT_THEMES = ["green", "orange", "lightblue", "yellow", "softred"];

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

  function mergeWatchlistElementIds(localIds, cloudIds) {
    return normalizeElementIds([...normalizeElementIds(localIds), ...normalizeElementIds(cloudIds)]);
  }

  function planInitialPreferenceSync({
    localWatchlistElementIds = [],
    cloudWatchlistElementIds = [],
    localTheme,
    cloudTheme,
  } = {}) {
    const validCloudIds = normalizeElementIds(cloudWatchlistElementIds);
    const watchlistElementIds = mergeWatchlistElementIds(
      localWatchlistElementIds,
      validCloudIds,
    );
    const cloudIdSet = new Set(validCloudIds);
    const normalisedCloudTheme = normalizeTheme(cloudTheme);
    const normalisedLocalTheme = normalizeTheme(localTheme) || "green";

    return {
      watchlistElementIds,
      watchlistElementIdsToInsert: watchlistElementIds.filter(
        (elementId) => !cloudIdSet.has(elementId),
      ),
      effectiveTheme: normalisedCloudTheme || normalisedLocalTheme,
      themeToPersist: normalisedCloudTheme ? null : normalisedLocalTheme,
    };
  }

  return {
    ACCOUNT_THEMES,
    normalizeTheme,
    normalizeElementIds,
    mergeWatchlistElementIds,
    planInitialPreferenceSync,
  };
});
