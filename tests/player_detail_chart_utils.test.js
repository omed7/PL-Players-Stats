const { buildFormChart } = require("../player_detail_chart_utils.js");

function chart(matches, metric) {
  return buildFormChart({ matches, metric });
}

describe("player-detail form-chart utilities", () => {
  test("preserves supplied match order and current points threshold classes", () => {
    const matches = [
      { fixture_id: 11, pts: 9 },
      { fixture_id: 12, pts: 6 },
      { fixture_id: 13, pts: 2 },
      { fixture_id: 14, pts: 0 },
    ];

    const result = chart(matches, "pts");

    expect(result.maximum).toBe(9);
    expect(result.bars.map(({ record, value, heightPercent, barClass, displayValue }) => ({
      fixture_id: record.fixture_id,
      value,
      heightPercent,
      barClass,
      displayValue,
    }))).toEqual([
      { fixture_id: 11, value: 9, heightPercent: 100, barClass: "bar-high", displayValue: "9" },
      { fixture_id: 12, value: 6, heightPercent: 66.7, barClass: "bar-med", displayValue: "6" },
      { fixture_id: 13, value: 2, heightPercent: 22.2, barClass: "bar-low", displayValue: "2" },
      { fixture_id: 14, value: 0, heightPercent: 0, barClass: "bar-zero", displayValue: "0" },
    ]);
  });

  test("uses the existing minutes thresholds at 60, positive, and zero", () => {
    const result = chart(
      [
        { fixture_id: 21, minutes: 60 },
        { fixture_id: 22, minutes: 1 },
        { fixture_id: 23, minutes: 0 },
      ],
      "minutes",
    );

    expect(result.maximum).toBe(60);
    expect(result.bars.map(({ barClass, heightPercent }) => ({ barClass, heightPercent }))).toEqual([
      { barClass: "bar-high", heightPercent: 100 },
      { barClass: "bar-med", heightPercent: 1.7 },
      { barClass: "bar-zero", heightPercent: 0 },
    ]);
  });

  test("uses the existing generic-metric thresholds relative to the active maximum", () => {
    const result = chart(
      [
        { fixture_id: 31, xG: 10 },
        { fixture_id: 32, xG: 6.01 },
        { fixture_id: 33, xG: 2.01 },
        { fixture_id: 34, xG: 2 },
        { fixture_id: 35, xG: 0 },
      ],
      "xG",
    );

    expect(result.bars.map(({ barClass, heightPercent }) => ({ barClass, heightPercent }))).toEqual([
      { barClass: "bar-high", heightPercent: 100 },
      { barClass: "bar-high", heightPercent: 60.1 },
      { barClass: "bar-med", heightPercent: 20.1 },
      { barClass: "bar-low", heightPercent: 20 },
      { barClass: "bar-zero", heightPercent: 0 },
    ]);
  });

  test("uses the zero-safe maximum floor and finite zero bars for empty, missing, invalid, and negative values", () => {
    const result = chart(
      [
        { fixture_id: 41, influence: undefined },
        { fixture_id: 42, influence: "invalid" },
        { fixture_id: 43, influence: -2 },
      ],
      "influence",
    );

    expect(result.maximum).toBe(0.01);
    expect(result.bars.map(({ value, heightPercent, barClass, displayValue }) => ({
      value,
      heightPercent,
      barClass,
      displayValue,
    }))).toEqual([
      { value: 0, heightPercent: 0, barClass: "bar-zero", displayValue: "0" },
      { value: 0, heightPercent: 0, barClass: "bar-zero", displayValue: "0" },
      { value: -2, heightPercent: 0, barClass: "bar-zero", displayValue: "-2" },
    ]);

    expect(chart([], "pts")).toEqual({ maximum: 0.01, bars: [] });
  });

  test("formats decimal values to two places while retaining integer display values", () => {
    const result = chart(
      [
        { fixture_id: 51, bonus: 2 },
        { fixture_id: 52, bonus: 1.234 },
      ],
      "bonus",
    );

    expect(result.bars.map(({ displayValue }) => displayValue)).toEqual(["2", "1.23"]);
  });
});
