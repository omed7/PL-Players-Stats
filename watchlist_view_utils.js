(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLWatchlistViewUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function isValidElementId(value) {
    return Number.isInteger(value) && value > 0;
  }

  function normalizeElementIds(values) {
    const seen = new Set();
    return (Array.isArray(values) ? values : []).filter((value) => {
      if (!isValidElementId(value) || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  function indexPlayersByElementId(players) {
    const byElementId = new Map();
    (Array.isArray(players) ? players : []).forEach((player) => {
      if (isValidElementId(player?.element_id) && !byElementId.has(player.element_id)) {
        byElementId.set(player.element_id, player);
      }
    });
    return byElementId;
  }

  function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function buildWatchlistViewModel({
    players = [],
    watchlistElementIds = [],
    prefix = "",
  } = {}) {
    const playerByElementId = indexPlayersByElementId(players);
    const metricPrefix = typeof prefix === "string" ? prefix : "";
    const cards = normalizeElementIds(watchlistElementIds)
      .map((elementId) => {
        const player = playerByElementId.get(elementId);
        if (!player) return null;

        const points = numberOrZero(player[`${metricPrefix}points`]);
        const xgi = numberOrZero(player[`${metricPrefix}xGI`]);
        const price = numberOrZero(player.price);
        return {
          elementId,
          player,
          points,
          xgi,
          xgiDisplay: xgi.toFixed(2),
          pointsPerMillion: price > 0 ? (points / price).toFixed(1) : "—",
        };
      })
      .filter(Boolean);

    return { count: cards.length, cards };
  }

  return { buildWatchlistViewModel };
});
