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

// ── Web Push ──────────────────────────────────────────────────────────────────
self.addEventListener("push", function (event) {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: "تذكير", body: event.data.text() }; }

  const options = {
    body: data.body || "",
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "reminder",
    requireInteraction: true,
    dir: "rtl",
    lang: "ar",
    data: { url: data.url || "/dashboard/reminders" },
  };
  event.waitUntil(self.registration.showNotification(data.title || "تذكير", options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/dashboard/reminders";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
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
