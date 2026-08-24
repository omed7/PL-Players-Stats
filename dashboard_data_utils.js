(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLDashboardDataUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function isPreseasonDataset({ players, currentGW, deadline, now = Date.now() } = {}) {
    const deadlineTime = Date.parse(deadline || "");
    return (
      Array.isArray(players) &&
      players.length === 0 &&
      currentGW === 1 &&
      Number.isFinite(deadlineTime) &&
      deadlineTime > now
    );
  }

  function priceSliderBounds(players) {
    const prices = players
      .map((player) => Number(player?.price))
      .filter((price) => Number.isFinite(price) && price > 0);

    return {
      minPriceSlider: Math.floor(Math.min(...prices, 3.0) * 10),
      maxPriceSlider: Math.ceil(Math.max(...prices, 15.0) * 10),
    };
  }

  function prepareDashboardData({ classified, now = Date.now() } = {}) {
    if (!classified?.compatible) throw new Error("Player dataset is incompatible");

    const dataset = classified.dataset;
    if (!dataset || !Array.isArray(dataset.players)) {
      throw new Error("Player dataset is malformed");
    }

    const players = dataset.players;
    const currentGW = dataset.current_gw || null;
    const deadline = dataset.deadline || null;
    const isPreseason = isPreseasonDataset({ players, currentGW, deadline, now });
    const dashboardState = isPreseason
      ? "preseason"
      : players.length > 0
        ? "ready"
        : "no_results";

    return {
      players,
      nextGWs: Array.isArray(dataset.next_gws) ? dataset.next_gws : [],
      currentGW,
      deadline,
      fetchedAt: dataset.fetched_at || null,
      schemaVersion: classified.schemaVersion || null,
      source: classified.source || null,
      isPreseason,
      dashboardState,
      ...priceSliderBounds(players),
    };
  }

  return { isPreseasonDataset, prepareDashboardData, priceSliderBounds };
});
