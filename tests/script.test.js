const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.resolve(__dirname, "../index.html"), "utf8");

describe("fetchPlayers", () => {
  let script;

  beforeEach(() => {
    // Set up the DOM
    document.body.innerHTML = html;

    // Require the script so it can bind to the DOM elements
    jest.isolateModules(() => {
      script = require("../script.js");
    });

    // Mock fetch
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("should fetch players.json and update the global state", async () => {
    const dummyPlayers = [
      {
        name: "Erling Haaland",
        team: "MCI",
        logo: "mci-logo.png",
        position: "FWD",
        price: 14.0,
        status_pct: 100,
        last_5_minutes: 450,
        last_5_saves: 0,
        last_5_defcon: 0,
        last_5_xG: 4.5,
        last_5_xA: 0.5,
        last_5_xGI: 5.0,
        last_5_xGC: 0,
        last_5_creativity: 10,
        last_5_threat: 50,
        last_5_ict: 20,
        last_5_bps: 100,
        last_5_bonus: 5,
        last_5_points: 40,
      },
    ];

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => dummyPlayers,
    });

    await script.fetchPlayers();

    expect(global.fetch).toHaveBeenCalledWith("players.json");
    const expectedPlayers = dummyPlayers.map((p) => ({
      ...p,
      name_lower: p.name.toLowerCase(),
    }));
    expect(script.state.players).toEqual(expectedPlayers);
  });

  it("should show an error message if fetch fails", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await script.fetchPlayers();

    expect(global.fetch).toHaveBeenCalledWith("players.json");
    expect(script.state.players).toEqual([]);
    expect(script.elements.errorMessage.classList.contains("hidden")).toBe(
      false,
    );
    expect(script.elements.errorMessage.textContent).toContain(
      "Failed to load player data",
    );

    consoleErrorSpy.mockRestore();
  });

  it("should catch and log network errors and show error message", async () => {
    global.fetch.mockRejectedValueOnce(new Error("Network Error"));

    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    await script.fetchPlayers();

    expect(global.fetch).toHaveBeenCalledWith("players.json");
    expect(script.state.players).toEqual([]);
    expect(script.elements.errorMessage.classList.contains("hidden")).toBe(
      false,
    );
    expect(script.elements.errorMessage.textContent).toContain(
      "Failed to load player data",
    );

    consoleErrorSpy.mockRestore();
  });
});

describe("applyFiltersAndSort", () => {
  let script;

  beforeEach(() => {
    document.body.innerHTML = html;
    jest.isolateModules(() => {
      script = require("../script.js");
    });

    // Setup some dummy data
    const dummyStats = {
      last_5_xA: 0.0,
      last_5_creativity: 0.0,
      last_5_threat: 0.0,
      last_5_points: 0,
      price: 5.0,
      status_pct: 100,
      logo: "dummy.png",
    };
    script.state.players = [
      {
        name: "Saka",
        name_lower: "saka",
        team: "ARS",
        position: "MID",
        last_5_minutes: 450,
        last_5_xG: 2.0,
        ...dummyStats,
      },
      {
        name: "Odegaard",
        name_lower: "odegaard",
        team: "ARS",
        position: "MID",
        last_5_minutes: 400,
        last_5_xG: 1.5,
        ...dummyStats,
      },
      {
        name: "Haaland",
        name_lower: "haaland",
        team: "MCI",
        position: "FWD",
        last_5_minutes: 300,
        last_5_xG: 4.0,
        ...dummyStats,
      },
      {
        name: "ZeroMins",
        name_lower: "zeromins",
        team: "CHE",
        position: "DEF",
        last_5_minutes: 0,
        last_5_xG: 0.0,
        ...dummyStats,
      },
    ];
    script.state.timeframe = "last_5";
    script.state.selectedTeams = ["ARS", "MCI", "CHE"];
    script.elements.minutesSlider.value = 0;
    script.elements.minutesToggle.checked = false;
  });

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("should completely hide players with 0 minutes", () => {
    script.applyFiltersAndSort();
    expect(script.state.filteredPlayers.length).toBe(3);
    expect(
      script.state.filteredPlayers.find((p) => p.name === "ZeroMins"),
    ).toBeUndefined();
  });

  it("should filter by search query", () => {
    script.state.searchQuery = "saka";
    script.applyFiltersAndSort();
    expect(script.state.filteredPlayers.length).toBe(1);
    expect(script.state.filteredPlayers[0].name).toBe("Saka");
  });

  it("should filter by position", () => {
    script.state.positionFilter = "FWD";
    script.applyFiltersAndSort();
    expect(script.state.filteredPlayers.length).toBe(1);
    expect(script.state.filteredPlayers[0].name).toBe("Haaland");
  });

  it("should filter by team", () => {
    script.state.selectedTeams = ["MCI"];
    script.applyFiltersAndSort();
    expect(script.state.filteredPlayers.length).toBe(1);
    expect(script.state.filteredPlayers[0].name).toBe("Haaland");
  });

  it("should handle zero players found edge case gracefully", () => {
    script.state.searchQuery = "nonexistentplayer123";
    script.applyFiltersAndSort();
    expect(script.state.filteredPlayers.length).toBe(0);

    // Ensure "No players found" row is rendered
    const tbody = document.getElementById("table-body");
    expect(tbody.innerHTML).toContain("No players found matching criteria");
  });
});
