/* ============================================================================
   DnyanSetu — college notifications on this phone / browser

   New announcements (faculty or office), scholarship updates and new notes.
   Uses public/sw.js (scope "/"); RaktSetu's blood alerts are separate
   (src/raktsetu/push.js). Permission is only asked from a button press.
   ========================================================================== */

import { getAccessToken, isBackendConfigured } from "./supabase.js";

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY || "").trim();
const SW_URL = "/sw.js";
const SW_SCOPE = "/";
const API = "/api/site-push";

export const isSitePushConfigured = Boolean(VAPID_PUBLIC_KEY) && isBackendConfigured;

export function sitePushSupport() {
  if (typeof window === "undefined") return { supported: false };
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  return {
    supported,
    needsHomeScreen: ios && !standalone,
    permission: "Notification" in window ? Notification.permission : "unsupported",
  };
}

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/* The registration whose scope is exactly "/" (getRegistration("/") could
   also return nothing while RaktSetu's /raktsetu/ worker exists). */
async function findRegistration() {
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.find((r) => new URL(r.scope).pathname === SW_SCOPE) || null;
}

async function activeRegistration() {
  const reg = (await findRegistration()) || await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
  if (reg.active) return reg;
  const worker = reg.installing || reg.waiting;
  if (worker) {
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 10000);
      const check = () => {
        if (worker.state === "activated" || worker.state === "redundant") { clearTimeout(timer); resolve(); }
      };
      worker.addEventListener("statechange", check);
      check();
    });
  }
  if (!reg.active) throw new Error("Notifications could not start in this browser. Refresh the page and try again.");
  return reg;
}

/* Registers the worker quietly on page load (no prompt), so a later tap is
   instant and tapped notifications always have a handler. */
export async function ensureSiteWorker() {
  if (!sitePushSupport().supported || !isSitePushConfigured) return;
  try {
    const reg = (await findRegistration()) || await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
    reg.update().catch(() => {});
  } catch (error) {
    console.error("[dnyansetu] service worker registration failed", error);
  }
}

export async function siteSubscription() {
  if (!sitePushSupport().supported) return null;
  const reg = await findRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

async function call(method, body, { auth = false, keepalive = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getAccessToken().catch(() => "");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(API, { method, headers, body: JSON.stringify(body), signal: controller.signal, keepalive });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json.error || "Could not update notifications.");
    return json;
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The server took too long. Please try again.");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/* Call only from a click handler. */
export async function enableSitePush() {
  const support = sitePushSupport();
  if (!support.supported) throw new Error("This browser does not support notifications. Try Chrome.");
  if (support.needsHomeScreen) {
    throw new Error("On iPhone, first add DnyanSetu to your Home Screen (Share → Add to Home Screen), then open it from there.");
  }
  if (!isSitePushConfigured) throw new Error("Notifications are not configured on this site yet.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notifications are blocked. Allow them for this site in your browser settings, then try again.");
  }
  const reg = await activeRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  }
  await call("POST", { subscription: sub.toJSON() }, { auth: true });
  return sub;
}

export async function disableSitePush() {
  const sub = await siteSubscription();
  if (!sub) return;
  try {
    await call("DELETE", { endpoint: sub.endpoint });
  } finally {
    await sub.unsubscribe().catch(() => {});
  }
}

/* Tells the server something was just published so it can notify every
   subscriber. Fire-and-forget: the person never waits on it. */
export function notifySite(kind, id) {
  if (!isSitePushConfigured || !id) return;
  call("POST", { notify: kind, id: String(id) }, { auth: true, keepalive: true })
    .catch((error) => console.error("[dnyansetu] notify failed", error));
}
