/* One-time "Allow notifications?" card for DnyanSetu phone notifications
   (new announcements, scholarship updates, notes). It replaces the old
   Get / Turn off notifications buttons that sat on several pages.

   When it is asked (remembered per device):
     - opening the installed app while signed out: once;
     - after signing in: only if the answer so far was "Not now" (or it was
       never asked) — a "Not now" given as a signed-in user is final;
     - once the browser allows notifications, nothing is asked: the device
       is (re)subscribed quietly, and again after signing in so the
       subscription is linked to the account. */

import React, { useEffect, useState } from "react";
import { BatteryCharging, BellRing, Loader2, X } from "lucide-react";
import { enableSitePush, isSitePushConfigured, siteSubscription, sitePushSupport } from "./sitePush.js";

const ASKED_KEY = "ds-push-asked";

function readAsked() {
  try { return localStorage.getItem(ASKED_KEY) || ""; } catch { return ""; }
}
function saveAsked(value) {
  try { localStorage.setItem(ASKED_KEY, value); } catch { /* private mode: may ask again next visit */ }
}

export default function NotificationPrompt({ tr = (en) => en, signedIn = false }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /* Android only: after Allow, one more card about Chrome's battery setting.
     Many phones (Vivo, Oppo, Realme, Xiaomi, Samsung) put Chrome to sleep
     when it is closed, so notifications wait until the app is opened. */
  const [batteryTip, setBatteryTip] = useState(false);

  useEffect(() => {
    if (!isSitePushConfigured) return undefined;
    const support = sitePushSupport();
    if (!support.supported || support.needsHomeScreen || support.permission === "denied") return undefined;
    let alive = true;
    const timer = setTimeout(async () => {
      if (!alive) return;
      if (Notification.permission === "granted") {
        /* Said yes before (or allowed in browser settings): keep it on. */
        enableSitePush().catch(() => {});
        return;
      }
      const sub = await siteSubscription().catch(() => null);
      if (!alive || sub) return;
      const asked = readAsked();
      const ask = signedIn ? asked !== "no-user" && asked !== "yes" : !asked;
      if (ask) setShow(true);
    }, 2500);
    return () => { alive = false; clearTimeout(timer); };
  }, [signedIn]);

  if (!show) return null;

  const allow = async () => {
    setBusy(true);
    setError("");
    try {
      await enableSitePush();
      saveAsked("yes");
      if (/Android/i.test(navigator.userAgent)) setBatteryTip(true);
      else setShow(false);
    } catch (e) {
      /* Blocked in the browser's own prompt counts as an answer too. */
      if (Notification.permission === "denied") { saveAsked("no-user"); setShow(false); return; }
      setError(e.message || tr("Could not turn on notifications.", "सूचना सुरू करता आल्या नाहीत."));
    } finally {
      setBusy(false);
    }
  };
  const later = () => { saveAsked(signedIn ? "no-user" : "no-guest"); setShow(false); };

  if (batteryTip) {
    return (
      <div className="np-card" role="dialog" aria-labelledby="np-title" aria-describedby="np-text">
        <button type="button" className="np-close" onClick={() => setShow(false)} aria-label={tr("Close", "बंद करा")}><X size={16} /></button>
        <span className="np-icon" aria-hidden="true"><BatteryCharging size={20} /></span>
        <div className="np-body">
          <strong id="np-title">{tr("One more step", "अजून एक पायरी")}</strong>
          <p id="np-text">{tr(
            "To get notifications even when the app is closed, open phone Settings → Apps → Chrome → Battery and choose \"Unrestricted\" (or \"Allow background activity\").",
            "ॲप बंद असतानाही सूचना मिळण्यासाठी फोनच्या Settings → Apps → Chrome → Battery मध्ये \"Unrestricted\" (किंवा \"Allow background activity\") निवडा.",
          )}</p>
          <div className="np-actions">
            <button type="button" className="np-btn np-btn--primary" onClick={() => setShow(false)}>{tr("Got it", "समजले")}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="np-card" role="dialog" aria-labelledby="np-title" aria-describedby="np-text">
      <button type="button" className="np-close" onClick={later} aria-label={tr("Close", "बंद करा")}><X size={16} /></button>
      <span className="np-icon" aria-hidden="true"><BellRing size={20} /></span>
      <div className="np-body">
        <strong id="np-title">{tr("Allow notifications?", "सूचना सुरू करायच्या?")}</strong>
        <p id="np-text">{tr(
          "Get a notification on this device when a new announcement, scholarship update or notes are posted.",
          "नवीन घोषणा, शिष्यवृत्ती किंवा नोट्स आल्यावर या डिव्हाइसवर सूचना मिळवा.",
        )}</p>
        {error && <p className="np-error" role="status">{error}</p>}
        <div className="np-actions">
          <button type="button" className="np-btn np-btn--ghost" onClick={later} disabled={busy}>{tr("Not now", "नंतर")}</button>
          <button type="button" className="np-btn np-btn--primary" onClick={allow} disabled={busy}>
            {busy && <Loader2 size={15} className="spin" />} {tr("Allow", "होय, सुरू करा")}
          </button>
        </div>
      </div>
    </div>
  );
}
