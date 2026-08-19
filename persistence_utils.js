(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLPersistenceUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function isValidElementId(value) {
    return Number.isInteger(value) && value > 0;
  }

  function normalizeElementIds(values) {
    if (!Array.isArray(values)) return [];
    const seen = new Set();
    return values.filter((value) => {
      if (!isValidElementId(value) || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
  }

  function indexPlayersByElementId(players) {
    return new Map(
      (Array.isArray(players) ? players : [])
        .filter((player) => isValidElementId(player?.element_id))
        .map((player) => [player.element_id, player]),
    );
  }

  function resolveLegacyWatchlist(legacyNames, players) {
    if (!Array.isArray(legacyNames)) {
      return { complete: false, elementIds: [] };
    }

    const namesToIds = new Map();
    (Array.isArray(players) ? players : []).forEach((player) => {
      if (typeof player?.name !== "string" || !isValidElementId(player.element_id)) {
        return;
      }
      const ids = namesToIds.get(player.name) || [];
      ids.push(player.element_id);
      namesToIds.set(player.name, ids);
    });

    const resolvedIds = [];
    for (const name of legacyNames) {
      if (typeof name !== "string") return { complete: false, elementIds: [] };
      const ids = namesToIds.get(name) || [];
      if (ids.length !== 1) return { complete: false, elementIds: [] };
      resolvedIds.push(ids[0]);
    }

    return { complete: true, elementIds: normalizeElementIds(resolvedIds) };
  }

  return {
    isValidElementId,
    normalizeElementIds,
    indexPlayersByElementId,
    resolveLegacyWatchlist,
  };
});
