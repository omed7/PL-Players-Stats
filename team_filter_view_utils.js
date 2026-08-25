(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLTeamFilterViewUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function selectionPresentation(selectedTeams) {
    const count = selectedTeams.length;

    return {
      count,
      hasSelection: count > 0,
      label: count === 1 ? `Team: ${selectedTeams[0]}` : "Filter by Team",
      countLabel: count > 1 ? `${count} selected` : "",
    };
  }

  function buildTeamFilterViewModel({ players = [], selectedTeams = [] } = {}) {
    const teamSelection = Array.isArray(selectedTeams) ? selectedTeams : [];
    const teamItems = Array.from(
      new Map(
        (Array.isArray(players) ? players : []).map((player) => [
          player.team,
          { name: player.team, logo: player.logo },
        ]),
      ).values(),
    )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((team) => ({
        ...team,
        selected: teamSelection.includes(team.name),
      }));

    return {
      teams: teamItems,
      selection: selectionPresentation(teamSelection),
    };
  }

  function toggleTeamFilterSelection({ selectedTeams = [], teamName } = {}) {
    const teamSelection = Array.isArray(selectedTeams) ? selectedTeams : [];

    if (!teamSelection.length) return { selectedTeams: [teamName] };
    if (teamSelection.includes(teamName)) {
      return { selectedTeams: teamSelection.filter((team) => team !== teamName) };
    }
    return { selectedTeams: [...teamSelection, teamName] };
  }

  return {
    buildTeamFilterViewModel,
    toggleTeamFilterSelection,
  };
});
