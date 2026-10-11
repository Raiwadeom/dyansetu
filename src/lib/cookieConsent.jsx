/* Cookie / storage notice shown once per device at the bottom of the page.

   DnyanSetu sets no advertising or tracking cookies. It keeps only what the
   site needs on the device (sign-in session, language, quiz progress,
   install / notification answers) plus one optional thing: the anonymous
   footer visitor count.

     - "Accept"  → "all":       everything above, visitor count included.
     - "Reject"  → "essential": only the storage the site needs to work;
                                this device no longer adds to the visitor count.

   The answer is remembered in localStorage under CONSENT_KEY. */

import React, { useState } from "react";
import { Cookie } from "lucide-react";

export const CONSENT_KEY = "ds-cookie-consent";

export function readConsent() {
  try { return localStorage.getItem(CONSENT_KEY) || ""; } catch { return ""; }
}

/** False only when this device chose "Reject" (essential storage only). */
export function allowsVisitCount() {
  return readConsent() !== "essential";
}

function saveConsent(value) {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* private mode: asked again next visit */ }
}

export default function CookieConsent({ tr = (en) => en, onAnswer, privacyHref = "/privacy", onOpenPrivacy }) {
  const [show, setShow] = useState(() => !readConsent());
  if (!show) return null;

  const answer = (value) => {
    saveConsent(value);
    setShow(false);
    onAnswer?.(value);
  };

  return (
    <div className="cc-bar" role="dialog" aria-live="polite" aria-labelledby="cc-title" aria-describedby="cc-text">
      <span className="cc-icon" aria-hidden="true"><Cookie size={20} /></span>
      <div className="cc-body">
        <strong id="cc-title">{tr("Cookies & storage on this site", "या साइटवरील कुकीज व स्टोरेज")}</strong>
        <p id="cc-text">
          {tr(
            "We don't use advertising or tracking cookies. We keep only what the site needs (sign-in, language, your settings) and an anonymous visitor count. ",
            "आम्ही जाहिरात किंवा ट्रॅकिंग कुकीज वापरत नाही. साइटला आवश्यक तेवढेच (लॉगिन, भाषा, तुमची सेटिंग्ज) आणि निनावी अभ्यागत संख्या ठेवतो. ",
          )}
          <a
            href={privacyHref}
            onClick={onOpenPrivacy ? (e) => { e.preventDefault(); onOpenPrivacy(); } : undefined}
          >
            {tr("Privacy Policy", "गोपनीयता धोरण")}
          </a>
        </p>
      </div>
      <div className="cc-actions">
        <button type="button" className="cc-btn cc-btn--ghost" onClick={() => answer("essential")}>
          {tr("Reject", "नाकारा")}
        </button>
        <button type="button" className="cc-btn cc-btn--primary" onClick={() => answer("all")}>
          {tr("Accept", "स्वीकारा")}
        </button>
      </div>
    </div>
  );
}
