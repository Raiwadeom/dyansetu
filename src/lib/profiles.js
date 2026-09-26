/* ============================================================================
   DnyanSetu — Profiles (Supabase Postgres)

   The React app works with one flat user object. The profiles table holds the
   same shape, with the fields the admin directory filters on kept as columns
   and the role-specific rest in the `details` jsonb column.

   The row itself is created by a database trigger the moment an auth user
   exists (see supabase/migrations/0001_core.sql). Row Level Security and the
   profiles_guard trigger decide what a user may change — this file only
   avoids sending changes that would be rejected.

   Sign-in and sign-out live in auth.jsx (useAuth), not here.
   ========================================================================== */

import { friendlyError, isBackendConfigured, supabase } from "./supabase.js";

export const ADMIN_EMAIL = "smuiqac@gmail.com";

/* App field -> table column, for the fields kept as real columns. */
const COLUMNS = {
  role: "role",
  name: "name",
  email: "email",
  phone: "phone",
  pfp: "pfp",
  cover: "cover",
  trackingId: "tracking_id",
  status: "status",
  restricted: "restricted",
};

/* Fields a user may never write to their own row. */
const PRIVILEGED = new Set(["role", "status", "restricted"]);

/* Never written from the browser at all (set by the database or the server). */
const READ_ONLY = new Set([
  "id", "joined", "password", "email", "termsAcceptedAt", "termsVersion",
  "legacyFirebaseUid", "createdAt", "updatedAt",
]);

function toProfile(row) {
  if (!row) return null;
  return {
    ...(row.details || {}),
    role: row.role,
    name: row.name,
    email: row.email,
    phone: row.phone,
    pfp: row.pfp,
    cover: row.cover,
    trackingId: row.tracking_id,
    status: row.status,
    restricted: row.restricted,
    termsAcceptedAt: row.terms_accepted_at,
    termsVersion: row.terms_version,
    id: row.id,
    joined: row.created_at ? Date.parse(row.created_at) : Date.now(),
  };
}

function toRow(profile, { includePrivileged = false } = {}) {
  const out = {};
  const details = {};

  Object.entries(profile || {}).forEach(([key, value]) => {
    if (READ_ONLY.has(key) || value === undefined) return;
    if (COLUMNS[key]) {
      if (PRIVILEGED.has(key) && !includePrivileged) return;
      out[COLUMNS[key]] = value;
      return;
    }
    details[key] = value;
  });

  out.details = details;
  return out;
}

async function run(query, fallback) {
  const { data, error } = await query;
  if (error) throw new Error(friendlyError(error, fallback));
  return data;
}

/* -------------------------------- profile -------------------------------- */

export async function fetchProfile(userId) {
  if (!isBackendConfigured || !userId) return null;
  const row = await run(
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    "Could not load your profile.",
  );
  return toProfile(row);
}

export async function updateProfile(userId, profile) {
  if (!isBackendConfigured || !userId) return null;
  const row = await run(
    supabase.from("profiles").update(toRow(profile)).eq("id", userId).select("*").single(),
    "Could not save your profile.",
  );
  return toProfile(row);
}

/* ------------------------------ admin views ------------------------------ */

export async function listProfiles() {
  if (!isBackendConfigured) return [];
  const rows = await run(
    supabase.from("profiles").select("*").eq("status", "active").order("created_at", { ascending: false }),
    "Could not read the user directory.",
  );
  return (rows || []).map(toProfile);
}

/* Records that this account opened the notes library, for the admin desk.
   Reads back as profile.notesLastOpenedAt. */
export async function markNotesOpened(uid) {
  if (!isBackendConfigured || !uid) return;
  const { error } = await supabase.rpc("mark_notes_opened");
  /* Never block reading notes because the marker could not be written. */
  if (error) console.error(error);
}

/* Only an admin may send role, status and restricted; the database checks it. */
export async function adminUpdateProfile(profile) {
  if (!isBackendConfigured) return null;
  const row = await run(
    supabase.from("profiles").update(toRow(profile, { includePrivileged: true })).eq("id", profile.id).select("*").single(),
    "Could not update that account.",
  );
  return toProfile(row);
}

/* A soft delete: the row is marked and filtered out of the directory. */
export async function adminDeleteProfile(userId) {
  if (!isBackendConfigured) return;
  await run(
    supabase.from("profiles").update({ status: "deleted", restricted: true }).eq("id", userId),
    "Could not remove that account.",
  );
}
