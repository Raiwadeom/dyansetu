/* ============================================================================
   DyanSetu — Firebase client

   Configuration comes from .env.local (see .env.example). When the keys are
   missing the app falls back to offline seed data so the interface still runs;
   every module here checks `isBackendConfigured` before calling out.

   All of these values are public by design — a Firebase web config ships in
   the browser and is protected by the security rules in firestore.rules, not
   by secrecy.
   ========================================================================== */

import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isBackendConfigured = Boolean(config.apiKey && config.projectId);

const app = isBackendConfigured
  ? (getApps().length ? getApps()[0] : initializeApp(config))
  : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;

if (!isBackendConfigured && import.meta.env.DEV) {
  console.info(
    "[DyanSetu] Firebase is not configured — running on local seed data. " +
      "Copy .env.example to .env.local and add your project keys to enable accounts.",
  );
}

/* Turns a Firebase error code into something worth showing a student. */
export function friendlyError(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  const code = error.code || "";
  const message = error.message || String(error);

  const map = {
    /* Firebase returns invalid-credential for a wrong password AND for an
       address that has no account at all — it will not say which, so that
       nobody can probe for registered emails. The message has to cover both,
       or someone who has never registered reads "incorrect password" and
       retypes a correct password forever. */
    "auth/invalid-credential": "Incorrect email or password — or there is no account for this email yet. If you have not registered, use the Sign up tab first.",
    "auth/invalid-login-credentials": "Incorrect email or password — or there is no account for this email yet. If you have not registered, use the Sign up tab first.",
    "auth/wrong-password": "Incorrect password.",
    "auth/user-not-found": "No account found for that email. Please sign up first.",
    "auth/email-already-in-use": "An account with this email already exists. Please log in instead.",
    "auth/weak-password": "Password should be at least 6 characters long.",
    "auth/invalid-email": "That does not look like a valid email address.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Cannot reach the server. Check your connection and try again.",
    "auth/user-disabled": "This account has been disabled. Please contact the administrator.",
    "permission-denied": "You do not have permission to do that.",
    unavailable: "Cannot reach the server. Check your connection and try again.",
  };

  if (map[code]) return map[code];
  if (/permission|insufficient/i.test(message)) return "You do not have permission to do that.";
  return message.replace(/^Firebase:\s*/, "").replace(/\s*\(auth\/[^)]+\)\.?$/, "");
}
