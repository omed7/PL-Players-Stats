const { buildWatchlistViewModel } = require("../watchlist_view_utils.js");

const players = [
  {
    element_id: 101,
    name: "First",
    price: 5,
    last_5_points: 8,
    last_5_xGI: 1.234,
    last_10_points: 15,
    last_10_xGI: 2.345,
    season_points: 20,
    season_xGI: 3.456,
  },
  {
    element_id: 202,
    name: "Zero Price",
    price: 0,
    last_5_points: undefined,
    last_5_xGI: "invalid",
    last_10_points: 4,
    last_10_xGI: 0.4,
    season_points: 6,
    season_xGI: 0.6,
  },
  {
    element_id: 303,
    name: "Third",
    price: 6.5,
    last_5_points: 3,
    last_5_xGI: 0.125,
    last_10_points: 10,
    last_10_xGI: 1.5,
    season_points: 30,
    season_xGI: 4.5,
  },
];

function model({ watchlistElementIds, prefix = "last_5_", sourcePlayers = players }) {
  return buildWatchlistViewModel({
    players: sourcePlayers,
    watchlistElementIds,
    prefix,
  });
}

describe("watchlist drawer view-model utilities", () => {
  test("normalizes durable IDs, deduplicates them, and preserves first-occurrence order", () => {
    const result = model({
      watchlistElementIds: ["303", 101, 303, "101", 0, -2, "bad", 202],
    });

    expect(result.count).toBe(3);
    expect(result.cards.map(({ elementId }) => elementId)).toEqual([101, 303, 202]);
    expect(result.cards.map(({ player }) => player.name)).toEqual([
      "First",
      "Third",
      "Zero Price",
    ]);
  });

  test("omits stale IDs without inferring a player by display name", () => {
    const result = model({
      watchlistElementIds: [999, "First", 101, 404],
    });

    expect(result).toEqual({
      count: 1,
      cards: [
        expect.objectContaining({
          elementId: 101,
          player: players[0],
        }),
      ],
    });
  });

  test("reads only the supplied timeframe prefix and formats current card metrics", () => {
    const lastFive = model({ watchlistElementIds: [101, 303], prefix: "last_5_" });
    const lastTen = model({ watchlistElementIds: [101, 303], prefix: "last_10_" });
    const season = model({ watchlistElementIds: [101, 303], prefix: "season_" });

    expect(lastFive.cards.map(({ points, xgi, pointsPerMillion }) => ({ points, xgi, pointsPerMillion }))).toEqual([
      { points: 8, xgi: 1.234, pointsPerMillion: "1.6" },
      { points: 3, xgi: 0.125, pointsPerMillion: "0.5" },
    ]);
    expect(lastTen.cards.map(({ points, xgi, pointsPerMillion }) => ({ points, xgi, pointsPerMillion }))).toEqual([
      { points: 15, xgi: 2.345, pointsPerMillion: "3.0" },
      { points: 10, xgi: 1.5, pointsPerMillion: "1.5" },
    ]);
    expect(season.cards.map(({ points, xgi, pointsPerMillion }) => ({ points, xgi, pointsPerMillion }))).toEqual([
      { points: 20, xgi: 3.456, pointsPerMillion: "4.0" },
      { points: 30, xgi: 4.5, pointsPerMillion: "4.6" },
    ]);
  });

  test("uses finite zero-safe metrics and the established em dash for zero or invalid prices", () => {
    const result = model({
      watchlistElementIds: [202, 303],
      sourcePlayers: [
        players[1],
        {
          ...players[2],
          price: Number.POSITIVE_INFINITY,
          last_5_points: Number.NaN,
          last_5_xGI: Number.POSITIVE_INFINITY,
        },
      ],
    });

    expect(result.cards.map(({ elementId, points, xgi, xgiDisplay, pointsPerMillion }) => ({
      elementId,
      points,
      xgi,
      xgiDisplay,
      pointsPerMillion,
    }))).toEqual([
      {
        elementId: 202,
        points: 0,
        xgi: 0,
        xgiDisplay: "0.00",
        pointsPerMillion: "—",
      },
      {
        elementId: 303,
        points: 0,
        xgi: 0,
        xgiDisplay: "0.00",
        pointsPerMillion: "—",
      },
    ]);
  });

  test("returns a stable empty model for an empty watchlist or an all-stale watchlist", () => {
    expect(model({ watchlistElementIds: [] })).toEqual({ count: 0, cards: [] });
    expect(model({ watchlistElementIds: [999, "bad"] })).toEqual({ count: 0, cards: [] });
  });
});
