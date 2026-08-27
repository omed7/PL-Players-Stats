(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLPersonalFdrUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const MIN_RATING = 1;
  const MAX_RATING = 7;
  const MAX_CHANGES = 20;

  class PersonalFdrInputError extends Error {
    constructor(message) {
      super(message);
      this.name = "PersonalFdrInputError";
    }
  }

  function normalizeTeamId(value) {
    const numeric = Number(value);
    return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
  }

  function normalizeRating(value) {
    if (value === null || value === undefined || value === "") return null;
    const numeric = Number(value);
    return Number.isInteger(numeric) && numeric >= MIN_RATING && numeric <= MAX_RATING
      ? numeric
      : null;
  }

  function parseRating(value, label) {
    const normalized = normalizeRating(value);
    if (normalized === null && value !== null && value !== undefined && value !== "") {
      throw new PersonalFdrInputError(`${label} must be empty or an integer from ${MIN_RATING} to ${MAX_RATING}.`);
    }
    return normalized;
  }

  function normalizePersonalFdrChanges(changes) {
    if (!Array.isArray(changes) || changes.length === 0) {
      throw new PersonalFdrInputError("At least one team rating change is required.");
    }
    if (changes.length > MAX_CHANGES) {
      throw new PersonalFdrInputError(`At most ${MAX_CHANGES} team rating changes can be saved at once.`);
    }

    const seenTeamIds = new Set();
    return changes.map((change) => {
      const teamId = normalizeTeamId(change?.teamId);
      if (!teamId) throw new PersonalFdrInputError("Each rating change needs a valid FPL team ID.");
      if (seenTeamIds.has(teamId)) {
        throw new PersonalFdrInputError("A team may only appear once in a rating save.");
      }
      seenTeamIds.add(teamId);
      return {
        teamId,
        homeRating: parseRating(change?.homeRating, "Home rating"),
        awayRating: parseRating(change?.awayRating, "Away rating"),
      };
    });
  }

  function normalizePersonalFdrRows(rows) {
    const ratingsByTeam = new Map();
    if (!Array.isArray(rows)) return ratingsByTeam;

    rows.forEach((row) => {
      const teamId = normalizeTeamId(row?.team_id ?? row?.teamId);
      if (!teamId || ratingsByTeam.has(teamId)) return;
      const homeRating = normalizeRating(row?.home_rating ?? row?.homeRating);
      const awayRating = normalizeRating(row?.away_rating ?? row?.awayRating);
      ratingsByTeam.set(teamId, { teamId, homeRating, awayRating });
    });
    return ratingsByTeam;
  }

  function ratingForTeam(ratingsByTeam, teamId) {
    const normalizedTeamId = normalizeTeamId(teamId);
    if (!normalizedTeamId || !(ratingsByTeam instanceof Map)) return null;
    const row = ratingsByTeam.get(normalizedTeamId);
    if (!row) return null;
    const homeRating = normalizeRating(row.homeRating ?? row.home_rating);
    const awayRating = normalizeRating(row.awayRating ?? row.away_rating);
    return { teamId: normalizedTeamId, homeRating, awayRating };
  }

  function resolvePersonalFixtureDifficulty(fixture, ratingsByTeam) {
    const opponent = ratingForTeam(ratingsByTeam, fixture?.opponent_id);
    if (!opponent || typeof fixture?.is_home !== "boolean") return null;
    return fixture.is_home ? opponent.awayRating : opponent.homeRating;
  }

  function buildPersonalFdrEditorRows(players, ratingsByTeam) {
    const teamsById = new Map();
    if (Array.isArray(players)) {
      players.forEach((player) => {
        const teamId = normalizeTeamId(player?.team_id);
        const name = typeof player?.team === "string" ? player.team.trim() : "";
        if (!teamId || !name || teamsById.has(teamId)) return;
        teamsById.set(teamId, {
          teamId,
          name,
          logo: typeof player?.logo === "string" ? player.logo : "",
        });
      });
    }

    return [...teamsById.values()]
      .sort((left, right) => left.name.localeCompare(right.name) || left.teamId - right.teamId)
      .map((team) => {
        const rating = ratingForTeam(ratingsByTeam, team.teamId);
        return {
          ...team,
          homeRating: rating?.homeRating ?? null,
          awayRating: rating?.awayRating ?? null,
        };
      });
  }

  return {
    MIN_RATING,
    MAX_RATING,
    PersonalFdrInputError,
    normalizeTeamId,
    normalizeRating,
    normalizePersonalFdrChanges,
    normalizePersonalFdrRows,
    resolvePersonalFixtureDifficulty,
    buildPersonalFdrEditorRows,
  };
});
