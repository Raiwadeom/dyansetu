/* ============================================================================
   DyanSetu — Profiles and authentication (Firebase Auth + Firestore)

   The React app works with one flat user object. Firestore holds the same
   shape, with the fields the admin directory filters on kept at the top level
   and the role-specific rest under `details`.

   There is no server-side trigger here — Cloud Functions need the paid plan —
   so the profile document is written by the client immediately after signup.
   firestore.rules is what actually decides whether that write is allowed, and
   it is the only thing that can grant the admin role.
   ========================================================================== */

import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut as fbSignOut, onAuthStateChanged, updateProfile as updateAuthProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc, getDoc, setDoc, updateDoc, collection, query, where,
  getDocs, serverTimestamp,
} from "firebase/firestore";

import { auth, db, isBackendConfigured, friendlyError } from "./firebase.js";

export const ADMIN_EMAIL = "smuiqac@gmail.com";

/* Fields kept as top-level document keys; anything else goes into `details`. */
const COLUMNS = ["role", "name", "email", "phone", "pfp", "cover", "trackingId", "status", "restricted"];

/* Fields a user may never write to their own document. The rules enforce this
   as well — this only avoids sending changes that would be rejected. */
const PRIVILEGED = new Set(["role", "status", "restricted"]);

function toProfile(snapshot) {
  if (!snapshot?.exists()) return null;
  const { details, createdAt, updatedAt, ...rest } = snapshot.data();
  return {
    ...(details || {}),
    ...rest,
    id: snapshot.id,
    joined: createdAt?.toMillis?.() ?? Date.now(),
  };
}

function toDocument(profile, { includePrivileged = false } = {}) {
  const out = {};
  const details = {};

  Object.entries(profile || {}).forEach(([key, value]) => {
    if (key === "id" || key === "joined" || key === "password" || value === undefined) return;
    if (COLUMNS.includes(key)) {
      if (PRIVILEGED.has(key) && !includePrivileged) return;
      out[key] = value;
      return;
    }
    details[key] = value;
  });

  out.details = details;
  out.updatedAt = serverTimestamp();
  return out;
}

/* --------------------------------- auth ---------------------------------- */

export async function signUp({ name, email, password, role }) {
  if (!isBackendConfigured) return { success: false, message: "Accounts are not configured yet." };

  const normalised = email.trim().toLowerCase();
  /* The rules only accept 'admin' from the one authorised address, so asking
     for it here from anywhere else simply fails the write. */
  const requested = normalised === ADMIN_EMAIL
    ? "admin"
    : role === "faculty" ? "faculty" : "student";

  try {
    const { user } = await createUserWithEmailAndPassword(auth, normalised, password);

    if (name) {
      await updateAuthProfile(user, { displayName: name }).catch(() => {});
    }

    await setDoc(doc(db, "profiles", user.uid), {
      role: requested,
      name: name || normalised.split("@")[0],
      email: normalised,
      phone: "",
      status: "active",
      restricted: false,
      details: {},
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { success: true, message: "Account created successfully." };
  } catch (error) {
    return { success: false, message: friendlyError(error) };
  }
}

export async function signIn({ email, password }) {
  if (!isBackendConfigured) return { success: false, message: "Accounts are not configured yet." };
  try {
    await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    return { success: true, message: "Login successful." };
  } catch (error) {
    return { success: false, message: friendlyError(error) };
  }
}

/* Works for a student, faculty or admin account alike — Firebase Auth does
   not distinguish role, and the reset email/link is the same for all three.
   Firebase never reveals whether the address is actually registered, so the
   caller should show one neutral message regardless of the result. */
export async function resetPassword({ email }) {
  if (!isBackendConfigured) return { success: false, message: "Accounts are not configured yet." };
  try {
    await sendPasswordResetEmail(auth, (email || "").trim().toLowerCase());
    return { success: true, message: "If an account exists for that email, a reset link is on its way." };
  } catch (error) {
    return { success: false, message: friendlyError(error) };
  }
}

export async function signOut() {
  if (!isBackendConfigured) return;
  await fbSignOut(auth);
}

/* Resolves once Firebase has restored any persisted session. */
export function getSession() {
  if (!isBackendConfigured) return Promise.resolve(null);
  return new Promise((resolve) => {
    const stop = onAuthStateChanged(auth, (user) => {
      stop();
      resolve(user ? { user: { id: user.uid, email: user.email } } : null);
    });
  });
}

/* Fires on login, logout and token refresh. Returns an unsubscribe function. */
export function onAuthChange(handler) {
  if (!isBackendConfigured) return () => {};
  return onAuthStateChanged(auth, (user) => {
    handler(user ? { user: { id: user.uid, email: user.email } } : null);
  });
}

/* -------------------------------- profile -------------------------------- */

export async function fetchProfile(userId) {
  if (!isBackendConfigured || !userId) return null;
  return toProfile(await getDoc(doc(db, "profiles", userId)));
}

export async function updateProfile(userId, profile) {
  if (!isBackendConfigured || !userId) return null;
  await updateDoc(doc(db, "profiles", userId), toDocument(profile));
  return fetchProfile(userId);
}

/* ------------------------------ admin views ------------------------------ */

export async function listProfiles() {
  if (!isBackendConfigured) return [];
  /* Filter on one field, sort in memory. Doing both in the query — where() on
     status plus orderBy() on createdAt — needs a composite index that Firestore
     never builds on its own, so the directory failed with failed-precondition
     on any project where that index had not been deployed by hand. It also
     silently dropped every document without a createdAt, which is exactly the
     shape a profile written through the console ends up with.

     The directory is one row per account; sorting it here costs nothing. */
  const snapshot = await getDocs(query(
    collection(db, "profiles"),
    where("status", "==", "active"),
  ));
  return snapshot.docs
    .map((d) => toProfile(d))
    .filter(Boolean)
    .sort((a, b) => (b.joined || 0) - (a.joined || 0));
}

/* Records that this account opened the notes library. Written to the user's own
   profile rather than a separate log: a user may already update their own
   document, so this needs no new collection and no new rule, and the admin desk
   picks it up from the directory read it already does.

   `details.` prefix keeps it out of the top-level columns; toProfile() flattens
   details back out, so it reads as profile.notesLastOpenedAt. */
export async function markNotesOpened(uid) {
  if (!isBackendConfigured || !uid) return;
  try {
    await updateDoc(doc(db, "profiles", uid), {
      "details.notesLastOpenedAt": Date.now(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    /* Never block reading notes because the marker could not be written. */
    console.error(error);
  }
}

/* Only an admin may send role, status and restricted; the rules check it. */
export async function adminUpdateProfile(profile) {
  if (!isBackendConfigured) return null;
  await updateDoc(doc(db, "profiles", profile.id), toDocument(profile, { includePrivileged: true }));
  return fetchProfile(profile.id);
}

/* A soft delete. Removing the underlying auth user needs the Admin SDK, which
   cannot safely run in a browser, so the document is marked and filtered out. */
export async function adminDeleteProfile(userId) {
  if (!isBackendConfigured) return;
  await updateDoc(doc(db, "profiles", userId), {
    status: "deleted",
    restricted: true,
    updatedAt: serverTimestamp(),
  });
}
