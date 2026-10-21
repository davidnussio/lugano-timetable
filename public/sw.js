// Service worker used to show the timer notifications (mobile browsers only
// allow notifications from a service worker) and the push messages of the
// usual journeys, which arrive with the app closed. It also keeps the static
// files of the app: their names change with their content, so a cached copy
// is never stale and a launch from the home screen does not wait for them.

const STATIC_CACHE = "static-v1";
// Files of past deploys pile up: keep the most recent ones
const STATIC_LIMIT = 300;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// In development the files keep their names while they change
const development = ["localhost", "127.0.0.1"].includes(self.location.hostname);

const isStatic = (url) =>
  !development &&
  url.origin === self.location.origin &&
  url.pathname.startsWith("/_next/static/");

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT)).map((key) => cache.delete(key)));
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await trim(cache);
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (isStatic(new URL(event.request.url))) event.respondWith(cacheFirst(event.request));
});

// A message of the server: { title, body, tag, url }. The tag of the routine
// replaces its previous notification instead of piling them up.
self.addEventListener("push", (event) => {
  let message = {};
  try {
    message = event.data?.json() ?? {};
  } catch {
    message = { body: event.data?.text() };
  }
  event.waitUntil(
    self.registration.showNotification(message.title ?? "Lugano Bus", {
      body: message.body ?? "",
      tag: message.tag ?? "routine",
      renotify: true,
      vibrate: [250, 120, 250],
      icon: "/icon",
      badge: "/icon",
      data: { url: message.url ?? "/tragitto" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/timer", self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const client = clients.find((c) => new URL(c.url).origin === url.origin);
      if (client) {
        client.navigate?.(url.href);
        return client.focus();
      }
      return self.clients.openWindow(url.href);
    })
  );
});
