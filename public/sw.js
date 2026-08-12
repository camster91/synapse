const CACHE_NAME = "synapse-v2";
const PRECACHE_URLS = ["/manifest.json"];

// Install: precache shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: always get navigation and private API data from the network.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and chrome-extension requests
  if (request.method !== "GET" || url.protocol === "chrome-extension:") return;

  if (request.mode === "navigate" || url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request));
    return;
  }

  // Versioned static assets can be cached safely.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      });
    })
  );
});

// Push notifications
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Synapse";
  const options = {
    body: data.body || data.message || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: {
      url: data.actionUrl || "/today",
    },
    vibrate: [100, 50, 100],
    tag: data.tag || "synapse-notification",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click: focus or open window
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/today";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.navigate(url).then(() => client.focus());
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});
