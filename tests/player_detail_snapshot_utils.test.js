const { buildPlayerDetailSnapshot } = require("../player_detail_snapshot_utils.js");

const basePlayer = {
  position: "DEF",
  price: 4.5,
  status_pct: 100,
  last_5_points: 17,
  last_5_xGI: 1.68,
  last_5_minutes: 77,
  last_5_min_pct: 86,
  last_10_points: 24,
  last_10_xGI: 2.345,
  last_10_minutes: 155,
  last_10_min_pct: 91,
  season_points: 44,
  season_xGI: 4.567,
  season_minutes: 502,
  season_min_pct: 88,
  season_goals: 3,
  season_assists: 4,
  season_clean_sheets: 5,
  season_ppg: 4.4,
  season_form: 5.55,
  season_xG: 2.345,
  season_xA: 2.222,
  season_ict: 12.34,
  season_bonus: 6,
  season_bps: 123,
};

function snapshot({ player = basePlayer, prefix = "last_5_", timeframe = "last_5", matchHistory = [] } = {}) {
  return buildPlayerDetailSnapshot({ player, prefix, timeframe, matchHistory });
}

describe("player-detail snapshot utilities", () => {
  test("preserves existing timeframe labels and current-period display values", () => {
    const lastFive = snapshot();
    const lastTen = snapshot({ prefix: "last_10_", timeframe: "last_10" });
    const season = snapshot({ prefix: "season_", timeframe: "season" });

    expect(lastFive.periodLabel).toBe("Last 5 Matches");
    expect(lastFive.period).toEqual({
      points: 17,
      xgi: 1.68,
      xgiDisplay: "1.68",
      minutes: 77,
      minutesPercent: 86,
      pointsPerMillionDisplay: "3.8",
    });
    expect(lastTen.periodLabel).toBe("Last 10 Matches");
    expect(lastTen.period).toEqual({
      points: 24,
      xgi: 2.345,
      xgiDisplay: "2.35",
      minutes: 155,
      minutesPercent: 91,
      pointsPerMillionDisplay: "5.3",
    });
    expect(season.periodLabel).toBe("This Season");
    expect(season.period).toEqual({
      points: 44,
      xgi: 4.567,
      xgiDisplay: "4.57",
      minutes: 502,
      minutesPercent: 88,
      pointsPerMillionDisplay: "9.8",
    });
  });

  test("uses finite zero fallbacks and the existing em dash for zero, missing, or invalid price", () => {
    const zeroPrice = snapshot({
      player: {
        ...basePlayer,
        price: 0,
        last_5_points: "invalid",
        last_5_xGI: Infinity,
        last_5_minutes: undefined,
        last_5_min_pct: NaN,
      },
    });
    const invalidPrice = snapshot({ player: { ...basePlayer, price: "4.5" } });

    expect(zeroPrice.period).toEqual({
      points: 0,
      xgi: 0,
      xgiDisplay: "0.00",
      minutes: 0,
      minutesPercent: 0,
      pointsPerMillionDisplay: "—",
    });
    expect(invalidPrice.period.pointsPerMillionDisplay).toBe("—");
  });

  test("preserves existing valid availability bands and treats invalid status as available-compatible", () => {
    const cases = [
      [0, { kind: "injured", percent: 0, className: "inj-0" }],
      [25, { kind: "injured", percent: 25, className: "inj-25" }],
      [50, { kind: "injured", percent: 50, className: "inj-50" }],
      [75, { kind: "injured", percent: 75, className: "inj-75" }],
      [99, { kind: "injured", percent: 99, className: "inj-75" }],
      [100, { kind: "available", percent: 100, className: "avail-ok" }],
      ["invalid", { kind: "available", percent: 100, className: "avail-ok" }],
    ];

    for (const [statusPct, expected] of cases) {
      expect(snapshot({ player: { ...basePlayer, status_pct: statusPct } }).availability).toEqual(expected);
    }
  });

  test("preserves season tile labels, precision, and GK Saves versus outfield Bonus", () => {
    const defender = snapshot();
    const goalkeeper = snapshot({
      player: { ...basePlayer, position: "GK", season_saves: 55, season_bonus: 99 },
    });

    expect(defender.seasonTiles).toEqual([
      { key: "goals", label: "Goals", value: 3, displayValue: "3" },
      { key: "assists", label: "Assists", value: 4, displayValue: "4" },
      { key: "cleanSheets", label: "CS", value: 5, displayValue: "5" },
      { key: "totalPoints", label: "Total Pts", value: 44, displayValue: "44" },
      { key: "ppg", label: "PPG", value: 4.4, displayValue: "4.40" },
      { key: "form", label: "Form", value: 5.55, displayValue: "5.5" },
      { key: "xG", label: "xG", value: 2.345, displayValue: "2.35" },
      { key: "xA", label: "xA", value: 2.222, displayValue: "2.22" },
      { key: "xGI", label: "xGI", value: 4.567, displayValue: "4.57" },
      { key: "ict", label: "ICT", value: 12.34, displayValue: "12.3" },
      { key: "bonus", label: "Bonus", value: 6, displayValue: "6" },
      { key: "bps", label: "BPS", value: 123, displayValue: "123" },
    ]);
    expect(goalkeeper.seasonTiles[10]).toEqual({
      key: "saves",
      label: "Saves",
      value: 55,
      displayValue: "55",
    });
  });

  test("uses missing-safe count tiles and finite rate tiles for malformed season values", () => {
    const result = snapshot({
      player: {
        ...basePlayer,
        season_goals: undefined,
        season_assists: "invalid",
        season_ppg: Infinity,
        season_form: "invalid",
        season_xG: undefined,
      },
    });

    expect(result.seasonTiles.slice(0, 2)).toEqual([
      { key: "goals", label: "Goals", value: null, displayValue: "—" },
      { key: "assists", label: "Assists", value: null, displayValue: "—" },
    ]);
    expect(result.seasonTiles.slice(4, 7)).toEqual([
      { key: "ppg", label: "PPG", value: 0, displayValue: "0.00" },
      { key: "form", label: "Form", value: 0, displayValue: "0.0" },
      { key: "xG", label: "xG", value: 0, displayValue: "0.00" },
    ]);
  });

  test("preserves supplied match-log order, raw record associations, bands, and display precision", () => {
    const first = { fixture_id: 41, pts: 9, xG: 1.234, xA: 0.1, minutes: 77, bonus: 2 };
    const second = { fixture_id: 42, pts: 6, xG: 0.005, xA: 0.456, minutes: 90, bonus: 1 };
    const third = { fixture_id: 43, pts: 1, xG: "invalid", xA: Infinity, minutes: undefined, bonus: "invalid" };

    const result = snapshot({ matchHistory: [first, second, third] });

    expect(result.matchLogRows).toEqual([
      {
        record: first,
        points: 9,
        pointsClass: "pts-high",
        xgDisplay: "1.23",
        xaDisplay: "0.10",
        minutesDisplay: "77'",
        bonus: 2,
      },
      {
        record: second,
        points: 6,
        pointsClass: "pts-med",
        xgDisplay: "0.01",
        xaDisplay: "0.46",
        minutesDisplay: "90'",
        bonus: 1,
      },
      {
        record: third,
        points: 1,
        pointsClass: "",
        xgDisplay: "0.00",
        xaDisplay: "0.00",
        minutesDisplay: "0'",
        bonus: 0,
      },
    ]);
    expect(snapshot().matchLogRows).toEqual([]);
  });
});
