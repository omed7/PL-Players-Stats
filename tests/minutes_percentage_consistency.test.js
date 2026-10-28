const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { queryPlayers } = require("../player_query_utils.js");
const { buildPlayerTableRowMetrics } = require("../player_table_utils.js");

const baseCriteria = {
  minutesMode: "percent", minMinutes: 90, priceMin: 0, priceMax: 100,
  searchQuery: "", selectedTeams: [], positionFilter: "All",
  watchlistOnly: false, watchlistElementIds: [], mySquadOnly: false,
  squadElementIds: [], sortColumn: "name", sortDirection: "asc",
};

function makePlayer({ id = 1, prefix, minutes, percentage }) {
  const player = {
    element_id: id, name: `Synthetic ${id}`, team: "ARS", position: "MID", price: 5,
    [`${prefix}minutes`]: minutes, [`${prefix}points`]: 1,
  };
  if (percentage !== undefined) player[`${prefix}min_pct`] = percentage;
  return player;
}

function query(records, prefix, maxMinutes, overrides = {}) {
  return queryPlayers({
    players: records, prefix, maxMinutes,
    criteria: { ...baseCriteria, ...overrides },
  }).players.map((player) => player.element_id);
}

function displayed(player, prefix, maxMinutes) {
  return buildPlayerTableRowMetrics({ player, prefix, maxMinutes }).minPct;
}

describe("minutes-percentage query/display agreement", () => {
  test.each([
    ["three-match Last 5 window", "last_5_", 450, 270, 100],
    ["six-match Last 10 window", "last_10_", 900, 540, 100],
    ["two-match Last 10 window", "last_10_", 900, 180, 100],
    ["Season supplied percentage", "season_", 900, 720, 90],
  ])("uses the displayed period percentage for %s", (_label, prefix, maxMinutes, minutes, percentage) => {
    const player = makePlayer({ prefix, minutes, percentage });
    expect(displayed(player, prefix, maxMinutes)).toBe(percentage);
    expect(query([player], prefix, maxMinutes)).toEqual([1]);
  });

  test.each([[79, true], [80, true], [81, false]])(
    "compares the minimum %i with the supplied displayed value, inclusively",
    (minimum, included) => {
      const prefix = "last_5_";
      const player = makePlayer({ prefix, minutes: 216, percentage: 80 });
      expect(displayed(player, prefix, 450)).toBe(80);
      expect(query([player], prefix, 450, { minMinutes: minimum })).toEqual(included ? [1] : []);
    },
  );

  test("honors a supplied zero rather than replacing it with a derived percentage", () => {
    const prefix = "last_5_";
    const player = makePlayer({ prefix, minutes: 90, percentage: 0 });
    expect(displayed(player, prefix, 450)).toBe(0);
    expect(query([player], prefix, 450, { minMinutes: 1 })).toEqual([]);
  });

  test.each([undefined, null])("preserves rounded fallback when the supplied percentage is %p", (percentage) => {
    const prefix = "last_5_";
    const records = [
      makePlayer({ id: 1, prefix, minutes: 223, percentage }),
      makePlayer({ id: 2, prefix, minutes: 222, percentage }),
    ];
    expect(records.map((player) => displayed(player, prefix, 450))).toEqual([50, 49]);
    expect(query(records, prefix, 450, { minMinutes: 50 })).toEqual([1]);
  });

  test("uses the same zero-safe fallback denominator as display", () => {
    const prefix = "last_5_";
    const player = makePlayer({ prefix, minutes: 1 });
    expect(displayed(player, prefix, 0)).toBe(100);
    expect(query([player], prefix, 0, { minMinutes: 101 })).toEqual([]);
  });

  test("does not change raw-minutes filtering", () => {
    const prefix = "last_10_";
    const player = makePlayer({ prefix, minutes: 540, percentage: 0 });
    expect(query([player], prefix, 900, { minutesMode: "raw", minMinutes: 500 })).toEqual([1]);
    expect(query([player], prefix, 900, { minutesMode: "raw", minMinutes: 541 })).toEqual([]);
  });

  test("retains zero-minute exclusion even if a supplied percentage is positive", () => {
    const prefix = "last_10_";
    const player = makePlayer({ prefix, minutes: 0, percentage: 100 });
    expect(query([player], prefix, 900)).toEqual([]);
  });

  test("does not clamp an already supplied percentage above 100", () => {
    const prefix = "season_";
    const player = makePlayer({ prefix, minutes: 1080, percentage: 120 });
    expect(displayed(player, prefix, 900)).toBe(120);
    expect(query([player], prefix, 900, { minMinutes: 120 })).toEqual([1]);
  });

  test("works through the browser globals in the actual HTML script order", () => {
    const root = path.join(__dirname, "..");
    const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
    const tableIndex = html.indexOf('<script src="player_table_utils.js"></script>');
    const queryIndex = html.indexOf('<script src="player_query_utils.js"></script>');
    expect(tableIndex).toBeGreaterThan(-1);
    expect(queryIndex).toBeGreaterThan(tableIndex);
    const browser = vm.createContext({});
    for (const file of ["player_table_utils.js", "player_query_utils.js"]) {
      vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), browser, { filename: file });
    }
    const prefix = "last_10_";
    const player = makePlayer({ prefix, minutes: 540, percentage: 100 });
    expect(browser.FPLPlayerTableUtils.buildPlayerTableRowMetrics({ player, prefix, maxMinutes: 900 }).minPct).toBe(100);
    const result = browser.FPLPlayerQueryUtils.queryPlayers({ players: [player], prefix, maxMinutes: 900, criteria: baseCriteria });
    expect(Array.from(result.players, (record) => record.element_id)).toEqual([1]);
  });
});
