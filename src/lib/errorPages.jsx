/* ============================================================================
   DnyanSetu — friendly error screens

   Two screens, used by both DnyanSetu and RaktSetu:
     * NotFoundPage — any address that does not exist (404).
     * CrashPage    — something broke while showing a page. The visitor sees a
                      calm "try again after a while" message; the technical
                      details stay in the browser console (and behind a small
                      "Technical details" toggle for whoever reports it).

   Self-contained (inline styles, no app CSS) so it still renders when the
   rest of the app failed to load. Follows the saved EN / मराठी choice.
   ========================================================================== */

import React from "react";

import { LANG_KEY } from "./i18n.js";

function savedLang() {
  try { return localStorage.getItem(LANG_KEY) === "mr" ? "mr" : "en"; } catch { return "en"; }
}

const TEXT = {
  en: {
    nfCode: "404",
    nfTitle: "Page not found",
    nfBody: "The page you are looking for does not exist or may have been moved. Check the address, or go back to the home page.",
    crashCode: "Error",
    crashTitle: "Something went wrong",
    crashBody: "This section could not be loaded right now. Please try again after a while. If it keeps happening, let us know.",
    tryAgain: "Try again",
    home: "Go to home",
    report: "Report this problem",
    details: "Technical details",
  },
  mr: {
    nfCode: "404",
    nfTitle: "पृष्ठ सापडले नाही",
    nfBody: "तुम्ही शोधत असलेले पृष्ठ अस्तित्वात नाही किंवा हलवले गेले असावे. पत्ता तपासा किंवा मुख्यपृष्ठावर परत जा.",
    crashCode: "त्रुटी",
    crashTitle: "काहीतरी चुकले",
    crashBody: "हा विभाग आत्ता उघडता आला नाही. कृपया थोड्या वेळाने पुन्हा प्रयत्न करा. असे वारंवार होत असल्यास आम्हाला कळवा.",
    tryAgain: "पुन्हा प्रयत्न करा",
    home: "मुख्यपृष्ठावर जा",
    report: "समस्या कळवा",
    details: "तांत्रिक तपशील",
  },
};

const CONTACT_EMAIL = "smuiqac@gmail.com";

const css = {
  page: {
    minHeight: "100vh", display: "flex", flexDirection: "column", background: "#F3F5F8",
    fontFamily: "'Noto Sans', 'Segoe UI', system-ui, sans-serif", color: "#1B1F24",
  },
  strip: { height: 5, background: "linear-gradient(90deg, #ff9933 0 33.33%, #ffffff 33.33% 66.66%, #138808 66.66% 100%)" },
  bar: { background: "#1E3A5F", color: "#fff", padding: "14px 20px", fontWeight: 700, fontSize: 18, letterSpacing: "0.01em" },
  main: { flex: 1, display: "grid", placeItems: "center", padding: "32px 16px" },
  card: {
    width: "100%", maxWidth: 560, background: "#fff", border: "1px solid #D8DEE7", borderTop: "5px solid #C98A1B",
    borderRadius: 12, padding: "32px 28px", boxShadow: "0 6px 24px rgba(15, 23, 42, 0.08)", textAlign: "center",
  },
  code: { fontSize: 56, fontWeight: 800, color: "#1E3A5F", lineHeight: 1, margin: 0 },
  title: { fontSize: 24, margin: "14px 0 10px", color: "#16202E" },
  body: { fontSize: 16, lineHeight: 1.6, color: "#4A5563", margin: "0 0 24px" },
  actions: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" },
  primary: {
    background: "#1E3A5F", color: "#fff", border: 0, borderRadius: 6, padding: "11px 20px",
    fontSize: 15, fontWeight: 700, cursor: "pointer", textDecoration: "none", fontFamily: "inherit",
  },
  secondary: {
    background: "#E8EFF9", color: "#1E3A5F", border: 0, borderRadius: 6, padding: "11px 20px",
    fontSize: 15, fontWeight: 700, cursor: "pointer", textDecoration: "none", fontFamily: "inherit",
  },
  report: { display: "inline-block", marginTop: 18, color: "#0B4EA2", fontSize: 14 },
  details: { marginTop: 18, textAlign: "left", fontSize: 12.5, color: "#4A5563" },
  pre: {
    whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#F3F5F8", padding: 10,
    borderRadius: 6, maxHeight: 180, overflow: "auto", marginTop: 8,
  },
};

function Shell({ children, inline = false }) {
  /* inline: just the card, for a section that failed inside a working page. */
  if (inline) {
    return (
      <div style={{ padding: "40px 16px", display: "grid", placeItems: "center" }}>
        <section style={css.card} role="alert">{children}</section>
      </div>
    );
  }
  return (
    <div style={css.page}>
      <div style={css.strip} />
      <div style={css.bar}>DnyanSetu</div>
      <main style={css.main}>
        <section style={css.card} role="alert">{children}</section>
      </main>
    </div>
  );
}

export function NotFoundPage({ homeHref = "/", inline = false }) {
  const t = TEXT[savedLang()];
  return (
    <Shell inline={inline}>
      <p style={css.code}>{t.nfCode}</p>
      <h1 style={css.title}>{t.nfTitle}</h1>
      <p style={css.body}>{t.nfBody}</p>
      <div style={css.actions}>
        <a href={homeHref} style={css.primary}>{t.home}</a>
        <button type="button" style={css.secondary} onClick={() => window.history.back()}>←</button>
      </div>
    </Shell>
  );
}

export function CrashPage({ error, inline = false }) {
  const t = TEXT[savedLang()];
  const detail = error ? `${error.name || "Error"}: ${error.message || String(error)}` : "";
  const subject = encodeURIComponent("DnyanSetu: something went wrong");
  const mailBody = encodeURIComponent(`Page: ${window.location.href}\nTime: ${new Date().toISOString()}\n${detail}`);
  return (
    <Shell inline={inline}>
      <p style={css.code}>{t.crashCode}</p>
      <h1 style={css.title}>{t.crashTitle}</h1>
      <p style={css.body}>{t.crashBody}</p>
      <div style={css.actions}>
        <button type="button" style={css.primary} onClick={() => window.location.reload()}>{t.tryAgain}</button>
        <a href="/" style={css.secondary}>{t.home}</a>
      </div>
      <a style={css.report} href={`mailto:${CONTACT_EMAIL}?subject=${subject}&body=${mailBody}`}>{t.report}</a>
      {detail && (
        <details style={css.details}>
          <summary>{t.details}</summary>
          <pre style={css.pre}>{detail}</pre>
        </details>
      )}
    </Shell>
  );
}

/* Catches a crash anywhere below it and shows CrashPage instead of a blank or
   technical screen. `resetKey` clears the error when the page changes. */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[DnyanSetu] page failed:", error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    /* After a new deploy, a tab that was already open asks for code files
       that no longer exist. Reloading fetches the new version, so do it
       quietly — every time a new version is out, but never twice within a
       minute, so a real outage cannot cause a reload loop. */
    if (/Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|error loading dynamically imported module/i.test(this.state.error?.message || "")) {
      try {
        const last = Number(sessionStorage.getItem("dnyansetu:reloaded-for-update") || 0);
        if (Date.now() - last > 60 * 1000) {
          sessionStorage.setItem("dnyansetu:reloaded-for-update", String(Date.now()));
          window.location.reload();
          return null;
        }
      } catch { /* storage blocked: fall through to the error page */ }
    }
    return <CrashPage error={this.state.error} inline={this.props.inline} />;
  }
}
