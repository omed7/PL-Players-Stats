(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLSchemaUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const SUPPORTED_SCHEMA_VERSIONS = new Set([1, 2]);

  function classifyPlayerDataset(payload) {
    if (Array.isArray(payload)) {
      return {
        compatible: true,
        schemaVersion: 1,
        dataset: { players: payload },
      };
    }

    if (
      !payload ||
      typeof payload !== "object" ||
      !Number.isInteger(payload.schema_version) ||
      !SUPPORTED_SCHEMA_VERSIONS.has(payload.schema_version) ||
      !Array.isArray(payload.players)
    ) {
      return { compatible: false, schemaVersion: null };
    }

    return {
      compatible: true,
      schemaVersion: payload.schema_version,
      dataset: payload,
    };
  }

  return { classifyPlayerDataset, SUPPORTED_SCHEMA_VERSIONS };
});
