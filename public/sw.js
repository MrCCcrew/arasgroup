const CACHE_NAME = "rashid-erp-v2";

const STATIC_CACHEABLE = [
  "/manifest.json",
];

// Install — only cache truly static assets (no authenticated pages)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_CACHEABLE))
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// Fetch — never intercept API or auth routes; pass everything else through
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never intercept: API calls, auth pages, or non-GET requests
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/dashboard") ||
    event.request.method !== "GET"
  ) {
    return; // let the browser handle it natively — cookies work correctly
  }

  // Static assets only — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
