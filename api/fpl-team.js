const { normalizeTeamId, normalizeTeamPicks } = require("../team_profile_utils.js");

const FPL_API_BASE = "https://fantasy.premierleague.com/api";

function sendJson(response, statusCode, body) {
  response.status(statusCode).json(body);
}

function selectAuthoritativeEvent(events) {
  if (!Array.isArray(events)) return null;
  const validEvent = (event) => Number.isSafeInteger(Number(event?.id)) && Number(event.id) > 0;
  return (
    events.find((event) => validEvent(event) && event.is_current === true) ||
    events.find((event) => validEvent(event) && event.is_next === true) ||
    null
  );
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("FPL upstream request failed");
  return response.json();
}

async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  const requestedTeamId = request.query?.teamId;
  const teamId =
    typeof requestedTeamId === "string" || typeof requestedTeamId === "number"
      ? normalizeTeamId(requestedTeamId)
      : null;
  if (!teamId) {
    sendJson(response, 400, { error: "A positive numeric Team ID is required" });
    return;
  }

  try {
    const bootstrap = await fetchJson(`${FPL_API_BASE}/bootstrap-static/`);
    const event = selectAuthoritativeEvent(bootstrap?.events);
    if (!event) throw new Error("No authoritative current or next event");

    const picksPayload = await fetchJson(
      `${FPL_API_BASE}/entry/${teamId}/event/${Number(event.id)}/picks/`,
    );
    const picks = normalizeTeamPicks(picksPayload?.picks);
    if (!picks.length) throw new Error("No valid public picks");

    response.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
    sendJson(response, 200, {
      teamId,
      event: Number(event.id),
      picks,
    });
  } catch (_) {
    sendJson(response, 502, { error: "FPL team data is temporarily unavailable" });
  }
}

module.exports = handler;
module.exports.selectAuthoritativeEvent = selectAuthoritativeEvent;
