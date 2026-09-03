/* ============================================================================
   DyanSetu — Cloudinary upload signature endpoint

   Why this exists
   ---------------
   An unsigned Cloudinary preset lets anybody who reads the shipped JavaScript
   upload to the account. This endpoint removes that: the browser can no longer
   upload on its own, it has to ask for a signature first, and a signature is
   only issued to a signed-in member of faculty.

   How a request is checked, in order:

     1. The caller sends their Firebase ID token.
     2. We verify that token cryptographically against Google's public signing
        certificates — issuer, audience, expiry and RSA signature. A forged or
        expired token fails here.
     3. We read the caller's own profile from Firestore using their token, so
        Firestore's rules apply, and confirm the role is faculty or admin and
        the account is not restricted.
     4. Only then do we return a signature, computed with the Cloudinary API
        secret that lives in the server environment and never reaches a browser.

   The secret is read from CLOUDINARY_API_SECRET — deliberately without the
   VITE_ prefix, so Vite cannot inline it into the client bundle even by
   accident.
   ========================================================================== */

import crypto from "node:crypto";

const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

/* Cloudinary folders this endpoint is willing to sign for. A caller cannot ask
   for an arbitrary path. */
const ALLOWED_FOLDERS = new Set(["dyansetu/notes", "dyansetu/papers", "dyansetu/avatars"]);

/* ------------------------------ certificate cache ------------------------- */

let certCache = { keys: null, expiresAt: 0 };

async function fetchGoogleCerts() {
  if (certCache.keys && Date.now() < certCache.expiresAt) return certCache.keys;

  const response = await fetch(GOOGLE_CERTS_URL);
  if (!response.ok) throw new Error("Could not fetch Google signing certificates.");

  const keys = await response.json();
  /* Respect Google's own cache window rather than guessing one. */
  const cacheControl = response.headers.get("cache-control") || "";
  const maxAge = Number(/max-age=(\d+)/.exec(cacheControl)?.[1] || 3600);

  certCache = { keys, expiresAt: Date.now() + maxAge * 1000 };
  return keys;
}

/* --------------------------- ID token verification ------------------------ */

function decodeBase64Url(segment) {
  return Buffer.from(segment.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

/* Verifies a Firebase ID token and returns its claims. Throws on any failure —
   there is no partial trust here. */
async function verifyIdToken(token, projectId) {
  if (typeof token !== "string" || token.split(".").length !== 3) {
    throw new Error("Malformed token.");
  }

  const [headerB64, payloadB64, signatureB64] = token.split(".");
  const header = JSON.parse(decodeBase64Url(headerB64).toString("utf8"));
  const claims = JSON.parse(decodeBase64Url(payloadB64).toString("utf8"));

  if (header.alg !== "RS256") throw new Error("Unexpected token algorithm.");
  if (!header.kid) throw new Error("Token has no key id.");

  const certs = await fetchGoogleCerts();
  const certificate = certs[header.kid];
  if (!certificate) throw new Error("Token was signed with an unknown key.");

  const verified = crypto
    .createVerify("RSA-SHA256")
    .update(`${headerB64}.${payloadB64}`)
    .verify(certificate, decodeBase64Url(signatureB64));
  if (!verified) throw new Error("Token signature is invalid.");

  /* projectId comes from an env var typed into a dashboard by hand — trim it
     so a stray trailing space or newline from a copy-paste doesn't make a
     correct token look like it belongs to "a different project". The project
     ID itself is not a secret (it is the same value VITE_FIREBASE_PROJECT_ID
     ships to the browser), so it is safe to name both sides when this fails. */
  const now = Math.floor(Date.now() / 1000);
  const expectedProjectId = String(projectId || "").trim();
  if (claims.aud !== expectedProjectId) {
    throw new Error(
      `Token is for a different project (token aud="${claims.aud}", configured FIREBASE_PROJECT_ID="${expectedProjectId}").`,
    );
  }
  if (claims.iss !== `https://securetoken.google.com/${expectedProjectId}`) {
    throw new Error("Token has an unexpected issuer.");
  }
  if (!claims.sub) throw new Error("Token has no subject.");
  if (typeof claims.exp !== "number" || claims.exp <= now) throw new Error("Token has expired.");
  if (typeof claims.iat !== "number" || claims.iat > now + 60) throw new Error("Token is not yet valid.");

  return claims;
}

/* ------------------------------- role check ------------------------------- */

/* Reads the caller's own profile through the Firestore REST API using their
   token, so the same security rules that guard the app guard this too. */
async function fetchRole(projectId, uid, idToken) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/documents/profiles/${uid}`;

  const response = await fetch(url, { headers: { Authorization: `Bearer ${idToken}` } });
  if (!response.ok) {
    /* Include Firestore's own status and body server-side only — the uid and
       project id here are not secrets, and this is what tells us whether the
       profile document is simply missing (404) versus the rules refusing the
       read (403 permission-denied) versus something else entirely. */
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Could not read your profile (HTTP ${response.status} for uid=${uid}, url=${url}): ${detail}`,
    );
  }

  const fields = (await response.json()).fields || {};
  return {
    role: fields.role?.stringValue || "student",
    restricted: fields.restricted?.booleanValue === true,
  };
}

