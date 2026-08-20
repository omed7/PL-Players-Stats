(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FPLAccountAuth = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function normalizeCanonicalOrigin(value) {
    if (typeof value !== "string" || !value) return null;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.origin === value.replace(/\/$/, "")
        ? url.origin
        : null;
    } catch {
      return null;
    }
  }

  function normalizeAccountConfig(config) {
    if (!config || typeof config !== "object") return null;
    const canonicalOrigin = normalizeCanonicalOrigin(config.canonicalOrigin);
    if (
      typeof config.supabaseUrl !== "string" ||
      !config.supabaseUrl.startsWith("https://") ||
      typeof config.supabasePublishableKey !== "string" ||
      !config.supabasePublishableKey ||
      !canonicalOrigin
    ) {
      return null;
    }

    return {
      accountEnabled: config.accountEnabled === true,
      supabaseUrl: config.supabaseUrl,
      supabasePublishableKey: config.supabasePublishableKey,
      canonicalOrigin,
    };
  }

  function createBrowserClient(config) {
    const supabaseApi = globalThis.supabase;
    if (!supabaseApi?.createClient) return null;
    return supabaseApi.createClient(config.supabaseUrl, config.supabasePublishableKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });
  }

  function createAccountAuth(rawConfig, dependencies = {}) {
    const config = normalizeAccountConfig(rawConfig);
    const client = dependencies.client || (config ? createBrowserClient(config) : null);

    function assertAvailable() {
      if (!config?.accountEnabled || !client?.auth) {
        throw new Error("Google account sign-in is not available yet");
      }
    }

    return {
      config,
      client,
      isEnabled: () => Boolean(config?.accountEnabled && client?.auth),
      async signInWithGoogle() {
        assertAvailable();
        const { error } = await client.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${config.canonicalOrigin}/` },
        });
        if (error) throw error;
      },
      async getSession() {
        if (!config?.accountEnabled || !client?.auth) return null;
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data?.session || null;
      },
      onAuthStateChange(callback) {
        if (!config?.accountEnabled || !client?.auth?.onAuthStateChange) return () => {};
        const { data } = client.auth.onAuthStateChange(callback);
        return () => data?.subscription?.unsubscribe?.();
      },
      async signOut() {
        assertAvailable();
        const { error } = await client.auth.signOut();
        if (error) throw error;
      },
    };
  }

  return { normalizeAccountConfig, createAccountAuth };
});
