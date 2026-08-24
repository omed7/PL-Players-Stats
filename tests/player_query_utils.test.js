const {
  queryPlayers,
  getPagination,
} = require("../player_query_utils.js");

const PREFIX = "last_5_";
const MAX_MINUTES = 450;

function player({
  elementId,
  name,
  team = "ARS",
  position = "MID",
  price = 5,
  minutes = 90,
  points = 0,
  xG = 0,
  ...stats
}) {
  return {
    element_id: elementId,
    name,
    team,
    position,
    price,
    [`${PREFIX}minutes`]: minutes,
    [`${PREFIX}points`]: points,
    [`${PREFIX}xG`]: xG,
    ...Object.fromEntries(
      [
        "xA",
        "xGI",
        "influence",
        "creativity",
        "threat",
        "ict",
        "bps",
        "bonus",
        "saves",
        "defcon",
        "goals",
        "assists",
        "clean_sheets",
        "ppg",
      ].map((key) => [`${PREFIX}${key}`, stats[key] ?? 0]),
    ),
  };
}

const players = [
  player({ elementId: 11, name: "Ada", price: 5, minutes: 90, points: 10, xG: 1.5 }),
  player({ elementId: 12, name: "Adam", price: 5, minutes: 89, points: 10, xG: 1.5 }),
  player({ elementId: 13, name: "Bea", team: "CHE", position: "DEF", price: 4.5, minutes: 223, points: 9, xG: 0.2 }),
  player({ elementId: 14, name: "Cara", position: "FWD", price: 6, minutes: 222, points: 12, xG: 2 }),
  player({ elementId: 15, name: "Dae", price: 0, minutes: 450, points: 25, xG: 1.5 }),
];

function criteria(overrides = {}) {
  return {
    minutesMode: "raw",
    minMinutes: 0,
    priceMin: 3,
    priceMax: 15,
    searchQuery: "",
    selectedTeams: [],
    positionFilter: "All",
    watchlistOnly: false,
    watchlistElementIds: [],
    mySquadOnly: false,
    squadElementIds: [],
    sortColumn: "xG",
    sortDirection: "desc",
    ...overrides,
  };
}

describe("player query utilities", () => {
  test("combines current raw-minute boundary, price, search, team, and position filters", () => {
    const result = queryPlayers({
      players,
      prefix: PREFIX,
      maxMinutes: MAX_MINUTES,
      criteria: criteria({
        minMinutes: 90,
        priceMin: 5,
        priceMax: 5,
        searchQuery: "AD",
        selectedTeams: ["ARS"],
        positionFilter: "MID",
      }),
    });

    expect(result.players.map((player) => player.element_id)).toEqual([11]);
  });

  test("preserves the rounded percentage-minute threshold and durable-ID watchlist/squad intersection", () => {
    const percentageResult = queryPlayers({
      players,
      prefix: PREFIX,
      maxMinutes: MAX_MINUTES,
      criteria: criteria({ minutesMode: "percent", minMinutes: 50, priceMin: 0 }),
    });
    expect(percentageResult.players.map((player) => player.element_id)).toEqual([15, 13]);

    const restrictedResult = queryPlayers({
      players,
      prefix: PREFIX,
      maxMinutes: MAX_MINUTES,
      criteria: criteria({
        watchlistOnly: true,
        watchlistElementIds: [12, 14],
        mySquadOnly: true,
        squadElementIds: [11, 14, 15],
        sortColumn: "name",
        sortDirection: "asc",
      }),
    });
    expect(restrictedResult.players.map((player) => player.element_id)).toEqual([14]);
  });

  test("preserves name, numeric, and points-per-price sorting with stable numeric ties", () => {
    const nameResult = queryPlayers({
      players,
      prefix: PREFIX,
      maxMinutes: MAX_MINUTES,
      criteria: criteria({ sortColumn: "name", sortDirection: "desc", priceMin: 0 }),
    });
    expect(nameResult.players.map((player) => player.name)).toEqual([
      "Dae",
      "Cara",
      "Bea",
      "Adam",
      "Ada",
    ]);

    const numericResult = queryPlayers({
      players,
      prefix: PREFIX,
      maxMinutes: MAX_MINUTES,
      criteria: criteria({ sortColumn: "xG", sortDirection: "desc", priceMin: 0 }),
    });
    expect(numericResult.players.map((player) => player.element_id)).toEqual([
      14,
      11,
      12,
      15,
      13,
    ]);

    const valueResult = queryPlayers({
      players,
      prefix: PREFIX,
      maxMinutes: MAX_MINUTES,
      criteria: criteria({ sortColumn: "value", sortDirection: "desc", priceMin: 0 }),
    });
    expect(valueResult.players.map((player) => player.element_id)).toEqual([
      11,
      12,
      13,
      14,
      15,
    ]);
  });

  test("returns current filtered maxima with the established zero-safe floor", () => {
    const result = queryPlayers({
      players,
      prefix: PREFIX,
      maxMinutes: MAX_MINUTES,
      criteria: criteria({ selectedTeams: ["ARS"], priceMin: 0 }),
    });

    expect(result.columnMaxes).toMatchObject({
      points: 25,
      xG: 2,
      goals: 0.01,
      value: 2,
    });
  });

  test("clamps pagination and retains one empty-result page", () => {
    expect(getPagination({ totalItems: 31, itemsPerPage: 15, currentPage: 99 })).toEqual({
      currentPage: 3,
      totalPages: 3,
      startIndex: 30,
      endIndex: 45,
    });

    expect(getPagination({ totalItems: 0, itemsPerPage: 15, currentPage: 0 })).toEqual({
      currentPage: 1,
      totalPages: 1,
      startIndex: 0,
      endIndex: 15,
    });
  });
});
