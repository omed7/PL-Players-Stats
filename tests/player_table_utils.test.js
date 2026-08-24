const {
  getTableColumnVisibility,
  buildPlayerTableRowMetrics,
} = require("../player_table_utils.js");

describe("player table rendering utilities", () => {
  test("preserves goalkeeper and season column-visibility rules", () => {
    expect(
      getTableColumnVisibility({ positionFilter: "GK", timeframe: "season" }),
    ).toEqual({
      saves: true,
      xG: false,
      xA: false,
      xGI: false,
      influence: false,
      creativity: false,
      threat: false,
      ict: false,
      defcon: false,
      goals: false,
      assists: false,
      cleanSheets: true,
      ppg: true,
    });

    expect(
      getTableColumnVisibility({ positionFilter: "All", timeframe: "last_5" }),
    ).toEqual({
      saves: false,
      xG: true,
      xA: true,
      xGI: true,
      influence: true,
      creativity: true,
      threat: true,
      ict: true,
      defcon: true,
      goals: true,
      assists: true,
      cleanSheets: false,
      ppg: false,
    });
  });

  test("builds existing last-five metric precision for a populated outfield player", () => {
    const result = buildPlayerTableRowMetrics({
      prefix: "last_5_",
      maxMinutes: 450,
      player: {
        price: 6.5,
        ownership: 12.4,
        last_5_minutes: 360,
        last_5_min_pct: 80,
        last_5_saves: 0,
        last_5_defcon: 4,
        last_5_xG: 1.236,
        last_5_xA: 0.118,
        last_5_xGI: 1.354,
        last_5_influence: 23.46,
        last_5_creativity: 10.04,
        last_5_threat: 45.65,
        last_5_ict: 7.86,
        last_5_bps: 12,
        last_5_bonus: 3,
        last_5_points: 12,
        last_5_goals: 2,
        last_5_assists: 1,
        last_5_clean_sheets: 1,
        last_5_ppg: 2.345,
      },
    });

    expect(result).toEqual({
      minutes: 360,
      minPct: 80,
      saves: 0,
      defcon: 4,
      xG: "1.24",
      xA: "0.12",
      xGI: "1.35",
      influence: "23.5",
      creativity: "10.0",
      threat: "45.6",
      ict: "7.9",
      bps: 12,
      bonus: 3,
      points: 12,
      goals: 2,
      assists: 1,
      cleanSheets: 1,
      ppg: "2.35",
      value: "1.8",
      ownership: 12.4,
    });
  });

  test("uses existing zero-safe fallbacks when optional metrics, minutes percentage, or price are absent", () => {
    const result = buildPlayerTableRowMetrics({
      prefix: "season_",
      maxMinutes: 3420,
      player: { season_minutes: 0, price: 0 },
    });

    expect(result).toEqual({
      minutes: 0,
      minPct: 0,
      saves: 0,
      defcon: 0,
      xG: "0.00",
      xA: "0.00",
      xGI: "0.00",
      influence: "0.0",
      creativity: "0.0",
      threat: "0.0",
      ict: "0.0",
      bps: 0,
      bonus: 0,
      points: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      ppg: "0.00",
      value: "0.0",
      ownership: "0.0",
    });
  });
});
