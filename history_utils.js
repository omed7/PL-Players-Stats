(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLHistoryUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function isValidMatchRecord(record) {
    return (
      record &&
      Number.isInteger(record.fixture_id) &&
      record.fixture_id > 0 &&
      typeof record.was_home === "boolean"
    );
  }

  function compareMatches(a, b) {
    const aTime = Date.parse(a.kickoff_time || "");
    const bTime = Date.parse(b.kickoff_time || "");
    const bothTimesValid = Number.isFinite(aTime) && Number.isFinite(bTime);

    if (bothTimesValid && aTime !== bTime) return aTime - bTime;
    return a.fixture_id - b.fixture_id;
  }

  function selectRecentMatches(history, options = {}) {
    const venue = options.venue || "all";
    const limit = options.limit || 10;

    if (!["all", "home", "away"].includes(venue)) {
      throw new Error(`Unsupported venue filter: ${venue}`);
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("Match-history limit must be a positive integer");
    }

    const venueMatches = (Array.isArray(history) ? history : [])
      .filter(isValidMatchRecord)
      .filter((record) => {
        if (venue === "home") return record.was_home;
        if (venue === "away") return !record.was_home;
        return true;
      })
      .sort(compareMatches);

    return venueMatches.slice(-limit);
  }

  function matchLabel(record) {
    const gw = Number.isInteger(record?.gw) && record.gw > 0 ? `GW${record.gw}` : "GW?";
    if (typeof record?.was_home !== "boolean") return gw;
    return `${gw} ${record.was_home ? "H" : "A"}`;
  }

  return { isValidMatchRecord, compareMatches, selectRecentMatches, matchLabel };
});
