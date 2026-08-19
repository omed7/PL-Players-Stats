(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLPublicDataLoader = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function classifyPayload(payload, classifyDataset) {
    const classified = classifyDataset(payload);
    if (!classified?.compatible) {
      throw new Error("Player dataset is incompatible");
    }
    return classified;
  }

  async function fetchSupabaseSnapshot(config, request, classifyDataset) {
    if (!config?.supabaseUrl || !config?.supabasePublishableKey) {
      throw new Error("Supabase public reader is not configured");
    }

    const response = await request(
      `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/current_fpl_snapshot?select=payload&limit=1`,
      {
        headers: {
          apikey: config.supabasePublishableKey,
          Authorization: `Bearer ${config.supabasePublishableKey}`,
        },
      },
    );
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);

    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1 || !rows[0]?.payload) {
      throw new Error("Supabase has no current published snapshot");
    }

    return {
      ...classifyPayload(rows[0].payload, classifyDataset),
      source: "supabase",
      fallbackReason: null,
    };
  }

  async function fetchStaticSnapshot(request, classifyDataset) {
    const response = await request("players.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Static snapshot HTTP ${response.status}`);

    return {
      ...classifyPayload(await response.json(), classifyDataset),
      source: "static",
    };
  }

  async function loadPlayerDataset(options = {}) {
    const request = options.request || fetch;
    const classifyDataset = options.classifyDataset;
    const config = options.config || {};

    if (typeof classifyDataset !== "function") {
      throw new Error("Player dataset classifier is required");
    }

    if (config.sourceMode !== "static-only") {
      try {
        return await fetchSupabaseSnapshot(config, request, classifyDataset);
      } catch (error) {
        if (!config.allowStaticFallback) throw error;
        try {
          const fallback = await fetchStaticSnapshot(request, classifyDataset);
          return { ...fallback, fallbackReason: error.message };
        } catch (fallbackError) {
          throw new Error(
            `Supabase reader failed (${error.message}); static fallback failed (${fallbackError.message})`,
          );
        }
      }
    }

    return { ...(await fetchStaticSnapshot(request, classifyDataset)), fallbackReason: null };
  }

  return { loadPlayerDataset };
});
