const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.resolve(__dirname, './index.html'), 'utf8');

describe('applyFiltersAndSort', () => {
    let script;

    beforeEach(() => {
        // Reset the DOM
        document.documentElement.innerHTML = html.toString();

        // Require the script freshly to reset state
        jest.resetModules();
        script = require('./script.js');

        // Setup mock players data with full structure expected by renderTable
        script.state.players = [
            {
                id: 1,
                name: "Erling Haaland",
                team: "MCI",
                position: "FWD",
                price: 15.0,
                status_pct: 100,
                logo: "test.png",
                last_5_minutes: 450,
                last_10_minutes: 900,
                last_5_xG: 5.2,
                last_10_xG: 10.1,
                last_5_xA: 1.0,
                last_10_xA: 2.0,
                last_5_creativity: 10.0,
                last_10_creativity: 20.0,
                last_5_points: 40,
                last_10_points: 80,
            },
            {
                id: 2,
                name: "Bukayo Saka",
                team: "ARS",
                position: "MID",
                price: 10.0,
                status_pct: 100,
                logo: "test.png",
                last_5_minutes: 360,
                last_10_minutes: 800,
                last_5_xG: 3.1,
                last_10_xG: 6.2,
                last_5_xA: 2.0,
                last_10_xA: 4.0,
                last_5_creativity: 20.0,
                last_10_creativity: 40.0,
                last_5_points: 30,
                last_10_points: 60,
            },
            {
                id: 3,
                name: "Trent Alexander-Arnold",
                team: "LIV",
                position: "DEF",
                price: 7.0,
                status_pct: 100,
                logo: "test.png",
                last_5_minutes: 400,
                last_10_minutes: 850,
                last_5_xG: 0.5,
                last_10_xG: 1.0,
                last_5_xA: 3.0,
                last_10_xA: 6.0,
                last_5_creativity: 30.0,
                last_10_creativity: 60.0,
                last_5_points: 20,
                last_10_points: 40,
            },
            {
                id: 4,
                name: "Ederson M.",
                team: "MCI",
                position: "GK",
                price: 5.5,
                status_pct: 100,
                logo: "test.png",
                last_5_minutes: 0, // 0 minutes should be filtered out
                last_10_minutes: 900,
                last_5_xG: 0.0,
                last_10_xG: 0.0,
                last_5_xA: 0.0,
                last_10_xA: 0.0,
                last_5_creativity: 0.0,
                last_10_creativity: 0.0,
                last_5_points: 0,
                last_10_points: 0,
            }
        ];

        // Setup initial default state for test
        script.state.timeframe = 'last_5';
        script.state.sortColumn = 'xG';
        script.state.sortDirection = 'desc';
        script.state.searchQuery = '';
        script.state.positionFilter = 'All';
        script.state.selectedTeams = ['MCI', 'ARS', 'LIV'];
        script.elements.minutesSlider.value = '0';
        script.elements.minutesToggle.checked = false;

        // Mock renderTable so we don't need all HTML columns present in test
        script.renderTable = jest.fn();
    });

    test('should hide players with 0 minutes in the selected timeframe', () => {
        script.applyFiltersAndSort();
        expect(script.state.filteredPlayers).toHaveLength(3);
        const playerNames = script.state.filteredPlayers.map(p => p.name);
        expect(playerNames).not.toContain("Ederson M.");
    });

    test('should filter by minimum raw minutes', () => {
        script.elements.minutesSlider.value = '400';
        script.elements.minutesToggle.checked = false;
        script.applyFiltersAndSort();

        expect(script.state.filteredPlayers).toHaveLength(2);
        const playerNames = script.state.filteredPlayers.map(p => p.name);
        expect(playerNames).toContain("Erling Haaland");
        expect(playerNames).toContain("Trent Alexander-Arnold");
        expect(playerNames).not.toContain("Bukayo Saka"); // 360 mins
    });

    test('should filter by minimum percentage minutes', () => {
        script.elements.minutesSlider.value = '90'; // 90%
        script.elements.minutesToggle.checked = true; // Percentage mode
        script.applyFiltersAndSort();

        // Haaland has 450 (100%), Saka has 360 (80%), Trent has 400 (89%)
        expect(script.state.filteredPlayers).toHaveLength(1);
        expect(script.state.filteredPlayers[0].name).toBe("Erling Haaland");
    });

    test('should filter by search query (case-insensitive)', () => {
        script.state.searchQuery = 'saka';
        script.applyFiltersAndSort();

        expect(script.state.filteredPlayers).toHaveLength(1);
        expect(script.state.filteredPlayers[0].name).toBe("Bukayo Saka");
    });

    test('should filter by selected teams', () => {
        script.state.selectedTeams = ['MCI'];
        script.applyFiltersAndSort();

        // Ederson has 0 mins so he is excluded
        expect(script.state.filteredPlayers).toHaveLength(1);
        expect(script.state.filteredPlayers[0].name).toBe("Erling Haaland");
    });

    test('should allow all teams if selectedTeams is empty', () => {
        script.state.selectedTeams = [];
        script.applyFiltersAndSort();

        // Ederson has 0 mins so he is excluded
        expect(script.state.filteredPlayers).toHaveLength(3);
    });

    test('should filter by position', () => {
        script.state.positionFilter = 'DEF';
        script.applyFiltersAndSort();

        expect(script.state.filteredPlayers).toHaveLength(1);
        expect(script.state.filteredPlayers[0].name).toBe("Trent Alexander-Arnold");
    });

    test('should sort by metric (xG) descending by default', () => {
        script.state.sortColumn = 'xG';
        script.state.sortDirection = 'desc';
        script.applyFiltersAndSort();

        expect(script.state.filteredPlayers).toHaveLength(3);
        expect(script.state.filteredPlayers[0].name).toBe("Erling Haaland"); // 5.2
        expect(script.state.filteredPlayers[1].name).toBe("Bukayo Saka"); // 3.1
        expect(script.state.filteredPlayers[2].name).toBe("Trent Alexander-Arnold"); // 0.5
    });

    test('should sort by metric (xG) ascending', () => {
        script.state.sortColumn = 'xG';
        script.state.sortDirection = 'asc';
        script.applyFiltersAndSort();

        expect(script.state.filteredPlayers).toHaveLength(3);
        expect(script.state.filteredPlayers[0].name).toBe("Trent Alexander-Arnold"); // 0.5
        expect(script.state.filteredPlayers[1].name).toBe("Bukayo Saka"); // 3.1
        expect(script.state.filteredPlayers[2].name).toBe("Erling Haaland"); // 5.2
    });

    test('should sort by name descending', () => {
        script.state.sortColumn = 'name';
        script.state.sortDirection = 'desc';
        script.applyFiltersAndSort();

        expect(script.state.filteredPlayers).toHaveLength(3);
        // T > E > B
        expect(script.state.filteredPlayers[0].name).toBe("Trent Alexander-Arnold");
        expect(script.state.filteredPlayers[1].name).toBe("Erling Haaland");
        expect(script.state.filteredPlayers[2].name).toBe("Bukayo Saka");
    });

    test('should apply prefix dynamically based on timeframe (last_10)', () => {
        // Timeframe last_10
        script.state.timeframe = 'last_10';

        // Ederson has 900 minutes in last 10, should not be filtered
        script.applyFiltersAndSort();
        expect(script.state.filteredPlayers).toHaveLength(4);
    });
});
