/* RaktSetu — small shared UI pieces. */

import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";

import { PAYMENT_WARNING, displayGroup } from "./api.js";

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

/* RaktSetu mark: a heart carrying a blood drop, resting on a bridge ("setu").
   The heart beats gently; the motion stops for anyone who asked their device
   to reduce motion. */
export function RaktSetuLogo({ size = 44, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" className={`rs-logo-mark ${className}`}>
      <circle cx="24" cy="24" r="23" fill="#ffffff" />
      <circle cx="24" cy="24" r="21" fill="none" stroke="#e07b00" strokeWidth="1.5" />
      <g className="rs-beat">
        <path
          d="M24 36.5C15.5 30.2 10.5 25.4 10.5 19.4a6.9 6.9 0 0 1 13.5-2.1 6.9 6.9 0 0 1 13.5 2.1c0 6-5 10.8-13.5 17.1z"
          fill="#0b2f5b"
        />
        <path d="M24 18.2s-4.2 5-4.2 7.6a4.2 4.2 0 0 0 8.4 0c0-2.6-4.2-7.6-4.2-7.6z" fill="#ffffff" />
      </g>
      <path d="M8.5 38.5Q24 30.5 39.5 38.5" fill="none" stroke="#e07b00" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M14 36v4M24 33.5v6.5M34 36v4" stroke="#e07b00" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
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
