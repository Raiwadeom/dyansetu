import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

/* A crash used to leave a blank white page with nothing to go on — the error
   only existed in the browser console. This paints it on the page instead, so
   a failure is legible without opening devtools. */

const panel = {
  wrap: {
    margin: "40px auto", maxWidth: 760, padding: "28px 32px",
    fontFamily: "'Segoe UI', system-ui, sans-serif", lineHeight: 1.6,
    background: "#fff", border: "1px solid #fecaca", borderRadius: 14,
    boxShadow: "0 10px 30px rgba(15,23,42,0.08)", color: "#0f172a",
  },
  tag: {
    display: "inline-block", padding: "3px 10px", borderRadius: 999,
    background: "#fef2f2", color: "#b91c1c", fontSize: 12,
    fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase",
  },
  msg: {
    marginTop: 14, padding: "12px 14px", background: "#fff7ed",
    border: "1px solid #fed7aa", borderRadius: 8,
    font: "13px/1.5 'JetBrains Mono', Consolas, monospace",
    whiteSpace: "pre-wrap", wordBreak: "break-word",
  },
  stack: {
    marginTop: 12, maxHeight: 260, overflow: "auto", padding: "12px 14px",
    background: "#0f172a", color: "#e2e8f0", borderRadius: 8,
    font: "12px/1.5 'JetBrains Mono', Consolas, monospace", whiteSpace: "pre",
  },
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[DnyanSetu] render failed:", error, info);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={panel.wrap}>
        <span style={panel.tag}>DnyanSetu could not start</span>
        <h2 style={{ margin: "14px 0 4px", fontSize: 21 }}>{error.name || "Error"}</h2>
        <div style={panel.msg}>{error.message || String(error)}</div>
        {error.stack && <div style={panel.stack}>{error.stack}</div>}
        <p style={{ marginTop: 18, fontSize: 14, color: "#475569" }}>
          Reload with <strong>Ctrl&nbsp;+&nbsp;Shift&nbsp;+&nbsp;R</strong> to clear a stale
          cache. If it persists, this message is what to report.
        </p>
      </div>
    );
  }
}

const root = document.getElementById("root");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

/* Errors thrown outside React — a failed dynamic import, a rejected promise in
   an effect — never reach the boundary above and would still blank the page. */
function showFatal(label, detail) {
  if (root && root.childElementCount > 0) return; /* something rendered; leave it */
  root.innerHTML =
    `<div style="margin:40px auto;max-width:760px;padding:28px 32px;` +
    `font-family:'Segoe UI',system-ui,sans-serif;background:#fff;` +
    `border:1px solid #fecaca;border-radius:14px;color:#0f172a">` +
    `<strong style="color:#b91c1c">${label}</strong>` +
    `<pre style="margin-top:12px;padding:12px;background:#0f172a;color:#e2e8f0;` +
    `border-radius:8px;overflow:auto;white-space:pre-wrap">${detail}</pre></div>`;
}

/* A phone's on-screen keyboard covers the bottom of the screen without
   reliably shrinking window.innerHeight or firing a visualViewport resize —
   plenty of mobile browsers (and every DevTools device-toolbar keyboard
   preview) never signal it at all. Detecting the covered area is not
   reliable, so this always brings the focused field into a comfortable
   position near the top of the screen on focus instead of waiting for a
   signal that may never come. Harmless on desktop: the field is normally
   in view already, so there is nothing to scroll. */
if (typeof window !== "undefined") {
  document.addEventListener("focusin", (e) => {
    const el = e.target;
    if (!el || !["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
    window.setTimeout(() => {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 300);
  });
}

window.addEventListener("error", (e) => {
  showFatal("Script error", e.message + (e.filename ? `\n  at ${e.filename}:${e.lineno}` : ""));
});
window.addEventListener("unhandledrejection", (e) => {
  showFatal("Unhandled promise rejection", e.reason?.stack || String(e.reason));
});
