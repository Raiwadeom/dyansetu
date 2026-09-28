/* ============================================================================
   DnyanSetu — sign-in list for the administrator

   When each account last signed in lives in Supabase Auth (auth.users), which
   the browser cannot read. This endpoint reads it with the service role and
   returns it only to the administrator: the caller's token is verified with
   the Auth server, and their profile must be the admin account.

   Returns { accounts: [{ id, email, lastSignInAt, createdAt, provider }] }.
   ========================================================================== */

import { authenticate, bearerToken, missingEnv, readBody, supabaseAdmin } from "./_lib/supabaseAdmin.js";

const ADMIN_EMAIL = "smuiqac@gmail.com";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const missing = missingEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (missing.length) {
    res.status(503).json({ error: `Not configured: ${missing.join(", ")} missing.` });
    return;
  }

  const body = readBody(req) || {};
  const token = bearerToken(req) || (typeof body.accessToken === "string" ? body.accessToken : "");

  let caller = null;
  try {
    caller = await authenticate(token);
  } catch (error) {
    console.error("[admin-sign-ins] authenticate failed:", error?.message || error);
  }
  if (!caller) {
    res.status(401).json({ error: "Your session is not valid. Please sign in again." });
    return;
  }
  const email = (caller.profile.email || "").toLowerCase();
  if (caller.profile.role !== "admin" || email !== ADMIN_EMAIL) {
    res.status(403).json({ error: "Only the administrator can see the sign-in list." });
    return;
  }

  try {
    const admin = supabaseAdmin();
    const accounts = [];
    /* listUsers pages at most 1000 at a time. */
    for (let page = 1; page <= 20; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const users = data?.users || [];
      users.forEach((u) => accounts.push({
        id: u.id,
        email: u.email || "",
        lastSignInAt: u.last_sign_in_at || null,
        createdAt: u.created_at || null,
        provider: u.app_metadata?.provider || "email",
      }));
      if (users.length < 1000) break;
    }
    res.status(200).json({ accounts });
  } catch (error) {
    console.error("[admin-sign-ins]", error?.message || error);
    res.status(500).json({ error: "Could not read the sign-in list." });
  }
}
