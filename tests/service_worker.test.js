const fs = require("fs");
const path = require("path");

const serviceWorker = fs.readFileSync(path.join(__dirname, "..", "sw.js"), "utf8");

describe("service-worker upgrade safety", () => {
  test("uses a shared network-first path that updates the cache before serving app-shell resources", () => {
    expect(serviceWorker).toContain("function networkFirst(request)");
    expect(serviceWorker).toContain("return fetch(request)");
    expect(serviceWorker).toContain("cacheSuccessfulSameOriginResponse(request, networkResponse)");
    expect(serviceWorker).toContain("event.respondWith(networkFirst(event.request));");
    expect(serviceWorker).not.toContain(
      "caches.match(event.request, { ignoreSearch: true }).then((cachedResponse) => {\n      if (cachedResponse) return cachedResponse;",
    );
  });

  test("retains a cached fallback only after a same-origin network request fails", () => {
    expect(serviceWorker).toContain(".catch(() =>");
    expect(serviceWorker).toContain("caches.match(request, { ignoreSearch: true })");
    expect(serviceWorker).toContain("cachedResponse || Response.error()");
  });

  test("keeps players.json on the same network-first resilience path", () => {
    expect(serviceWorker).toContain('if (url.pathname.endsWith("/players.json"))');
    expect(serviceWorker).toContain("event.respondWith(networkFirst(event.request))");
  });
});
