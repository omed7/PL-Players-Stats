const {
  isValidElementId,
  normalizeElementIds,
  indexPlayersByElementId,
  resolveLegacyWatchlist,
} = require("../persistence_utils.js");

describe("stable element-ID persistence helpers", () => {
  const players = [
    { element_id: 1, name: "Raya" },
    { element_id: 101, name: "Saka" },
    { element_id: 202, name: "Salah" },
  ];

  test("accepts only positive integer element IDs and deduplicates while preserving order", () => {
    expect(isValidElementId(1)).toBe(true);
    expect(isValidElementId(0)).toBe(false);
    expect(isValidElementId("1")).toBe(false);
    expect(normalizeElementIds([101, 1, 101, 0, "202", 202])).toEqual([
      101,
      1,
      202,
    ]);
  });

  test("indexes only valid player records by element ID", () => {
    const indexed = indexPlayersByElementId([
      ...players,
      { element_id: null, name: "Invalid" },
      { element_id: 0, name: "Also invalid" },
    ]);

    expect(indexed.get(101).name).toBe("Saka");
    expect(indexed.has(0)).toBe(false);
    expect(indexed.size).toBe(3);
  });

  test("migrates a fully resolvable legacy name list to stable IDs", () => {
    expect(resolveLegacyWatchlist(["Saka", "Raya", "Saka"], players)).toEqual({
      complete: true,
      elementIds: [101, 1],
    });
  });

  test("does not migrate a legacy list with an unresolved player name", () => {
    expect(resolveLegacyWatchlist(["Saka", "Unknown"], players)).toEqual({
      complete: false,
      elementIds: [],
    });
  });

  test("does not migrate when a current display name is ambiguous", () => {
    const ambiguousPlayers = [
      ...players,
      { element_id: 303, name: "Saka" },
    ];

    expect(resolveLegacyWatchlist(["Saka"], ambiguousPlayers)).toEqual({
      complete: false,
      elementIds: [],
    });
  });

  test("does not migrate malformed legacy storage values", () => {
    expect(resolveLegacyWatchlist("Saka", players)).toEqual({
      complete: false,
      elementIds: [],
    });
  });
});
