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

/* Formats checked here for a quick, clear error. The upload preset enforces the
   same list server-side, which is what actually matters. */
const ALLOWED_TYPES = new Set([
  "application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp",
]);

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

  const { signature, timestamp, apiKey, uploadPreset } = await requestSignature(folder);

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("signature", signature);
  form.append("folder", folder);
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

export async function uploadFiles(files, options = {}) {
  const out = [];
  for (let i = 0; i < files.length; i += 1) {
    /* Sequential, so progress can report "file 2 of 5" and one failure does not
       leave five half-finished uploads in flight. */
    out.push(await uploadFile(files[i], {
      ...options,
      onProgress: (pct) => options.onProgress?.(pct, i + 1, files.length),
    }));
  }
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
export async function shrinkPhoto(file, maxBytes = MAX_PHOTO_BYTES) {
  if (!file?.type?.startsWith("image/")) throw new Error("Choose an image — a JPG, PNG or WebP.");
  if (file.size <= maxBytes) return file;

  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let side = 1600;
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
