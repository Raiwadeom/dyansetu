/* DnyanSetu service worker — shows college notifications (new announcement,
   scholarship update, new notes) and opens the right page when one is tapped.
   Scope "/". RaktSetu keeps its own worker at /raktsetu/ (raktsetu-sw.js),
   which wins for those pages because its scope is longer.

   No fetch handler: the site is never served from a cache, so a deploy is
   always picked up straight away. */

const VAPID_PUBLIC_KEY = "BH0AzvO_mnYfJ4-kukMUCyUkgpcyrtN1V_1WMIV3GTsyehlLrS3r-YcXuV0WlRDrzYM4oOqxwrSwC9MbhHfRdw8";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "DnyanSetu", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(self.registration.showNotification(data.title || "DnyanSetu", {
    body: data.body || "Something new on DnyanSetu.",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    tag: data.tag || "dnyansetu",
    renotify: true,
    vibrate: [200, 100, 200],
    timestamp: Date.now(),
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      try {
        if ("navigate" in client) {
          const moved = await client.navigate(target);
          if (moved) return (moved.focus ? moved.focus() : undefined);
        }
      } catch { /* not controlled by this worker — try the next one */ }
    }
    return self.clients.openWindow(target);
  })());
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil((async () => {
    const oldEndpoint = event.oldSubscription?.endpoint;
    let sub = event.newSubscription;
    if (!sub) {
      const raw = atob(VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (VAPID_PUBLIC_KEY.length % 4)) % 4));
      sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from([...raw].map((c) => c.charCodeAt(0))),
      });
    }
    if (!oldEndpoint || !sub) return;
    await fetch("/api/site-push", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldEndpoint, subscription: sub.toJSON() }),
    });
  })());
});
