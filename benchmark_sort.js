const { performance } = require("perf_hooks");

const players = [];
const teams = ["ARS", "MCI", "CHE", "LIV", "MUN"];
const positions = ["FWD", "MID", "DEF", "GK"];
for (let i = 0; i < 100000; i++) {
  players.push({
    name: `Player ${i} John Doe`,
    team: teams[i % teams.length],
    position: positions[i % 4],
    last_5_minutes: Math.floor(Math.random() * 450) + 1,
    last_10_minutes: Math.floor(Math.random() * 900) + 1,
    last_5_xG: Math.random() * 5,
    last_10_xG: Math.random() * 10,
  });
}

function runSortBaseline(data, sortColumn, sortDirection, timeframe) {
  const arr = [...data];
  arr.sort((a, b) => {
    let valA, valB;

    if (sortColumn === "name") {
      valA = a[sortColumn].toLowerCase();
      valB = b[sortColumn].toLowerCase();
    } else {
      const prefix = timeframe === "last_5" ? "last_5_" : "last_10_";
      valA = a[`${prefix}${sortColumn}`];
      valB = b[`${prefix}${sortColumn}`];
    }

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
  return arr;
}

function runSortOptimized(data, sortColumn, sortDirection, timeframe) {
  const arr = [...data];

  const isNameSort = sortColumn === "name";
  const metricPrefix = timeframe === "last_5" ? "last_5_" : "last_10_";
  const metricKey = isNameSort ? null : `${metricPrefix}${sortColumn}`;

  arr.sort((a, b) => {
    let valA, valB;

    if (isNameSort) {
      valA = a.name_lower;
      valB = b.name_lower;
    } else {
      valA = a[metricKey];
      valB = b[metricKey];
    }

    if (valA < valB) return sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
  return arr;
}

const playersOpt = players.map((p) => ({
  ...p,
  name_lower: p.name.toLowerCase(),
}));

const iterations = 50;

let totalNameBaseline = 0;
for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  runSortBaseline(players, "name", "asc", "last_5");
  totalNameBaseline += performance.now() - start;
}
const avgNameBaseline = totalNameBaseline / iterations;

let totalNameOpt = 0;
for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  runSortOptimized(playersOpt, "name", "asc", "last_5");
  totalNameOpt += performance.now() - start;
}
const avgNameOpt = totalNameOpt / iterations;

console.log(`--- Name Sorting (100k items) ---`);
console.log(`Baseline Avg: ${avgNameBaseline.toFixed(2)} ms`);
console.log(`Optimized Avg: ${avgNameOpt.toFixed(2)} ms`);
console.log(
  `Improvement: ${(((avgNameBaseline - avgNameOpt) / avgNameBaseline) * 100).toFixed(2)}%`,
);

let totalMetricBaseline = 0;
for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  runSortBaseline(players, "xG", "desc", "last_5");
  totalMetricBaseline += performance.now() - start;
}
const avgMetricBaseline = totalMetricBaseline / iterations;

let totalMetricOpt = 0;
for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  runSortOptimized(playersOpt, "xG", "desc", "last_5");
  totalMetricOpt += performance.now() - start;
}
const avgMetricOpt = totalMetricOpt / iterations;

console.log(`\n--- Metric Sorting (100k items) ---`);
console.log(`Baseline Avg: ${avgMetricBaseline.toFixed(2)} ms`);
console.log(`Optimized Avg: ${avgMetricOpt.toFixed(2)} ms`);
console.log(
  `Improvement: ${(((avgMetricBaseline - avgMetricOpt) / avgMetricBaseline) * 100).toFixed(2)}%`,
);
