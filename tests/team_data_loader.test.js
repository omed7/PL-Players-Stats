const { createTeamDataLoader, TeamDataError } = require("../team_data_loader.js");
const profileUtils = require("../team_profile_utils.js");

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(body),
});

describe("public FPL Team ID browser loader", () => {
  test("rejects an invalid Team ID before making a network request", async () => {
    const request = jest.fn();
    const loader = createTeamDataLoader({ fetchImpl: request, profileUtils });

    await expect(loader.load("not-public")).rejects.toMatchObject({
      code: "invalid-team-id",
      message: "Enter a positive numeric FPL Team ID.",
    });
    expect(request).not.toHaveBeenCalled();
  });

  test("uses the same-origin endpoint and defensively returns only minimised fields", async () => {
    const request = jest.fn().mockResolvedValue(
      jsonResponse({
        teamId: 123,
        event: 4,
        picks: [
          {
            element: 88,
            position: 1,
            multiplier: 2,
            is_captain: true,
            is_vice_captain: false,
            manager_name: "must-not-pass-through",
          },
        ],
        entry_history: { points: 999 },
      }),
    );
    const loader = createTeamDataLoader({ fetchImpl: request, profileUtils });

    await expect(loader.load("123")).resolves.toEqual({
      teamId: 123,
      event: 4,
      picks: [{ element: 88, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false }],
    });
    expect(request).toHaveBeenCalledWith("/api/fpl-team?teamId=123", {
      headers: { Accept: "application/json" },
    });
  });

  test("maps non-success and malformed payloads to neutral unavailable errors", async () => {
    const unavailable = createTeamDataLoader({
      fetchImpl: jest.fn().mockResolvedValue(jsonResponse({ error: "upstream details" }, 502)),
      profileUtils,
    });
    await expect(unavailable.load(123)).rejects.toMatchObject({
      code: "team-data-unavailable",
      message: "FPL team data is temporarily unavailable. Try again shortly.",
    });

    const malformed = createTeamDataLoader({
      fetchImpl: jest.fn().mockResolvedValue(jsonResponse({ teamId: 123, event: 4, picks: [] })),
      profileUtils,
    });
    await expect(malformed.load(123)).rejects.toBeInstanceOf(TeamDataError);
    await expect(malformed.load(123)).rejects.toMatchObject({ code: "team-data-unavailable" });
  });
});
