const state = {
    players: [],
    filteredPlayers: [],
    timeframe: 'last_5', // 'last_5' or 'last_10'
    sortColumn: 'xG', // 'name', 'xG', 'xA', 'creativity', 'threat', 'ict', 'bps', 'bonus', 'points'
    sortDirection: 'desc', // 'asc' or 'desc'
    searchQuery: '',
    positionFilter: 'All',
    selectedTeams: [], // Array of selected team strings
    currentPage: 1,
    itemsPerPage: 15
};

const elements = {
    btnLast5: document.getElementById('btn-last5'),
    btnLast10: document.getElementById('btn-last10'),
    positionBtns: document.querySelectorAll('.position-tabs button'),
    searchInput: document.getElementById('search-input'),
    teamFilterBtn: document.getElementById('team-filter-btn'),
    teamFilterDropdown: document.getElementById('team-filter-dropdown'),
    tableHeaders: document.querySelectorAll('th'),
    tableBody: document.getElementById('table-body'),
    errorMessage: document.getElementById('error-message'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    pageInfo: document.getElementById('page-info')
};

async function fetchPlayers() {
    try {
        const response = await fetch('players.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        state.players = await response.json();

        populateTeamFilter();

        // Initial render
        applyFiltersAndSort();
    } catch (error) {
        console.error("Failed to load players data:", error);
        elements.errorMessage.classList.remove('hidden');
        elements.errorMessage.textContent = "Failed to load player data. Please ensure players.json exists and is accessible.";
    }
}

function populateTeamFilter() {
    // Extract unique teams and their logos
    const teamsMap = new Map();
    state.players.forEach(player => {
        if (!teamsMap.has(player.team)) {
            teamsMap.set(player.team, player.logo);
        }
    });

    const sortedTeams = Array.from(teamsMap.keys()).sort();

    elements.teamFilterDropdown.innerHTML = '';
    sortedTeams.forEach(team => {
        const logo = teamsMap.get(team);
        const label = document.createElement('label');
        label.className = 'checkbox-label';
        label.innerHTML = `
            <input type="checkbox" value="${team}">
            <img src="${logo}" alt="${team} logo" class="team-logo">
            <span>${team}</span>
        `;

        const checkbox = label.querySelector('input');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                state.selectedTeams.push(team);
            } else {
                state.selectedTeams = state.selectedTeams.filter(t => t !== team);
            }
            updateTeamFilterText();
            state.currentPage = 1;
            applyFiltersAndSort();
        });

        elements.teamFilterDropdown.appendChild(label);
    });
}

function updateTeamFilterText() {
    const textSpan = elements.teamFilterBtn.querySelector('.select-text');
    if (state.selectedTeams.length === 0) {
        textSpan.textContent = 'All Teams';
    } else if (state.selectedTeams.length === 1) {
        textSpan.textContent = state.selectedTeams[0];
    } else {
        textSpan.textContent = `${state.selectedTeams.length} Teams Selected`;
    }
}

