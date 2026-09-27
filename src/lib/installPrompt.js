/* ============================================================================
   DnyanSetu — "Install app" support

   Android and desktop Chrome/Edge fire `beforeinstallprompt` once, early, when
   the site qualifies as installable (site.webmanifest). If nobody is listening
   at that moment the chance is lost, so this module is imported first thing
   in main.jsx and holds on to the event until a button asks for it.

   iPhone and iPad never fire it: Safari only installs through Share → Add to
   Home Screen, so callers show those steps instead.
   ========================================================================== */

import { useEffect, useState } from "react";

let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function isIos() {
  const ua = window.navigator.userAgent || "";
  /* iPadOS reports itself as a Mac; the touch screen gives it away. */
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1);
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); /* keep the event for our own button */
    deferred = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

/* Safari cannot tell a page whether it is already on the home screen (the
   installed copy even keeps separate storage), so on iPhone the button is
   retired once the steps have been read instead. */
const IOS_SEEN_KEY = "dnyansetu:ios-install-seen";
const iosStepsSeen = () => {
  try { return localStorage.getItem(IOS_SEEN_KEY) === "1"; } catch { return false; }
};
export function markIosStepsSeen() {
  try { localStorage.setItem(IOS_SEEN_KEY, "1"); } catch { /* storage blocked */ }
  notify();
}

/* "prompt" — the browser's own install dialog is ready,
   "ios"    — show the Add to Home Screen steps,
   null     — already installed, or this browser cannot install. */
export function useInstallApp() {
  const read = () => {
    if (isStandalone()) return null;
    if (deferred) return "prompt";
    if (isIos() && !iosStepsSeen()) return "ios";
    return null;
  };
  const [mode, setMode] = useState(read);

  useEffect(() => {
    const update = () => setMode(read());
    listeners.add(update);
    update();
    return () => listeners.delete(update);
  }, []);

  const install = async () => {
    if (!deferred) return false;
    const event = deferred;
    deferred = null; /* each event can be shown only once */
    event.prompt();
    const { outcome } = await event.userChoice;
    notify();
    return outcome === "accepted";
  };

  return { mode, install };
}
