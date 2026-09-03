/* ============================================================================
   DyanSetu — single administrator session

   The administrator account may be open in exactly one place at a time. The
   lock is a single Firestore document, so it holds across tabs, windows,
   browsers and devices — not just within one browser, which a localStorage
   flag would be limited to.

   The holder rewrites its heartbeat on a timer. If a window is closed without
   releasing (a crash, a killed tab, a lost connection) the heartbeat stops and
   the lock goes stale, after which the next window may take it over. That TTL
   is the whole reason the heartbeat exists: without it a crashed session would
   lock the administrator out permanently.

   Timestamps are client clock rather than serverTimestamp, because a
   serverTimestamp reads back as null until the write lands and the staleness
   comparison has to work on the value that is already there.
   ========================================================================== */

import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

import { db, isBackendConfigured } from "./firebase.js";

const LOCK_PATH = ["adminSessions", "current"];

/* Rewrite this often; treat a lock older than STALE_MS as abandoned. The gap
   between them is deliberately wide, so a slow network cannot cause a live
   session to lose its own lock. */
export const HEARTBEAT_MS = 15000;
export const STALE_MS = 50000;

export function newSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function lockRef() {
  return doc(db, ...LOCK_PATH);
}

function isStale(data) {
  const beat = Number(data?.heartbeatAt) || 0;
  return Date.now() - beat > STALE_MS;
}

/* Returns { ok: true } when this window now holds the lock, or
   { ok: false, since } when another live window already has it. */
export async function claimAdminSession(uid, sessionId) {
  if (!isBackendConfigured) return { ok: true };
  try {
    const snap = await getDoc(lockRef());
    const held = snap.exists() ? snap.data() : null;

    if (held && held.sessionId !== sessionId && !isStale(held)) {
      return { ok: false, since: Number(held.claimedAt) || null };
    }

    await setDoc(lockRef(), {
      sessionId,
      uid,
      claimedAt: held?.sessionId === sessionId ? (held.claimedAt ?? Date.now()) : Date.now(),
      heartbeatAt: Date.now(),
    });
    return { ok: true };
  } catch (error) {
    /* A lock that cannot be read must not bar the administrator from their own
       desk — fail open and log it. */
    console.error("Admin session lock unavailable", error);
    return { ok: true, degraded: true };
  }
}

export async function beatAdminSession(uid, sessionId) {
  if (!isBackendConfigured) return;
  try {
    await setDoc(lockRef(), { sessionId, uid, heartbeatAt: Date.now() }, { merge: true });
  } catch (error) {
    console.error(error);
  }
}

/* Only the holder clears the lock, so a window that was refused access cannot
   release the session that refused it. */
export async function releaseAdminSession(sessionId) {
  if (!isBackendConfigured) return;
  try {
    const snap = await getDoc(lockRef());
    if (snap.exists() && snap.data().sessionId === sessionId) {
      await deleteDoc(lockRef());
    }
  } catch (error) {
    console.error(error);
  }
}

/* Watches the lock so a window that loses a claim race — both read an empty
   lock and both wrote — finds out immediately rather than at the next beat. */
export function watchAdminSession(sessionId, onLost) {
  if (!isBackendConfigured) return () => {};
  return onSnapshot(
    lockRef(),
    (snap) => {
      if (!snap.exists()) return;
      const held = snap.data();
      if (held.sessionId !== sessionId && !isStale(held)) onLost();
    },
    (error) => console.error(error),
  );
}
