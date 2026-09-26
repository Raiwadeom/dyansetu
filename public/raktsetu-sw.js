/* RaktSetu service worker — shows blood-request alerts and opens the request
   when one is tapped. Scoped to /raktsetu/ (see src/raktsetu/push.js). Push
   payloads never contain phone numbers. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "RaktSetu", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "RaktSetu: blood needed";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "Open RaktSetu to see the request.",
    icon: "/icon-192.png",
    badge: "/favicon-32x32.png",
    tag: data.tag || "raktsetu",
    renotify: true,
    data: { url: data.url || "/raktsetu/requests" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/raktsetu/requests", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(`${self.location.origin}/raktsetu`) && "focus" in client) {
        await client.focus();
        if ("navigate" in client) return client.navigate(target);
        return undefined;
      }
    }
    return self.clients.openWindow(target);
  })());
});
