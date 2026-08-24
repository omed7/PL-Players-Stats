const CACHE_NAME = "fpl-omed-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function cacheSuccessfulSameOriginResponse(request, response) {
  if (!response || !response.ok || request.method !== "GET") return;
  caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
}

function networkFirst(request) {
  return fetch(request)
    .then((networkResponse) => {
      cacheSuccessfulSameOriginResponse(request, networkResponse);
      return networkResponse;
    })
    .catch(() =>
      caches.match(request, { ignoreSearch: true }).then(
        (cachedResponse) => cachedResponse || Response.error(),
      ),
    );
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache third-party data or analytics responses. In particular, the live
  // FPL bootstrap request must retain its caller's network-only freshness policy.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.endsWith("/players.json")) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // Keep the app shell fresh across deployments. Cached same-origin responses are
  // resilience fallback only, never the preferred response for a returning user.
  event.respondWith(networkFirst(event.request));
});
