/* Keeps open pages up to date without a manual refresh: whatever the
   administrator changes (approvals, announcements, scholarships, posts)
   shows up on its own. The loader runs again every few seconds while the
   tab is on screen, and straight away when the reader comes back to the tab.
   A hidden tab does nothing, so a page left open in the background costs
   nothing. Loaders must refresh quietly — no "Loading…" flash. */

import { useEffect, useRef } from "react";

export const LIVE_REFRESH_MS = 20000;

export function useLiveRefresh(load, enabled = true, every = LIVE_REFRESH_MS) {
  const latest = useRef(load);
  latest.current = load;

  useEffect(() => {
    if (!enabled) return undefined;
    let last = Date.now();
    const run = () => {
      if (document.visibilityState === "hidden") return;
      /* Focus and visibility often fire together; one reload is enough. */
      if (Date.now() - last < 3000) return;
      last = Date.now();
      try {
        const result = latest.current?.();
        if (result && typeof result.catch === "function") result.catch(() => {});
      } catch { /* offline — try again on the next tick */ }
    };
    const timer = setInterval(run, every);
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    window.addEventListener("online", run);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
      window.removeEventListener("online", run);
    };
  }, [enabled, every]);
}
