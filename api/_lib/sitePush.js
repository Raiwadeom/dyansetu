/* ============================================================================
   DnyanSetu notifications — sending (rebuilt 2026-10-11)

   Devices live in public.push_devices (migration 0026). Every send is
   written to public.push_log so delivery can be checked in Supabase.
   Same free VAPID keys as RaktSetu, but RaktSetu's blood alerts keep their
   own table and service worker.
   ========================================================================== */

import webpush from "web-push";

import { env, supabaseAdmin } from "./supabaseAdmin.js";

const CHUNK = 100;
const PAGE = 1000;
const SEND_OPTIONS = { TTL: 24 * 60 * 60, urgency: "high", timeout: 8000 };

function configure() {
  const publicKey = env("VAPID_PUBLIC_KEY");
  const privateKey = env("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(env("VAPID_SUBJECT", "mailto:smuiqac@gmail.com"), publicKey, privateKey);
  return true;
}

async function liveDevices() {
  const admin = supabaseAdmin();
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from("push_devices").select("id, endpoint, p256dh, auth, user_id")
      .is("dead_at", null).order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load devices: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/* Sends one payload to the given devices; marks gone ones dead, stamps the
   rest, and logs the result. */
async function deliver(devices, payload, { kind, refId = "" }) {
  const admin = supabaseAdmin();
  if (!configure()) return { sent: 0, failed: 0, removed: 0, targets: devices.length, skipped: "VAPID keys are not configured." };

  /* The phone shows this as the notification's time, so one that arrives
     late still says when it was really sent. */
  const body = JSON.stringify({ ...payload, sentAt: Date.now() });
  const delivered = [];
  const gone = [];
  let failed = 0;

  for (let i = 0; i < devices.length; i += CHUNK) {
    const chunk = devices.slice(i, i + CHUNK);
    const results = await Promise.allSettled(chunk.map((d) => webpush.sendNotification(
      { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, body, SEND_OPTIONS,
    )));
    results.forEach((r, index) => {
      if (r.status === "fulfilled") { delivered.push(chunk[index].id); return; }
      const status = r.reason?.statusCode;
      if (status === 404 || status === 410) gone.push(chunk[index].id);
      else { failed += 1; console.error("[push] send failed:", status, r.reason?.body || r.reason?.message); }
    });
  }

  const now = new Date().toISOString();
  if (gone.length) await admin.from("push_devices").update({ dead_at: now }).in("id", gone);
  if (delivered.length) await admin.from("push_devices").update({ last_sent_at: now }).in("id", delivered);
  /* Forget devices that have been gone for a month. */
  await admin.from("push_devices").delete().lt("dead_at", new Date(Date.now() - 30 * 86400000).toISOString());

  const result = { targets: devices.length, sent: delivered.length, failed, removed: gone.length };
  await admin.from("push_log").insert({ kind, ref_id: String(refId), title: String(payload.title || "").slice(0, 200), ...result });
  return result;
}

/* Every device, minus the browsers of skipUsers. */
export async function broadcast(payload, { skipUsers = [], kind = "other", refId = "" } = {}) {
  const skip = new Set(skipUsers);
  const devices = (await liveDevices()).filter((d) => !d.user_id || !skip.has(d.user_id));
  return deliver(devices, payload, { kind, refId });
}
