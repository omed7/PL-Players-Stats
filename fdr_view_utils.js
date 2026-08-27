(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLFdrViewUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function buildFdrViewModel({ players = [], selectedTeams = [], sortMode = "avg", resolveDifficulty = null }) {
    const teamsByName = new Map();
    const usesPersonalDifficulty = typeof resolveDifficulty === "function";

    players.forEach((player) => {
      const team = player?.team;
      if (!team) return;

      if (!teamsByName.has(team)) {
        teamsByName.set(team, {
          name: team,
          logo: player.logo,
          fixtures: [],
        });
      }

      const teamData = teamsByName.get(team);
      if (teamData.fixtures.length === 0 && Array.isArray(player.fixtures)) {
        teamData.fixtures = player.fixtures;
      }
    });

    const gameweeks = new Set();
    teamsByName.forEach((teamData) => {
      teamData.fixtures.forEach((fixture) => gameweeks.add(fixture.gw));
    });

    const teams = Array.from(teamsByName.values()).map((teamData) => {
      const fixturesByGameweek = {};
      let totalDifficulty = 0;
      let fixtureCount = 0;

      teamData.fixtures.forEach((fixture) => {
        const displayDifficulty = usesPersonalDifficulty
          ? resolveDifficulty(fixture)
          : fixture.difficulty;
        const fixtureForView = usesPersonalDifficulty
          ? { ...fixture, displayDifficulty }
          : fixture;
        if (!fixturesByGameweek[fixture.gw]) fixturesByGameweek[fixture.gw] = [];
        fixturesByGameweek[fixture.gw].push(fixtureForView);

        const difficulty = Number(displayDifficulty);
        const maxDifficulty = usesPersonalDifficulty ? 7 : 5;
        if (Number.isInteger(difficulty) && difficulty >= 1 && difficulty <= maxDifficulty) {
          totalDifficulty += difficulty;
          fixtureCount++;
        }
      });

      return {
        name: teamData.name,
        logo: teamData.logo,
        fixturesByGameweek,
        averageDifficulty: fixtureCount > 0 ? totalDifficulty / fixtureCount : usesPersonalDifficulty ? null : 0,
      };
    });

    const hasTeamSelection = Array.isArray(selectedTeams) && selectedTeams.length > 0;
    const selectedRows = hasTeamSelection
      ? teams.filter((team) => selectedTeams.includes(team.name))
      : teams;

    const sortedTeams = selectedRows
      .map((team, sourceIndex) => ({ team, sourceIndex }))
      .sort((left, right) => {
        let comparison;
        if (sortMode === "avg") {
          const leftUnavailable = left.team.averageDifficulty === null;
          const rightUnavailable = right.team.averageDifficulty === null;
          comparison = leftUnavailable === rightUnavailable
            ? (leftUnavailable ? 0 : left.team.averageDifficulty - right.team.averageDifficulty)
            : (leftUnavailable ? 1 : -1);
        } else {
          comparison = left.team.name.localeCompare(right.team.name);
        }
        return comparison || left.sourceIndex - right.sourceIndex;
      })
      .map(({ team }) => team);

    return {
      gameweeks: Array.from(gameweeks).sort((a, b) => a - b),
      teams: sortedTeams,
    };
  }

  return { buildFdrViewModel };
});
