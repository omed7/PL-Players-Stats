(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLPlayerDetailChartUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function roundPercent(value) {
    return Number(value.toFixed(1));
  }

  function getBarClass({ metric, value, maximum }) {
    if (value <= 0) return "bar-zero";

    if (metric === "pts") {
      if (value >= 9) return "bar-high";
      if (value >= 6) return "bar-med";
      if (value >= 2) return "bar-low";
      return "bar-zero";
    }

    if (metric === "minutes") {
      return value >= 60 ? "bar-high" : "bar-med";
    }

    if (value > maximum * 0.6) return "bar-high";
    if (value > maximum * 0.2) return "bar-med";
    return "bar-low";
  }

  function formatChartValue(value) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  function buildFormChart({ matches = [], metric = "pts" } = {}) {
    const orderedMatches = Array.isArray(matches) ? matches : [];
    const values = orderedMatches.map((match) =>
      toFiniteNumber(match?.[metric]),
    );
    const maximum = Math.max(...values, 0.01);

    return {
      maximum,
      bars: orderedMatches.map((record, index) => {
        const value = values[index];
        const heightPercent = roundPercent(
          Math.min(Math.max((value / maximum) * 100, 0), 100),
        );
        return {
          record,
          value,
          heightPercent,
          barClass: getBarClass({ metric, value, maximum }),
          displayValue: formatChartValue(value),
        };
      }),
    };
  }

  return { buildFormChart, formatChartValue, getBarClass, toFiniteNumber };
});
