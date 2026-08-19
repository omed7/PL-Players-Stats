const { classifyPlayerDataset } = require("../schema_utils.js");

describe("players.json schema compatibility", () => {
  test("accepts a legacy root-array payload as schema version 1", () => {
    const players = [{ name: "Legacy Player" }];

    expect(classifyPlayerDataset(players)).toEqual({
      compatible: true,
      schemaVersion: 1,
      dataset: { players },
    });
  });

  test.each([1, 2])("accepts an explicit supported object schema version %i", (schemaVersion) => {
    const dataset = { schema_version: schemaVersion, players: [] };

    expect(classifyPlayerDataset(dataset)).toEqual({
      compatible: true,
      schemaVersion,
      dataset,
    });
  });

  test("preserves supported payload metadata alongside the players array", () => {
    const dataset = { schema_version: 2, players: [], fetched_at: "2026-08-19" };

    expect(classifyPlayerDataset(dataset)).toEqual({
      compatible: true,
      schemaVersion: 2,
      dataset,
    });
  });

  test.each([
    [{ players: [] }, "missing schema version"],
    [{ schema_version: null, players: [] }, "null schema version"],
    [{ schema_version: "2", players: [] }, "string schema version"],
    [{ schema_version: 1.5, players: [] }, "fractional schema version"],
    [{ schema_version: 0, players: [] }, "unsupported zero schema version"],
    [{ schema_version: 99, players: [] }, "future schema version"],
    [{ schema_version: 2 }, "missing players array"],
    [{ schema_version: 2, players: {} }, "non-array players envelope"],
    [null, "non-object payload"],
    [false, "boolean payload"],
  ])("rejects %s", (payload) => {
    expect(classifyPlayerDataset(payload)).toEqual({
      compatible: false,
      schemaVersion: null,
    });
  });
});
