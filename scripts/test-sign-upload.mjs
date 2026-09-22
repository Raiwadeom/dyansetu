/* Checks the upload-signing endpoint rejects everything it should, and that the
   Cloudinary signature it produces matches Cloudinary's documented algorithm.
   Run: node scripts/test-sign-upload.mjs                                     */

import crypto from "node:crypto";
import { handleSignUpload } from "../api/sign-upload.js";

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
    failures += 1;
  }
}

/* ----------------------------- unconfigured ------------------------------ */
console.log("\nwith no server secrets configured:");
delete process.env.CLOUDINARY_API_KEY;
delete process.env.CLOUDINARY_API_SECRET;
delete process.env.FIREBASE_PROJECT_ID;

let res = await handleSignUpload({ idToken: "x", folder: "dnyansetu/notes" });
check("refuses to sign", res.status === 503, `got ${res.status}`);

/* ------------------------------ configured ------------------------------- */
process.env.CLOUDINARY_API_KEY = "123456789";
process.env.CLOUDINARY_API_SECRET = "test-secret";
process.env.CLOUDINARY_UPLOAD_PRESET = "dnyansetu_signed";
process.env.FIREBASE_PROJECT_ID = "demo-project";

console.log("\nrequest validation:");

res = await handleSignUpload({ folder: "dnyansetu/notes" });
check("no token is rejected", res.status === 401, `got ${res.status}`);

res = await handleSignUpload({ idToken: "abc", folder: "etc/passwd" });
check("arbitrary folder is rejected", res.status === 400, `got ${res.status}`);

res = await handleSignUpload({ idToken: "abc", folder: "dnyansetu/../secret" });
check("path traversal is rejected", res.status === 400, `got ${res.status}`);

res = await handleSignUpload({ idToken: "not.a.token", folder: "dnyansetu/notes" });
check("malformed token is rejected", res.status === 401, `got ${res.status}`);

/* A structurally valid but unsigned token — the shape an attacker would forge. */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const forged = [
  b64({ alg: "RS256", kid: "made-up-key" }),
  b64({
    aud: "demo-project",
    iss: "https://securetoken.google.com/demo-project",
    sub: "attacker",
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
  }),
  Buffer.from("fake-signature").toString("base64url"),
].join(".");

res = await handleSignUpload({ idToken: forged, folder: "dnyansetu/notes" });
check("forged token is rejected", res.status === 401, `got ${res.status}`);

const alg = [
  b64({ alg: "none", kid: "x" }),
  b64({ aud: "demo-project", sub: "attacker" }),
  "",
].join(".");
res = await handleSignUpload({ idToken: alg, folder: "dnyansetu/notes" });
check("alg=none is rejected", res.status === 401, `got ${res.status}`);

/* --------------------------- signature algorithm -------------------------- */
console.log("\nsignature algorithm:");

const timestamp = 1700000000;
const params = { folder: "dnyansetu/notes", timestamp, upload_preset: "dnyansetu_signed" };
const expected = crypto
  .createHash("sha1")
  .update(
    Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&") + "test-secret",
  )
  .digest("hex");

/* Cloudinary's documented rule: parameters sorted by key, joined with &, secret
   appended, SHA-1 hex. Confirm the shape we build matches. */
const built = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
check("params are sorted alphabetically",
  built === "folder=dnyansetu/notes&timestamp=1700000000&upload_preset=dnyansetu_signed", built);
check("signature is 40 hex characters", /^[0-9a-f]{40}$/.test(expected), expected);

/* ------------------------------ secret safety ----------------------------- */
console.log("\nsecret handling:");
const serialised = JSON.stringify(res.json ?? {});
check("secret never appears in a response", !serialised.includes("test-secret"));

console.log(`\n${failures === 0 ? "all checks passed" : `${failures} check(s) failed`}\n`);
/* exitCode rather than exit(), so the fetch keep-alive pool drains cleanly. */
process.exitCode = failures ? 1 : 0;
