const {
  normalizeAccountConfig,
  createAccountAuth,
} = require("../account_auth.js");

function makeClient() {
  return {
    auth: {
      signInWithOAuth: jest.fn().mockResolvedValue({ data: {}, error: null }),
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
    },
  };
}

describe("Google OAuth account adapter", () => {
  const validConfig = {
    accountEnabled: true,
    supabaseUrl: "https://project.supabase.co",
    supabasePublishableKey: "sb_publishable_test",
    canonicalOrigin: "https://fpl-omed.vercel.app",
  };

  test("requires an explicit release flag and valid non-secret browser config", () => {
    expect(normalizeAccountConfig({ ...validConfig, accountEnabled: false })).toEqual({
      ...validConfig,
      accountEnabled: false,
      canonicalOrigin: "https://fpl-omed.vercel.app",
    });
    expect(normalizeAccountConfig({ ...validConfig, supabasePublishableKey: "" })).toBeNull();
    expect(normalizeAccountConfig({ ...validConfig, canonicalOrigin: "http://unsafe.example" })).toBeNull();
  });

  test("does not initiate OAuth while the account release is disabled", async () => {
    const client = makeClient();
    const auth = createAccountAuth({ ...validConfig, accountEnabled: false }, { client });

    await expect(auth.signInWithGoogle()).rejects.toThrow("not available");
    expect(client.auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  test("starts Google OAuth with the configured canonical root redirect only", async () => {
    const client = makeClient();
    const auth = createAccountAuth(validConfig, { client });

    await auth.signInWithGoogle("https://attacker.example/return");

    expect(client.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://fpl-omed.vercel.app/" },
    });
  });

  test("reads session, reports auth changes, and signs out through the same client", async () => {
    const client = makeClient();
    const callback = jest.fn();
    const auth = createAccountAuth(validConfig, { client });

    expect(await auth.getSession()).toBeNull();
    const unsubscribe = auth.onAuthStateChange(callback);
    const registeredCallback = client.auth.onAuthStateChange.mock.calls[0][0];
    registeredCallback("SIGNED_IN", { user: { id: "user-1" } });
    expect(callback).toHaveBeenCalledWith("SIGNED_IN", { user: { id: "user-1" } });
    await auth.signOut();
    expect(client.auth.signOut).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
