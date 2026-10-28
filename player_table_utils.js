(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLPlayerTableUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function getPlayerMinutesPercentage({ prefix, maxMinutes, player }) {
    return player[`${prefix}min_pct`] ?? Math.round(
      numberOrZero(player[`${prefix}minutes`]) / Math.max(numberOrZero(maxMinutes), 1) * 100,
    );
  }

  function getTableColumnVisibility({ positionFilter, timeframe }) {
    const isGK = positionFilter === "GK";
    const isSeason = timeframe === "season";
    return {
      saves: isGK,
      xG: !isGK,
      xA: !isGK,
      xGI: !isGK,
      influence: !isGK,
      creativity: !isGK,
      threat: !isGK,
      ict: !isGK,
      defcon: !isGK && !isSeason,
      goals: !isGK,
      assists: !isGK,
      cleanSheets: isSeason,
      ppg: isSeason,
    };
  }

  function buildPlayerTableRowMetrics({ prefix, maxMinutes, player }) {
    const field = (name) => player[`${prefix}${name}`];
    const minutes = field("minutes") ?? 0;
    const points = field("points") ?? 0;
    const price = numberOrZero(player.price);

    return {
      minutes,
      minPct: getPlayerMinutesPercentage({ prefix, maxMinutes, player }),
      saves: field("saves") ?? 0,
      defcon: field("defcon") ?? 0,
      xG: numberOrZero(field("xG")).toFixed(2),
      xA: numberOrZero(field("xA")).toFixed(2),
      xGI: numberOrZero(field("xGI")).toFixed(2),
      influence: numberOrZero(field("influence")).toFixed(1),
      creativity: numberOrZero(field("creativity")).toFixed(1),
      threat: numberOrZero(field("threat")).toFixed(1),
      ict: numberOrZero(field("ict")).toFixed(1),
      bps: field("bps") ?? 0,
      bonus: field("bonus") ?? 0,
      points,
      goals: field("goals") ?? 0,
      assists: field("assists") ?? 0,
      cleanSheets: field("clean_sheets") ?? 0,
      ppg: numberOrZero(field("ppg")).toFixed(2),
      value: price > 0 ? (numberOrZero(points) / price).toFixed(1) : "0.0",
      ownership: player.ownership ?? "0.0",
    };
  }

  return { getPlayerMinutesPercentage, getTableColumnVisibility, buildPlayerTableRowMetrics };
});
