/* ============================================================================
   DnyanSetu — Supabase client

   Configuration comes from .env.local (see .env.example). When the keys are
   missing the app falls back to offline seed data so the interface still runs;
   every module here checks `isBackendConfigured` before calling out.

   Both values are public by design — the anon key ships in the browser and is
   protected by the Row Level Security policies in supabase/migrations, not by
   secrecy. The service-role key never appears in this file or anywhere under
   src/.
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";

/* Trimmed defensively: these are typed into a hosting dashboard by hand, and
   a trailing space or newline from a copy-paste compiles straight into the
   bundle. */
const trimmed = (value) => (typeof value === "string" ? value.trim() : value);

const url = trimmed(import.meta.env.VITE_SUPABASE_URL);
const anonKey = trimmed(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const isBackendConfigured = Boolean(url && anonKey);

export const supabase = isBackendConfigured
  ? createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      /* Picks up the ?code= Google sends back after sign-in, and the recovery
         link from a password-reset email. */
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  })
  : null;

if (!isBackendConfigured && import.meta.env.DEV) {
  console.info(
    "[DnyanSetu] Supabase is not configured — running on local seed data. " +
      "Copy .env.example to .env.local and add your project keys to enable accounts.",
  );
}

/* The current session's access token, for calls to our own /api functions. */
export async function getAccessToken() {
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || "";
}

/* Turns a Supabase / PostgREST error into something worth showing a student. */
export function friendlyError(error, fallback = "Something went wrong. Please try again.") {
  if (!error) return fallback;
  const code = String(error.code || "");
  const message = error.message || String(error);

  if (/invalid login credentials/i.test(message)) {
    /* Supabase answers the same way for a wrong password and for an address
       that has no account, so nobody can probe for registered emails. The
       message has to cover both. */
    return "Incorrect email or password — or there is no account for this email yet. If you have not registered, use Sign up first.";
  }
  if (/user already registered|already been registered/i.test(message)) {
    return "An account with this email already exists. Please log in instead.";
  }
  if (/password should be at least|password should contain|weak password/i.test(message)) {
    return "Password must be at least 8 characters and include a letter and a number.";
  }
  if (/unable to validate email|invalid email/i.test(message)) return "That does not look like a valid email address.";
  if (/rate limit|too many/i.test(message)) return "Too many attempts. Please wait a moment and try again.";
  if (/failed to fetch|network/i.test(message)) return "Cannot reach the server. Check your connection and try again.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email address first — check your inbox.";
  if (code === "42501" || /permission denied|row-level security/i.test(message)) {
    /* A policy refusal raised by our own functions carries a readable message. */
    return /cannot|only|administrators|not signed/i.test(message) ? message : "You do not have permission to do that.";
  }
  if (code === "P0001") return message;
  return message || fallback;
}
