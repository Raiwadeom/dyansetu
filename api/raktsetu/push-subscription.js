/* ============================================================================
   POST   /api/raktsetu/push-subscription — save this browser's subscription
   DELETE /api/raktsetu/push-subscription — remove it (push turned off)

   One row per browser, keyed on the push endpoint. A browser that signs in as
   a different account moves its subscription to that account. Signing out
   does NOT remove it, so alerts keep arriving after the tab is closed.
   ========================================================================== */

import {
  authenticate, bearerToken, missingEnv, readBody, supabaseAdmin,
} from "../_lib/supabaseAdmin.js";

function isPushEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && value.length <= 1000;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const missing = missingEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (missing.length) {
    res.status(503).json({ error: `RaktSetu is not configured: ${missing.join(", ")} missing.` });
    return;
  }

  const caller = await authenticate(bearerToken(req));
  if (!caller) {
    res.status(401).json({ error: "Your session is not valid. Please sign in again." });
    return;
  }

  const body = readBody(req);
  const admin = supabaseAdmin();

  if (req.method === "DELETE") {
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    if (!endpoint) {
      res.status(400).json({ error: "Missing endpoint." });
      return;
    }
    await admin.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", caller.user.id);
    res.status(200).json({ ok: true });
    return;
  }

  const sub = body.subscription || {};
  const p256dh = sub.keys?.p256dh;
  const auth = sub.keys?.auth;
  if (!isPushEndpoint(sub.endpoint) || typeof p256dh !== "string" || typeof auth !== "string") {
    res.status(400).json({ error: "That is not a valid push subscription." });
    return;
  }

  const { error } = await admin.from("push_subscriptions").upsert({
    user_id: caller.user.id,
    endpoint: sub.endpoint,
    keys: { p256dh, auth },
    user_agent: String(req.headers["user-agent"] || "").slice(0, 300),
  }, { onConflict: "endpoint" });

  if (error) {
    console.error("[raktsetu] subscription save failed:", error.message);
    res.status(500).json({ error: "Could not save this browser for alerts." });
    return;
  }

  /* Turning push on in this browser also switches the account preference on. */
  await admin.from("raktsetu_profiles").update({ notify_push: true }).eq("user_id", caller.user.id);
  res.status(200).json({ ok: true });
}