function applyFiltersAndSort() {
    // 1. Filter
    state.filteredPlayers = state.players.filter(player => {
        const matchesSearch = player.name.toLowerCase().includes(state.searchQuery.toLowerCase());
        const matchesTeam = state.selectedTeams.length === 0 || state.selectedTeams.includes(player.team);
        const matchesPosition = state.positionFilter === 'All' || player.position === state.positionFilter;
        return matchesSearch && matchesTeam && matchesPosition;
    });

    // 2. Sort
    state.filteredPlayers.sort((a, b) => {
        let valA, valB;

        if (state.sortColumn === 'name') {
            valA = a[state.sortColumn].toLowerCase();
            valB = b[state.sortColumn].toLowerCase();
        } else {
            // It's a metric, need to determine based on timeframe
            const prefix = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
            valA = a[`${prefix}${state.sortColumn}`];
            valB = b[`${prefix}${state.sortColumn}`];
        }

        if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // 3. Update Pagination and Render
    updatePagination();
    renderTable();
}

function updatePagination() {
    const totalPages = Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1;

    // Ensure current page is within bounds
    if (state.currentPage > totalPages) {
        state.currentPage = totalPages;
    }

    elements.pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
    elements.btnPrev.disabled = state.currentPage === 1;
    elements.btnNext.disabled = state.currentPage === totalPages;
}

function renderTable() {
    elements.tableBody.innerHTML = '';

    if (state.filteredPlayers.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="7" style="text-align: center; color: var(--text-secondary);">No players found matching criteria.</td>`;
        elements.tableBody.appendChild(tr);
        return;
    }

    const prefix = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';

    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const playersToRender = state.filteredPlayers.slice(startIndex, endIndex);

    playersToRender.forEach(player => {
        const minutes = player[`${prefix}minutes`] !== undefined ? player[`${prefix}minutes`] : 0;
        const xG = player[`${prefix}xG`].toFixed(2);
        const xA = player[`${prefix}xA`].toFixed(2);
        const xGI = player[`${prefix}xGI`] !== undefined ? player[`${prefix}xGI`].toFixed(2) : "0.00";
        const xGC = player[`${prefix}xGC`] !== undefined ? player[`${prefix}xGC`].toFixed(2) : "0.00";
        const creativity = player[`${prefix}creativity`].toFixed(1);
        const threat = player[`${prefix}threat`] !== undefined ? player[`${prefix}threat`].toFixed(1) : "0.0";
        const ict = player[`${prefix}ict`] !== undefined ? player[`${prefix}ict`].toFixed(1) : "0.0";
        const bps = player[`${prefix}bps`] !== undefined ? player[`${prefix}bps`] : 0;
        const bonus = player[`${prefix}bonus`] !== undefined ? player[`${prefix}bonus`] : 0;
        const points = player[`${prefix}points`];

        let statusHtml = '';
        let bgColor = '';
        let textColorClass = '';
        if (player.status_pct < 100) {
            statusHtml = `<div class="status-pct">%${player.status_pct}</div>`;
            if (player.status_pct === 0) bgColor = '#B2002D';
            else if (player.status_pct === 25) bgColor = '#D34401';
            else if (player.status_pct === 50) { bgColor = '#FEAB1B'; textColorClass = 'dark-text'; }
            else if (player.status_pct === 75) { bgColor = '#FBE772'; textColorClass = 'dark-text'; }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="player-name-cell sticky-col ${textColorClass}" style="${bgColor ? `background-color: ${bgColor} !important;` : ''}">
                <div class="player-info-wrapper">
                    ${statusHtml}
                    <div class="team-logo-container">
                        <img src="${player.logo}" alt="${player.team} logo" class="team-logo" style="margin-right: 0;">
                        <div class="player-price">£${player.price.toFixed(1)}m</div>
                    </div>
                    <div class="player-details">
                        <div class="player-name-text">${player.name}</div>
                    </div>
                </div>
            </td>
            <td>${minutes}</td>
            <td>${xG}</td>
            <td>${xA}</td>
            <td>${xGI}</td>
            <td>${xGC}</td>
            <td>${creativity}</td>
            <td>${threat}</td>
            <td>${ict}</td>
            <td>${bps}</td>
            <td>${bonus}</td>
            <td>${points}</td>
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
        // All columns (including name) default to descending (highest to lowest) on first click
        state.sortDirection = 'desc';
    }

    updateSortHeaders();
    applyFiltersAndSort();
}

// Event Listeners
elements.teamFilterBtn.addEventListener('click', () => {
    elements.teamFilterDropdown.classList.toggle('hidden');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (!elements.teamFilterBtn.contains(e.target) && !elements.teamFilterDropdown.contains(e.target)) {
        elements.teamFilterDropdown.classList.add('hidden');
    }
});

elements.btnLast5.addEventListener('click', () => {
    state.timeframe = 'last_5';
    state.currentPage = 1;
    elements.btnLast5.classList.add('active');
    elements.btnLast10.classList.remove('active');
    applyFiltersAndSort();
});

elements.btnLast10.addEventListener('click', () => {
    state.timeframe = 'last_10';
    state.currentPage = 1;
    elements.btnLast10.classList.add('active');
    elements.btnLast5.classList.remove('active');
    applyFiltersAndSort();
});

elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    state.currentPage = 1;
    applyFiltersAndSort();
});

elements.tableHeaders.forEach(th => {
    th.addEventListener('click', () => {
        const column = th.getAttribute('data-sort');
        state.currentPage = 1;
        handleSort(column);
    });
});

elements.btnPrev.addEventListener('click', () => {
    if (state.currentPage > 1) {
        state.currentPage--;
        updatePagination();
        renderTable();
    }
});

elements.btnNext.addEventListener('click', () => {
    const totalPages = Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1;
    if (state.currentPage < totalPages) {
        state.currentPage++;
        updatePagination();
        renderTable();
    }
});

// Init
document.addEventListener('DOMContentLoaded', fetchPlayers);

if (elements.positionBtns) {
    elements.positionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.positionBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.positionFilter = btn.getAttribute('data-pos');
            state.currentPage = 1;
            applyFiltersAndSort();
        });
    });
}
