const {
  selectRecentMatches,
  matchLabel,
} = require("../history_utils.js");

const match = (fixture_id, gw, was_home, kickoff_time, minutes = 90) => ({
  fixture_id,
  gw,
  was_home,
  kickoff_time,
  minutes,
  pts: 0,
});

describe("match-based history selection", () => {
  const history = [
    match(101, 1, true, "2026-08-15T14:00:00Z"),
    match(102, 2, false, "2026-08-22T14:00:00Z"),
    match(103, 3, true, "2026-08-29T14:00:00Z", 0),
    match(104, 4, false, "2026-09-05T14:00:00Z"),
    match(105, 4, true, "2026-09-08T14:00:00Z"),
    match(106, 5, false, "2026-09-12T14:00:00Z"),
  ];

  test("selects the latest completed matches rather than gameweeks", () => {
    expect(selectRecentMatches(history, { limit: 3 }).map((record) => record.fixture_id)).toEqual([
      104,
      105,
      106,
    ]);
  });

  test("keeps both fixtures in a double gameweek as two matches", () => {
    expect(selectRecentMatches(history, { limit: 4 }).filter((record) => record.gw === 4)).toHaveLength(2);
  });

  test("filters by venue before selecting the latest N matches", () => {
    expect(selectRecentMatches(history, { venue: "away", limit: 2 }).map((record) => record.fixture_id)).toEqual([
      104,
      106,
    ]);
    expect(selectRecentMatches(history, { venue: "home", limit: 2 }).map((record) => record.fixture_id)).toEqual([
      103,
      105,
    ]);
  });

  test("retains a zero-minute completed match in the raw match sequence", () => {
    expect(selectRecentMatches(history, { venue: "home", limit: 3 }).find((record) => record.fixture_id === 103)).toMatchObject({
      minutes: 0,
    });
  });

  test("uses a stable fixture-ID fallback when kickoff times are unavailable", () => {
    const unscheduled = [
      match(202, 6, true, null),
      match(201, 6, true, null),
    ];
    expect(selectRecentMatches(unscheduled, { limit: 2 }).map((record) => record.fixture_id)).toEqual([
      201,
      202,
    ]);
  });

  test("does not treat malformed data as a completed match", () => {
    const malformed = [{ gw: 7, was_home: true }, ...history];
    expect(selectRecentMatches(malformed, { limit: 6 })).toHaveLength(6);
  });

  test("labels chart points as gameweek context plus venue, not as a gameweek-only unit", () => {
    expect(matchLabel(history[0])).toBe("GW1 H");
    expect(matchLabel(history[1])).toBe("GW2 A");
  });
});
