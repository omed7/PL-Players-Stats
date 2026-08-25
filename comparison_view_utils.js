(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLComparisonViewUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DEFAULT_MAX_SELECTIONS = 3;
  const DEFAULT_RADAR_SIZE = 200;
  const DEFAULT_RADAR_RADIUS = 72;

  function isValidElementId(value) {
    return Number.isSafeInteger(value) && value > 0;
  }

  function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function roundCoordinate(value) {
    return Number(value.toFixed(1));
  }

  function normalizeSelectedElementIds(
    selectedElementIds,
    maxSelections = DEFAULT_MAX_SELECTIONS,
  ) {
    const normalized = [];
    const seen = new Set();
    const limit = Number.isSafeInteger(maxSelections) && maxSelections > 0
      ? maxSelections
      : DEFAULT_MAX_SELECTIONS;

    (Array.isArray(selectedElementIds) ? selectedElementIds : []).forEach(
      (elementId) => {
        if (
          normalized.length < limit &&
          isValidElementId(elementId) &&
          !seen.has(elementId)
        ) {
          seen.add(elementId);
          normalized.push(elementId);
        }
      },
    );

    return normalized;
  }

  function updateComparisonSelection({
    selectedElementIds = [],
    elementId,
    maxSelections = DEFAULT_MAX_SELECTIONS,
  } = {}) {
    const nextIds = normalizeSelectedElementIds(selectedElementIds, maxSelections);
    if (!isValidElementId(elementId)) {
      return { selectedElementIds: nextIds, action: "ignored" };
    }

    const selectedIndex = nextIds.indexOf(elementId);
    if (selectedIndex !== -1) {
      nextIds.splice(selectedIndex, 1);
      return { selectedElementIds: nextIds, action: "removed" };
    }

    const limit = Number.isSafeInteger(maxSelections) && maxSelections > 0
      ? maxSelections
      : DEFAULT_MAX_SELECTIONS;
    if (nextIds.length >= limit) {
      return { selectedElementIds: nextIds, action: "full" };
    }

    nextIds.push(elementId);
    return { selectedElementIds: nextIds, action: "added" };
  }

  function resolveSelectedPlayers({
    selectedElementIds = [],
    players = [],
    maxSelections = DEFAULT_MAX_SELECTIONS,
  } = {}) {
    const playerByElementId = new Map();
    (Array.isArray(players) ? players : []).forEach((player) => {
      const elementId = player?.element_id;
      if (isValidElementId(elementId) && !playerByElementId.has(elementId)) {
        playerByElementId.set(elementId, player);
      }
    });

    return normalizeSelectedElementIds(selectedElementIds, maxSelections)
      .map((elementId, slotIndex) => {
        const player = playerByElementId.get(elementId);
        return player ? { elementId, slotIndex, player } : null;
      })
      .filter(Boolean);
  }

  function buildStatRows({ selectedPlayers, prefix, statDefinitions }) {
    return (Array.isArray(statDefinitions) ? statDefinitions : []).map(
      ({ key, label, bestLow = false }) => {
        const rawValues = selectedPlayers.map(({ player }) =>
          toFiniteNumber(player?.[`${prefix || ""}${key}`]),
        );
        const bestValue = bestLow
          ? Math.min(...rawValues)
          : Math.max(...rawValues);
        const maximum = bestLow
          ? Math.max(bestValue, 0.01)
          : Math.max(...rawValues, 0.01);
        const bestIndex = rawValues.indexOf(bestValue);
        const allTied = rawValues.every((value) => value === bestValue);

        const values = selectedPlayers.map((selectedPlayer, index) => {
          const value = rawValues[index];
          const ratio = bestLow
            ? maximum / (value || 0.01)
            : value / maximum;
          return {
            elementId: selectedPlayer.elementId,
            slotIndex: selectedPlayer.slotIndex,
            value,
            barPercent: roundCoordinate(Math.min(Math.max(ratio * 100, 0), 100)),
            isBest: value === bestValue,
          };
        });

        return {
          key,
          label,
          bestLow,
          maximum,
          bestValue,
          bestIndex,
          allTied,
          values,
        };
      },
    );
  }

  function buildRadarModel({
    selectedPlayers,
    prefix,
    radarStats,
    size = DEFAULT_RADAR_SIZE,
    radius = DEFAULT_RADAR_RADIUS,
  }) {
    const safeSize = Number.isFinite(size) && size > 0 ? size : DEFAULT_RADAR_SIZE;
    const safeRadius = Number.isFinite(radius) && radius > 0
      ? radius
      : DEFAULT_RADAR_RADIUS;
    const center = { x: safeSize / 2, y: safeSize / 2 };
    const stats = Array.isArray(radarStats) ? radarStats : [];
    const statCount = stats.length;
    const angleFor = (index) =>
      statCount ? (index / statCount) * 2 * Math.PI - Math.PI / 2 : -Math.PI / 2;
    const pointFor = (index, scale) => {
      const angle = angleFor(index);
      return {
        x: roundCoordinate(center.x + safeRadius * scale * Math.cos(angle)),
        y: roundCoordinate(center.y + safeRadius * scale * Math.sin(angle)),
      };
    };

    const maximumByKey = {};
    stats.forEach(({ key }) => {
      maximumByKey[key] = Math.max(
        ...selectedPlayers.map(({ player }) =>
          toFiniteNumber(player?.[`${prefix || ""}${key}`]),
        ),
        0.01,
      );
    });

    const axes = stats.map(({ key, label }, index) => {
      const angle = angleFor(index);
      return {
        key,
        label,
        end: pointFor(index, 1),
        labelPosition: {
          x: roundCoordinate(center.x + (safeRadius + 16) * Math.cos(angle)),
          y: roundCoordinate(center.y + (safeRadius + 16) * Math.sin(angle)),
        },
      };
    });

    const players = selectedPlayers.map(({ elementId, slotIndex, player }) => ({
      elementId,
      slotIndex,
      points: stats.map(({ key }, index) => {
        const value = toFiniteNumber(player?.[`${prefix || ""}${key}`]);
        const normalized = Math.min(
          Math.max(value / maximumByKey[key], 0),
          1,
        );
        return {
          key,
          normalized: roundCoordinate(normalized),
          ...pointFor(index, normalized),
        };
      }),
    }));

    const gridScales = [0.25, 0.5, 0.75, 1];
    const grid = gridScales.map((scale) =>
      stats.map((_, index) => pointFor(index, scale)),
    );

    return {
      size: safeSize,
      center,
      radius: safeRadius,
      gridScales,
      grid,
      maximumByKey,
      axes,
      players,
    };
  }

  function buildComparisonViewModel({
    selectedElementIds = [],
    players = [],
    prefix = "",
    statDefinitions = [],
    radarStats = [],
    maxSelections = DEFAULT_MAX_SELECTIONS,
  } = {}) {
    const selectedPlayers = resolveSelectedPlayers({
      selectedElementIds,
      players,
      maxSelections,
    });
    if (selectedPlayers.length < 2) return null;

    return {
      selectedPlayers,
      statRows: buildStatRows({ selectedPlayers, prefix, statDefinitions }),
      radar: buildRadarModel({ selectedPlayers, prefix, radarStats }),
    };
  }

  return {
    isValidElementId,
    normalizeSelectedElementIds,
    updateComparisonSelection,
    resolveSelectedPlayers,
    buildComparisonViewModel,
  };
});
