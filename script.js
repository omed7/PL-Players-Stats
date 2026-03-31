// State
const state = {
    players: [],
    filteredPlayers: [],
    currentPage: 1,
    itemsPerPage: 15,
    timeframe: 'last_5',
    positionFilter: 'All',
    selectedTeams: [],
    searchQuery: '',
    sortColumn: 'xG',
    sortDirection: 'desc'
};

// DOM Elements (populated after DOMContentLoaded)
const elements = {};

// ─── Data Fetch ───────────────────────────────────────────────────────────────

async function fetchPlayers() {
    try {
        const response = await fetch('players.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        state.players = data;
        populateTeamFilter();
        applyFiltersAndSort();
    } catch (error) {
        console.error('Error fetching player data:', error);
        if (elements.errorMessage) elements.errorMessage.classList.remove('hidden');
    }
}

// ─── Team Filter ──────────────────────────────────────────────────────────────

function populateTeamFilter() {
    elements.teamFilterRow.innerHTML = '';

    const uniqueTeams = Array.from(
        new Map(state.players.map(p => [p.team, { name: p.team, logo: p.logo }])).values()
    ).sort((a, b) => a.name.localeCompare(b.name));

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
        if (state.selectedTeams.includes(team)) btn.classList.add('selected');

        btn.addEventListener('click', () => {
            if (state.selectedTeams.length === 0) {
                state.selectedTeams = [team];
                document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            } else if (state.selectedTeams.includes(team)) {
                state.selectedTeams = state.selectedTeams.filter(t => t !== team);
                btn.classList.remove('selected');
                if (state.selectedTeams.length === 0) {
                    document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
                }
            } else {
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

// ─── Filter + Sort ────────────────────────────────────────────────────────────

function applyFiltersAndSort() {
    const searchQueryLower = (state.searchQuery || '').toLowerCase();
    const isAllTeamsSelected = state.selectedTeams.length === 0;
    const isAllPositionsSelected = state.positionFilter === 'All';
    const isPctMode = elements.minutesToggle.checked;
    const sliderValue = parseInt(elements.minutesSlider.value, 10);
    const prefix = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
    const maxMinutes = state.timeframe === 'last_5' ? 450 : 900;

    state.filteredPlayers = state.players.filter(player => {
        const minutes = player[`${prefix}minutes`] ?? 0;
        if (minutes === 0) return false;

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

    // Sort
    state.filteredPlayers.sort((a, b) => {
        let valA, valB;

        if (state.sortColumn === 'name') {
            valA = a.name.toLowerCase();
            valB = b.name.toLowerCase();
            if (valA < valB) return state.sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return state.sortDirection === 'asc' ? 1 : -1;
            return 0;
        }

        if (state.sortColumn === 'value') {
            valA = a.price > 0 ? (a[`${prefix}points`] / a.price) : 0;
            valB = b.price > 0 ? (b[`${prefix}points`] / b.price) : 0;
        } else {
            valA = a[`${prefix}${state.sortColumn}`] ?? 0;
            valB = b[`${prefix}${state.sortColumn}`] ?? 0;
        }

        return state.sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    // Compute per-column max values for heat-map coloring
    state.columnMaxes = {};
    const numericCols = ['xG', 'xA', 'xGI', 'creativity', 'threat', 'ict', 'bps', 'bonus', 'points', 'saves', 'defcon'];
    numericCols.forEach(col => {
        state.columnMaxes[col] = Math.max(...state.filteredPlayers.map(p => p[`${prefix}${col}`] ?? 0), 0.01);
    });

    updatePagination();
    renderTable();
}

// ─── Heat-map helper ──────────────────────────────────────────────────────────

function heatColor(value, max) {
    if (!max || value <= 0) return '';
    const ratio = Math.min(value / max, 1);
    // Fade from transparent → accent purple at full intensity
    const alpha = (ratio * 0.45).toFixed(2);
    return `background-color: rgba(187, 134, 252, ${alpha});`;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function updatePagination() {
    const totalPages = Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1;
    if (state.currentPage > totalPages) state.currentPage = totalPages;

    elements.pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
    elements.btnPrev.disabled = state.currentPage === 1;
    elements.btnNext.disabled = state.currentPage === totalPages;
}

// ─── Render Table ─────────────────────────────────────────────────────────────

function renderTable() {
    elements.tableBody.innerHTML = '';

    if (state.filteredPlayers.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="14" style="text-align:center;color:var(--text-secondary);">No players found matching criteria.</td>`;
        elements.tableBody.appendChild(tr);
        return;
    }

    const prefix = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
    const isGK = state.positionFilter === 'GK';

    // Column header visibility
    const colSaves     = document.getElementById('col-saves');
    const colDefcon    = document.getElementById('col-defcon');
    const colXg        = document.getElementById('col-xg');
    const colXa        = document.getElementById('col-xa');
    const colXgi       = document.getElementById('col-xgi');
    const colCreativity= document.getElementById('col-creativity');
    const colThreat    = document.getElementById('col-threat');
    const colIct       = document.getElementById('col-ict');

    colSaves.classList.toggle('hidden', !isGK);
    colDefcon.classList.toggle('hidden', isGK);
    colXg.classList.toggle('hidden', isGK);
    colXa.classList.toggle('hidden', isGK);
    colXgi.classList.toggle('hidden', isGK);
    colCreativity.classList.toggle('hidden', isGK);
    colThreat.classList.toggle('hidden', isGK);
    colIct.classList.toggle('hidden', isGK);

    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const playersToRender = state.filteredPlayers.slice(startIndex, startIndex + state.itemsPerPage);
    const maxes = state.columnMaxes;

    playersToRender.forEach(player => {
        const minutes = player[`${prefix}minutes`] ?? 0;
        const maxMinutes = state.timeframe === 'last_5' ? 450 : 900;
        const min_pct = Math.round((minutes / maxMinutes) * 100);

        const saves      = player[`${prefix}saves`]      ?? 0;
        const defcon     = player[`${prefix}defcon`]     ?? 0;
        const xG         = (player[`${prefix}xG`]        ?? 0).toFixed(2);
        const xA         = (player[`${prefix}xA`]        ?? 0).toFixed(2);
        const xGI        = (player[`${prefix}xGI`]       ?? 0).toFixed(2);
        const xGC        = (player[`${prefix}xGC`]       ?? 0).toFixed(2);
        const creativity = (player[`${prefix}creativity`]?? 0).toFixed(1);
        const threat     = (player[`${prefix}threat`]    ?? 0).toFixed(1);
        const ict        = (player[`${prefix}ict`]       ?? 0).toFixed(1);
        const bps        = player[`${prefix}bps`]        ?? 0;
        const bonus      = player[`${prefix}bonus`]      ?? 0;
        const points     = player[`${prefix}points`]     ?? 0;
        const ownership  = player.ownership              ?? '0.0';
        const value      = player.price > 0 ? (points / player.price).toFixed(1) : '0.0';

        // Injury status badge + row background
        let statusHtml = '';
        let bgColor = '';
        let textColorClass = '';
        if (player.status_pct < 100) {
            statusHtml = `<div class="status-pct">%${player.status_pct}</div>`;
            if      (player.status_pct === 0)  { bgColor = '#B2002D'; }
            else if (player.status_pct === 25) { bgColor = '#D34401'; }
            else if (player.status_pct === 50) { bgColor = '#FEAB1B'; textColorClass = 'dark-text'; }
            else if (player.status_pct === 75) { bgColor = '#FBE772'; textColorClass = 'dark-text'; }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="player-name-cell sticky-col ${textColorClass}" style="${bgColor ? `background-color:${bgColor}!important;` : ''}">
                <div class="player-info-wrapper">
                    <div class="player-ownership-corner">${ownership}%</div>
                    ${statusHtml}
                    <div class="team-logo-container">
                        <img src="${player.logo}" alt="${player.team}" class="team-logo" style="margin-right:0;">
                        <div class="player-price">£${player.price.toFixed(1)}m</div>
                    </div>
                    <div class="player-details">
                        <div class="player-name-text">${player.name}</div>
                    </div>
                    <div class="player-minutes-corner">Mins:${minutes} %${min_pct}</div>
                </div>
            </td>
            <td class="${isGK ? '' : 'hidden'}" style="${heatColor(saves, maxes.saves)}">${saves}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(defcon, maxes.defcon)}">${defcon}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(parseFloat(xG), maxes.xG)}">${xG}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(parseFloat(xA), maxes.xA)}">${xA}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(parseFloat(xGI), maxes.xGI)}">${xGI}</td>
            <td>${xGC}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(parseFloat(creativity), maxes.creativity)}">${creativity}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(parseFloat(threat), maxes.threat)}">${threat}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(parseFloat(ict), maxes.ict)}">${ict}</td>
            <td style="${heatColor(bps, maxes.bps)}">${bps}</td>
            <td style="${heatColor(bonus, maxes.bonus)}">${bonus}</td>
            <td style="${heatColor(points, maxes.points)}">${points}</td>
            <td style="${heatColor(parseFloat(value), 10)}">${value}</td>
        `;
        elements.tableBody.appendChild(tr);
    });
}

// ─── Sort Headers ─────────────────────────────────────────────────────────────

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
        state.sortDirection = 'desc';
    }
    updateSortHeaders();
    applyFiltersAndSort();
}

// ─── Slider UI ────────────────────────────────────────────────────────────────

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

// ─── Init: everything inside DOMContentLoaded ─────────────────────────────────
//
//  BUG FIX: Previously, event listeners were attached at the module level
//  before DOMContentLoaded fired. `elements.*` was still an empty object {},
//  so e.g. `elements.minutesToggle.addEventListener(...)` threw a TypeError
//  and crashed the script. The critical consequence: the line
//  `document.addEventListener('DOMContentLoaded', fetchPlayers)` came AFTER
//  those crashes and was never reached, so data never loaded.
//
//  Fix: populate elements AND attach all listeners inside one DOMContentLoaded
//  callback, then call fetchPlayers() at the end of that same callback.
// ─────────────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // 1. Populate element references
    elements.btnLast5        = document.getElementById('btn-last5');
    elements.btnLast10       = document.getElementById('btn-last10');
    elements.positionBtns    = document.querySelectorAll('.position-tabs button');
    elements.teamFilterRow   = document.getElementById('team-filter-row');
    elements.searchInput     = document.getElementById('search-input');
    elements.tableBody       = document.getElementById('table-body');
    elements.tableHeaders    = document.querySelectorAll('th');
    elements.btnPrev         = document.getElementById('btn-prev');
    elements.btnNext         = document.getElementById('btn-next');
    elements.pageInfo        = document.getElementById('page-info');
    elements.errorMessage    = document.getElementById('error-message');
    elements.minutesSlider   = document.getElementById('minutes-slider');
    elements.minutesToggle   = document.getElementById('minutes-toggle');
    elements.minutesLabel    = document.getElementById('minutes-label');

    // 2. Attach all event listeners (elements are now available)

    elements.minutesToggle.addEventListener('change', () => {
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
            state.currentPage = 1;
            handleSort(th.getAttribute('data-sort'));
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

    elements.positionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.positionBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.positionFilter = btn.getAttribute('data-pos');
            state.currentPage = 1;
            applyFiltersAndSort();
        });
    });

    // 3. Load data
    fetchPlayers();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { state, elements, fetchPlayers, populateTeamFilter,
        applyFiltersAndSort, updatePagination, renderTable, updateSortHeaders, handleSort };
}