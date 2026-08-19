(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.FPLFixtureUtils = api;
})(typeof window !== "undefined" ? window : null, function () {
  function groupFixturesByGameweek(fixtures) {
    return (fixtures || []).reduce((byGameweek, fixture) => {
      const gameweek = Number(fixture?.gw);
      if (!Number.isFinite(gameweek) || gameweek <= 0) return byGameweek;
      if (!byGameweek[gameweek]) byGameweek[gameweek] = [];
      byGameweek[gameweek].push(fixture);
      return byGameweek;
    }, {});
  }

  function classifyFixtureSlot(fixtures) {
    const knownFixtures = Array.isArray(fixtures) ? fixtures.filter(Boolean) : [];
    if (knownFixtures.length > 0) {
      return { status: "known", fixtures: knownFixtures };
    }

    // A missing fixture record may be a confirmed blank, delayed API assignment,
    // partial source response, or an unassigned future event. It is therefore unknown.
    return { status: "unknown", fixtures: [] };
  }

  function upcomingGameweeksFromPlayers(players, limit) {
    const gameweeks = new Set();
    (players || []).forEach((player) => {
      (player.fixtures || []).forEach((fixture) => {
        const gameweek = Number(fixture?.gw);
        if (Number.isFinite(gameweek) && gameweek > 0) gameweeks.add(gameweek);
      });
    });
    const sorted = Array.from(gameweeks).sort((a, b) => a - b);
    return Number.isFinite(limit) ? sorted.slice(0, limit) : sorted;
  }

  return {
    classifyFixtureSlot,
    groupFixturesByGameweek,
    upcomingGameweeksFromPlayers,
  };
});
