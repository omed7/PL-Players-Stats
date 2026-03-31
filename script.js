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
    minutesSlider: document.getElementById('minutes-slider'),
    minutesLabel: document.getElementById('minutes-label'),
    minutesToggle: document.getElementById('minutes-toggle'),
    searchInput: document.getElementById('search-input'),
    teamFilterRow: document.getElementById('team-filter-row'),
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
        const rawPlayers = await response.json();
        state.players = rawPlayers.map(p => ({
            ...p,
            name_lower: p.name.toLowerCase()
        }));

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

    // By default, select all teams
    state.selectedTeams = [...sortedTeams];

    elements.teamFilterRow.innerHTML = '';
    sortedTeams.forEach(team => {
        const logo = teamsMap.get(team);
        const btn = document.createElement('button');
        btn.className = 'team-logo-btn selected';
        btn.title = team;
        btn.innerHTML = `<img src="${logo}" alt="${team} logo">`;

        btn.addEventListener('click', () => {
            const isSelected = btn.classList.contains('selected');

            if (isSelected) {
                btn.classList.remove('selected');
                state.selectedTeams = state.selectedTeams.filter(t => t !== team);
            } else {
                btn.classList.add('selected');
                state.selectedTeams.push(team);
            }

            state.currentPage = 1;
            applyFiltersAndSort();
        });

        elements.teamFilterRow.appendChild(btn);
    });
}

function applyFiltersAndSort() {
    // 1. Filter
    const searchQueryLower = (state.searchQuery || '').toLowerCase();
    const isAllTeamsSelected = state.selectedTeams.length === 0;
    const isAllPositionsSelected = state.positionFilter === 'All';
    const isPctMode = elements.minutesToggle.checked;
    const sliderValue = parseInt(elements.minutesSlider.value, 10);
    const prefix = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
    const maxMinutes = state.timeframe === 'last_5' ? 450 : 900;

    state.filteredPlayers = state.players.filter(player => {
        const minutes = player[`${prefix}minutes`] !== undefined ? player[`${prefix}minutes`] : 0;

        if (minutes === 0) return false; // Completely hide players with 0 minutes in the selected timeframe

        if (isPctMode) {
            const min_pct = Math.round((minutes / maxMinutes) * 100);
            if (min_pct < sliderValue) return false;
        } else {
            if (minutes < sliderValue) return false;
        }

        const matchesSearch = player.name.toLowerCase().includes(searchQueryLower);
        const matchesTeam = isAllTeamsSelected || state.selectedTeams.includes(player.team);
        const matchesPosition = isAllPositionsSelected || player.position === state.positionFilter;
        return matchesSearch && matchesTeam && matchesPosition;
    });

    // 2. Sort
    const isNameSort = state.sortColumn === 'name';
    const metricPrefix = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
    const metricKey = isNameSort ? null : `${metricPrefix}${state.sortColumn}`;

    state.filteredPlayers.sort((a, b) => {
        let valA, valB;

        if (isNameSort) {
            valA = a.name_lower;
            valB = b.name_lower;
        } else {
            // It's a metric
            valA = a[metricKey];
            valB = b[metricKey];
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

    // Update column visibility based on position tab
    const colSaves = document.getElementById('col-saves');
    const colDefcon = document.getElementById('col-defcon');
    const colXg = document.getElementById('col-xg');
    const colXa = document.getElementById('col-xa');
    const colXgi = document.getElementById('col-xgi');
    const colCreativity = document.getElementById('col-creativity');
    const colThreat = document.getElementById('col-threat');
    const colIct = document.getElementById('col-ict');

    if (state.positionFilter === 'GK') {
        colSaves.classList.remove('hidden');
        colDefcon.classList.add('hidden');
        colXg.classList.add('hidden');
        colXa.classList.add('hidden');
        colXgi.classList.add('hidden');
        colCreativity.classList.add('hidden');
        colThreat.classList.add('hidden');
        colIct.classList.add('hidden');
    } else {
        colSaves.classList.add('hidden');
        colDefcon.classList.remove('hidden');
        colXg.classList.remove('hidden');
        colXa.classList.remove('hidden');
        colXgi.classList.remove('hidden');
        colCreativity.classList.remove('hidden');
        colThreat.classList.remove('hidden');
        colIct.classList.remove('hidden');
    }

    playersToRender.forEach(player => {
        const minutes = player[`${prefix}minutes`] !== undefined ? player[`${prefix}minutes`] : 0;

        let min_pct = 0;
        if (state.timeframe === 'last_5') {
            min_pct = Math.round((minutes / 450) * 100);
        } else {
            min_pct = Math.round((minutes / 900) * 100);
        }

        const saves = player[`${prefix}saves`] !== undefined ? player[`${prefix}saves`] : 0;
        const defcon = player[`${prefix}defcon`] !== undefined ? player[`${prefix}defcon`] : 0;
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
                    <div class="player-minutes-corner">Mins:${minutes} %${min_pct}</div>
                </div>
            </td>
            <td class="col-saves ${state.positionFilter === 'GK' ? '' : 'hidden'}">${saves}</td>
            <td class="col-defcon ${state.positionFilter === 'GK' ? 'hidden' : ''}">${defcon}</td>
            <td class="col-xg ${state.positionFilter === 'GK' ? 'hidden' : ''}">${xG}</td>
            <td class="col-xa ${state.positionFilter === 'GK' ? 'hidden' : ''}">${xA}</td>
            <td class="col-xgi ${state.positionFilter === 'GK' ? 'hidden' : ''}">${xGI}</td>
            <td>${xGC}</td>
            <td class="col-creativity ${state.positionFilter === 'GK' ? 'hidden' : ''}">${creativity}</td>
            <td class="col-threat ${state.positionFilter === 'GK' ? 'hidden' : ''}">${threat}</td>
            <td class="col-ict ${state.positionFilter === 'GK' ? 'hidden' : ''}">${ict}</td>
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
function updateSliderUI() {
    const isPctMode = elements.minutesToggle.checked;
    if (isPctMode) {
        elements.minutesSlider.max = 100;
        elements.minutesLabel.textContent = `Min Minutes: ${elements.minutesSlider.value}%`;
    } else {
        elements.minutesSlider.max = state.timeframe === 'last_5' ? 450 : 900;
        elements.minutesLabel.textContent = `Min Minutes: ${elements.minutesSlider.value}`;
    }
}

elements.minutesToggle.addEventListener('change', () => {
    // Reset to 0 when toggling modes
    elements.minutesSlider.value = 0;
    updateSliderUI();
    state.currentPage = 1;
    applyFiltersAndSort();
});

elements.minutesSlider.addEventListener('input', () => {
    updateSliderUI();
    state.currentPage = 1;
    applyFiltersAndSort();
});

elements.btnLast5.addEventListener('click', () => {
    state.timeframe = 'last_5';
    state.currentPage = 1;
    elements.btnLast5.classList.add('active');
    elements.btnLast10.classList.remove('active');
    elements.minutesSlider.value = 0;
    updateSliderUI();
    applyFiltersAndSort();
});

elements.btnLast10.addEventListener('click', () => {
    state.timeframe = 'last_10';
    state.currentPage = 1;
    elements.btnLast10.classList.add('active');
    elements.btnLast5.classList.remove('active');
    elements.minutesSlider.value = 0;
    updateSliderUI();
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
