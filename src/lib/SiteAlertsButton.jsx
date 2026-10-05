/* "Get notifications" switch for college updates on this phone / browser.
   Shown in the home-page Announcements box and on the dashboards. */

import React, { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import {
  disableSitePush, enableSitePush, isSitePushConfigured, siteSubscription, sitePushSupport,
} from "./sitePush.js";

export default function SiteAlertsButton({ tr = (en) => en, variant = "inline" }) {
  const support = sitePushSupport();
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ text: "", tone: "" });

  useEffect(() => {
    let alive = true;
    siteSubscription().then((sub) => { if (alive) setOn(Boolean(sub)); }).catch(() => alive && setOn(false));
    return () => { alive = false; };
  }, []);

  if (!isSitePushConfigured || !support.supported) return null;

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setMsg({ text: "", tone: "" });
    try {
      if (on) {
        await disableSitePush();
        setOn(false);
        setMsg({ text: tr("Notifications turned off on this device.", "या डिव्हाइसवर सूचना बंद केल्या."), tone: "ok" });
      } else {
        await enableSitePush();
        setOn(true);
        setMsg({ text: tr("Done! You will be notified of new notices, scholarships and notes.", "झाले! नवीन सूचना, शिष्यवृत्ती आणि नोट्सची माहिती मिळेल."), tone: "ok" });
      }
    } catch (error) {
      setMsg({ text: error.message, tone: "err" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`site-alerts site-alerts--${variant} ${on ? "is-on" : ""}`}>
      {variant === "card" && (
        <div className="site-alerts-copy">
          <strong><BellRing size={16} /> {tr("College notifications", "महाविद्यालय सूचना")}</strong>
          <span>
            {on
              ? tr("On for this device — new announcements, scholarship updates and notes.", "या डिव्हाइसवर सुरू — नवीन घोषणा, शिष्यवृत्ती आणि नोट्स.")
              : tr("Get a notification on this phone when a new announcement, scholarship update or notes are posted.", "नवीन घोषणा, शिष्यवृत्ती किंवा नोट्स आल्यावर या फोनवर सूचना मिळवा.")}
          </span>
        </div>
      )}
      <button
        type="button"
        className={`site-alerts-btn ${on ? "is-on" : ""}`}
        onClick={toggle}
        disabled={busy || on === null || (!on && support.needsHomeScreen)}
        aria-pressed={Boolean(on)}
      >
        {busy ? <Loader2 size={15} className="spin" /> : on ? <BellOff size={15} /> : <Bell size={15} />}
        {on ? tr("Turn off notifications", "सूचना बंद करा") : tr("Get notifications", "सूचना मिळवा")}
      </button>
      {!on && support.needsHomeScreen && (
        <p className="site-alerts-msg">{tr("On iPhone: Share → Add to Home Screen, then open DnyanSetu from the icon.", "iPhone वर: Share → Add to Home Screen, नंतर आयकॉनवरून उघडा.")}</p>
      )}
      {msg.text && <p className={`site-alerts-msg ${msg.tone === "err" ? "is-err" : ""}`} role="status">{msg.text}</p>}
    </div>
  );
}
