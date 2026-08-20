const {
  ACCOUNT_THEMES,
  normalizeTheme,
  mergeWatchlistElementIds,
  planInitialPreferenceSync,
} = require("../account_sync_utils.js");

describe("account preference-sync utilities", () => {
  test("recognises only declared application themes", () => {
    expect(ACCOUNT_THEMES).toEqual(["green", "orange", "lightblue", "yellow", "softred"]);
    expect(normalizeTheme("orange")).toBe("orange");
    expect(normalizeTheme("not-a-theme")).toBeNull();
    expect(normalizeTheme(null)).toBeNull();
  });

  test("merges local and cloud watchlists as a deduplicated positive-ID union", () => {
    expect(mergeWatchlistElementIds([101, "202", 0, "bad"], [202, 303, 303, -1])).toEqual([
      101, 202, 303,
    ]);
  });

  test("selects existing cloud theme and adds only missing cloud watchlist items", () => {
    expect(
      planInitialPreferenceSync({
        localWatchlistElementIds: [1, 2, 2],
        cloudWatchlistElementIds: [2, 3],
        localTheme: "orange",
        cloudTheme: "green",
      }),
    ).toEqual({
      watchlistElementIds: [1, 2, 3],
      watchlistElementIdsToInsert: [1],
      effectiveTheme: "green",
      themeToPersist: null,
    });
  });

  test("seeds a valid local theme only when cloud has no valid saved preference", () => {
    expect(
      planInitialPreferenceSync({
        localWatchlistElementIds: [],
        cloudWatchlistElementIds: [],
        localTheme: "lightblue",
        cloudTheme: null,
      }),
    ).toEqual({
      watchlistElementIds: [],
      watchlistElementIdsToInsert: [],
      effectiveTheme: "lightblue",
      themeToPersist: "lightblue",
    });
  });
});
