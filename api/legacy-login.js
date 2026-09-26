/* ============================================================================
   POST /api/legacy-login — first sign-in for an account migrated from Firebase

   scripts/migrate-firebase-to-supabase.mjs copies every Firebase user into
   Supabase with the same email and profile, but without a password: Firebase's
   password hashes use a modified scrypt that Supabase cannot check. Instead,
   the first time such a user signs in:

     1. The browser tries Supabase first. That fails (no password yet), so it
        calls this endpoint with the email and password the user typed.
     2. We look for a migrated profile with that email that is still marked
        legacy_password_pending.
     3. We ask Firebase Auth's own REST API whether the password is right.
        Firebase is left running and untouched for exactly this.
     4. If it is, we set that password on the Supabase account. The database
        trigger clears legacy_password_pending, so from now on only the
        Supabase password works and this endpoint refuses the account.
     5. The browser signs in to Supabase normally with the same password.

   Nobody gets locked out, nobody is emailed, and no password hash is moved.
   ========================================================================== */

import { env, missingEnv, readBody, supabaseAdmin } from "./_lib/supabaseAdmin.js";

const FIREBASE_SIGN_IN =
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const missing = missingEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FIREBASE_API_KEY"]);
  if (missing.length) {
    /* No legacy accounts to rescue in this environment — report a plain miss. */
    res.status(401).json({ migrated: false });
    return;
  }

  const body = readBody(req);
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) {
    res.status(400).json({ migrated: false });
    return;
  }

  const admin = supabaseAdmin();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, legacy_firebase_uid, legacy_password_pending, restricted, status")
    .eq("email", email)
    .eq("legacy_password_pending", true)
    .maybeSingle();

  if (!profile?.legacy_firebase_uid) {
    res.status(401).json({ migrated: false });
    return;
  }

  const check = await fetch(`${FIREBASE_SIGN_IN}?key=${encodeURIComponent(env("FIREBASE_API_KEY"))}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: false }),
  });
  const result = await check.json().catch(() => ({}));

  if (!check.ok || result.localId !== profile.legacy_firebase_uid) {
    /* Wrong password, or Firebase is rate-limiting — same answer either way. */
    res.status(401).json({ migrated: false });
    return;
  }

  const { error } = await admin.auth.admin.updateUserById(profile.id, { password });
  if (error) {
    console.error("[legacy-login] could not set password:", error.message);
    res.status(500).json({ migrated: false, error: "Could not finish moving your account. Please try again." });
    return;
  }

  res.status(200).json({ migrated: true });
}
