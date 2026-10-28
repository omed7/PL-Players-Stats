const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const yaml = require("js-yaml"); // Already provided by the existing Jest lockfile.

const workflow = fs.readFileSync(
  path.join(__dirname, "..", ".github", "workflows", "update_data.yml"),
  "utf8",
);
const publication = yaml.safeLoad(workflow);
const validationText = fs.readFileSync(
  path.join(__dirname, "..", ".github", "workflows", "test.yml"),
  "utf8",
);
const validation = yaml.safeLoad(validationText);
const job = publication.jobs["update-data"];
const steps = job.steps;
const credentialStepName = "Check publication credential";
const publisherStepName = "Publish validated snapshot to Supabase";

function stepNamed(name) {
  const step = steps.find((candidate) => candidate.name === name);
  expect(step).toBeDefined();
  return step;
}

function checkCredential(value) {
  const step = stepNamed(credentialStepName);
  // Never inherit real credentials or execute the fetch/publish commands.
  const env = { PATH: process.env.PATH };
  if (value !== undefined) env.SUPABASE_SERVICE_ROLE_KEY = value;
  return spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", step.run], {
    env,
    encoding: "utf8",
    timeout: 5000,
  });
}

describe("FPL data publication workflow", () => {
  test("restricts fetcher pushes to main while retaining schedule and dispatch", () => {
    expect(Object.keys(publication.on).sort()).toEqual(["push", "schedule", "workflow_dispatch"]);
    expect(publication.on.push).toEqual({ branches: ["main"], paths: ["fpl_fetcher.py"] });
    expect(publication.on.schedule).toEqual([{ cron: "0 3 * * *" }]);
    expect(publication.on).toHaveProperty("workflow_dispatch");
  });

  test("guards the whole job with the exact main branch and allowed events", () => {
    // Assert the actual expression, ignoring formatting only. This encodes the
    // runbook policy matrix without a second GitHub-expression implementation.
    const expected = "${{ github.ref == 'refs/heads/main' && (github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' || github.event_name == 'push') }}";
    expect(String(job.if).replace(/\s/g, "")).toBe(expected.replace(/\s/g, ""));
    expect(job.environment).toBe("fpl-data-production");
  });

  test("grants content write only to the guarded production job", () => {
    expect(publication.permissions).toEqual({ contents: "read" });
    expect(Object.keys(publication.jobs)).toEqual(["update-data"]);
    expect(job.permissions).toEqual({ contents: "write" });
  });

  test("keeps pull-request validation read-only and free of production secrets", () => {
    expect(validation.on).toHaveProperty("pull_request");
    expect(validation.permissions).toEqual({ contents: "read" });
    for (const validationJob of Object.values(validation.jobs)) {
      expect(validationJob.permissions).toBeUndefined();
      expect(validationJob.environment).toBeUndefined();
    }
    expect(validationText).not.toMatch(/secrets\s*[.\[]|SUPABASE_SERVICE_ROLE_KEY/);
    expect(validation.jobs.test.steps.some((step) => step.run === "npm test")).toBe(true);
  });

  test("scopes the publishing key only to its presence check and publisher", () => {
    expect(publication.env).toBeUndefined();
    expect(job.env).toBeUndefined();
    const secretReference = /secrets\s*[.\[]/;
    const secretSteps = steps.filter((step) => secretReference.test(JSON.stringify(step)));
    expect(secretSteps.map((step) => step.name)).toEqual([credentialStepName, publisherStepName]);
    for (const step of secretSteps) {
      expect(step.env.SUPABASE_SERVICE_ROLE_KEY).toBe("${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}");
      const { env, ...rest } = step;
      expect(JSON.stringify(rest)).not.toMatch(secretReference);
    }
    expect(steps.filter((step) => step.env?.SUPABASE_SERVICE_ROLE_KEY).map((step) => step.name))
      .toEqual([credentialStepName, publisherStepName]);
  });

  test.each([undefined, ""])("fails clearly with an absent/empty publishing credential (%p)", (value) => {
    const result = checkCredential(value);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toMatch(/::error::.*SUPABASE_SERVICE_ROLE_KEY.*fpl-data-production/);
  });

  test("accepts a present credential without printing or serializing its value", () => {
    const result = checkCredential("synthetic-service-key-not-a-real-credential");
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("");
  });

  test("tests and checks configuration before fetch, then publishes before commit", () => {
    const pipeline = [
      "Run data-contract tests",
      credentialStepName,
      "Run FPL fetcher script",
      publisherStepName,
      "Commit and push changed data",
    ].map(stepNamed);
    const positions = pipeline.map((step) => steps.indexOf(step));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(pipeline[0].run).toBe("npm test");
    expect(pipeline[1].shell).toBe("bash");
    expect(pipeline[2].run).toBe("python fpl_fetcher.py");
    expect(pipeline[3].run).toBe("python supabase_publisher.py");
    expect(job["continue-on-error"]).toBeUndefined();
    for (const step of steps) {
      expect(step.if).toBeUndefined(); // Default success() propagates failures.
      expect(step["continue-on-error"]).toBeUndefined();
    }
    expect(pipeline[4].run).toMatch(/if git diff --cached --quiet; then\s+echo 'No player-data changes to commit\.'\s+exit 0\s+fi/);
    expect(pipeline[4].run).toMatch(/git add players\.json/);
    expect(pipeline[4].run).toMatch(/git commit[^\n]+\n\s*git push\s*$/);
  });

  test("serializes output-writing runs without cancelling an active validated publication", () => {
    expect(workflow).toMatch(
      /concurrency:\s*\n\s*group:\s*fpl-data-publication\s*\n\s*cancel-in-progress:\s*false/,
    );
    expect(workflow.indexOf("concurrency:")).toBeLessThan(workflow.indexOf("jobs:"));
  });
});
