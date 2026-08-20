const {
  ACCOUNT_THEMES,
  normalizeTheme,
  mergeWatchlistElementIds,
  normalizeFdrSortMode,
  normalizePublicTeamId,
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

  test("normalises only public positive Team IDs and declared FDR sort modes", () => {
    expect(normalizePublicTeamId("42")).toBe(42);
    expect(normalizePublicTeamId("0")).toBeNull();
    expect(normalizePublicTeamId("not-a-team")).toBeNull();
    expect(normalizeFdrSortMode("alpha")).toBe("alpha");
    expect(normalizeFdrSortMode("unsupported")).toBeNull();
  });

  test("selects existing cloud values and adds only missing cloud watchlist items", () => {
    expect(
      planInitialPreferenceSync({
        localWatchlistElementIds: [1, 2, 2],
        cloudWatchlistElementIds: [2, 3],
        localTheme: "orange",
        cloudTheme: "green",
        localTeamId: 111,
        cloudTeamId: 222,
        localFdrSortMode: "alpha",
        cloudFdrSortMode: "avg",
      }),
    ).toEqual({
      watchlistElementIds: [1, 2, 3],
      watchlistElementIdsToInsert: [1],
      effectiveTheme: "green",
      themeToPersist: null,
      effectiveTeamId: 222,
      teamIdToPersist: null,
      effectiveFdrSortMode: "avg",
      fdrSortModeToPersist: null,
    });
  });

  test("seeds a valid local theme only when cloud has no valid saved preference", () => {
    expect(
      planInitialPreferenceSync({
        localWatchlistElementIds: [],
        cloudWatchlistElementIds: [],
        localTheme: "lightblue",
        cloudTheme: null,
        localTeamId: "88",
        cloudTeamId: null,
        localFdrSortMode: "alpha",
        cloudFdrSortMode: null,
      }),
    ).toEqual({
      watchlistElementIds: [],
      watchlistElementIdsToInsert: [],
      effectiveTheme: "lightblue",
      themeToPersist: "lightblue",
      effectiveTeamId: 88,
      teamIdToPersist: 88,
      effectiveFdrSortMode: "alpha",
      fdrSortModeToPersist: "alpha",
    });
  });

  test("does not seed invalid Team ID values and defaults a missing FDR sort to avg", () => {
    expect(
      planInitialPreferenceSync({
        localTeamId: "invalid",
        cloudTeamId: 0,
        localFdrSortMode: "invalid",
        cloudFdrSortMode: null,
      }),
    ).toMatchObject({
      effectiveTeamId: null,
      teamIdToPersist: null,
      effectiveFdrSortMode: "avg",
      fdrSortModeToPersist: "avg",
    });
  });
});
