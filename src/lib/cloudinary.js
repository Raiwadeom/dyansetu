/* ============================================================================
   DnyanSetu — Cloudinary uploads (signed)

   The browser cannot upload on its own. Every upload runs in two steps:

     1. Ask /api/sign-upload for a signature, sending the current Supabase
        access token. The server verifies that token with Supabase Auth and
        confirms the account is faculty or admin before signing anything.
     2. Upload straight to Cloudinary with that signature.

   The Cloudinary API secret only ever exists on the server, so nothing in this
   file — or anywhere else in the shipped bundle — can be used to upload without
   a valid faculty session. A signature is also short-lived and scoped to one
   folder, so a captured one is of little use.

   Deletion still needs the API secret and therefore a server call, so removing
   a note deletes the record and hides it from students immediately, while the
   stored file is cleared from the Cloudinary dashboard.
   ========================================================================== */

import { getAccessToken, isBackendConfigured } from "./supabase.js";

/* Trimmed defensively: this value is typed into a hosting dashboard by hand,
   and a trailing space or newline from a copy-paste compiles straight into
   the bundle as part of the upload URL — Cloudinary then reports the whole
   thing, whitespace included, as an "Invalid cloud_name". */
const CLOUD_NAME = (import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "").trim();

export const isCloudinaryConfigured = Boolean(CLOUD_NAME);

const ENDPOINT = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
const SIGN_URL = "/api/sign-upload";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const BIG_IMAGE_BYTES = 1.5 * 1024 * 1024;

/* Formats checked here for a quick, clear error. The signature from
   /api/sign-upload carries allowed_formats, so Cloudinary enforces the same
   list itself, which is what actually matters. */
const ALLOWED_TYPES = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp",
]);

/* A signature stays valid with Cloudinary for an hour and covers any number
   of uploads to its folder, so one is fetched per folder and reused for 45
   minutes instead of a server round-trip before every single file. */
const SIGNATURE_TTL_MS = 45 * 60 * 1000;
const signatureCache = new Map();

function cachedSignature(folder) {
  const hit = signatureCache.get(folder);
  if (hit && Date.now() - hit.at < SIGNATURE_TTL_MS) return hit.promise;
  const promise = requestSignature(folder);
  signatureCache.set(folder, { at: Date.now(), promise });
  promise.catch(() => signatureCache.delete(folder));
  return promise;
}

/* Fetch the signature while the person is still filling in the form, so
   pressing Upload starts sending bytes straight away. Errors are ignored
   here; the real upload reports them. */
export function warmUpload(folder) {
  if (!isCloudinaryConfigured || !isBackendConfigured) return;
  cachedSignature(folder).catch(() => {});
}

async function requestSignature(folder) {
  const accessToken = isBackendConfigured ? await getAccessToken() : "";
  if (!accessToken) {
    throw new Error("Sign in to upload files.");
  }

  const response = await fetch(SIGN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken, folder }),
  });

  let body = {};
  try { body = await response.json(); } catch { /* handled below */ }

  if (!response.ok) {
    throw new Error(body.error || "Could not authorise this upload.");
  }
  return body;
}

/* Uploads one file and returns the details stored alongside the record. */
export async function uploadFile(file, { folder = "dnyansetu/notes", onProgress } = {}) {
  if (!isCloudinaryConfigured) {
    throw new Error("File uploads are not configured yet. See SETUP.md.");
  }
  if (!file) throw new Error("No file selected.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`"${file.name}" is larger than 15 MB.`);
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    throw new Error(`"${file.name}" is not a PDF or an image.`);
  }

  /* Phone photos of notes are often 4–8 MB; a 2400px JPEG stays sharp for
     reading and uploads several times faster on college Wi-Fi. */
  if (file.type && file.type.startsWith("image/") && file.size > BIG_IMAGE_BYTES) {
    file = await shrinkPhoto(file, BIG_IMAGE_BYTES, 2400).catch(() => file);
  }

  const { signature, timestamp, apiKey, uploadPreset, allowedFormats } = await cachedSignature(folder);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("folder", folder);
  if (allowedFormats) form.append("allowed_formats", allowedFormats);
  if (uploadPreset) form.append("upload_preset", uploadPreset);

  /* XHR rather than fetch, because it reports upload progress. */
  const result = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", ENDPOINT);

    xhr.upload.onprogress = (event) => {
      if (onProgress && event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let body = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON error page */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body);
      reject(new Error(body?.error?.message || `Upload failed (${xhr.status}).`));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection and try again."));
    xhr.send(form);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format,
    name: file.name,
    type: file.type,
    size: result.bytes ?? file.size,
  };
}

/* Up to three files at a time; progress is reported as the share of all
   bytes sent so far, with "file n of total" counting finished files. */
export async function uploadFiles(files, options = {}) {
  const total = files.length;
  const out = new Array(total);
  const pcts = new Array(total).fill(0);
  const weights = files.map((f) => Math.max(1, f.size || 1));
  const weightSum = weights.reduce((a, b) => a + b, 0);
  let done = 0;
  const report = () => {
    const pct = Math.round(pcts.reduce((sum, p, i) => sum + p * weights[i], 0) / weightSum);
    options.onProgress?.(pct, Math.min(total, done + 1), total);
  };

  let next = 0;
  const worker = async () => {
    while (next < total) {
      const i = next;
      next += 1;
      out[i] = await uploadFile(files[i], {
        ...options,
        onProgress: (pct) => { pcts[i] = pct; report(); },
      });
      pcts[i] = 100;
      done += 1;
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, total) }, worker));
  return out;
}

/* A download-forcing variant of a delivery URL. Cloudinary honours fl_attachment
   as a transformation, which makes a PDF save rather than open in a viewer. */
export function downloadUrl(file) {
  if (!file?.url) return "";
  return file.url.replace("/upload/", "/upload/fl_attachment/");
}

export const MAX_PHOTO_BYTES = 300 * 1024;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That image could not be read. Try a JPG or PNG.")); };
    img.src = url;
  });
}

/* Phone cameras produce multi-megabyte photos; profile and ID-card photos are
   capped at 300 KB, so shrink them here (JPEG, stepping down size and quality)
   instead of rejecting them. */
export async function shrinkPhoto(file, maxBytes = MAX_PHOTO_BYTES, startSide = 1600) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose an image — a JPG, PNG or WebP.");
  if (file.size <= maxBytes) return file;

  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let side = startSide;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.72, 0.6]) {
      const blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
      if (blob && blob.size <= maxBytes) {
        const name = (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg";
        return new File([blob], name, { type: "image/jpeg" });
      }
    }
    side = Math.round(side * 0.75);
  }
  throw new Error("This photo is too large even after shrinking. Try a smaller one (under 300 KB).");
}
