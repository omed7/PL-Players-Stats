(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLAccountSync = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function sessionUserId(session) {
    const userId = session?.user?.id;
    if (typeof userId !== "string" || !userId) {
      throw new Error("An authenticated session is required");
    }
    return userId;
  }

  function assertNoError(result, operation) {
    if (result?.error) throw new Error(`${operation} failed`);
    return result?.data;
  }

  function createAccountSync({ client, utils } = {}) {
    if (!client?.from) throw new Error("A Supabase browser client is required");
    if (
      !utils?.planInitialPreferenceSync ||
      !utils?.normalizeTheme ||
      !utils?.normalizePublicTeamId ||
      !utils?.normalizeFdrSortMode
    ) {
      throw new Error("Account sync utilities are required");
    }

    async function ensureProfile(userId) {
      const result = await client
        .from("profiles")
        .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
      assertNoError(result, "Profile synchronisation");
    }

    async function readCloudPreferences(userId) {
      const [themeResult, watchlistResult] = await Promise.all([
        client
          .from("user_preferences")
          .select("theme,fpl_team_id,fdr_sort_mode")
          .eq("user_id", userId)
          .maybeSingle(),
        client
          .from("watchlist_items")
          .select("element_id")
          .eq("user_id", userId),
      ]);
      const themeRow = assertNoError(themeResult, "Theme retrieval");
      const watchlistRows = assertNoError(watchlistResult, "Watchlist retrieval") || [];
      return {
        cloudTheme: themeRow?.theme || null,
        cloudTeamId: themeRow?.fpl_team_id || null,
        cloudFdrSortMode: themeRow?.fdr_sort_mode || null,
        cloudWatchlistElementIds: watchlistRows.map((row) => row.element_id),
      };
    }

    async function insertWatchlistItems(userId, elementIds) {
      if (!elementIds.length) return;
      const result = await client.from("watchlist_items").upsert(
        elementIds.map((element_id) => ({ user_id: userId, element_id })),
        { onConflict: "user_id,element_id", ignoreDuplicates: true },
      );
      assertNoError(result, "Watchlist synchronisation");
    }

    async function syncInitialPreferences({
      session,
      localWatchlistElementIds = [],
      localTheme,
      localTeamId,
      localFdrSortMode,
    } = {}) {
      const userId = sessionUserId(session);
      const [{ cloudTheme, cloudTeamId, cloudFdrSortMode, cloudWatchlistElementIds }] = await Promise.all([
        readCloudPreferences(userId),
        ensureProfile(userId),
      ]);
      const plan = utils.planInitialPreferenceSync({
        localWatchlistElementIds,
        cloudWatchlistElementIds,
        localTheme,
        cloudTheme,
        localTeamId,
        cloudTeamId,
        localFdrSortMode,
        cloudFdrSortMode,
      });

      await insertWatchlistItems(userId, plan.watchlistElementIdsToInsert);
      const preferenceSeed = { user_id: userId };
      if (plan.themeToPersist) preferenceSeed.theme = plan.themeToPersist;
      if (plan.teamIdToPersist) preferenceSeed.fpl_team_id = plan.teamIdToPersist;
      if (plan.fdrSortModeToPersist) preferenceSeed.fdr_sort_mode = plan.fdrSortModeToPersist;
      if (Object.keys(preferenceSeed).length > 1) {
        const result = await client
          .from("user_preferences")
          .upsert(preferenceSeed, { onConflict: "user_id" });
        assertNoError(result, "Preference synchronisation");
      }

      return {
        watchlistElementIds: plan.watchlistElementIds,
        effectiveTheme: plan.effectiveTheme,
        effectiveTeamId: plan.effectiveTeamId,
        effectiveFdrSortMode: plan.effectiveFdrSortMode,
      };
    }

    async function setWatchlistMembership({ session, elementId, watched } = {}) {
      const userId = sessionUserId(session);
      const normalisedIds = utils.normalizeElementIds([elementId]);
      if (!normalisedIds.length) return;
      const normalisedId = normalisedIds[0];

      if (watched) {
        const result = await client.from("watchlist_items").upsert(
          { user_id: userId, element_id: normalisedId },
          { onConflict: "user_id,element_id", ignoreDuplicates: true },
        );
        assertNoError(result, "Watchlist synchronisation");
        return;
      }

      const result = await client
        .from("watchlist_items")
        .delete()
        .eq("user_id", userId)
        .eq("element_id", normalisedId);
      assertNoError(result, "Watchlist synchronisation");
    }

    async function saveTeamPreferences({ session, teamId, fdrSortMode } = {}) {
      const userId = sessionUserId(session);
      const normalisedTeamId = utils.normalizePublicTeamId(teamId);
      if (!normalisedTeamId) return;
      const normalisedFdrSortMode = utils.normalizeFdrSortMode(fdrSortMode) || "avg";
      const result = await client.from("user_preferences").upsert(
        {
          user_id: userId,
          fpl_team_id: normalisedTeamId,
          fdr_sort_mode: normalisedFdrSortMode,
        },
        { onConflict: "user_id" },
      );
      assertNoError(result, "Team preference synchronisation");
    }

    async function saveFdrSortMode({ session, fdrSortMode } = {}) {
      const userId = sessionUserId(session);
      const normalisedFdrSortMode = utils.normalizeFdrSortMode(fdrSortMode);
      if (!normalisedFdrSortMode) return;
      const result = await client.from("user_preferences").upsert(
        { user_id: userId, fdr_sort_mode: normalisedFdrSortMode },
        { onConflict: "user_id" },
      );
      assertNoError(result, "FDR preference synchronisation");
    }

    async function clearTeamId({ session } = {}) {
      const userId = sessionUserId(session);
      const result = await client
        .from("user_preferences")
        .update({ fpl_team_id: null })
        .eq("user_id", userId);
      assertNoError(result, "Team preference synchronisation");
    }

    async function saveTheme({ session, theme } = {}) {
      const userId = sessionUserId(session);
      const normalisedTheme = utils.normalizeTheme(theme);
      if (!normalisedTheme) return;
      const result = await client
        .from("user_preferences")
        .upsert({ user_id: userId, theme: normalisedTheme }, { onConflict: "user_id" });
      assertNoError(result, "Theme synchronisation");
    }

    return {
      syncInitialPreferences,
      setWatchlistMembership,
      saveTeamPreferences,
      saveFdrSortMode,
      clearTeamId,
      saveTheme,
    };
  }

  return { createAccountSync };
});
