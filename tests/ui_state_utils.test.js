const { classifyDashboardState } = require("../ui_state_utils.js");

describe("dashboard UI state classification", () => {
  test.each([
    [
      { loadError: true, isPreseason: true, filteredPlayerCount: 0 },
      "error",
      "load errors take precedence over all other states",
    ],
    [
      { loadError: false, isPreseason: true, filteredPlayerCount: 0 },
      "preseason",
      "valid preseason data is distinct from no results",
    ],
    [
      { loadError: false, isPreseason: false, filteredPlayerCount: 0 },
      "no_results",
      "an empty filtered set outside preseason is no results",
    ],
    [
      { loadError: false, isPreseason: false, filteredPlayerCount: 1 },
      "ready",
      "a non-empty filtered set is ready to render",
    ],
  ])("returns %s when %s", (input, expected) => {
    expect(classifyDashboardState(input)).toBe(expected);
  });

  test("defaults to no results when no state inputs are supplied", () => {
    expect(classifyDashboardState()).toBe("no_results");
  });
});
