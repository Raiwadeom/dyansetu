/* RaktSetu service worker — shows blood-request alerts and opens the request
   when one is tapped. Scoped to /raktsetu/ (see src/raktsetu/push.js). Push
   payloads never contain phone numbers.

   Works the same in a browser tab and in DnyanSetu installed to a phone's home
   screen: the installed app is the same origin, so it shares this worker and
   its subscription. */

const VAPID_PUBLIC_KEY = "BH0AzvO_mnYfJ4-kukMUCyUkgpcyrtN1V_1WMIV3GTsyehlLrS3r-YcXuV0WlRDrzYM4oOqxwrSwC9MbhHfRdw8";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "RaktSetu", body: event.data ? event.data.text() : "" };
  }

  /* A new request is urgent: it buzzes and stays on screen until the person
     acts on it. Follow-ups (a donor responded, a request closed) are quieter. */
  const urgent = !data.kind || data.kind === "request";
  const title = data.title || "RaktSetu: blood needed";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "Open RaktSetu to see the request.",
    icon: "/icon-192.png",
    badge: "/badge-96.png",
    tag: data.tag || "raktsetu",
    renotify: true,
    requireInteraction: urgent,
    vibrate: urgent ? [300, 120, 300, 120, 300] : [200],
    timestamp: Date.now(),
    actions: urgent ? [{ action: "open", title: "View request" }] : [],
    data: { url: data.url || "/raktsetu/requests" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/raktsetu/requests", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    /* Prefer a window already in RaktSetu (this worker controls it, so it can
       be navigated); otherwise any DnyanSetu window, e.g. the installed app
       sitting on the home page. */
    const ordered = [
      ...windows.filter((c) => c.url.startsWith(`${self.location.origin}/raktsetu`)),
      ...windows.filter((c) => !c.url.startsWith(`${self.location.origin}/raktsetu`)),
    ];
    for (const client of ordered) {
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

/* The browser renewed or revoked the subscription (it does this from time to
   time). Subscribe again and swap the new one in on the server, so alerts keep
   arriving even if the person does not open RaktSetu for weeks. */
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
    await fetch("/api/raktsetu/push-subscription", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldEndpoint, subscription: sub.toJSON() }),
    });
  })());
});
