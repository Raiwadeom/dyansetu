/* ============================================================================
   DnyanSetu — one-time move from Firebase (Auth + Firestore) to Supabase

   Copies, in order:
     1. every Firebase Auth user  -> a Supabase auth user with the same email
        (confirmed, no password yet; the database trigger creates the profile)
     2. Firestore profiles/{uid}   -> public.profiles (role, name, details, …)
     3. profiles/{uid}/attempts    -> public.quiz_attempts
     4. notes                      -> public.notes (same ids)
     5. pyqPapers                  -> public.pyq_papers (same ids)

   Passwords are not copied — Firebase's modified-scrypt hashes cannot be
   checked by Supabase. Instead each migrated email/password account is marked
   legacy_password_pending, and api/legacy-login.js checks the old password
   against Firebase on that user's first sign-in and sets it on Supabase.
   Nothing in Firebase is changed or deleted; every read here is read-only.

   Safe to run more than once: users are matched by email, and every table
   write is an upsert on a stable key.

   Run from hac/:
     node scripts/migrate-firebase-to-supabase.mjs --service-account=path/to/firebase-key.json --dry-run
     node scripts/migrate-firebase-to-supabase.mjs --service-account=path/to/firebase-key.json

   Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (or the
   environment), and supabase/migrations/0001_core.sql already run.
   ========================================================================== */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, "").split("=");
  return [k, v ?? true];
}));
const DRY = Boolean(args["dry-run"]);

/* Same parsing rule as vite.config.js: the file is the source of truth. */
function loadEnvFile(name) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m || process.env[m[1]]) continue;
    let value = m[2].trim();
    const quoted = /^(['"])([\s\S]*)\1$/.exec(value);
    value = quoted ? quoted[2] : value.replace(/\s+#.*$/, "").trim();
    process.env[m[1]] = value;
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env");

const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const keyPath = args["service-account"] || process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
if (!keyPath || !fs.existsSync(keyPath)) {
  console.error("Pass --service-account=path/to/firebase-service-account.json");
  console.error("(Firebase console -> Project settings -> Service accounts -> Generate new private key)");
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(fs.readFileSync(keyPath, "utf8"))) });
const fbAuth = getAuth();
const firestore = getFirestore();
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const iso = (ts) => (ts?.toDate ? ts.toDate().toISOString() : typeof ts === "number" ? new Date(ts).toISOString() : null);
const log = (...a) => console.log(DRY ? "[dry-run]" : "", ...a);

async function upsert(table, rows, onConflict) {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    if (DRY) continue;
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  log(`${table}: ${rows.length} row(s)`);
}

/* ---------------------------------------------------------------- 1. users */

async function existingSupabaseUsers() {
  const byEmail = new Map();
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    data.users.forEach((u) => u.email && byEmail.set(u.email.toLowerCase(), u.id));
    if (data.users.length < 1000) break;
  }
  return byEmail;
}

async function allFirebaseUsers() {
  const users = [];
  let token;
  do {
    const page = await fbAuth.listUsers(1000, token);
    users.push(...page.users);
    token = page.pageToken;
  } while (token);
  return users;
}

const idMap = new Map(); /* firebase uid -> supabase uuid */

