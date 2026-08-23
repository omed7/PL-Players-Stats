const { prepareDashboardData } = require("../dashboard_data_utils.js");

describe("dashboard data quality gate", () => {
  const now = Date.parse("2026-08-24T12:00:00Z");

  test("prepares compatible populated data with finite slider bounds and a ready state", () => {
    const result = prepareDashboardData({
      now,
      classified: {
        compatible: true,
        source: "supabase",
        schemaVersion: 2,
        dataset: {
          players: [{ element_id: 1, price: 4.45 }, { element_id: 2, price: 15.5 }],
          next_gws: [2, 3],
          current_gw: 1,
          deadline: "2026-08-28T17:30:00Z",
          fetched_at: "2026-08-24T11:55:00Z",
        },
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        players: expect.any(Array),
        source: "supabase",
        schemaVersion: 2,
        currentGW: 1,
        isPreseason: false,
        dashboardState: "ready",
        minPriceSlider: 30,
        maxPriceSlider: 155,
      }),
    );
  });

  test("classifies a valid zero-player opening-gameweek snapshot as preseason", () => {
    const result = prepareDashboardData({
      now,
      classified: {
        compatible: true,
        source: "supabase",
        schemaVersion: 2,
        dataset: {
          players: [],
          current_gw: 1,
          deadline: "2026-08-28T17:30:00Z",
        },
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        dashboardState: "preseason",
        isPreseason: true,
        minPriceSlider: 30,
        maxPriceSlider: 150,
      }),
    );
  });

  test("does not label an arbitrary empty dataset as preseason", () => {
    const result = prepareDashboardData({
      now,
      classified: {
        compatible: true,
        source: "static",
        schemaVersion: 2,
        dataset: { players: [], current_gw: 2, deadline: "2026-09-04T17:30:00Z" },
      },
    });

    expect(result).toEqual(expect.objectContaining({ dashboardState: "no_results", isPreseason: false }));
  });

  test("rejects incompatible and malformed reader results before the controller mutates state", () => {
    expect(() => prepareDashboardData({ now, classified: { compatible: false } })).toThrow(
      "Player dataset is incompatible",
    );
    expect(() =>
      prepareDashboardData({
        now,
        classified: { compatible: true, dataset: { players: "not-an-array" } },
      }),
    ).toThrow("Player dataset is malformed");
  });
});
