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
    sortDirection: 'desc',
    columnMaxes: {}
};

const elements = {};

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function fetchPlayers() {
    try {
        const response = await fetch('players.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        state.players = await response.json();
        populateTeamFilter();
        applyFiltersAndSort();
    } catch (err) {
        console.error('Error fetching player data:', err);
        if (elements.errorMessage) elements.errorMessage.classList.remove('hidden');
    }
}

// ─── Team Filter (collapsible) ────────────────────────────────────────────────

function populateTeamFilter() {
    elements.teamFilterRow.innerHTML = '';

    const uniqueTeams = Array.from(
        new Map(state.players.map(p => [p.team, { name: p.team, logo: p.logo }])).values()
    ).sort((a, b) => a.name.localeCompare(b.name));

    const fragment = document.createDocumentFragment();

    uniqueTeams.forEach(({ name: team, logo }) => {
        const btn = document.createElement('button');
        btn.className = 'team-logo-btn';
        btn.title = team;
        if (state.selectedTeams.includes(team)) btn.classList.add('selected');

        btn.innerHTML = `
            <img src="${logo}" alt="${team}">
            <span class="team-abbr">${team}</span>
        `;

        btn.addEventListener('click', () => {
            toggleTeam(team, btn);
        });

        fragment.appendChild(btn);
    });

    elements.teamFilterRow.appendChild(fragment);
    updateTeamFilterUI();
}

function toggleTeam(team, btn) {
    if (state.selectedTeams.length === 0) {
        // All → select just this one
        state.selectedTeams = [team];
        document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
    } else if (state.selectedTeams.includes(team)) {
        // Deselect
        state.selectedTeams = state.selectedTeams.filter(t => t !== team);
        btn.classList.remove('selected');
        if (state.selectedTeams.length === 0) {
            document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
        }
    } else {
        // Add to selection
        state.selectedTeams.push(team);
        btn.classList.add('selected');
    }

    state.currentPage = 1;
    updateTeamFilterUI();
    applyFiltersAndSort();
}

function updateTeamFilterUI() {
    const count = state.selectedTeams.length;
    const toggleBtn = elements.teamFilterToggleBtn;
    const label = document.getElementById('team-filter-label');
    const countEl = document.getElementById('team-selection-count');

    if (count === 0) {
        label.textContent = 'Filter by Team';
        toggleBtn.classList.remove('has-selection');
        if (countEl) countEl.textContent = '';
    } else if (count === 1) {
        label.textContent = `Team: ${state.selectedTeams[0]}`;
        toggleBtn.classList.add('has-selection');
        if (countEl) countEl.textContent = '';
    } else {
        label.textContent = 'Filter by Team';
        toggleBtn.classList.add('has-selection');
        if (countEl) countEl.textContent = `${count} selected`;
    }
}

// ─── Filters + Sort ───────────────────────────────────────────────────────────

function applyFiltersAndSort() {
    const searchLower = (state.searchQuery || '').toLowerCase();
    const allTeams = state.selectedTeams.length === 0;
    const allPos   = state.positionFilter === 'All';
    const isPct    = elements.minutesToggle.checked;
    const slider   = parseInt(elements.minutesSlider.value, 10);
    const prefix   = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
    const maxMins  = state.timeframe === 'last_5' ? 450 : 900;

    state.filteredPlayers = state.players.filter(p => {
        const mins = p[`${prefix}minutes`] ?? 0;
        if (mins === 0) return false;

        if (isPct) {
            if (Math.round((mins / maxMins) * 100) < slider) return false;
        } else {
            if (mins < slider) return false;
        }

        return (
            p.name.toLowerCase().includes(searchLower) &&
            (allTeams || state.selectedTeams.includes(p.team)) &&
            (allPos   || p.position === state.positionFilter)
        );
    });

    // Sort
    state.filteredPlayers.sort((a, b) => {
        if (state.sortColumn === 'name') {
            const na = a.name.toLowerCase(), nb = b.name.toLowerCase();
            return state.sortDirection === 'asc' ? na.localeCompare(nb) : nb.localeCompare(na);
        }
        let va, vb;
        if (state.sortColumn === 'value') {
            va = a.price > 0 ? (a[`${prefix}points`] / a.price) : 0;
            vb = b.price > 0 ? (b[`${prefix}points`] / b.price) : 0;
        } else {
            va = a[`${prefix}${state.sortColumn}`] ?? 0;
            vb = b[`${prefix}${state.sortColumn}`] ?? 0;
        }
        return state.sortDirection === 'asc' ? va - vb : vb - va;
    });

    // Per-column maxes for heat-map
    const cols = ['xG','xA','xGI','creativity','threat','ict','bps','bonus','points','saves','defcon'];
    cols.forEach(c => {
        state.columnMaxes[c] = Math.max(...state.filteredPlayers.map(p => p[`${prefix}${c}`] ?? 0), 0.01);
    });

    updatePagination();
    renderTable();
}

// ─── Heat colour ──────────────────────────────────────────────────────────────

function heatColor(value, max) {
    if (!max || value <= 0) return '';
    const alpha = Math.min((value / max) * 0.45, 0.45).toFixed(2);
    return `background-color:rgba(187,134,252,${alpha});`;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function updatePagination() {
    const total = Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1;
    if (state.currentPage > total) state.currentPage = total;
    elements.pageInfo.textContent = `Page ${state.currentPage} of ${total}`;
    elements.btnPrev.disabled = state.currentPage === 1;
    elements.btnNext.disabled = state.currentPage === total;
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderTable() {
    elements.tableBody.innerHTML = '';

    if (state.filteredPlayers.length === 0) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="14" style="text-align:center;color:var(--text-secondary);">No players match the current filters.</td>`;
        elements.tableBody.appendChild(tr);
        return;
    }

    const prefix  = state.timeframe === 'last_5' ? 'last_5_' : 'last_10_';
    const maxMins = state.timeframe === 'last_5' ? 450 : 900;
    const isGK    = state.positionFilter === 'GK';
    const maxes   = state.columnMaxes;

    // Column header visibility
    document.getElementById('col-saves').classList.toggle('hidden', !isGK);
    document.getElementById('col-defcon').classList.toggle('hidden', isGK);
    document.getElementById('col-xg').classList.toggle('hidden', isGK);
    document.getElementById('col-xa').classList.toggle('hidden', isGK);
    document.getElementById('col-xgi').classList.toggle('hidden', isGK);
    document.getElementById('col-creativity').classList.toggle('hidden', isGK);
    document.getElementById('col-threat').classList.toggle('hidden', isGK);
    document.getElementById('col-ict').classList.toggle('hidden', isGK);

    const start   = (state.currentPage - 1) * state.itemsPerPage;
    const players = state.filteredPlayers.slice(start, start + state.itemsPerPage);

    players.forEach(p => {
        const mins    = p[`${prefix}minutes`] ?? 0;
        const minPct  = Math.round((mins / maxMins) * 100);
        const saves   = p[`${prefix}saves`]      ?? 0;
        const defcon  = p[`${prefix}defcon`]     ?? 0;
        const xG      = (p[`${prefix}xG`]        ?? 0).toFixed(2);
        const xA      = (p[`${prefix}xA`]        ?? 0).toFixed(2);
        const xGI     = (p[`${prefix}xGI`]       ?? 0).toFixed(2);
        const xGC     = (p[`${prefix}xGC`]       ?? 0).toFixed(2);
        const creat   = (p[`${prefix}creativity`]?? 0).toFixed(1);
        const threat  = (p[`${prefix}threat`]    ?? 0).toFixed(1);
        const ict     = (p[`${prefix}ict`]       ?? 0).toFixed(1);
        const bps     = p[`${prefix}bps`]        ?? 0;
        const bonus   = p[`${prefix}bonus`]      ?? 0;
        const points  = p[`${prefix}points`]     ?? 0;
        const value   = p.price > 0 ? (points / p.price).toFixed(1) : '0.0';
        const own     = p.ownership ?? '0.0';

        // Injury / availability
        let statusBadge = '';
        let rowBg = '';
        let darkClass = '';
        if (p.status_pct < 100) {
            statusBadge = `<span class="status-pct">&#9888; ${p.status_pct}%</span>`;
            if      (p.status_pct === 0)  rowBg = 'background-color:#B2002D!important;';
            else if (p.status_pct === 25) rowBg = 'background-color:#D34401!important;';
            else if (p.status_pct === 50) { rowBg = 'background-color:#FEAB1B!important;'; darkClass = 'dark-text'; }
            else if (p.status_pct === 75) { rowBg = 'background-color:#FBE772!important;'; darkClass = 'dark-text'; }
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="player-name-cell sticky-col ${darkClass}" style="${rowBg}">
                <div class="player-info-wrapper">
                    <div class="team-logo-container">
                        <img src="${p.logo}" alt="${p.team}" class="team-logo">
                        <div class="player-price">&#163;${p.price.toFixed(1)}m</div>
                    </div>
                    <div class="player-details">
                        <div class="player-name-text">${p.name}</div>
                        <div class="player-meta-row">
                            <span class="player-ownership-badge">${own}%</span>
                            <span class="player-minutes-badge">${mins}m&nbsp;(${minPct}%)</span>
                            ${statusBadge}
                        </div>
                    </div>
                </div>
            </td>
            <td class="${isGK ? '' : 'hidden'}" style="${heatColor(saves, maxes.saves)}">${saves}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(defcon, maxes.defcon)}">${defcon}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(+xG, maxes.xG)}">${xG}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(+xA, maxes.xA)}">${xA}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(+xGI, maxes.xGI)}">${xGI}</td>
            <td>${xGC}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(+creat, maxes.creativity)}">${creat}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(+threat, maxes.threat)}">${threat}</td>
            <td class="${isGK ? 'hidden' : ''}" style="${heatColor(+ict, maxes.ict)}">${ict}</td>
            <td style="${heatColor(bps, maxes.bps)}">${bps}</td>
            <td style="${heatColor(bonus, maxes.bonus)}">${bonus}</td>
            <td style="${heatColor(points, maxes.points)}">${points}</td>
            <td style="${heatColor(+value, 10)}">${value}</td>
        `;
        elements.tableBody.appendChild(tr);
    });
}

// ─── Sort headers ─────────────────────────────────────────────────────────────

function updateSortHeaders() {
    elements.tableHeaders.forEach(th => {
        th.classList.remove('active-sort', 'asc', 'desc');
        th.querySelector('.sort-icon').textContent = '';
        if (th.getAttribute('data-sort') === state.sortColumn) {
            th.classList.add('active-sort', state.sortDirection);
            th.querySelector('.sort-icon').textContent = state.sortDirection === 'asc' ? '▲' : '▼';
        }
    });
}

function handleSort(col) {
    if (!col) return;
    state.sortColumn    = col;
    state.sortDirection = (state.sortColumn === col && state.sortDirection === 'desc') ? 'asc' : 'desc';
    // re-read — if same column, already flipped above; if new column, default desc
    if (state.sortColumn !== col) { state.sortColumn = col; state.sortDirection = 'desc'; }
    updateSortHeaders();
    applyFiltersAndSort();
}

// ─── Slider UI ────────────────────────────────────────────────────────────────

function updateSliderUI() {
    const isPct = elements.minutesToggle.checked;
    elements.minutesSlider.max = isPct ? 100 : (state.timeframe === 'last_5' ? 450 : 900);
    elements.minutesLabel.textContent = isPct
        ? `Min Minutes: ${elements.minutesSlider.value}%`
        : `Min Minutes: ${elements.minutesSlider.value}`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

    // Populate element refs
    elements.btnLast5              = document.getElementById('btn-last5');
    elements.btnLast10             = document.getElementById('btn-last10');
    elements.positionBtns          = document.querySelectorAll('.position-tabs button');
    elements.teamFilterRow         = document.getElementById('team-filter-row');
    elements.teamFilterToggleBtn   = document.getElementById('team-filter-toggle-btn');
    elements.teamFilterPanel       = document.getElementById('team-filter-panel');
    elements.searchInput           = document.getElementById('search-input');
    elements.tableBody             = document.getElementById('table-body');
    elements.tableHeaders          = document.querySelectorAll('th');
    elements.btnPrev               = document.getElementById('btn-prev');
    elements.btnNext               = document.getElementById('btn-next');
    elements.pageInfo              = document.getElementById('page-info');
    elements.errorMessage          = document.getElementById('error-message');
    elements.minutesSlider         = document.getElementById('minutes-slider');
    elements.minutesToggle         = document.getElementById('minutes-toggle');
    elements.minutesLabel          = document.getElementById('minutes-label');

    // ── Collapsible team panel ──
    elements.teamFilterToggleBtn.addEventListener('click', () => {
        const open = elements.teamFilterPanel.classList.toggle('open');
        elements.teamFilterToggleBtn.classList.toggle('open', open);
    });

    document.getElementById('btn-select-all-teams').addEventListener('click', () => {
        state.selectedTeams = [];
        document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
        state.currentPage = 1;
        updateTeamFilterUI();
        applyFiltersAndSort();
    });

    document.getElementById('btn-clear-teams').addEventListener('click', () => {
        state.selectedTeams = [];
        document.querySelectorAll('.team-logo-btn').forEach(b => b.classList.remove('selected'));
        state.currentPage = 1;
        updateTeamFilterUI();
        applyFiltersAndSort();
    });

    // ── Timeframe ──
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

    // ── Minutes ──
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

    // ── Search ──
    elements.searchInput.addEventListener('input', e => {
        state.searchQuery = e.target.value;
        state.currentPage = 1;
        applyFiltersAndSort();
    });

    // ── Sort ──
    elements.tableHeaders.forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (!col) return;
            if (state.sortColumn === col) {
                state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                state.sortColumn = col;
                state.sortDirection = 'desc';
            }
            state.currentPage = 1;
            updateSortHeaders();
            applyFiltersAndSort();
        });
    });

    // ── Pagination ──
    elements.btnPrev.addEventListener('click', () => {
        if (state.currentPage > 1) { state.currentPage--; updatePagination(); renderTable(); }
    });
    elements.btnNext.addEventListener('click', () => {
        const total = Math.ceil(state.filteredPlayers.length / state.itemsPerPage) || 1;
        if (state.currentPage < total) { state.currentPage++; updatePagination(); renderTable(); }
    });

    // ── Position tabs ──
    elements.positionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.positionBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.positionFilter = btn.getAttribute('data-pos');
            state.currentPage = 1;
            applyFiltersAndSort();
        });
    });

    // ── Load data ──
    fetchPlayers();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { state, elements, fetchPlayers, populateTeamFilter,
        applyFiltersAndSort, updatePagination, renderTable, updateSortHeaders };
}