/* ------------------------------- the handler ------------------------------ */

export async function handleSignUpload(body) {
  const {
    CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET,
    CLOUDINARY_UPLOAD_PRESET,
  } = process.env;

  /* Env vars typed into a dashboard by hand can pick up a trailing space or
     newline from a copy-paste. Trim once here so every downstream use (the
     token check, the Firestore REST URL) sees the same clean value instead of
     each call site having to remember to trim it itself. */
  const FIREBASE_PROJECT_ID = (process.env.FIREBASE_PROJECT_ID || "").trim();

  /* Name the missing variable. "Not configured" alone sent people to SETUP.md
     to re-check five values when only one was ever blank. The names are not
     secrets; the values never leave this function. */
  const missing = [
    ["CLOUDINARY_API_KEY", CLOUDINARY_API_KEY],
    ["CLOUDINARY_API_SECRET", CLOUDINARY_API_SECRET],
    ["FIREBASE_PROJECT_ID", FIREBASE_PROJECT_ID],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length) {
    return {
      status: 503,
      json: {
        error:
          `Uploads are not configured: ${missing.join(", ")} ` +
          `${missing.length === 1 ? "is" : "are"} missing from .env.local. ` +
          "Add it and restart the dev server. See SETUP.md.",
      },
    };
  }

  const idToken = typeof body?.idToken === "string" ? body.idToken : "";
  const folder = typeof body?.folder === "string" ? body.folder : "";

  if (!idToken) return { status: 401, json: { error: "Sign in to upload." } };
  if (!ALLOWED_FOLDERS.has(folder)) {
    return { status: 400, json: { error: "That upload destination is not allowed." } };
  }

  let claims;
  try {
    claims = await verifyIdToken(idToken, FIREBASE_PROJECT_ID);
  } catch (error) {
    /* Deliberately vague to the caller: a caller probing this endpoint learns
       nothing about which part of their token was wrong. The real reason is
       logged server-side only, to debug deployment issues (env var mismatch,
       clock skew, etc.) without exposing anything to the client. */
    console.error("[sign-upload] verifyIdToken failed:", error?.message || error);
    return { status: 401, json: { error: "Your session is not valid. Please sign in again." } };
  }

  let profile;
  try {
    profile = await fetchRole(FIREBASE_PROJECT_ID, claims.sub, idToken);
  } catch (error) {
    console.error("[sign-upload] fetchRole failed:", error?.message || error);
    return { status: 403, json: { error: "Could not confirm your account." } };
  }

  if (profile.restricted || !["faculty", "admin"].includes(profile.role)) {
    return { status: 403, json: { error: "Only faculty may upload files." } };
  }

  /* Cloudinary signs the alphabetically sorted parameters, then the secret. */
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp };
  if (CLOUDINARY_UPLOAD_PRESET) params.upload_preset = CLOUDINARY_UPLOAD_PRESET;

  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  const signature = crypto
    .createHash("sha1")
    .update(toSign + CLOUDINARY_API_SECRET)
    .digest("hex");

  return {
    status: 200,
    json: { signature, timestamp, apiKey: CLOUDINARY_API_KEY, folder, uploadPreset: CLOUDINARY_UPLOAD_PRESET || null },
  };
}

/* Vercel / Node serverless entry point. */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const { status, json } = await handleSignUpload(body || {});
  res.status(status).json(json);
}
