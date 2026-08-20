const handler = require("../api/fpl-team.js");

function responseRecorder() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader: jest.fn(function setHeader(name, value) {
      this.headers[name] = value;
    }),
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(body) {
      this.body = body;
      return this;
    }),
  };
}

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(body),
});

describe("FPL Team ID proxy", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test("rejects non-GET methods and invalid Team IDs without calling FPL", async () => {
    const request = jest.fn();
    global.fetch = request;

    const nonGet = responseRecorder();
    await handler({ method: "POST", query: { teamId: "123" } }, nonGet);
    expect(nonGet.statusCode).toBe(405);
    expect(nonGet.body).toEqual({ error: "Method not allowed" });

    const invalid = responseRecorder();
    await handler({ method: "GET", query: { teamId: "not-public" } }, invalid);
    expect(invalid.statusCode).toBe(400);
    expect(invalid.body).toEqual({ error: "A positive numeric Team ID is required" });
    expect(request).not.toHaveBeenCalled();
  });

  test("uses the authoritative current event and returns only sanitised pick fields", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ events: [{ id: 9, is_current: true }, { id: 10, is_next: true }] }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          picks: [
            {
              element: 101,
              position: 1,
              multiplier: 2,
              is_captain: true,
              is_vice_captain: false,
              player_name: "Must not leave server",
            },
          ],
          entry_history: { points: 12 },
        }),
      );
    const response = responseRecorder();

    await handler({ method: "GET", query: { teamId: "123" } }, response);

    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      "https://fantasy.premierleague.com/api/entry/123/event/9/picks/",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers["Cache-Control"]).toContain("s-maxage=120");
    expect(response.body).toEqual({
      teamId: 123,
      event: 9,
      picks: [
        { element: 101, position: 1, multiplier: 2, is_captain: true, is_vice_captain: false },
      ],
    });
  });

  test("uses the authoritative next event only when there is no current event", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ events: [{ id: 4, is_next: true }] }))
      .mockResolvedValueOnce(jsonResponse({ picks: [{ element: 2, position: 1, multiplier: 1 }] }));
    const response = responseRecorder();

    await handler({ method: "GET", query: { teamId: "22" } }, response);

    expect(response.body.event).toBe(4);
  });

  test("does not infer an event and does not expose upstream details on failure", async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ events: [{ id: 4 }] }));
    const response = responseRecorder();

    await handler({ method: "GET", query: { teamId: "22" } }, response);

    expect(response.statusCode).toBe(502);
    expect(response.body).toEqual({ error: "FPL team data is temporarily unavailable" });
  });

  test("rejects malformed or empty FPL picks", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse({ events: [{ id: 2, is_current: true }] }))
      .mockResolvedValueOnce(jsonResponse({ picks: [{ element: 0, position: 1, multiplier: 1 }] }));
    const response = responseRecorder();

    await handler({ method: "GET", query: { teamId: "22" } }, response);

    expect(response.statusCode).toBe(502);
    expect(response.body).toEqual({ error: "FPL team data is temporarily unavailable" });
  });
});
