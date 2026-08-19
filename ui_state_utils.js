(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLUIStateUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function classifyDashboardState({
    loadError = false,
    isPreseason = false,
    filteredPlayerCount = 0,
  } = {}) {
    if (loadError) return "error";
    if (isPreseason) return "preseason";
    return filteredPlayerCount > 0 ? "ready" : "no_results";
  }

  return { classifyDashboardState };
});
