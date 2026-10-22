/* How many feedback messages the administrator has not opened yet; drives the
   badge on the admin menu. Quiet when signed out or not an administrator. */

import { useCallback, useEffect, useState } from "react";
import { fetchFeedback } from "./feedback.js";
import { useLiveRefresh } from "./liveRefresh.js";

export function useFeedbackCount(enabled = true) {
  const [count, setCount] = useState(0);
  const load = useCallback(async () => {
    if (!enabled) return;
    try { setCount((await fetchFeedback()).filter((f) => f.status === "new").length); } catch { /* keep the last number */ }
  }, [enabled]);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load, enabled);
  return count;
}
