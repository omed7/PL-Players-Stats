(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLPlayerDetailSnapshotUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function toFiniteOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function formatFixed(value, digits) {
    return toFiniteNumber(value).toFixed(digits);
  }

  function periodLabelFor(timeframe) {
    if (timeframe === "last_5") return "Last 5 Matches";
    if (timeframe === "last_10") return "Last 10 Matches";
    return "This Season";
  }

  function buildAvailability(statusPct) {
    const percent =
      typeof statusPct === "number" &&
      Number.isFinite(statusPct) &&
      statusPct >= 0 &&
      statusPct <= 100
        ? statusPct
        : 100;

    if (percent >= 100) {
      return { kind: "available", percent, className: "avail-ok" };
    }

    const className =
      percent === 0
        ? "inj-0"
        : percent <= 25
          ? "inj-25"
          : percent <= 50
            ? "inj-50"
            : "inj-75";

    return { kind: "injured", percent, className };
  }

  function countTile(key, label, value) {
    const numericValue = toFiniteOrNull(value);
    return {
      key,
      label,
      value: numericValue,
      displayValue: numericValue === null ? "—" : String(numericValue),
    };
  }

  function rateTile(key, label, value, digits) {
    const numericValue = toFiniteNumber(value);
    return {
      key,
      label,
      value: numericValue,
      displayValue: numericValue.toFixed(digits),
    };
  }

  function buildSeasonTiles(player) {
    const source = player && typeof player === "object" ? player : {};
    const position = source.position;

    return [
      countTile("goals", "Goals", source.season_goals),
      countTile("assists", "Assists", source.season_assists),
      countTile("cleanSheets", "CS", source.season_clean_sheets),
      countTile("totalPoints", "Total Pts", source.season_points),
      rateTile("ppg", "PPG", source.season_ppg, 2),
      rateTile("form", "Form", source.season_form, 1),
      rateTile("xG", "xG", source.season_xG, 2),
      rateTile("xA", "xA", source.season_xA, 2),
      rateTile("xGI", "xGI", source.season_xGI, 2),
      rateTile("ict", "ICT", source.season_ict, 1),
      position === "GK"
        ? countTile("saves", "Saves", source.season_saves)
        : countTile("bonus", "Bonus", source.season_bonus),
      countTile("bps", "BPS", source.season_bps),
    ];
  }

  function pointsClassFor(points) {
    if (points >= 9) return "pts-high";
    if (points >= 6) return "pts-med";
    return "";
  }

  function buildMatchLogRows(matchHistory) {
    const records = Array.isArray(matchHistory) ? matchHistory : [];

    return records.map((record) => {
      const source = record && typeof record === "object" ? record : {};
      const points = toFiniteNumber(source.pts);
      const bonus = toFiniteNumber(source.bonus);
      return {
        record,
        points,
        pointsClass: pointsClassFor(points),
        xgDisplay: formatFixed(source.xG, 2),
        xaDisplay: formatFixed(source.xA, 2),
        minutesDisplay: `${toFiniteNumber(source.minutes)}'`,
        bonus,
      };
    });
  }

  function buildPlayerDetailSnapshot({
    player = {},
    prefix = "",
    timeframe = "season",
    matchHistory = [],
  } = {}) {
    const source = player && typeof player === "object" ? player : {};
    const points = toFiniteNumber(source[`${prefix}points`]);
    const xgi = toFiniteNumber(source[`${prefix}xGI`]);
    const minutes = toFiniteNumber(source[`${prefix}minutes`]);
    const minutesPercent = toFiniteNumber(source[`${prefix}min_pct`]);
    const price = source.price;
    const isValidPrice = typeof price === "number" && Number.isFinite(price) && price > 0;

    return {
      periodLabel: periodLabelFor(timeframe),
      availability: buildAvailability(source.status_pct),
      period: {
        points,
        xgi,
        xgiDisplay: xgi.toFixed(2),
        minutes,
        minutesPercent,
        pointsPerMillionDisplay: isValidPrice ? (points / price).toFixed(1) : "—",
      },
      seasonTiles: buildSeasonTiles(source),
      matchLogRows: buildMatchLogRows(matchHistory),
    };
  }

  return {
    buildAvailability,
    buildMatchLogRows,
    buildPlayerDetailSnapshot,
    buildSeasonTiles,
    periodLabelFor,
    pointsClassFor,
    toFiniteNumber,
  };
});
