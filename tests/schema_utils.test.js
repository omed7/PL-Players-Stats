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

  test.each([
    [{ players: [] }, "missing schema version"],
    [{ schema_version: null, players: [] }, "null schema version"],
    [{ schema_version: "2", players: [] }, "string schema version"],
    [{ schema_version: 1.5, players: [] }, "fractional schema version"],
    [{ schema_version: 99, players: [] }, "future schema version"],
    [{ schema_version: 2 }, "missing players array"],
    [null, "non-object payload"],
  ])("rejects %s", (payload) => {
    expect(classifyPlayerDataset(payload)).toEqual({
      compatible: false,
      schemaVersion: null,
    });
  });
});
