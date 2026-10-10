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
const FOLDER_ROLES = {
  "dnyansetu/notes": ["faculty", "admin"],
  "dnyansetu/papers": ["faculty", "admin"],
  "dnyansetu/avatars": ["faculty", "admin"],
  "dnyansetu/id-proofs": ["faculty", "staff", "scholarship"],
  "dnyansetu/announcements": ["faculty", "admin", "scholarship"],
  /* Talent Corner: students' artwork, posters and thumbnails (photos only). */
  "dnyansetu/talent": ["student"],
};

/* The only file types anyone may upload: PDFs and photos. */
const ALLOWED_FORMATS = "pdf,jpg,jpeg,png,webp";
const PHOTO_FORMATS = "jpg,jpeg,png,webp";

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
    /* The names go to the server log only; the browser gets a plain message. */
    console.error("[sign-upload] missing env:", missing.join(", "));
    return { status: 503, json: { error: "Uploads are not available right now. Please try again later." } };
  }

  const token = typeof body?.accessToken === "string" ? body.accessToken : "";
  const folder = typeof body?.folder === "string" ? body.folder : "";

  if (!token) return { status: 401, json: { error: "Sign in to upload." } };
  if (!Object.hasOwn(FOLDER_ROLES, folder)) {
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

  const role = caller.profile.role;
  if (!FOLDER_ROLES[folder].includes(role)) {
    return { status: 403, json: { error: "Your account cannot upload files here." } };
  }
  /* Notes (and announcement PDFs) stay closed until the administrator has approved the teacher. */
  const publishing = folder === "dnyansetu/notes" || folder === "dnyansetu/papers" || folder === "dnyansetu/announcements";
  if (publishing && role === "faculty" && caller.profile.approval_status && caller.profile.approval_status !== "approved") {
    return { status: 403, json: { error: "Your faculty account is waiting for administrator approval." } };
  }

  /* Cloudinary signs the alphabetically sorted parameters, then the secret. */
  const timestamp = Math.floor(Date.now() / 1000);
  /* Signed, so Cloudinary itself refuses any other file type (the browser's
     own check can be skipped by anyone calling the API directly). */
  const allowedFormats = folder === "dnyansetu/talent" ? PHOTO_FORMATS : ALLOWED_FORMATS;
  const params = { allowed_formats: allowedFormats, folder, timestamp };
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
    json: { signature, timestamp, apiKey: CLOUDINARY_API_KEY, folder, allowedFormats, uploadPreset: CLOUDINARY_UPLOAD_PRESET || null },
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
