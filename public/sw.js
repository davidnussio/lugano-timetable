// Service worker used to show the timer notifications (mobile browsers only
// allow notifications from a service worker). It does not cache anything.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

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
