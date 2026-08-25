const {
  buildTeamFilterViewModel,
  toggleTeamFilterSelection,
} = require("../team_filter_view_utils.js");

describe("Team filter view-model utility", () => {
  test("deduplicates Team names with the latest public logo and keeps locale-sorted item order", () => {
    expect(
      buildTeamFilterViewModel({
        players: [
          { team: "BHA", logo: "old-bha.png" },
          { team: "CHE", logo: "che.png" },
          { team: "ARS", logo: "ars.png" },
          { team: "BHA", logo: "latest-bha.png" },
        ],
        selectedTeams: ["BHA"],
      }).teams,
    ).toEqual([
      { name: "ARS", logo: "ars.png", selected: false },
      { name: "BHA", logo: "latest-bha.png", selected: true },
      { name: "CHE", logo: "che.png", selected: false },
    ]);
  });

  test.each([
    {
      selectedTeams: [],
      expected: {
        count: 0,
        hasSelection: false,
        label: "Filter by Team",
        countLabel: "",
      },
    },
    {
      selectedTeams: ["BHA"],
      expected: {
        count: 1,
        hasSelection: true,
        label: "Team: BHA",
        countLabel: "",
      },
    },
    {
      selectedTeams: ["BHA", "CHE"],
      expected: {
        count: 2,
        hasSelection: true,
        label: "Filter by Team",
        countLabel: "2 selected",
      },
    },
  ])("preserves existing selection presentation for %# Team selections", ({ selectedTeams, expected }) => {
    expect(
      buildTeamFilterViewModel({ players: [], selectedTeams }).selection,
    ).toEqual(expected);
  });

  test("selects the first Team and appends a different Team without mutating the supplied selection", () => {
    const emptySelection = [];
    const existingSelection = ["BHA"];

    expect(
      toggleTeamFilterSelection({ selectedTeams: emptySelection, teamName: "CHE" }),
    ).toEqual({ selectedTeams: ["CHE"] });
    expect(
      toggleTeamFilterSelection({ selectedTeams: existingSelection, teamName: "CHE" }),
    ).toEqual({ selectedTeams: ["BHA", "CHE"] });
    expect(emptySelection).toEqual([]);
    expect(existingSelection).toEqual(["BHA"]);
  });

  test("removes an already-selected Team and clears the final selection", () => {
    expect(
      toggleTeamFilterSelection({ selectedTeams: ["BHA", "CHE"], teamName: "BHA" }),
    ).toEqual({ selectedTeams: ["CHE"] });
    expect(
      toggleTeamFilterSelection({ selectedTeams: ["BHA"], teamName: "BHA" }),
    ).toEqual({ selectedTeams: [] });
  });
});
