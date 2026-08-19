const { loadPlayerDataset } = require("../public_data_loader.js");
const { classifyPlayerDataset } = require("../schema_utils.js");

const config = {
  sourceMode: "supabase-first",
  allowStaticFallback: true,
  supabaseUrl: "https://example.supabase.co",
  supabasePublishableKey: "public-test-key",
};
const preseason = {
  schema_version: 2,
  fetched_at: "2026-08-19T20:00:00Z",
  current_gw: 1,
  deadline: "2026-08-21T17:30:00Z",
  players: [],
};
const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: jest.fn().mockResolvedValue(body),
});

describe("staged public player-data loader", () => {
  test("uses one valid current Supabase snapshot without requesting static fallback", async () => {
    const request = jest.fn().mockResolvedValue(response([{ payload: preseason }]));

    const result = await loadPlayerDataset({ request, config, classifyDataset: classifyPlayerDataset });

    expect(result.source).toBe("supabase");
    expect(result.dataset).toEqual(preseason);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toContain("current_fpl_snapshot?select=payload&limit=1");
    expect(request.mock.calls[0][1].headers.apikey).toBe(config.supabasePublishableKey);
  });

  test("accepts a valid zero-player preseason snapshot from Supabase", async () => {
    const request = jest.fn().mockResolvedValue(response([{ payload: preseason }]));

    const result = await loadPlayerDataset({ request, config, classifyDataset: classifyPlayerDataset });

    expect(result.source).toBe("supabase");
    expect(result.dataset.players).toEqual([]);
    expect(result.schemaVersion).toBe(2);
  });

  test.each([
    [response([], 200), "Supabase has no current published snapshot"],
    [response([{ payload: { schema_version: 99, players: [] } }], 200), "Player dataset is incompatible"],
    [response({ message: "unavailable" }, 503), "Supabase HTTP 503"],
  ])("falls back to static data when the Supabase reader is degraded", async (supabaseResponse, reason) => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(supabaseResponse)
      .mockResolvedValueOnce(response(preseason));

    const result = await loadPlayerDataset({ request, config, classifyDataset: classifyPlayerDataset });

    expect(result.source).toBe("static");
    expect(result.fallbackReason).toBe(reason);
    expect(request.mock.calls[1][0]).toBe("players.json");
  });

  test("raises the Supabase reader error when static fallback is disabled", async () => {
    const request = jest.fn().mockResolvedValue(response([], 200));

    await expect(
      loadPlayerDataset({
        request,
        config: { ...config, allowStaticFallback: false },
        classifyDataset: classifyPlayerDataset,
      }),
    ).rejects.toThrow("Supabase has no current published snapshot");
    expect(request).toHaveBeenCalledTimes(1);
  });

  test("raises a combined failure only after both sources fail", async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(response([], 200))
      .mockResolvedValueOnce(response({ message: "missing" }, 404));

    await expect(
      loadPlayerDataset({ request, config, classifyDataset: classifyPlayerDataset }),
    ).rejects.toThrow("Supabase reader failed");
  });
});
