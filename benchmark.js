const { performance } = require("perf_hooks");

// Setup mock state and data to match script.js
const state = {
  players: [],
  filteredPlayers: [],
  timeframe: "last_5",
  sortColumn: "xG",
  sortDirection: "desc",
  searchQuery: "John",
  positionFilter: "All",
  selectedTeams: ["ARS", "MCI", "CHE", "LIV", "MUN"],
  currentPage: 1,
  itemsPerPage: 15,
};

// Mock elements needed by applyFiltersAndSort
const elements = {
  minutesToggle: { checked: false },
  minutesSlider: { value: "0" },
};

// Generate 100,000 mock players to simulate a heavy load
for (let i = 0; i < 100000; i++) {
  state.players.push({
    name: `Player ${i} John Doe`,
    team: state.selectedTeams[i % state.selectedTeams.length],
    position: ["FWD", "MID", "DEF", "GK"][i % 4],
    last_5_minutes: Math.floor(Math.random() * 450) + 1, // ensure > 0
    last_10_minutes: Math.floor(Math.random() * 900) + 1,
    last_5_xG: Math.random() * 5,
    last_10_xG: Math.random() * 10,
  });
}

// Dummy functions to replace UI updates
function updatePagination() {}
function renderTable() {}

function applyFiltersAndSortBaseline() {
  // 1. Filter
  state.filteredPlayers = state.players.filter((player) => {
    const prefix = state.timeframe === "last_5" ? "last_5_" : "last_10_";
    const minutes =
      player[`${prefix}minutes`] !== undefined ? player[`${prefix}minutes`] : 0;

    if (minutes === 0) return false;

    const isPctMode = elements.minutesToggle.checked;
    const sliderValue = parseInt(elements.minutesSlider.value, 10);
    let min_pct = 0;

    if (state.timeframe === "last_5") {
      min_pct = Math.round((minutes / 450) * 100);
    } else {
      min_pct = Math.round((minutes / 900) * 100);
    }

    if (isPctMode) {
      if (min_pct < sliderValue) return false;
    } else {
      if (minutes < sliderValue) return false;
    }

    // --- INEFFICIENCY HERE ---
    const matchesSearch = player.name
      .toLowerCase()
      .includes(state.searchQuery.toLowerCase());
    const matchesTeam =
      state.selectedTeams.length === 0 ||
      state.selectedTeams.includes(player.team);
    const matchesPosition =
      state.positionFilter === "All" ||
      player.position === state.positionFilter;
    return matchesSearch && matchesTeam && matchesPosition;
  });

  // 2. Sort
  state.filteredPlayers.sort((a, b) => {
    let valA, valB;

    if (state.sortColumn === "name") {
      valA = a[state.sortColumn].toLowerCase();
      valB = b[state.sortColumn].toLowerCase();
    } else {
      const prefix = state.timeframe === "last_5" ? "last_5_" : "last_10_";
      valA = a[`${prefix}${state.sortColumn}`];
      valB = b[`${prefix}${state.sortColumn}`];
    }

    if (valA < valB) return state.sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return state.sortDirection === "asc" ? 1 : -1;
    return 0;
  });
}

// Warmup
for (let i = 0; i < 10; i++) {
  applyFiltersAndSortBaseline();
}

// Benchmark Baseline
const iterations = 100;
let totalTime = 0;

for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  applyFiltersAndSortBaseline();
  const end = performance.now();
  totalTime += end - start;
}

const avgTime = totalTime / iterations;
console.log(
  `Baseline Average Time (100 iterations, 100k players): ${avgTime.toFixed(2)} ms`,
);

function applyFiltersAndSortOptimized() {
  // 1. Filter
  const searchQueryLower = (state.searchQuery || "").toLowerCase();
  const isAllTeamsSelected = state.selectedTeams.length === 0;
  const isAllPositionsSelected = state.positionFilter === "All";
  const isPctMode = elements.minutesToggle.checked;
  const sliderValue = parseInt(elements.minutesSlider.value, 10);
  const prefix = state.timeframe === "last_5" ? "last_5_" : "last_10_";
  const maxMinutes = state.timeframe === "last_5" ? 450 : 900;

  state.filteredPlayers = state.players.filter((player) => {
    const minutes =
      player[`${prefix}minutes`] !== undefined ? player[`${prefix}minutes`] : 0;

    if (minutes === 0) return false;

    if (isPctMode) {
      const min_pct = Math.round((minutes / maxMinutes) * 100);
      if (min_pct < sliderValue) return false;
    } else {
      if (minutes < sliderValue) return false;
    }

    const matchesSearch = player.name.toLowerCase().includes(searchQueryLower);
    const matchesTeam =
      isAllTeamsSelected || state.selectedTeams.includes(player.team);
    const matchesPosition =
      isAllPositionsSelected || player.position === state.positionFilter;
    return matchesSearch && matchesTeam && matchesPosition;
  });

  // 2. Sort
  state.filteredPlayers.sort((a, b) => {
    let valA, valB;

    if (state.sortColumn === "name") {
      valA = a[state.sortColumn].toLowerCase();
      valB = b[state.sortColumn].toLowerCase();
    } else {
      const prefix = state.timeframe === "last_5" ? "last_5_" : "last_10_";
      valA = a[`${prefix}${state.sortColumn}`];
      valB = b[`${prefix}${state.sortColumn}`];
    }

    if (valA < valB) return state.sortDirection === "asc" ? -1 : 1;
    if (valA > valB) return state.sortDirection === "asc" ? 1 : -1;
    return 0;
  });
}

// Warmup
for (let i = 0; i < 10; i++) {
  applyFiltersAndSortOptimized();
}

// Benchmark Optimized
let totalTimeOpt = 0;

for (let i = 0; i < iterations; i++) {
  const start = performance.now();
  applyFiltersAndSortOptimized();
  const end = performance.now();
  totalTimeOpt += end - start;
}

const avgTimeOpt = totalTimeOpt / iterations;
console.log(
  `Optimized Average Time (100 iterations, 100k players): ${avgTimeOpt.toFixed(2)} ms`,
);
const improvement = ((avgTime - avgTimeOpt) / avgTime) * 100;
console.log(`Improvement: ${improvement.toFixed(2)}%`);
