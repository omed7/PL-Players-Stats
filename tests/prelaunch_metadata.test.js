const fs = require("fs");
const path = require("path");

const indexHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const canonicalOrigin = "https://fpl-omed.vercel.app";
const legacyOrigin = "https://pl-players-stats-omed7s-projects.vercel.app";

describe("pre-launch public metadata", () => {
  test("uses the approved public canonical origin consistently", () => {
    expect(indexHtml).toContain(`<link rel="canonical" href="${canonicalOrigin}/" />`);
    expect(indexHtml).toContain(`<meta property="og:url" content="${canonicalOrigin}/" />`);
    expect(indexHtml).toContain(
      `<meta property="og:image" content="${canonicalOrigin}/assets/social/fpl-omed-social.png" />`,
    );
    expect(indexHtml).toContain(
      `<meta name="twitter:image" content="${canonicalOrigin}/assets/social/fpl-omed-social.png" />`,
    );
    expect(indexHtml).toContain(
      `path=${encodeURIComponent(`${canonicalOrigin}/`)}&label=VIEWS`,
    );
    expect(indexHtml).not.toContain(legacyOrigin);
  });

  test("loads the dashboard quality-gate helper before the browser controller", () => {
    const helperIndex = indexHtml.indexOf('<script src="dashboard_data_utils.js"></script>');
    const controllerIndex = indexHtml.indexOf('<script src="script.js"></script>');

    expect(helperIndex).toBeGreaterThan(-1);
    expect(helperIndex).toBeLessThan(controllerIndex);
  });

  test("loads the render-safety helper before the browser controller", () => {
    const helperIndex = indexHtml.indexOf('<script src="render_utils.js"></script>');
    const controllerIndex = indexHtml.indexOf('<script src="script.js"></script>');

    expect(helperIndex).toBeGreaterThan(-1);
    expect(helperIndex).toBeLessThan(controllerIndex);
  });
});
