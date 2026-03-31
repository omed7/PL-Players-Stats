// State
const state = {
    players: [],
    filteredPlayers: [],
    currentPage: 1,
    itemsPerPage: 15,
    timeframe: 'last_5', // 'last_5' or 'last_10'
    positionFilter: 'All', // 'All', 'GK', 'DEF', 'MID', 'FWD'
    selectedTeams: [], // Empty means ALL teams are selected
    searchQuery: '',
    sortColumn: 'xG',
    sortDirection: 'desc' // 'asc' or 'desc'
};

// DOM Elements
const elements = {};
document.addEventListener('DOMContentLoaded', () => {
    elements.btnLast5 = document.getElementById('btn-last5');
    elements.btnLast10 = document.getElementById('btn-last10');
    elements.positionBtns = document.querySelectorAll('.position-tabs button');
    elements.teamFilterRow = document.getElementById('team-filter-row');
    elements.searchInput = document.getElementById('search-input');
    elements.tableBody = document.getElementById('table-body');
    elements.tableHeaders = document.querySelectorAll('th');
    elements.btnPrev = document.getElementById('btn-prev');
    elements.btnNext = document.getElementById('btn-next');
    elements.pageInfo = document.getElementById('page-info');
    elements.errorMessage = document.getElementById('error-message');
    elements.minutesSlider = document.getElementById('minutes-slider');
    elements.minutesToggle = document.getElementById('minutes-toggle');
    elements.minutesLabel = document.getElementById('minutes-label');
});

// Fetch Data
async function fetchPlayers() {
    try {
        const response = await fetch('players.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        state.players = data;

        populateTeamFilter();
        applyFiltersAndSort();
    } catch (error) {
        console.error('Error fetching player data:', error);
        if (elements.errorMessage) {
            elements.errorMessage.classList.remove('hidden');
        }
    }
}

function populateTeamFilter() {
    elements.teamFilterRow.innerHTML = '';

    const uniqueTeams = Array.from(new Map(state.players.map(p => [p.team, { name: p.team, logo: p.logo }])).values())
        .sort((a, b) => a.name.localeCompare(b.name));

    const fragment = document.createDocumentFragment();

    uniqueTeams.forEach(teamInfo => {
        const btn = document.createElement('button');
        btn.className = 'team-logo-btn';
        btn.setAttribute('title', teamInfo.name);

        const img = document.createElement('img');
        img.src = teamInfo.logo;
        img.alt = teamInfo.name;

        btn.appendChild(img);

        const team = teamInfo.name;

        // By default, no buttons have 'selected' class = ALL are active.
        if (state.selectedTeams.includes(team)) {
            btn.classList.add('selected');
        }

        btn.addEventListener('click', () => {
            // Logic:
            // If selectedTeams is empty, it implies "ALL". Clicking a team makes ONLY that team selected.
            if (state.selectedTeams.length === 0) {
                state.selectedTeams = [team];
                document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            }
            // If clicked team is already selected:
            else if (state.selectedTeams.includes(team)) {
                state.selectedTeams = state.selectedTeams.filter(t => t !== team);
                btn.classList.remove('selected');
                // If deselected the last one, revert to "ALL" state
                if (state.selectedTeams.length === 0) {
                    document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
                }
            }
            // If clicking a new team, add to selection
            else {
                btn.classList.add('selected');
                state.selectedTeams.push(team);
            }

            state.currentPage = 1;
            applyFiltersAndSort();
        });

        fragment.appendChild(btn);
    });

    elements.teamFilterRow.appendChild(fragment);
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
    state.filteredPlayers.sort((a, b) => {
        let valA, valB;

        if (state.sortColumn === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
            return 0;
        }

        valA = a[`${prefix}${state.sortColumn}`];
        valB = b[`${prefix}${state.sortColumn}`];

        if (valA === undefined) valA = 0;
        if (valB === undefined) valB = 0;

        return state.sortDirection === 'asc' ? valA - valB : valB - valA;
    });

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
        const ownership = player.ownership !== undefined ? player.ownership : "0.0";

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
                    <div class="player-ownership-corner">${ownership}%</div>
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

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        state,
        elements,
        fetchPlayers,
        populateTeamFilter,
        applyFiltersAndSort,
        updatePagination,
        renderTable,
        updateSortHeaders,
        handleSort
    };
}