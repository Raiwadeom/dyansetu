/* ============================================================================
   POST /api/delete-account — a signed-in user deletes their own account

   The token is verified with the Auth server, so a user can only ever delete
   themselves. Deleting the auth user cascades to their profile, quiz attempts,
   RaktSetu profile, responses, reports and push subscriptions; notes they
   uploaded stay for students with the uploader cleared (on delete set null).
   The two fixed admin accounts cannot be deleted this way.
   ========================================================================== */

import { authenticate, bearerToken, missingEnv, supabaseAdmin } from "./_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }
  if (missingEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]).length) {
    res.status(503).json({ error: "This is not available right now. Please try again later." });
    return;
  }

  let caller = null;
  try {
    caller = await authenticate(bearerToken(req));
  } catch (error) {
    console.error("[delete-account] authenticate failed:", error?.message || error);
  }
  if (!caller) {
    res.status(401).json({ error: "Your session is not valid. Please sign in again." });
    return;
  }
  if (["admin", "scholarship"].includes(caller.profile.role)) {
    res.status(403).json({ error: "Administrator accounts cannot be deleted from here." });
    return;
  }

  const { error } = await supabaseAdmin().auth.admin.deleteUser(caller.user.id);
  if (error) {
    console.error("[delete-account] delete failed:", error.message);
    res.status(500).json({ error: "Could not delete the account. Please try again." });
    return;
  }
  res.status(200).json({ deleted: true });
}
