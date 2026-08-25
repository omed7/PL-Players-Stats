const {
  buildTeamProfileControlsViewModel,
} = require("../team_profile_controls_view_utils.js");

describe("Team Profile controls view-model utility", () => {
  test("builds the signed-out disconnected local-device presentation without overwriting input", () => {
    expect(
      buildTeamProfileControlsViewModel({
        teamId: null,
        isSignedIn: false,
        hasSquad: false,
        mySquadOnly: false,
      }),
    ).toEqual({
      isConnected: false,
      teamIdInputValue: null,
      note: "Public lookup only. Team and preferences stay on this device.",
      actionsHidden: true,
      connectLabel: "Connect",
      mySquad: {
        disabled: true,
        active: false,
        ariaPressed: "false",
      },
    });
  });

  test("builds connected local controls with the existing Team ID text and enabled squad action", () => {
    expect(
      buildTeamProfileControlsViewModel({
        teamId: 123456,
        isSignedIn: false,
        hasSquad: true,
        mySquadOnly: false,
      }),
    ).toEqual({
      isConnected: true,
      teamIdInputValue: "123456",
      note: "Public lookup only. Team and preferences stay on this device.",
      actionsHidden: false,
      connectLabel: "Update",
      mySquad: {
        disabled: false,
        active: false,
        ariaPressed: "false",
      },
    });
  });

  test("changes only the explanatory copy for the signed-in account presentation", () => {
    const local = buildTeamProfileControlsViewModel({
      teamId: 7,
      isSignedIn: false,
      hasSquad: true,
      mySquadOnly: true,
    });
    const signedIn = buildTeamProfileControlsViewModel({
      teamId: 7,
      isSignedIn: true,
      hasSquad: true,
      mySquadOnly: true,
    });

    expect(signedIn).toEqual({
      ...local,
      note: "Public lookup only. Team ID and supported preferences sync with this Google account.",
    });
  });

  test("preserves active and aria-pressed state from My Squad filtering even when no squad is available", () => {
    expect(
      buildTeamProfileControlsViewModel({
        teamId: 99,
        isSignedIn: true,
        hasSquad: false,
        mySquadOnly: true,
      }).mySquad,
    ).toEqual({
      disabled: true,
      active: true,
      ariaPressed: "true",
    });
  });

  test("uses the supplied truthy Team ID only for existing presentation and does not normalize profile data", () => {
    expect(
      buildTeamProfileControlsViewModel({
        teamId: "public-team-id",
        isSignedIn: false,
        hasSquad: 1,
        mySquadOnly: 0,
      }),
    ).toMatchObject({
      isConnected: true,
      teamIdInputValue: "public-team-id",
      connectLabel: "Update",
      actionsHidden: false,
      mySquad: {
        disabled: false,
        active: false,
        ariaPressed: "false",
      },
    });
  });
});
