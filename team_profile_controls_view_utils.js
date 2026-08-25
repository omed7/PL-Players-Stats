(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLTeamProfileControlsViewUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const LOCAL_NOTE = "Public lookup only. Team and preferences stay on this device.";
  const ACCOUNT_NOTE =
    "Public lookup only. Team ID and supported preferences sync with this Google account.";

  function buildTeamProfileControlsViewModel({
    teamId = null,
    isSignedIn = false,
    hasSquad = false,
    mySquadOnly = false,
  } = {}) {
    const isConnected = Boolean(teamId);
    const mySquadActive = Boolean(mySquadOnly);

    return {
      isConnected,
      teamIdInputValue: isConnected ? String(teamId) : null,
      note: isSignedIn ? ACCOUNT_NOTE : LOCAL_NOTE,
      actionsHidden: !isConnected,
      connectLabel: isConnected ? "Update" : "Connect",
      mySquad: {
        disabled: !Boolean(hasSquad),
        active: mySquadActive,
        ariaPressed: String(mySquadActive),
      },
    };
  }

  return {
    LOCAL_NOTE,
    ACCOUNT_NOTE,
    buildTeamProfileControlsViewModel,
  };
});
