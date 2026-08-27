const { buildFdrViewModel } = require("../fdr_view_utils.js");

function fixture({ gw, opponent, opponentId = null, difficulty, isHome = true }) {
  return {
    gw,
    opponent,
    opponent_id: opponentId,
    difficulty,
    is_home: isHome,
  };
}

function player({ team, logo, fixtures }) {
  return { team, logo, fixtures };
}

describe("FDR view-model utilities", () => {
  test("derives only unique ascending gameweeks observed in source fixtures", () => {
    const result = buildFdrViewModel({
      players: [
        player({
          team: "ARS",
          logo: "ars.png",
          fixtures: [fixture({ gw: 2, opponent: "CHE", difficulty: 2 })],
        }),
        player({
          team: "CHE",
          logo: "che.png",
          fixtures: [fixture({ gw: 4, opponent: "ARS", difficulty: 4 })],
        }),
      ],
      selectedTeams: [],
      sortMode: "alpha",
    });

    expect(result.gameweeks).toEqual([2, 4]);
    expect(result.gameweeks).not.toContain(3);
  });

  test("keeps the current first available team fixture source, primary logo, and double gameweeks", () => {
    const secondArsenalFixture = fixture({
      gw: 3,
      opponent: "MCI",
      difficulty: 5,
      isHome: false,
    });
    const result = buildFdrViewModel({
      players: [
        player({ team: "ARS", logo: "ars-primary.png", fixtures: [] }),
        player({
          team: "ARS",
          logo: "ars-secondary.png",
          fixtures: [
            fixture({ gw: 2, opponent: "CHE", difficulty: 2 }),
            fixture({ gw: 3, opponent: "LIV", difficulty: 4 }),
            secondArsenalFixture,
          ],
        }),
      ],
      selectedTeams: [],
      sortMode: "alpha",
    });

    expect(result.teams).toEqual([
      {
        name: "ARS",
        logo: "ars-primary.png",
        fixturesByGameweek: {
          2: [fixture({ gw: 2, opponent: "CHE", difficulty: 2 })],
          3: [fixture({ gw: 3, opponent: "LIV", difficulty: 4 }), secondArsenalFixture],
        },
        averageDifficulty: 11 / 3,
      },
    ]);
  });

  test("preserves source-only fixture groups, applies selected-team filtering, and keeps missing slots unknown for the renderer", () => {
    const result = buildFdrViewModel({
      players: [
        player({
          team: "ARS",
          logo: "ars.png",
          fixtures: [fixture({ gw: 2, opponent: "CHE", difficulty: 2 })],
        }),
        player({
          team: "CHE",
          logo: "che.png",
          fixtures: [fixture({ gw: 4, opponent: "ARS", difficulty: 3 })],
        }),
      ],
      selectedTeams: ["ARS"],
      sortMode: "avg",
    });

    expect(result.gameweeks).toEqual([2, 4]);
    expect(result.teams).toHaveLength(1);
    expect(result.teams[0].name).toBe("ARS");
    expect(result.teams[0].fixturesByGameweek[2]).toHaveLength(1);
    expect(result.teams[0].fixturesByGameweek[4]).toBeUndefined();
  });

  test("preserves average-FDR ascending order and stable ties, or alphabetical order when selected", () => {
    const players = [
      player({
        team: "ARS",
        logo: "ars.png",
        fixtures: [
          fixture({ gw: 2, opponent: "CHE", difficulty: 2 }),
          fixture({ gw: 3, opponent: "LIV", difficulty: 4 }),
          fixture({ gw: 3, opponent: "MCI", difficulty: 5 }),
        ],
      }),
      player({
        team: "CHE",
        logo: "che.png",
        fixtures: [fixture({ gw: 2, opponent: "ARS", difficulty: 3 })],
      }),
      player({
        team: "AVL",
        logo: "avl.png",
        fixtures: [fixture({ gw: 2, opponent: "BOU", difficulty: 3 })],
      }),
      player({ team: "BOU", logo: "bou.png", fixtures: [] }),
    ];

    const averageResult = buildFdrViewModel({
      players,
      selectedTeams: [],
      sortMode: "avg",
    });
    expect(averageResult.teams.map((team) => team.name)).toEqual([
      "BOU",
      "CHE",
      "AVL",
      "ARS",
    ]);

    const alphabeticalResult = buildFdrViewModel({
      players,
      selectedTeams: [],
      sortMode: "alpha",
    });
    expect(alphabeticalResult.teams.map((team) => team.name)).toEqual([
      "ARS",
      "AVL",
      "BOU",
      "CHE",
    ]);
  });

  test("resolves distinct personal venue ratings for every fixture in a double gameweek", () => {
    const resolveDifficulty = jest.fn((fixture) => {
      if (fixture.opponent_id === 2 && fixture.is_home) return 2;
      if (fixture.opponent_id === 3 && !fixture.is_home) return 7;
      return null;
    });
    const homeFixture = fixture({ gw: 4, opponent: "CHE", opponentId: 2, difficulty: 3, isHome: true });
    const awayFixture = fixture({ gw: 4, opponent: "LIV", opponentId: 3, difficulty: 4, isHome: false });

    const result = buildFdrViewModel({
      players: [player({ team: "ARS", logo: "ars.png", fixtures: [homeFixture, awayFixture] })],
      selectedTeams: [],
      sortMode: "avg",
      resolveDifficulty,
    });

    expect(resolveDifficulty).toHaveBeenCalledTimes(2);
    expect(result.teams[0].fixturesByGameweek[4]).toEqual([
      { ...homeFixture, displayDifficulty: 2 },
      { ...awayFixture, displayDifficulty: 7 },
    ]);
    expect(result.teams[0].averageDifficulty).toBe(4.5);
  });

  test("places teams without configured personal ratings after teams with a personal average", () => {
    const result = buildFdrViewModel({
      players: [
        player({ team: "UNRATED", logo: "unrated.png", fixtures: [fixture({ gw: 2, opponent: "CHE", opponentId: 2, difficulty: 3 })] }),
        player({ team: "RATED", logo: "rated.png", fixtures: [fixture({ gw: 2, opponent: "ARS", opponentId: 1, difficulty: 3 })] }),
      ],
      selectedTeams: [],
      sortMode: "avg",
      resolveDifficulty: (fixture) => fixture.opponent_id === 1 ? 4 : null,
    });

    expect(result.teams.map((team) => team.name)).toEqual(["RATED", "UNRATED"]);
    expect(result.teams[1].averageDifficulty).toBeNull();
  });

  test("does not manufacture gameweeks when no source team has fixtures", () => {
    const result = buildFdrViewModel({
      players: [
        player({ team: "ARS", logo: "ars.png", fixtures: [] }),
        player({ team: "CHE", logo: "che.png" }),
      ],
      selectedTeams: [],
      sortMode: "avg",
    });

    expect(result.gameweeks).toEqual([]);
    expect(result.teams.map((team) => team.name)).toEqual(["ARS", "CHE"]);
  });
});
