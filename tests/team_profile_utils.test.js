const {
  TEAM_PROFILE_KEY,
  PROFILE_VERSION,
  isValidTeamId,
  normalizeTeamId,
  normalizePick,
  normalizeTeamPicks,
  normalizeProfile,
  createProfile,
  filterPlayersByElementIds,
} = require("../team_profile_utils.js");

describe("account-free FPL Team ID profile utilities", () => {
  test("accepts only positive safe-integer Team IDs", () => {
    expect(TEAM_PROFILE_KEY).toBe("fpl_team_profile_v1");
    expect(isValidTeamId("123456")).toBe(true);
    expect(normalizeTeamId(" 42 ")).toBe(42);
    ["", "0", "-1", "1.5", "team-10", Number.MAX_SAFE_INTEGER + 1].forEach((value) => {
      expect(isValidTeamId(value)).toBe(false);
      expect(normalizeTeamId(value)).toBeNull();
    });
  });

  test("minimises a valid FPL pick to the permitted public squad fields", () => {
    expect(
      normalizePick({
        element: 123,
        position: 4,
        multiplier: 2,
        is_captain: true,
        is_vice_captain: false,
        player_name: "Must not persist",
        manager_email: "must-not-persist@example.test",
      }),
    ).toEqual({
      element: 123,
      position: 4,
      multiplier: 2,
      is_captain: true,
      is_vice_captain: false,
    });
  });

  test("rejects malformed pick fields and deduplicates valid squad element IDs", () => {
    expect(normalizePick({ element: 0, position: 1, multiplier: 1 })).toBeNull();
    expect(normalizePick({ element: 12, position: 16, multiplier: 1 })).toBeNull();
    expect(normalizePick({ element: 12, position: 1, multiplier: 4 })).toBeNull();

    expect(
      normalizeTeamPicks([
        { element: 101, position: 2, multiplier: 1 },
        { element: 101, position: 1, multiplier: 2, is_captain: true },
        { element: 202, position: 1, multiplier: 0 },
        { element: "bad", position: 3, multiplier: 1 },
      ]),
    ).toEqual([
      { element: 202, position: 1, multiplier: 0, is_captain: false, is_vice_captain: false },
      { element: 101, position: 2, multiplier: 1, is_captain: false, is_vice_captain: false },
    ]);
  });

  test("filters My Squad by durable element ID rather than player display name", () => {
    const players = [
      { element_id: 101, name: "Same Name" },
      { element_id: 202, name: "Same Name" },
      { element_id: 303, name: "Other Player" },
    ];

    expect(filterPlayersByElementIds(players, [202, "303", "bad"])).toEqual([
      { element_id: 202, name: "Same Name" },
      { element_id: 303, name: "Other Player" },
    ]);
  });

  test("creates a versioned this-device profile using stable element IDs only", () => {
    expect(
      createProfile({
        teamId: "999",
        watchlistElementIds: [101, "101", 202, "not-an-id"],
        fdrSortMode: "alpha",
      }),
    ).toEqual({
      version: PROFILE_VERSION,
      teamId: 999,
      watchlistElementIds: [101, 202],
      fdrSortMode: "alpha",
    });
  });

  test("rejects a corrupted or obsolete local profile", () => {
    expect(normalizeProfile(null)).toBeNull();
    expect(normalizeProfile({ version: 0, teamId: 1 })).toBeNull();
    expect(normalizeProfile({ version: PROFILE_VERSION, teamId: "not-public" })).toBeNull();
    expect(
      normalizeProfile({
        version: PROFILE_VERSION,
        teamId: 2,
        watchlistElementIds: [1, 1, -1],
        fdrSortMode: "unsupported",
      }),
    ).toEqual({
      version: PROFILE_VERSION,
      teamId: 2,
      watchlistElementIds: [1],
      fdrSortMode: "avg",
    });
  });
});
