const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');

describe('fetchPlayers', () => {
    let script;

    beforeEach(() => {
        // Set up the DOM
        document.body.innerHTML = html;

        // Require the script so it can bind to the DOM elements
        jest.isolateModules(() => {
            script = require('../script.js');
        });

        // Mock fetch
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('should fetch players.json and update the global state', async () => {
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
                last_5_points: 40
            }
        ];

        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => dummyPlayers
        });

        await script.fetchPlayers();

        expect(global.fetch).toHaveBeenCalledWith('players.json');
        expect(script.state.players).toEqual(dummyPlayers);
    });

    it('should show an error message if fetch fails', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: false,
            status: 404
        });

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await script.fetchPlayers();

        expect(global.fetch).toHaveBeenCalledWith('players.json');
        expect(script.state.players).toEqual([]);
        expect(script.elements.errorMessage.classList.contains('hidden')).toBe(false);
        expect(script.elements.errorMessage.textContent).toContain('Failed to load player data');

        consoleErrorSpy.mockRestore();
    });

    it('should catch and log network errors and show error message', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Network Error'));

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        await script.fetchPlayers();

        expect(global.fetch).toHaveBeenCalledWith('players.json');
        expect(script.state.players).toEqual([]);
        expect(script.elements.errorMessage.classList.contains('hidden')).toBe(false);
        expect(script.elements.errorMessage.textContent).toContain('Failed to load player data');

        consoleErrorSpy.mockRestore();
    });
});