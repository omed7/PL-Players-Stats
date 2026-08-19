const {
  classifyFixtureSlot,
  groupFixturesByGameweek,
  upcomingGameweeksFromPlayers,
} = require("../fixture_utils");

describe("fixture truthfulness", () => {
  const fixture = {
    gw: 3,
    opponent_id: 2,
    opponent: "ARS",
    difficulty: 3,
    is_home: true,
  };

  test("classifies a known single fixture without asserting a blank", () => {
    expect(classifyFixtureSlot([fixture])).toEqual({
      status: "known",
      fixtures: [fixture],
    });
  });

  test("preserves both fixtures in a double gameweek", () => {
    const secondFixture = { ...fixture, fixture_id: 99, opponent: "CHE" };
    const grouped = groupFixturesByGameweek([fixture, secondFixture]);

    expect(grouped[3]).toEqual([fixture, secondFixture]);
    expect(classifyFixtureSlot(grouped[3])).toEqual({
      status: "known",
      fixtures: [fixture, secondFixture],
    });
  });

  test("treats missing fixture data as unknown rather than a blank gameweek", () => {
    expect(classifyFixtureSlot([])).toEqual({
      status: "unknown",
      fixtures: [],
    });
    expect(classifyFixtureSlot()).toEqual({
      status: "unknown",
      fixtures: [],
    });
  });

  test("derives display gameweeks only from source-observed fixture records", () => {
    const players = [
      { fixtures: [{ gw: 5 }, { gw: 7 }] },
      { fixtures: [{ gw: 5 }, { gw: 8 }] },
    ];

    expect(upcomingGameweeksFromPlayers(players, 5)).toEqual([5, 7, 8]);
  });
});
