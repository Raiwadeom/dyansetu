/* ============================================================================
   GET/POST /api/raktsetu/unsubscribe?token=… — turn RaktSetu email alerts off

   GET is the link a person clicks in the email. POST is the one-click
   unsubscribe (RFC 8058) that Gmail's own "Unsubscribe" button sends. Both do
   the same thing: set notify_email = false for the account the signed token
   names. No sign-in needed, and the token cannot be forged.
   ========================================================================== */

import { missingEnv, supabaseAdmin } from "../_lib/supabaseAdmin.js";
import { readUnsubscribeToken } from "../_lib/unsubscribeToken.js";

function page(title, message) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} · RaktSetu</title>
<style>body{margin:0;font-family:Segoe UI,Arial,sans-serif;background:#f6f6f6;color:#111827}
main{max-width:520px;margin:48px auto;padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:10px}
h1{margin:0 0 10px;font-size:20px;color:#b91c1c}p{line-height:1.6;margin:0 0 12px}a{color:#b91c1c}
</style>
</head><body><main><h1>${title}</h1><p>${message}</p>
<p><a href="/raktsetu/settings">Open RaktSetu notification settings</a></p></main></body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const url = new URL(req.url, "http://local");
  const token = req.query?.token || url.searchParams.get("token") || "";

  let userId = null;
  try {
    userId = readUnsubscribeToken(token);
  } catch (error) {
    console.error("[raktsetu] unsubscribe misconfigured:", error.message);
  }

  if (!userId || missingEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]).length) {
    res.status(400).setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(page("Link not valid", "This unsubscribe link is not valid. You can turn email alerts off from your RaktSetu settings instead."));
    return;
  }

  const { error } = await supabaseAdmin()
    .from("raktsetu_profiles")
    .update({ notify_email: false })
    .eq("user_id", userId);

  if (error) {
    console.error("[raktsetu] unsubscribe failed:", error.message);
    res.status(500).setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(page("Something went wrong", "We could not update your settings. Please try again, or turn email alerts off from your RaktSetu settings."));
    return;
  }

  if (req.method === "POST") {
    res.status(200).json({ ok: true });
    return;
  }
  res.status(200).setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(page("Email alerts turned off", "You will no longer receive RaktSetu blood-request emails. Push alerts in your browser, if you turned them on, are not affected."));
}
