/* ============================================================================
   DnyanSetu — single administrator session

   The administrator account may be open in exactly one place at a time. The
   lock is a single row in admin_sessions, so it holds across tabs, windows,
   browsers and devices — not just within one browser, which a localStorage
   flag would be limited to.

   The holder rewrites its heartbeat on a timer. If a window is closed without
   releasing (a crash, a killed tab, a lost connection) the heartbeat stops and
   the lock goes stale, after which the next window may take it over. That TTL
   is the whole reason the heartbeat exists: without it a crashed session would
   lock the administrator out permanently.

   Timestamps are client clock (epoch milliseconds), so the staleness
   comparison works on exactly the value that was written.
   ========================================================================== */

import { isBackendConfigured, supabase } from "./supabase.js";

const LOCK_ID = "current";

/* Rewrite this often; treat a lock older than STALE_MS as abandoned. The gap
   between them is deliberately wide, so a slow network cannot cause a live
   session to lose its own lock. */
export const HEARTBEAT_MS = 15000;
export const STALE_MS = 50000;

export function newSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `s-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readLock() {
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("session_id, uid, claimed_at, heartbeat_at")
    .eq("id", LOCK_ID)
    .maybeSingle();
  if (error) throw error;
  return data
    ? { sessionId: data.session_id, uid: data.uid, claimedAt: data.claimed_at, heartbeatAt: data.heartbeat_at }
    : null;
}

async function writeLock({ sessionId, uid, claimedAt, heartbeatAt }) {
  const { error } = await supabase.from("admin_sessions").upsert({
    id: LOCK_ID, session_id: sessionId, uid, claimed_at: claimedAt, heartbeat_at: heartbeatAt,
  });
  if (error) throw error;
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
    const held = await readLock();

    if (held && held.sessionId !== sessionId && !isStale(held)) {
      return { ok: false, since: Number(held.claimedAt) || null };
    }

    await writeLock({
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
    const held = await readLock();
    /* Lost the lock to another live window: leave it alone; the watcher below
       tells this window to step down. */
    if (held && held.sessionId !== sessionId && !isStale(held)) return;
    await writeLock({
      sessionId,
      uid,
      claimedAt: held?.sessionId === sessionId ? (held.claimedAt ?? Date.now()) : Date.now(),
      heartbeatAt: Date.now(),
    });
  } catch (error) {
    console.error(error);
  }
}

/* Only the holder clears the lock, so a window that was refused access cannot
   release the session that refused it. */
export async function releaseAdminSession(sessionId) {
  if (!isBackendConfigured) return;
  try {
    await supabase.from("admin_sessions").delete().eq("id", LOCK_ID).eq("session_id", sessionId);
  } catch (error) {
    console.error(error);
  }
}

/* Checks the lock between heartbeats so a window that loses a claim race —
   both read an empty lock and both wrote — finds out within a few seconds. */
export function watchAdminSession(sessionId, onLost) {
  if (!isBackendConfigured) return () => {};
  const timer = setInterval(async () => {
    try {
      const held = await readLock();
      if (held && held.sessionId !== sessionId && !isStale(held)) onLost();
    } catch (error) {
      console.error(error);
    }
  }, 5000);
  return () => clearInterval(timer);
}
