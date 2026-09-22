/* ============================================================================
   DnyanSetu — guided setup

   Paste the Firebase config block straight from the console and answer three
   short questions. This works out which value belongs to which variable, checks
   the credentials against the live APIs, and writes .env.local.

   Run: npm run setup
   ========================================================================== */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGET = path.join(ROOT, ".env.local");

const rl = createInterface({ input: stdin });
const say = (s = "") => console.log(s);

/* Lines are queued from the 'line' event rather than awaited one at a time.
   rl.question() drops buffered lines when stdin is a pipe and never settles at
   EOF; this handles a paste, a redirect and an interactive session alike. */
const queue = [];
let waiting = null;
let atEof = false;

rl.on("line", (line) => {
  if (waiting) { const resolve = waiting; waiting = null; resolve(line); }
  else queue.push(line);
});
rl.on("close", () => {
  atEof = true;
  if (waiting) { const resolve = waiting; waiting = null; resolve(null); }
});

function nextLine() {
  if (queue.length) return Promise.resolve(queue.shift());
  if (atEof) return Promise.resolve(null);
  return new Promise((resolve) => { waiting = resolve; });
}

function abort(why) {
  say(`\n  ${why}\n  Nothing was written. Run npm run setup again.\n`);
  process.exit(1);
}

/* Keys as Firebase names them, mapped to the variables this project reads. */
const FIREBASE_KEYS = {
  apiKey: "VITE_FIREBASE_API_KEY",
  authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
  projectId: "VITE_FIREBASE_PROJECT_ID",
  storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
  appId: "VITE_FIREBASE_APP_ID",
};

/* Pulls values out of whatever shape was pasted — the `const firebaseConfig =`
   block, a bare object, or JSON. Quoting and trailing commas all vary. */
function parseFirebaseConfig(text) {
  const found = {};
  for (const key of Object.keys(FIREBASE_KEYS)) {
    const match = text.match(new RegExp(`["']?${key}["']?\\s*:\\s*["']([^"']+)["']`));
    if (match) found[key] = match[1].trim();
  }
  return found;
}

async function readPastedBlock() {
  say("Paste the whole firebaseConfig block, then press Enter on a blank line.");
  say("(Firebase console -> Project Settings -> General -> Your apps -> Web)");
  say();
  stdout.write("> ");
  const lines = [];
  for (;;) {
    const line = await nextLine();
    if (line === null) break;
    if (line.trim() === "" && lines.length) break;
    if (line.trim() !== "") lines.push(line);
  }
  if (!lines.length) abort("Nothing was pasted.");
  return lines.join("\n");
}

async function ask(label, { required = true } = {}) {
  for (;;) {
    stdout.write(`${label}: `);
    const line = await nextLine();
    if (line === null) {
      if (!required) return "";
      abort(`Ran out of input while asking for ${label.trim()}.`);
    }
    const value = line.trim();
    if (value || !required) return value;
    say("  (required)");
  }
}

/* ------------------------------ live checks ------------------------------- */

/* Non-mutating probe: createAuthUri just reports whether an address is already
   registered, so it validates the key without touching any account. */
async function checkFirebaseKey(apiKey) {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: "setup-probe@example.com",
          continueUri: "http://localhost",
        }),
      },
    );
    if (res.ok) return { ok: true };
    const body = await res.json().catch(() => ({}));
    const reason = body?.error?.message || `HTTP ${res.status}`;
    if (/API_KEY|API key/i.test(reason)) return { ok: false, reason: "the API key was rejected" };
    if (/CONFIGURATION_NOT_FOUND/i.test(reason)) {
      return { ok: false, reason: "Email/Password sign-in is not enabled yet" };
    }
    return { ok: false, reason };
  } catch (err) {
    return { ok: false, reason: `could not reach Firebase (${err.message})` };
  }
}

/* The usage endpoint needs cloud name, key and secret all correct, so one call
   validates the whole trio. */
async function checkCloudinary(cloudName, apiKey, apiSecret) {
  try {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/usage`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (res.ok) return { ok: true };
    if (res.status === 401) return { ok: false, reason: "the API key or secret is wrong" };
    if (res.status === 404) return { ok: false, reason: "that cloud name does not exist" };
    return { ok: false, reason: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, reason: `could not reach Cloudinary (${err.message})` };
  }
}

/* Confirms the signed preset exists and is actually in signed mode — the single
   most common thing to get wrong in the Cloudinary dashboard. */
async function checkPreset(cloudName, apiKey, apiSecret, preset) {
  try {
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/upload_presets/${preset}`,
      { headers: { Authorization: `Basic ${auth}` } },
    );
    if (res.status === 404) return { ok: false, reason: "not found" };
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const body = await res.json();
    if (body.unsigned) return { ok: false, reason: "it is set to UNSIGNED — change it to Signed" };
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

/* --------------------------------- main ---------------------------------- */

say("\n  DnyanSetu setup\n  ==============\n");

const pasted = await readPastedBlock();
const config = parseFirebaseConfig(pasted);
const missing = Object.keys(FIREBASE_KEYS).filter((k) => !config[k]);

if (missing.length) {
  say(`\n  Could not find: ${missing.join(", ")}`);
  say("  Fill those in by hand:\n");
  for (const key of missing) config[key] = await ask(`  ${key}`);
}

say(`\n  Firebase project: ${config.projectId}`);
say("  Checking the key...");
const fb = await checkFirebaseKey(config.apiKey);
say(fb.ok ? "  ok — Firebase accepted it" : `  warning — ${fb.reason}`);

say("\n  Now Cloudinary (dashboard -> Settings -> API Keys).\n");
const cloudName = await ask("  Cloud name");
const cldKey = await ask("  API Key");
const cldSecret = await ask("  API Secret");
const preset = (await ask("  Upload preset [dnyansetu_signed]", { required: false }))
  || "dnyansetu_signed";

say("\n  Checking Cloudinary...");
const cld = await checkCloudinary(cloudName, cldKey, cldSecret);
say(cld.ok ? "  ok — credentials work" : `  warning — ${cld.reason}`);

if (cld.ok) {
  const p = await checkPreset(cloudName, cldKey, cldSecret, preset);
  say(p.ok
    ? `  ok — "${preset}" exists and is signed`
    : `  warning — preset "${preset}": ${p.reason}`);
}

/* ------------------------------ write it out ------------------------------ */

const contents = `# Written by npm run setup. Do not commit this file.
# VITE_ values are public by design. The rest are secrets — never add a prefix.

${Object.entries(FIREBASE_KEYS).map(([k, v]) => `${v}=${config[k]}`).join("\n")}
VITE_CLOUDINARY_CLOUD_NAME=${cloudName}

FIREBASE_PROJECT_ID=${config.projectId}
CLOUDINARY_API_KEY=${cldKey}
CLOUDINARY_API_SECRET=${cldSecret}
CLOUDINARY_UPLOAD_PRESET=${preset}
`;

if (fs.existsSync(TARGET)) {
  fs.copyFileSync(TARGET, `${TARGET}.bak`);
  say("\n  Existing .env.local saved as .env.local.bak");
}
fs.writeFileSync(TARGET, contents, "utf8");

say(`\n  Wrote ${path.relative(ROOT, TARGET)}\n`);
say("  Two things only you can do, both in a dashboard:");
say("    1. Firestore -> Rules -> paste firestore.rules -> Publish");
say("    2. Cloudinary -> Settings -> Security -> untick 'PDF and ZIP files'");
say("\n  Then: npm run dev\n");

rl.close();
