const {
  updateComparisonSelection,
  buildComparisonViewModel,
} = require("../comparison_view_utils.js");

const STAT_DEFINITIONS = [
  { key: "points", label: "Points", bestLow: false },
  { key: "xG", label: "xG", bestLow: false },
  { key: "saves", label: "Saves", bestLow: false },
];

const RADAR_STATS = [
  { key: "points", label: "PTS" },
  { key: "xG", label: "xG" },
  { key: "saves", label: "SVS" },
];

function player(elementId, values = {}) {
  return { element_id: elementId, name: `Player ${elementId}`, ...values };
}

function buildModel({ selectedElementIds, players, prefix = "last_5_" }) {
  return buildComparisonViewModel({
    selectedElementIds,
    players,
    prefix,
    statDefinitions: STAT_DEFINITIONS,
    radarStats: RADAR_STATS,
  });
}

describe("comparison view-model utilities", () => {
  test("adds and removes only valid durable IDs, preserves order, and refuses a fourth distinct player", () => {
    expect(
      updateComparisonSelection({
        selectedElementIds: [101, 202],
        elementId: 303,
      }),
    ).toEqual({
      selectedElementIds: [101, 202, 303],
      action: "added",
    });

    expect(
      updateComparisonSelection({
        selectedElementIds: [101, 202, 303],
        elementId: 202,
      }),
    ).toEqual({
      selectedElementIds: [101, 303],
      action: "removed",
    });

    expect(
      updateComparisonSelection({
        selectedElementIds: [101, 202, 303],
        elementId: 404,
      }),
    ).toEqual({
      selectedElementIds: [101, 202, 303],
      action: "full",
    });

    expect(
      updateComparisonSelection({
        selectedElementIds: [101, 101, 202],
        elementId: "303",
      }),
    ).toEqual({
      selectedElementIds: [101, 202],
      action: "ignored",
    });
  });

  test("resolves selected players by element_id only and declines a modal model with fewer than two resolved players", () => {
    expect(
      buildModel({
        selectedElementIds: [101, 999],
        players: [player(101, { last_5_points: 7 })],
      }),
    ).toBeNull();

    const model = buildModel({
      selectedElementIds: [202, 101, 999],
      players: [
        player(101, { last_5_points: 7 }),
        player(202, { last_5_points: 11 }),
      ],
    });

    expect(model.selectedPlayers.map(({ elementId, slotIndex }) => ({ elementId, slotIndex }))).toEqual([
      { elementId: 202, slotIndex: 0 },
      { elementId: 101, slotIndex: 1 },
    ]);
  });

  test("reads only the supplied timeframe prefix and creates zero-safe high-is-best stat rows", () => {
    const model = buildModel({
      selectedElementIds: [101, 202],
      players: [
        player(101, {
          last_5_points: 7,
          season_points: 99,
          last_5_xG: 0.25,
          last_5_saves: 0,
        }),
        player(202, {
          last_5_points: 14,
          season_points: 1,
          last_5_xG: 0.5,
          last_5_saves: "not-a-number",
        }),
      ],
    });

    const points = model.statRows.find(({ key }) => key === "points");
    expect(points).toMatchObject({
      key: "points",
      label: "Points",
      maximum: 14,
      bestValue: 14,
      bestIndex: 1,
      allTied: false,
      values: [
        { elementId: 101, value: 7, barPercent: 50, isBest: false },
        { elementId: 202, value: 14, barPercent: 100, isBest: true },
      ],
    });

    const saves = model.statRows.find(({ key }) => key === "saves");
    expect(saves).toMatchObject({
      maximum: 0.01,
      bestValue: 0,
      bestIndex: 0,
      allTied: true,
      values: [
        { elementId: 101, value: 0, barPercent: 0, isBest: true },
        { elementId: 202, value: 0, barPercent: 0, isBest: true },
      ],
    });
  });

  test("preserves all best-value ties while exposing the first slot used by the existing single-dot renderer", () => {
    const model = buildModel({
      selectedElementIds: [101, 202, 303],
      players: [
        player(101, { last_5_points: 9, last_5_xG: 0, last_5_saves: 0 }),
        player(202, { last_5_points: 9, last_5_xG: 0, last_5_saves: 0 }),
        player(303, { last_5_points: 4, last_5_xG: 0, last_5_saves: 0 }),
      ],
    });

    const points = model.statRows.find(({ key }) => key === "points");
    expect(points.bestValue).toBe(9);
    expect(points.bestIndex).toBe(0);
    expect(points.allTied).toBe(false);
    expect(points.values.map(({ isBest }) => isBest)).toEqual([true, true, false]);

    const xG = model.statRows.find(({ key }) => key === "xG");
    expect(xG.allTied).toBe(true);
    expect(xG.bestIndex).toBe(0);
    expect(xG.values.map(({ isBest }) => isBest)).toEqual([true, true, true]);
  });

  test("creates deterministic finite radar axes and clipped normalized points for missing and numeric current-period values", () => {
    const model = buildModel({
      selectedElementIds: [101, 202],
      players: [
        player(101, { last_5_points: 10, last_5_xG: 0, last_5_saves: undefined }),
        player(202, { last_5_points: 100, last_5_xG: 2, last_5_saves: 5 }),
      ],
    });

    expect(model.radar).toMatchObject({
      size: 200,
      center: { x: 100, y: 100 },
      radius: 72,
      axes: [
        { key: "points", label: "PTS", end: { x: 100, y: 28 } },
        { key: "xG", label: "xG" },
        { key: "saves", label: "SVS" },
      ],
    });

    const firstPlayerPoints = model.radar.players[0].points;
    expect(firstPlayerPoints).toEqual([
      { key: "points", normalized: 0.1, x: 100, y: 92.8 },
      { key: "xG", normalized: 0, x: 100, y: 100 },
      { key: "saves", normalized: 0, x: 100, y: 100 },
    ]);

    const secondPlayerPoints = model.radar.players[1].points;
    expect(secondPlayerPoints.map(({ normalized, x, y }) => ({ normalized, x, y }))).toEqual([
      { normalized: 1, x: 100, y: 28 },
      { normalized: 1, x: 162.4, y: 136 },
      { normalized: 1, x: 37.6, y: 136 },
    ]);
    expect(secondPlayerPoints.every(({ normalized, x, y }) => Number.isFinite(normalized) && Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });
});
