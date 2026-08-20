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
});
