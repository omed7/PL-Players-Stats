const {
  escapeHTML,
  safeImageURL,
  safePositionClass,
} = require("../render_utils.js");

describe("render safety utilities", () => {
  test("encodes markup-like public text for HTML, attribute, and SVG-template contexts", () => {
    expect(escapeHTML('<img src=x onerror="alert(1)"> & \'quoted\'')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;quoted&#39;",
    );
  });

  test("preserves valid HTTPS image URLs while rejecting unsafe or non-absolute sources", () => {
    expect(safeImageURL("https://resources.premierleague.com/badge.png")).toBe(
      "https://resources.premierleague.com/badge.png",
    );
    expect(safeImageURL("javascript:alert(1)")).toBe("");
    expect(safeImageURL("data:image/svg+xml,<svg/>")).toBe("");
    expect(safeImageURL("/relative-logo.png")).toBe("");
    expect(safeImageURL("not a URL")).toBe("");
  });

  test("permits only supported position tokens in CSS class suffixes", () => {
    expect(safePositionClass("GK")).toBe("GK");
    expect(safePositionClass("<img onerror=alert(1)>")).toBe("UNK");
    expect(safePositionClass("mid")).toBe("UNK");
  });
});
