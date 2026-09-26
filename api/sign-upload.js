/* ============================================================================
   DnyanSetu — Cloudinary upload signature endpoint

   Why this exists
   ---------------
   An unsigned Cloudinary preset lets anybody who reads the shipped JavaScript
   upload to the account. This endpoint removes that: the browser can no longer
   upload on its own, it has to ask for a signature first, and a signature is
   only issued to a signed-in member of faculty.

   How a request is checked, in order:

     1. The caller sends their Supabase access token.
     2. We verify that token with the Supabase Auth server itself. A forged,
        expired or signed-out token fails here.
     3. We read the caller's own profile with the service role and confirm the
        role is faculty or admin and the account is not restricted.
     4. Only then do we return a signature, computed with the Cloudinary API
        secret that lives in the server environment and never reaches a browser.

   The secrets are read from CLOUDINARY_API_SECRET and SUPABASE_SERVICE_ROLE_KEY
   — deliberately without the VITE_ prefix, so Vite cannot inline them into the
   client bundle even by accident.
   ========================================================================== */

import crypto from "node:crypto";

import { authenticate } from "./_lib/supabaseAdmin.js";

/* Cloudinary folders this endpoint is willing to sign for. A caller cannot ask
   for an arbitrary path. */
const ALLOWED_FOLDERS = new Set(["dnyansetu/notes", "dnyansetu/papers", "dnyansetu/avatars"]);

/* ------------------------------- the handler ------------------------------ */

export async function handleSignUpload(body) {
  /* Every one of these is an env var typed into a dashboard by hand, which can
     silently pick up a trailing space or newline from a copy-paste. That kind
     of value still looks right in a masked "•••••" input and still passes a
     truthiness check, but breaks exact comparisons and hash signatures
     downstream (a Supabase URL, a Cloudinary HMAC signature).
     Trim every one of them once, here, at the single place they enter the
     function, so nothing downstream has to remember to do it. */
  const CLOUDINARY_API_KEY = (process.env.CLOUDINARY_API_KEY || "").trim();
  const CLOUDINARY_API_SECRET = (process.env.CLOUDINARY_API_SECRET || "").trim();
  const CLOUDINARY_UPLOAD_PRESET = (process.env.CLOUDINARY_UPLOAD_PRESET || "").trim();
  const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
  const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  /* Name the missing variable. "Not configured" alone sent people to SETUP.md
     to re-check five values when only one was ever blank. The names are not
     secrets; the values never leave this function. */
  const missing = [
    ["CLOUDINARY_API_KEY", CLOUDINARY_API_KEY],
    ["CLOUDINARY_API_SECRET", CLOUDINARY_API_SECRET],
    ["SUPABASE_URL", SUPABASE_URL],
    ["SUPABASE_SERVICE_ROLE_KEY", SUPABASE_SERVICE_ROLE_KEY],
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

  const token = typeof body?.accessToken === "string" ? body.accessToken : "";
  const folder = typeof body?.folder === "string" ? body.folder : "";

  if (!token) return { status: 401, json: { error: "Sign in to upload." } };
  if (!ALLOWED_FOLDERS.has(folder)) {
    return { status: 400, json: { error: "That upload destination is not allowed." } };
  }

  let caller;
  try {
    caller = await authenticate(token);
  } catch (error) {
    /* Deliberately vague to the caller; the real reason is logged server-side. */
    console.error("[sign-upload] authenticate failed:", error?.message || error);
  }
  if (!caller) {
    return { status: 401, json: { error: "Your session is not valid. Please sign in again." } };
  }

  if (!["faculty", "admin"].includes(caller.profile.role)) {
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
