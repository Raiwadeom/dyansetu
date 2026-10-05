/* ============================================================================
   Footer visitor counter

   Each page load adds one to its site's total (DnyanSetu or RaktSetu) — the
   same rule csmnewsdesk.com uses. main.jsx registers the visit as soon as the
   page starts; the footer card reuses that same request, so moving between
   views inside the app never counts twice. Shown in the footer
   as a glass pill: a live dot, a small label and the running total.
   ========================================================================== */

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { isBackendConfigured, supabase } from "./supabase.js";

const pending = {};

/** Adds this page load to the site's total (once) and resolves to the new total. */
export function registerVisit(site) {
  if (!isBackendConfigured) return Promise.resolve(null);
  if (!pending[site]) {
    pending[site] = supabase
      .rpc("register_visit", { p_site: site })
      .then(({ data, error }) => (error || data == null ? null : Number(data)))
      .catch(() => null);
  }
  return pending[site];
}

/* Counts up from zero to the total once it arrives (skipped when the visitor
   asked for reduced motion). */
function useCountUp(target) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (target == null) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(target); return undefined; }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 1200);
      setShown(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

export function VisitorCounter({ site, label = "Total visitors", locale = "en-IN", className = "" }) {
  const [count, setCount] = useState(null);
  const shown = useCountUp(count);

  useEffect(() => {
    let alive = true;
    registerVisit(site).then((n) => { if (alive) setCount(n); });
    return () => { alive = false; };
  }, [site]);

  /* Nothing to show offline or if the count could not be read. */
  if (count == null) return null;

  return (
    <div className={`visit-counter ${className}`} role="status" aria-label={`${label}: ${count}`}>
      <span className="visit-counter-icon" aria-hidden="true"><Users size={16} /></span>
      <span className="visit-counter-text" aria-hidden="true">
        <span className="visit-counter-label"><span className="visit-counter-live" />{label}</span>
        <span className="visit-counter-num">{shown.toLocaleString(locale)}</span>
      </span>
    </div>
  );
}
