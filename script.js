const state = {
    players: [],
    filteredPlayers: [],
    timeframe: 'season', // 'season' or 'last5'
    sortColumn: 'xG', // 'name', 'team', 'xG', 'xA'
    sortDirection: 'desc', // 'asc' or 'desc'
    searchQuery: '',
    selectedTeam: ''
};

const elements = {
    btnSeason: document.getElementById('btn-season'),
    btnLast5: document.getElementById('btn-last5'),
    searchInput: document.getElementById('search-input'),
    teamFilter: document.getElementById('team-filter'),
    tableHeaders: document.querySelectorAll('th'),
    tableBody: document.getElementById('table-body'),
    errorMessage: document.getElementById('error-message')
};

async function fetchPlayers() {
    try {
        const response = await fetch('players.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        state.players = await response.json();

        // Initial render
        applyFiltersAndSort();
    } catch (error) {
        console.error("Failed to load players data:", error);
        elements.errorMessage.classList.remove('hidden');
        elements.errorMessage.textContent = "Failed to load player data. Please ensure players.json exists and is accessible.";
    }
}

function applyFiltersAndSort() {
    // 1. Filter
    state.filteredPlayers = state.players.filter(player => {
        const matchesSearch = player.name.toLowerCase().includes(state.searchQuery.toLowerCase());
        const matchesTeam = state.selectedTeam === '' || player.team === state.selectedTeam;
        return matchesSearch && matchesTeam;
    });

    // 2. Sort
    state.filteredPlayers.sort((a, b) => {
        let valA, valB;

        if (state.sortColumn === 'name' || state.sortColumn === 'team') {
            valA = a[state.sortColumn].toLowerCase();
            valB = b[state.sortColumn].toLowerCase();
        } else {
            // It's xG or xA, need to determine based on timeframe
            const prefix = state.timeframe === 'season' ? 'season_' : 'last_5_';
            valA = a[`${prefix}${state.sortColumn}`];
            valB = b[`${prefix}${state.sortColumn}`];
        }

        if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // 3. Render
    renderTable();
}

function renderTable() {
    elements.tableBody.innerHTML = '';

    if (state.filteredPlayers.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="4" style="text-align: center; color: var(--text-secondary);">No players found matching criteria.</td>`;
        elements.tableBody.appendChild(tr);
        return;
    }

    const prefix = state.timeframe === 'season' ? 'season_' : 'last_5_';

    state.filteredPlayers.forEach(player => {
        const xG = player[`${prefix}xG`].toFixed(2);
        const xA = player[`${prefix}xA`].toFixed(2);

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${player.name}</td>
            <td>${player.team}</td>
            <td>${xG}</td>
            <td>${xA}</td>
        `;
        elements.tableBody.appendChild(tr);
    });
}

function updateSortHeaders() {
    elements.tableHeaders.forEach(th => {
        const column = th.getAttribute('data-sort');
        th.classList.remove('active-sort', 'asc', 'desc');
        th.querySelector('.sort-icon').textContent = '';

        if (column === state.sortColumn) {
            th.classList.add('active-sort', state.sortDirection);
            th.querySelector('.sort-icon').textContent = state.sortDirection === 'asc' ? '▲' : '▼';
        }
    });
}

function handleSort(column) {
    if (state.sortColumn === column) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortColumn = column;
        // Default text columns to asc, number columns to desc
        state.sortDirection = (column === 'name' || column === 'team') ? 'asc' : 'desc';
    }

    updateSortHeaders();
    applyFiltersAndSort();
}

// Event Listeners
elements.btnSeason.addEventListener('click', () => {
    state.timeframe = 'season';
    elements.btnSeason.classList.add('active');
    elements.btnLast5.classList.remove('active');
    applyFiltersAndSort();
});

elements.btnLast5.addEventListener('click', () => {
    state.timeframe = 'last5';
    elements.btnLast5.classList.add('active');
    elements.btnSeason.classList.remove('active');
    applyFiltersAndSort();
});

elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    applyFiltersAndSort();
});

elements.teamFilter.addEventListener('change', (e) => {
    state.selectedTeam = e.target.value;
    applyFiltersAndSort();
});

elements.tableHeaders.forEach(th => {
    th.addEventListener('click', () => {
        const column = th.getAttribute('data-sort');
        handleSort(column);
    });
});

// Init
document.addEventListener('DOMContentLoaded', fetchPlayers);