const { createAccountSync } = require("../account_sync.js");
const utils = require("../account_sync_utils.js");
const personalFdrUtils = require("../personal_fdr_utils.js");

function resolved(data, error = null) {
  return Promise.resolve({ data, error });
}

function makeClient({
  cloudPreferences = { theme: "green", fpl_team_id: null, fdr_sort_mode: null },
  cloudIds = [2, 3],
  cloudFdrRatings = [],
} = {}) {
  const calls = [];
  const client = {
    from: jest.fn((table) => {
      calls.push({ table });
      if (table === "user_preferences") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ maybeSingle: jest.fn(() => resolved(cloudPreferences)) })),
          })),
          upsert: jest.fn((rows, options) => {
            calls.push({ table, action: "upsert", rows, options });
            return resolved(null);
          }),
          update: jest.fn((rows) => ({
            eq: jest.fn((column, value) => {
              calls.push({ table, action: "update", rows, column, value });
              return resolved(null);
            }),
          })),
        };
      }
      if (table === "user_fdr_ratings") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn((column, value) => {
              calls.push({ table, action: "select", column, value });
              return resolved(cloudFdrRatings);
            }),
          })),
          upsert: jest.fn((rows, options) => {
            calls.push({ table, action: "upsert", rows, options });
            return resolved(null);
          }),
        };
      }
      if (table === "watchlist_items") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => resolved(cloudIds.map((element_id) => ({ element_id })))),
          })),
          upsert: jest.fn((rows, options) => {
            calls.push({ table, action: "upsert", rows, options });
            return resolved(null);
          }),
          delete: jest.fn(() => ({
            eq: jest.fn(() => ({ eq: jest.fn(() => resolved(null)) })),
          })),
        };
      }
      if (table === "profiles") {
        return {
          upsert: jest.fn((rows, options) => {
            calls.push({ table, action: "upsert", rows, options });
            return resolved(null);
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  };
  return { client, calls };
}

const session = { user: { id: "00000000-0000-4000-8000-000000000001" } };

describe("Supabase account preference adapter", () => {
  test("uses valid cloud Team ID/FDR values, preserves cloud theme, and creates a profile lazily", async () => {
    const { client, calls } = makeClient({
      cloudPreferences: { theme: "green", fpl_team_id: 222, fdr_sort_mode: "alpha" },
    });
    const sync = createAccountSync({ client, utils });

    await expect(
      sync.syncInitialPreferences({
        session,
        localWatchlistElementIds: [1, 2, "bad"],
        localTheme: "orange",
        localTeamId: 111,
        localFdrSortMode: "avg",
      }),
    ).resolves.toEqual({
      watchlistElementIds: [1, 2, 3],
      effectiveTheme: "green",
      effectiveTeamId: 222,
      effectiveFdrSortMode: "alpha",
      personalFdrRatings: new Map(),
    });

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "profiles",
          action: "upsert",
          rows: { user_id: session.user.id },
          options: { onConflict: "user_id", ignoreDuplicates: true },
        }),
        expect.objectContaining({
          table: "watchlist_items",
          action: "upsert",
          rows: [{ user_id: session.user.id, element_id: 1 }],
          options: { onConflict: "user_id,element_id", ignoreDuplicates: true },
        }),
      ]),
    );
    expect(calls.some((call) => call.table === "user_preferences" && call.action === "upsert")).toBe(false);
  });

  test("seeds missing cloud theme, Team ID, and FDR sort in one owner-scoped preference write", async () => {
    const { client, calls } = makeClient({ cloudPreferences: null, cloudIds: [] });
    const sync = createAccountSync({ client, utils });

    await expect(
      sync.syncInitialPreferences({
        session,
        localWatchlistElementIds: [],
        localTheme: "lightblue",
        localTeamId: 88,
        localFdrSortMode: "alpha",
      }),
    ).resolves.toEqual({
      watchlistElementIds: [],
      effectiveTheme: "lightblue",
      effectiveTeamId: 88,
      effectiveFdrSortMode: "alpha",
      personalFdrRatings: new Map(),
    });

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "user_preferences",
          action: "upsert",
          rows: {
            user_id: session.user.id,
            theme: "lightblue",
            fpl_team_id: 88,
            fdr_sort_mode: "alpha",
          },
          options: { onConflict: "user_id" },
        }),
      ]),
    );
  });

  test("synchronises Team ID/FDR updates and clears only the Team ID for an authenticated user", async () => {
    const { client, calls } = makeClient();
    const sync = createAccountSync({ client, utils });

    await sync.saveTeamPreferences({ session, teamId: "99", fdrSortMode: "alpha" });
    await sync.saveFdrSortMode({ session, fdrSortMode: "avg" });
    await sync.clearTeamId({ session });

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "user_preferences",
          action: "upsert",
          rows: { user_id: session.user.id, fpl_team_id: 99, fdr_sort_mode: "alpha" },
          options: { onConflict: "user_id" },
        }),
        expect.objectContaining({
          table: "user_preferences",
          action: "upsert",
          rows: { user_id: session.user.id, fdr_sort_mode: "avg" },
          options: { onConflict: "user_id" },
        }),
        expect.objectContaining({
          table: "user_preferences",
          action: "update",
          rows: { fpl_team_id: null },
          column: "user_id",
          value: session.user.id,
        }),
      ]),
    );
  });

  test("loads and saves personal FDR ratings through rows scoped to the authenticated user", async () => {
    const { client, calls } = makeClient({
      cloudFdrRatings: [{ team_id: 2, home_rating: 7, away_rating: 2 }],
    });
    const sync = createAccountSync({ client, utils, personalFdrUtils });

    await expect(sync.syncInitialPreferences({ session })).resolves.toEqual(
      expect.objectContaining({
        personalFdrRatings: new Map([[2, { teamId: 2, homeRating: 7, awayRating: 2 }]]),
      }),
    );
    await sync.savePersonalFdrChanges({
      session,
      changes: [{ teamId: 3, homeRating: 4, awayRating: 6 }],
    });

    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        table: "user_fdr_ratings",
        action: "select",
        column: "user_id",
        value: session.user.id,
      }),
      expect.objectContaining({
        table: "user_fdr_ratings",
        action: "upsert",
        rows: [{ user_id: session.user.id, team_id: 3, home_rating: 4, away_rating: 6 }],
        options: { onConflict: "user_id,team_id" },
      }),
    ]));
  });

  test("synchronises an individual watchlist membership by stable element ID", async () => {
    const { client, calls } = makeClient();
    const sync = createAccountSync({ client, utils });

    await sync.setWatchlistMembership({ session, elementId: 99, watched: true });
    await sync.setWatchlistMembership({ session, elementId: 99, watched: false });

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "watchlist_items",
          action: "upsert",
          rows: { user_id: session.user.id, element_id: 99 },
          options: { onConflict: "user_id,element_id", ignoreDuplicates: true },
        }),
      ]),
    );
  });

  test("refuses to read or write user-owned data without an authenticated session", async () => {
    const { client } = makeClient();
    const sync = createAccountSync({ client, utils });

    await expect(sync.syncInitialPreferences({ session: null })).rejects.toThrow("authenticated session");
    await expect(sync.setWatchlistMembership({ session: null, elementId: 3, watched: true })).rejects.toThrow(
      "authenticated session",
    );
    await expect(sync.saveTeamPreferences({ session: null, teamId: 3 })).rejects.toThrow(
      "authenticated session",
    );
    await expect(sync.saveFdrSortMode({ session: null, fdrSortMode: "avg" })).rejects.toThrow(
      "authenticated session",
    );
    await expect(sync.clearTeamId({ session: null })).rejects.toThrow("authenticated session");
    await expect(sync.savePersonalFdrChanges({ session: null, changes: [{ teamId: 3, homeRating: 4, awayRating: 4 }] })).rejects.toThrow(
      "authenticated session",
    );
    expect(client.from).not.toHaveBeenCalled();
  });
});
