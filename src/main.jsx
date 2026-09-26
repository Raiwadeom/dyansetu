import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./lib/auth.jsx";
import { CrashPage, ErrorBoundary } from "./lib/errorPages.jsx";
import "./index.css";

/* /raktsetu is its own full page with its own look, but the same site, domain
   and sign-in session — so it shares the AuthProvider and nothing else. */
const RaktSetuApp = lazy(() => import("./raktsetu/RaktSetuApp.jsx"));
const isRaktSetu = /^\/raktsetu(\/|$)/i.test(window.location.pathname);

/* Any crash shows a calm "Something went wrong, try again after a while"
   screen (src/lib/errorPages.jsx) instead of a blank page or a stack trace.
   The technical detail still goes to the browser console. */

const root = document.getElementById("root");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        {isRaktSetu ? (
          <Suspense fallback={null}>
            <RaktSetuApp />
          </Suspense>
        ) : (
          <App />
        )}
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

/* Errors thrown outside React — a failed dynamic import, a rejected promise in
   an effect — never reach the boundary above and would still blank the page. */
function showFatal(label, detail) {
  if (root && root.childElementCount > 0) return; /* something rendered; leave it */
  console.error(`[DnyanSetu] ${label}:`, detail);
  if (document.getElementById("fatal-root")) return; /* already showing */
  const host = document.createElement("div");
  host.id = "fatal-root";
  document.body.appendChild(host);
  ReactDOM.createRoot(host).render(<CrashPage error={{ name: label, message: String(detail) }} />);
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
