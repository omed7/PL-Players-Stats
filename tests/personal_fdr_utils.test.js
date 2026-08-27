const {
  PersonalFdrInputError,
  normalizePersonalFdrChanges,
  resolvePersonalFixtureDifficulty,
  buildPersonalFdrEditorRows,
} = require("../personal_fdr_utils.js");

describe("personal FDR utilities", () => {
  test("accepts distinct nullable home and away ratings on the seven-level scale", () => {
    expect(
      normalizePersonalFdrChanges([
        { teamId: 1, homeRating: 2, awayRating: 6 },
        { teamId: 2, homeRating: null, awayRating: 7 },
      ]),
    ).toEqual([
      { teamId: 1, homeRating: 2, awayRating: 6 },
      { teamId: 2, homeRating: null, awayRating: 7 },
    ]);
  });

  test("rejects invalid IDs, duplicate teams, and values outside 1–7", () => {
    expect(() => normalizePersonalFdrChanges([{ teamId: 0, homeRating: 4, awayRating: 4 }])).toThrow(PersonalFdrInputError);
    expect(() => normalizePersonalFdrChanges([{ teamId: 1, homeRating: 0, awayRating: 8 }])).toThrow(PersonalFdrInputError);
    expect(() => normalizePersonalFdrChanges([
      { teamId: 1, homeRating: 4, awayRating: 4 },
      { teamId: 1, homeRating: 5, awayRating: 5 },
    ])).toThrow(PersonalFdrInputError);
  });

  test("uses the opponent away rating for a home fixture and home rating for an away fixture", () => {
    const ratingsByTeam = new Map([
      [2, { teamId: 2, homeRating: 7, awayRating: 2 }],
    ]);

    expect(resolvePersonalFixtureDifficulty({ opponent_id: 2, is_home: true }, ratingsByTeam)).toBe(2);
    expect(resolvePersonalFixtureDifficulty({ opponent_id: 2, is_home: false }, ratingsByTeam)).toBe(7);
    expect(resolvePersonalFixtureDifficulty({ opponent_id: 2, is_home: true }, new Map())).toBeNull();
  });

  test("prepares one alphabetized editor row per durable team ID without trusting names as IDs", () => {
    expect(buildPersonalFdrEditorRows([
      { team_id: 2, team: "CHE", logo: "chelsea.png" },
      { team_id: 1, team: "ARS", logo: "arsenal.png" },
      { team_id: 1, team: "ARS", logo: "arsenal-other.png" },
    ], new Map([[1, { teamId: 1, homeRating: 4, awayRating: 5 }]]))).toEqual([
      { teamId: 1, name: "ARS", logo: "arsenal.png", homeRating: 4, awayRating: 5 },
      { teamId: 2, name: "CHE", logo: "chelsea.png", homeRating: null, awayRating: null },
    ]);
  });
});
