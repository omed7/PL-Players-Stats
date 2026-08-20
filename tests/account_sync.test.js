const { createAccountSync } = require("../account_sync.js");
const utils = require("../account_sync_utils.js");

function resolved(data, error = null) {
  return Promise.resolve({ data, error });
}

function makeClient({ cloudTheme = "green", cloudIds = [2, 3] } = {}) {
  const calls = [];
  const client = {
    from: jest.fn((table) => {
      calls.push({ table });
      if (table === "user_preferences") {
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({ maybeSingle: jest.fn(() => resolved(cloudTheme ? { theme: cloudTheme } : null)) })),
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
  test("merges valid local watchlist IDs, preserves cloud theme, and creates a profile lazily", async () => {
    const { client, calls } = makeClient();
    const sync = createAccountSync({ client, utils });

    await expect(
      sync.syncInitialPreferences({
        session,
        localWatchlistElementIds: [1, 2, "bad"],
        localTheme: "orange",
      }),
    ).resolves.toEqual({
      watchlistElementIds: [1, 2, 3],
      effectiveTheme: "green",
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

  test("seeds local theme when cloud has no row and synchronises an individual membership by element ID", async () => {
    const { client, calls } = makeClient({ cloudTheme: null, cloudIds: [] });
    const sync = createAccountSync({ client, utils });

    await sync.syncInitialPreferences({
      session,
      localWatchlistElementIds: [],
      localTheme: "lightblue",
    });
    await sync.setWatchlistMembership({ session, elementId: 99, watched: true });
    await sync.setWatchlistMembership({ session, elementId: 99, watched: false });

    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "user_preferences",
          action: "upsert",
          rows: { user_id: session.user.id, theme: "lightblue" },
          options: { onConflict: "user_id" },
        }),
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
    expect(client.from).not.toHaveBeenCalled();
  });
});
