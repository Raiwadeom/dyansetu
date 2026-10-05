import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { AuthProvider } from "./lib/auth.jsx";
import { CrashPage, ErrorBoundary, rememberCrash } from "./lib/errorPages.jsx";
import BackToTop from "./lib/BackToTop.jsx";
import "./index.css";
/* Imported early so the browser's one-time install offer is not missed. */
import "./lib/installPrompt.js";
import { registerVisit } from "./lib/visitCounter.jsx";

/* /raktsetu is its own full page with its own look, but the same site, domain
   and sign-in session — so it shares the AuthProvider and nothing else. */
const RaktSetuApp = lazy(() => import("./raktsetu/RaktSetuApp.jsx"));
const isRaktSetu = /^\/raktsetu(\/|$)/i.test(window.location.pathname);

/* Every page load counts once towards the footer visitor counter. */
registerVisit(isRaktSetu ? "raktsetu" : "dnyansetu");

/* Any crash shows a calm "Something went wrong, try again after a while"
   screen (src/lib/errorPages.jsx) instead of a blank page or a stack trace.
   The technical detail still goes to the browser console. */

const root = document.getElementById("root");

/* The start-up screen in index.html stays for at least ~1.5 s (it used to
   flash past too quickly to read) and fades out once, over the finished page.
   It waits until the app has drawn its real first screen: while signing in
   is still being checked, App shows its own copy of the splash, and fading
   over that copy restarted the animations and then cut to the page — the
   jump seen on laptops and PCs, which load fast enough to hit that moment. */
const boot = document.getElementById("ds-boot");
if (boot) {
  let left = false;
  const leave = () => {
    if (left) return;
    left = true;
    observer.disconnect();
    boot.classList.add("is-leaving");
    setTimeout(() => boot.remove(), 500);
  };
  const pageReady = () => root.childElementCount > 0 && !root.querySelector(".ds-splash");
  const tryLeave = () => {
    if (pageReady()) setTimeout(leave, Math.max(0, 1500 - performance.now()));
  };
  const observer = new MutationObserver(tryLeave);
  observer.observe(root, { childList: true, subtree: true });
  /* Never hold the page back for long, whatever happens. */
  setTimeout(leave, 10000);
}

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
        <BackToTop />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

/* Errors thrown outside React — a failed dynamic import, a rejected promise in
   an effect — never reach the boundary above and would still blank the page. */
function showFatal(label, detail) {
  rememberCrash({ name: label, message: String(detail) });
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
