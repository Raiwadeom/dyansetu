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

import { friendlyError, getAccessToken, isBackendConfigured, supabase } from "./supabase.js";

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
  "approvalStatus", "idProofUrl", "idProofNote",
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
    approvalStatus: row.approval_status || "approved",
    idProofUrl: row.id_proof_url || "",
    idProofNote: row.id_proof_note || "",
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

/* When each account last signed in. That lives in Supabase Auth, which only
   the server can read (api/admin-sign-ins.js); it answers the admin alone.
   Returns { [userId]: { lastSignInAt, provider } }. */
export async function fetchSignIns() {
  if (!isBackendConfigured) return {};
  const accessToken = await getAccessToken();
  if (!accessToken) throw new Error("Sign in again to load the sign-in list.");
  const response = await fetch("/api/admin-sign-ins", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: "{}",
  });
  let body = {};
  try { body = await response.json(); } catch { /* handled below */ }
  if (!response.ok) throw new Error(body.error || "Could not load the sign-in list.");
  return Object.fromEntries((body.accounts || []).map((a) => [a.id, a]));
}

/* --------------------------- faculty/staff approval --------------------------- */

/* The pending account's own proof (an ID-card photo). Scoped to the caller by
   the database function. */
export async function submitIdProof(url, note = "") {
  if (!isBackendConfigured) return;
  const { error } = await supabase.rpc("submit_id_proof", { p_url: url, p_note: note });
  if (error) throw new Error(friendlyError(error, "Could not send your ID proof."));
}

export async function listPendingApprovals() {
  if (!isBackendConfigured) return [];
  const { data, error } = await supabase.rpc("list_pending_approvals");
  if (error) throw new Error(friendlyError(error, "Could not read pending sign-ups."));
  return (data || []).map((r) => ({
    id: r.id, name: r.name, email: r.email, role: r.role,
    idProofUrl: r.id_proof_url || "", idProofNote: r.id_proof_note || "",
    joined: r.created_at ? Date.parse(r.created_at) : 0,
  }));
}

export async function adminReviewPending(userId, approve, note = "") {
  if (!isBackendConfigured) return;
  const { error } = await supabase.rpc("admin_review_pending", { p_user_id: userId, p_approve: approve, p_note: note });
  if (error) throw new Error(friendlyError(error, "Could not save that decision."));
}
