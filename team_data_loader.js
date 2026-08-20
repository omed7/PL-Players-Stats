(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLTeamDataLoader = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  class TeamDataError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "TeamDataError";
      this.code = code;
    }
  }

  function createTeamDataLoader({ fetchImpl, profileUtils } = {}) {
    if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
    if (!profileUtils?.normalizeTeamId || !profileUtils?.normalizeTeamPicks) {
      throw new Error("Team profile utilities are required");
    }

    async function load(teamIdInput) {
      const teamId = profileUtils.normalizeTeamId(teamIdInput);
      if (!teamId) {
        throw new TeamDataError("invalid-team-id", "Enter a positive numeric FPL Team ID.");
      }

      let response;
      try {
        response = await fetchImpl(`/api/fpl-team?teamId=${encodeURIComponent(teamId)}`, {
          headers: { Accept: "application/json" },
        });
      } catch (_) {
        throw new TeamDataError(
          "team-data-unavailable",
          "FPL team data is temporarily unavailable. Try again shortly.",
        );
      }

      if (!response?.ok) {
        throw new TeamDataError(
          "team-data-unavailable",
          "FPL team data is temporarily unavailable. Try again shortly.",
        );
      }

      let payload;
      try {
        payload = await response.json();
      } catch (_) {
        throw new TeamDataError(
          "team-data-unavailable",
          "FPL team data is temporarily unavailable. Try again shortly.",
        );
      }

      const responseTeamId = profileUtils.normalizeTeamId(payload?.teamId);
      const event = Number(payload?.event);
      const picks = profileUtils.normalizeTeamPicks(payload?.picks);
      if (
        responseTeamId !== teamId ||
        !Number.isSafeInteger(event) ||
        event <= 0 ||
        !picks.length
      ) {
        throw new TeamDataError(
          "team-data-unavailable",
          "FPL team data is temporarily unavailable. Try again shortly.",
        );
      }

      return { teamId, event, picks };
    }

    return { load };
  }

  return { TeamDataError, createTeamDataLoader };
});
