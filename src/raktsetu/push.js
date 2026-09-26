/* ============================================================================
   RaktSetu — web push in this browser

   Standard Web Push with VAPID keys; no paid service. The service worker is
   public/raktsetu-sw.js, scoped to /raktsetu/ so it never touches the rest of
   DnyanSetu.

   Permission is only ever requested from a button the user pressed — never on
   page load. Chrome quietly hides the prompt for sites that ask too early and
   get blocked a lot.
   ========================================================================== */

import { getAccessToken } from "../lib/supabase.js";

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();
const SW_URL = "/raktsetu-sw.js";
const SW_SCOPE = "/raktsetu/";

export const isPushConfigured = Boolean(VAPID_PUBLIC_KEY);

export function pushSupport() {
  if (typeof window === "undefined") return { supported: false };
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return {
    supported,
    ios,
    standalone,
    /* iPhone/iPad only allow web push for a site added to the Home Screen
       (iOS 16.4 and later). */
    needsHomeScreen: ios && !standalone,
    permission: "Notification" in window ? Notification.permission : "unsupported",
  };
}

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
}

/* Registers the worker as soon as RaktSetu opens (no prompt), so a later
   "turn on" is quick and notification clicks always have a handler. */
export async function ensureServiceWorker() {
  if (!pushSupport().supported) return null;
  try {
    return await registration();
  } catch (error) {
    console.error("[raktsetu] service worker registration failed", error);
    return null;
  }
}

export async function currentSubscription() {
  if (!pushSupport().supported) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
  return reg ? reg.pushManager.getSubscription() : null;
}

async function callApi(method, body) {
  const token = await getAccessToken();
  const response = await fetch("/api/raktsetu/push-subscription", {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(json.error || "Could not update alerts for this browser.");
}

/* Call only from a click handler. */
export async function enablePush() {
  const support = pushSupport();
  if (!support.supported) throw new Error("This browser does not support notifications.");
  if (support.needsHomeScreen) {
    throw new Error("On iPhone, first add DnyanSetu to your Home Screen (Share → Add to Home Screen), then open RaktSetu from there.");
  }
  if (!isPushConfigured) throw new Error("Push alerts are not configured on this site yet.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications are blocked. Allow them for this site in your browser settings, then try again.");
  }

  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  await callApi("POST", { subscription: sub.toJSON() });
  return sub;
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (!sub) return;
  try {
    await callApi("DELETE", { endpoint: sub.endpoint });
  } finally {
    await sub.unsubscribe().catch(() => {});
  }
}
