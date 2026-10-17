/* Keeps an open tab (or the app on the home screen) from running old code
   after a new version goes live. Old code asks for files that no longer
   exist, which showed up as "Something went wrong / Try again", a 404, or a
   screen that froze. The build id is compared with /version.json when the
   tab comes back into view and every few minutes; a newer version reloads
   the page when it is safe (the tab was in the background) or shows a small
   "Update" bar otherwise, so nobody loses a half-typed form. */

/* eslint-disable no-undef */
const CURRENT = typeof __BUILD_ID__ === "string" ? __BUILD_ID__ : "dev";
const CHECK_EVERY_MS = 5 * 60 * 1000;
const RELOAD_KEY = "dnyansetu:reloaded-for-update";

let started = false;
let newer = false;

/* One automatic reload per minute at most, so a broken deploy cannot loop. */
export function reloadForUpdate() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < 60 * 1000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch { /* storage blocked: reload anyway */ }
  window.location.reload();
  return true;
}

function showBar() {
  if (document.getElementById("ds-update-bar")) return;
  const bar = document.createElement("div");
  bar.id = "ds-update-bar";
  bar.setAttribute("role", "status");
  bar.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:460px;margin:0 auto;"
    + "display:flex;align-items:center;gap:12px;justify-content:space-between;padding:10px 14px;border-radius:8px;"
    + "background:#1E3A5F;color:#fff;font:600 14px/1.4 'Noto Sans','Segoe UI',system-ui,sans-serif;box-shadow:0 6px 24px rgba(15,23,42,.3)";
  const text = document.createElement("span");
  text.textContent = "A new version of DnyanSetu is ready.";
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "Update";
  button.style.cssText = "border:0;border-radius:6px;padding:8px 14px;background:#fff;color:#1E3A5F;font:700 14px inherit;cursor:pointer";
  button.onclick = () => window.location.reload();
  bar.append(text, button);
  document.body.appendChild(bar);
}

async function check(returningToTab) {
  if (newer) {
    if (returningToTab) reloadForUpdate();
    return;
  }
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (!data?.id || data.id === CURRENT) return;
    newer = true;
    if (returningToTab) { if (!reloadForUpdate()) showBar(); } else showBar();
  } catch { /* offline — look again later */ }
}

export function startUpdateCheck() {
  if (started || CURRENT === "dev" || typeof document === "undefined") return;
  started = true;
  let hiddenAt = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") { hiddenAt = Date.now(); return; }
    /* Coming back after a while is the safe moment to swap versions. */
    check(hiddenAt > 0 && Date.now() - hiddenAt > 15000);
  });
  setInterval(() => { if (document.visibilityState === "visible") check(false); }, CHECK_EVERY_MS);
  setTimeout(() => check(false), 15000);
}
