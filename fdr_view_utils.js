(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLFdrViewUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function buildFdrViewModel({ players = [], selectedTeams = [], sortMode = "avg" }) {
    const teamsByName = new Map();

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
        if (!fixturesByGameweek[fixture.gw]) fixturesByGameweek[fixture.gw] = [];
        fixturesByGameweek[fixture.gw].push(fixture);
        totalDifficulty += fixture.difficulty;
        fixtureCount++;
      });

      return {
        name: teamData.name,
        logo: teamData.logo,
        fixturesByGameweek,
        averageDifficulty: fixtureCount > 0 ? totalDifficulty / fixtureCount : 0,
      };
    });

    const hasTeamSelection = Array.isArray(selectedTeams) && selectedTeams.length > 0;
    const selectedRows = hasTeamSelection
      ? teams.filter((team) => selectedTeams.includes(team.name))
      : teams;

    const sortedTeams = selectedRows
      .map((team, sourceIndex) => ({ team, sourceIndex }))
      .sort((left, right) => {
        const comparison =
          sortMode === "avg"
            ? left.team.averageDifficulty - right.team.averageDifficulty
            : left.team.name.localeCompare(right.team.name);
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
