(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLPlayerQueryUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const COLUMN_NAMES = [
    "xG",
    "xA",
    "xGI",
    "influence",
    "creativity",
    "threat",
    "ict",
    "bps",
    "bonus",
    "points",
    "saves",
    "defcon",
    "goals",
    "assists",
    "clean_sheets",
    "ppg",
  ];

  function numberOrZero(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function elementIdSet(elementIds) {
    return new Set((elementIds || []).map((elementId) => Number(elementId)));
  }

  function valueFor(player, prefix, sortColumn) {
    if (sortColumn === "value") {
      const price = numberOrZero(player.price);
      return price > 0 ? numberOrZero(player[`${prefix}points`]) / price : 0;
    }
    return numberOrZero(player[`${prefix}${sortColumn}`]);
  }

  function queryPlayers({ players, prefix, maxMinutes, criteria }) {
    const {
      minutesMode,
      minMinutes,
      priceMin,
      priceMax,
      searchQuery,
      selectedTeams,
      positionFilter,
      watchlistOnly,
      watchlistElementIds,
      mySquadOnly,
      squadElementIds,
      sortColumn,
      sortDirection,
    } = criteria;
    const watchlistIds = elementIdSet(watchlistElementIds);
    const squadIds = elementIdSet(squadElementIds);
    const teamFilter = selectedTeams || [];
    const query = String(searchQuery || "").toLowerCase();
    const usePercentageMinutes = minutesMode === "percent";

    const filteredPlayers = (players || []).filter((player) => {
      const minutes = numberOrZero(player[`${prefix}minutes`]);
      if (!minutes) return false;
      if (
        usePercentageMinutes
          ? Math.round((minutes / maxMinutes) * 100) < minMinutes
          : minutes < minMinutes
      ) {
        return false;
      }
      if (player.price < priceMin || player.price > priceMax) return false;
      if (!player.name.toLowerCase().includes(query)) return false;
      if (teamFilter.length && !teamFilter.includes(player.team)) return false;
      if (positionFilter !== "All" && player.position !== positionFilter) return false;
      if (watchlistOnly && watchlistIds.size && !watchlistIds.has(Number(player.element_id))) {
        return false;
      }
      if (mySquadOnly && squadIds.size && !squadIds.has(Number(player.element_id))) {
        return false;
      }
      return true;
    });

    filteredPlayers.sort((playerA, playerB) => {
      if (sortColumn === "name") {
        const nameA = playerA.name.toLowerCase();
        const nameB = playerB.name.toLowerCase();
        return sortDirection === "asc"
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }
      const valueA = valueFor(playerA, prefix, sortColumn);
      const valueB = valueFor(playerB, prefix, sortColumn);
      return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
    });

    const columnMaxes = {};
    COLUMN_NAMES.forEach((column) => {
      columnMaxes[column] = Math.max(
        ...filteredPlayers.map((player) => numberOrZero(player[`${prefix}${column}`])),
        0.01,
      );
    });
    columnMaxes.value = Math.max(
      ...filteredPlayers.map((player) => valueFor(player, prefix, "value")),
      0.01,
    );

    return { players: filteredPlayers, columnMaxes };
  }

  function getPagination({ totalItems, itemsPerPage, currentPage }) {
    const safeItemsPerPage = Math.max(Math.floor(numberOrZero(itemsPerPage)), 1);
    const totalPages = Math.max(
      Math.ceil(Math.max(numberOrZero(totalItems), 0) / safeItemsPerPage),
      1,
    );
    const requestedPage = Math.floor(numberOrZero(currentPage));
    const clampedPage = Math.min(Math.max(requestedPage, 1), totalPages);
    const startIndex = (clampedPage - 1) * safeItemsPerPage;

    return {
      currentPage: clampedPage,
      totalPages,
      startIndex,
      endIndex: startIndex + safeItemsPerPage,
    };
  }

  return { queryPlayers, getPagination };
});
