(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLRenderUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  }

  function safeImageURL(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" ? parsed.href : "";
    } catch {
      return "";
    }
  }

  function safePositionClass(value) {
    return new Set(["GK", "DEF", "MID", "FWD"]).has(value) ? value : "UNK";
  }

  return { escapeHTML, safeImageURL, safePositionClass };
});
