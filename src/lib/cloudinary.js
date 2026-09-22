/* ============================================================================
   DnyanSetu — Cloudinary uploads (signed)

   The browser cannot upload on its own. Every upload runs in two steps:

     1. Ask /api/sign-upload for a signature, sending the current Firebase ID
        token. The server verifies that token against Google's certificates and
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

import { auth, isBackendConfigured } from "./firebase.js";

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
  if (!isBackendConfigured || !auth?.currentUser) {
    throw new Error("Sign in as faculty to upload files.");
  }

  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch(SIGN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken, folder }),
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
    // eslint-disable-next-line no-await-in-loop
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
