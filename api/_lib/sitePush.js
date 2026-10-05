/* ============================================================================
   DnyanSetu — site-wide web push (announcements, scholarships, new notes)

   Same free VAPID keys as RaktSetu, but its own subscriptions table and its
   own service worker (public/sw.js, scope "/"), so turning one on or off
   never touches the other.
   ========================================================================== */

import webpush from "web-push";

import { env, supabaseAdmin } from "./supabaseAdmin.js";

const PUSH_CHUNK = 100;
const PAGE = 1000;

async function allTargets() {
  const admin = supabaseAdmin();
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin.from("site_push_subscriptions")
      .select("id, endpoint, keys").order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load subscriptions: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/* Sends one payload to every DnyanSetu subscriber; dead subscriptions are
   deleted, live ones stamped. */
export async function broadcast(payload) {
  const publicKey = env("VAPID_PUBLIC_KEY");
  const privateKey = env("VAPID_PRIVATE_KEY");
  const subject = env("VAPID_SUBJECT", "mailto:smuiqac@gmail.com");
  if (!publicKey || !privateKey) return { sent: 0, skipped: "VAPID keys are not configured." };
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const list = await allTargets();
  const body = JSON.stringify(payload);
  let sent = 0;
  const gone = [];
  const delivered = [];

  for (let i = 0; i < list.length; i += PUSH_CHUNK) {
    const chunk = list.slice(i, i + PUSH_CHUNK);
    const results = await Promise.allSettled(chunk.map((t) => webpush.sendNotification(
      { endpoint: t.endpoint, keys: t.keys },
      body,
      { TTL: 24 * 60 * 60, urgency: "normal", timeout: 8000 },
    )));
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        sent += 1;
        delivered.push(chunk[index].id);
        return;
      }
      const status = result.reason?.statusCode;
      if (status === 404 || status === 410) gone.push(chunk[index].id);
      else console.error("[site-push] failed:", status, result.reason?.body || result.reason?.message);
    });
  }

  const admin = supabaseAdmin();
  if (gone.length) await admin.from("site_push_subscriptions").delete().in("id", gone);
  if (delivered.length) {
    await admin.from("site_push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", delivered);
  }
  return { sent, removed: gone.length, targets: list.length };
}
