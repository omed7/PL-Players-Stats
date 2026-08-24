const fs = require("fs");
const path = require("path");

const workflow = fs.readFileSync(
  path.join(__dirname, "..", ".github", "workflows", "update_data.yml"),
  "utf8",
);

describe("FPL data publication workflow", () => {
  test("serializes output-writing runs without cancelling an active validated publication", () => {
    expect(workflow).toMatch(
      /concurrency:\s*\n\s*group:\s*fpl-data-publication\s*\n\s*cancel-in-progress:\s*false/,
    );
    expect(workflow.indexOf("concurrency:")).toBeLessThan(workflow.indexOf("jobs:"));
  });
});