async function migrateUsers() {
  const [fbUsers, sbByEmail] = await Promise.all([allFirebaseUsers(), existingSupabaseUsers()]);
  log(`Firebase users: ${fbUsers.length}, already in Supabase: ${sbByEmail.size}`);

  const profileDocs = new Map();
  (await firestore.collection("profiles").get()).docs.forEach((d) => profileDocs.set(d.id, d.data()));

  let created = 0;
  let skipped = 0;
  const profileRows = [];

  for (const u of fbUsers) {
    const email = (u.email || "").toLowerCase();
    if (!email) { skipped += 1; continue; }
    const doc = profileDocs.get(u.uid) || {};

    let id = sbByEmail.get(email);
    if (!id) {
      if (DRY) {
        id = `dry-${u.uid}`;
      } else {
        const { data, error } = await supabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: { name: doc.name || u.displayName || "" },
        });
        if (error) throw new Error(`createUser ${email}: ${error.message}`);
        id = data.user.id;
      }
      created += 1;
    }
    idMap.set(u.uid, id);

    const hasPassword = u.providerData.some((p) => p.providerId === "password");
    profileRows.push({
      id,
      role: ["student", "faculty", "admin"].includes(doc.role) ? doc.role : "student",
      name: doc.name || u.displayName || email.split("@")[0],
      email,
      phone: doc.phone || "",
      pfp: doc.pfp || null,
      cover: doc.cover || null,
      tracking_id: doc.trackingId || null,
      status: doc.status === "deleted" ? "deleted" : "active",
      restricted: doc.restricted === true || u.disabled === true,
      details: doc.details || {},
      legacy_firebase_uid: u.uid,
      legacy_password_pending: hasPassword,
      created_at: iso(doc.createdAt) || u.metadata.creationTime && new Date(u.metadata.creationTime).toISOString(),
    });
  }

  log(`Supabase users created: ${created}, skipped (no email): ${skipped}`);
  if (!DRY) await upsert("profiles", profileRows, "id");
  else log(`profiles: ${profileRows.length} row(s)`);
}

/* ------------------------------------------------------------- 2. attempts */

async function migrateAttempts() {
  const rows = [];
  for (const [fbUid, sbId] of idMap) {
    const snap = await firestore.collection("profiles").doc(fbUid).collection("attempts").get();
    snap.docs.forEach((d) => {
      const a = d.data();
      rows.push({
        user_id: sbId,
        stream_id: a.streamId,
        year: Number(a.year) || 0,
        subject_id: a.subjectId,
        stage: a.stage,
        score: Number(a.score) || 0,
        total: Number(a.total) || 0,
        passed: a.passed === true,
        question_ids: (a.questionIds || []).map(String),
        legacy_id: `${fbUid}/${d.id}`,
        created_at: iso(a.createdAt) || new Date().toISOString(),
      });
    });
  }
  if (DRY) log(`quiz_attempts: ${rows.length} row(s)`);
  else await upsert("quiz_attempts", rows, "legacy_id");
}

/* ------------------------------------------------------- 3. notes and papers */

async function migrateNotes() {
  const snap = await firestore.collection("notes").get();
  const rows = snap.docs.map((d) => {
    const n = d.data();
    return {
      id: d.id,
      stream_id: n.streamId || "",
      subject: n.subject || "Untitled",
      semester: n.semester == null ? null : String(n.semester),
      title: n.title || "Untitled",
      description: n.description || "",
      files: n.files || [],
      uploaded_by: idMap.get(n.uploadedBy) || null,
      author_name: n.authorName || "Faculty",
      created_at: iso(n.createdAt) || new Date().toISOString(),
    };
  });
  if (DRY) log(`notes: ${rows.length} row(s)`);
  else await upsert("notes", rows, "id");
}

async function migratePapers() {
  const snap = await firestore.collection("pyqPapers").get();
  const rows = snap.docs.map((d) => {
    const p = d.data();
    return {
      id: d.id,
      stream_id: p.streamId,
      subject_id: p.subjectId,
      year: Number(p.year) || 0,
      session: p.session || "",
      file: p.file || {},
      uploaded_by: idMap.get(p.uploadedBy) || null,
      created_at: iso(p.createdAt) || new Date().toISOString(),
    };
  });
  if (DRY) log(`pyq_papers: ${rows.length} row(s)`);
  else await upsert("pyq_papers", rows, "id");
}

try {
  await migrateUsers();
  await migrateAttempts();
  await migrateNotes();
  await migratePapers();
  console.log(DRY ? "\nDry run finished — nothing was written. Run again without --dry-run." : "\nMigration finished.");
} catch (error) {
  console.error("\nMigration stopped:", error.message);
  process.exitCode = 1;
}
