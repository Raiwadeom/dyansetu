/* ============================================================================
   GET /api/cron/daily — run once a day by Vercel Cron (see vercel.json)

   Three jobs:
     * Keep the Supabase free project awake. Free projects pause after 7 days
       with no activity, after which sign-in and requests fail until someone
       restores the project by hand. A daily query counts as activity.
     * Mark blood requests whose needed-by time has passed as expired.
     * Retention: erase old contact numbers and long-inactive profiles.

   Vercel sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is set,
   so nobody else can trigger this.
   ========================================================================== */

import { bearerToken, env, missingEnv, supabaseAdmin } from "../_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  const secret = env("CRON_SECRET");
  if (!secret || bearerToken(req) !== secret) {
    res.status(401).json({ error: "Unauthorized." });
    return;
  }

  const missing = missingEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (missing.length) {
    res.status(503).json({ error: `${missing.join(", ")} missing.` });
    return;
  }

  const admin = supabaseAdmin();
  const { error: pingError } = await admin.from("profiles").select("id", { head: true, count: "exact" }).limit(1);
  const { data: expired, error: expireError } = await admin.rpc("raktsetu_expire_requests");
  /* Retention: erase contact numbers of requests closed 30+ days ago and
     delete RaktSetu profiles untouched for 12 months. */
  const { data: retention, error: retentionError } = await admin.rpc("raktsetu_retention");

  if (pingError || expireError || retentionError) {
    console.error("[cron] daily failed:", pingError?.message, expireError?.message, retentionError?.message);
    res.status(500).json({ ok: false });
    return;
  }

  res.status(200).json({ ok: true, expired: expired || 0, retention: Array.isArray(retention) ? retention[0] : retention });
}
