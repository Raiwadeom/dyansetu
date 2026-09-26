/* RaktSetu — small shared UI pieces. */

import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { ERAKTKOSH_URL, HEALTH_HELPLINE, PAYMENT_WARNING, displayGroup } from "./api.js";

/* An in-app link: a real <a href> (so open-in-new-tab works) that navigates
   without a page load on a plain click. */
export function Link({ to, navigate, className, children, ...rest }) {
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

export function Spinner({ label = "Loading…" }) {
  return <div className="rs-loading" role="status"><Loader2 size={18} className="rs-spin" /> {label}</div>;
}

export function PaymentWarning() {
  return (
    <p className="rs-pay-warning" role="note">
      <AlertTriangle size={15} /> <strong>{PAYMENT_WARNING}</strong>
    </p>
  );
}

export function GroupBadge({ group, large = false }) {
  return <span className={`rs-group ${large ? "rs-group--lg" : ""}`}>{displayGroup(group)}</span>;
}

const STATUS_LABEL = {
  open: "Open",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
  expired: "Expired",
  removed: "Removed by moderator",
};

export function StatusBadge({ status }) {
  return <span className={`rs-status rs-status--${status}`}>{STATUS_LABEL[status] || status}</span>;
}

export function formatDateTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ------------------------------------------------------------- brand art */

/* RaktSetu mark (from the brand sheet): a blood drop split into two halves,
   giver and receiver. Colours come from CSS so the reversed version (bright
   red + white on dark) is a class away. */
export function RaktSetuLogo({ size = 44, className = "" }) {
  return (
    <svg width={size * (100 / 120)} height={size} viewBox="0 0 100 120" aria-hidden="true" className={`rs-drop-mark ${className}`}>
      <path className="rs-drop-left" d="M46 4C33 21 6 54 6 76a40 40 0 0 0 40 40Z" />
      <path className="rs-drop-right" d="M54 4c13 17 40 50 40 72a40 40 0 0 1-40 40Z" />
    </svg>
  );
}

/* Primary lockup: mark + "RaktSetu" + "रक्तसेतु". `reversed` for dark backgrounds. */
export function RaktSetuLockup({ size = 44, reversed = false }) {
  return (
    <span className={`rs-lockup ${reversed ? "rs-lockup--reversed" : ""}`}>
      <RaktSetuLogo size={size} />
      <span className="rs-lockup-text">
        <strong>RaktSetu</strong>
        <span lang="mr">रक्तसेतु</span>
      </span>
    </span>
  );
}

/* A small beating heart, used on every section heading. */
export function HeartPulse({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="rs-heart">
      <path
        d="M12 21C6.2 16.8 2.5 13.3 2.5 9a4.8 4.8 0 0 1 9.5-1.4A4.8 4.8 0 0 1 21.5 9c0 4.3-3.7 7.8-9.5 12z"
        fill="currentColor"
      />
    </svg>
  );
}

/* Section heading: heart + title, with an optional short description. */
export function SectionTitle({ as: Tag = "h2", children, sub, id }) {
  return (
    <div className="rs-title-block">
      <Tag className="rs-title" id={id}>
        <span className="rs-title-heart"><HeartPulse /></span>
        <span>{children}</span>
      </Tag>
      {sub && <p className="rs-title-sub">{sub}</p>}
    </div>
  );
}

/* Heartbeat (ECG) line that draws itself across the hero panel. */
export function HeartbeatLine() {
  return (
    <svg className="rs-ecg" viewBox="0 0 320 60" preserveAspectRatio="none" aria-hidden="true">
      <path
        className="rs-ecg-path"
        d="M0 32h86l10-14 12 30 14-44 12 42 9-14h60l8-10 9 20 8-10h92"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Government help shown next to requests: RaktSetu is never the only way. */
export function EmergencyHelp({ tr = (en) => en }) {
  return (
    <p className="rs-emergency" role="note">
      <strong>{tr("Emergency?", "आपत्कालीन स्थिती?")}</strong>{" "}
      {tr("Contact the hospital's blood bank directly, call", "थेट रुग्णालयाच्या रक्तपेढीशी संपर्क साधा, कॉल करा")}{" "}
      <a href={`tel:${HEALTH_HELPLINE}`}>{HEALTH_HELPLINE}</a>{" "}
      {tr("(health helpline), or check live blood stock on", "(आरोग्य हेल्पलाइन), किंवा रक्तसाठा पहा")}{" "}
      <a href={ERAKTKOSH_URL} target="_blank" rel="noreferrer">e-RaktKosh</a>
      {tr(" (Government of India).", " (भारत सरकार).")}
    </p>
  );
}

/* Account created less than a day before the request was posted. */
export function NewMemberBadge() {
  return (
    <span className="rs-new-member" title="This request was posted by an account created less than a day earlier. Check the details with the hospital before going.">
      New member
    </span>
  );
}
