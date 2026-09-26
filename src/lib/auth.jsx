/* ============================================================================
   DnyanSetu — authentication (Supabase Auth)

   One AuthProvider at the root and one useAuth() hook. Nothing else in the app
   talks to supabase.auth directly, so the auth backend lives in exactly one
   file.

   Sign-in methods: Google (OAuth) and email + password. Accounts migrated from
   Firebase get their Supabase password on first sign-in — see
   api/legacy-login.js.
   ========================================================================== */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { friendlyError, isBackendConfigured, supabase } from "./supabase.js";

/* Bump when the Terms or Privacy Policy change in a way users must re-accept. */
export const TERMS_VERSION = "2026-09-26";

/* Google sign-in leaves the page. What the user chose before leaving — sign up
   or log in, student or faculty, terms ticked, where to go next — is parked
   here and picked up when Google sends them back. */
const OAUTH_INTENT_KEY = "dnyansetu:oauth-intent";

export function readOAuthIntent() {
  try {
    const raw = localStorage.getItem(OAUTH_INTENT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearOAuthIntent() {
  try { localStorage.removeItem(OAUTH_INTENT_KEY); } catch { /* storage blocked */ }
}

/* Only same-site paths are honoured as a post-login destination, so a crafted
   ?next= link cannot bounce someone to another website. */
export function safeNext(value) {
  if (typeof value !== "string") return "";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "";
  return value;
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isBackendConfigured);
  /* True after following a password-reset link, until a new password is set. */
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data?.session ?? null);
      setLoading(false);
    }).catch(() => {
      if (active) setLoading(false);
    });

    /* Safety net: if the browser blocks storage (private modes, embedded
       frames) the session check can stall. Carry on signed-out rather than
       showing "Loading…" forever. */
    const giveUp = setTimeout(() => { if (active) setLoading(false); }, 8000);

    /* Fires on sign-in, sign-out (in this tab or another), and token refresh. */
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setSession(next ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
      clearTimeout(giveUp);
      data?.subscription?.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async ({ intent = "login", role = "student", termsAccepted = false, next = "" } = {}) => {
    if (!supabase) return { success: false, message: "Accounts are not configured yet." };
    try {
      localStorage.setItem(OAUTH_INTENT_KEY, JSON.stringify({
        intent, role, termsAccepted, next: safeNext(next), at: Date.now(),
      }));
    } catch { /* storage blocked — the terms screen will ask again */ }

    const back = new URL(intent === "signup" ? "/signup" : "/login", window.location.origin);
    if (safeNext(next)) back.searchParams.set("next", safeNext(next));

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: back.toString(), queryParams: { prompt: "select_account" } },
    });
    if (error) return { success: false, message: friendlyError(error) };
    return { success: true };
  }, []);

  const signInWithEmail = useCallback(async ({ email, password }) => {
    if (!supabase) return { success: false, message: "Accounts are not configured yet." };
    const normalised = (email || "").trim().toLowerCase();

    const first = await supabase.auth.signInWithPassword({ email: normalised, password });
    if (!first.error) return { success: true, session: first.data.session, message: "Login successful." };
    if (!/invalid login credentials/i.test(first.error.message || "")) {
      return { success: false, message: friendlyError(first.error) };
    }

    /* Maybe an account from before the move to Supabase that has not signed in
       since. The server checks the password against Firebase and, if right,
       sets it on the Supabase account; then we simply try again. */
    try {
      const response = await fetch("/api/legacy-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalised, password }),
      });
      const body = await response.json().catch(() => ({}));
      if (body.migrated) {
        const second = await supabase.auth.signInWithPassword({ email: normalised, password });
        if (!second.error) return { success: true, session: second.data.session, message: "Login successful." };
        return { success: false, message: friendlyError(second.error) };
      }
      if (body.error) return { success: false, message: body.error };
    } catch { /* fall through to the original answer */ }

    return { success: false, message: friendlyError(first.error) };
  }, []);

  const signUpWithEmail = useCallback(async ({ email, password, name, role }) => {
    if (!supabase) return { success: false, message: "Accounts are not configured yet." };
    const normalised = (email || "").trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalised,
      password,
      options: {
        data: { name: (name || "").trim() },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) return { success: false, message: friendlyError(error) };

    /* With "Confirm email" switched off in Supabase (recommended — see
       SUPABASE-SETUP.md) a session comes back straight away. */
    if (!data.session) {
      return {
        success: true,
        needsConfirmation: true,
        message: "Account created. Check your email to confirm it, then log in.",
      };
    }

    const accepted = await acceptTerms(role);
    if (!accepted.success) return accepted;
    return { success: true, session: data.session, message: "Account created." };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const resetPassword = useCallback(async ({ email }) => {
    if (!supabase) return { success: false, message: "Accounts are not configured yet." };
    const { error } = await supabase.auth.resetPasswordForEmail((email || "").trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) return { success: false, message: friendlyError(error) };
    return { success: true, message: "If an account exists for that email, a reset link is on its way." };
  }, []);

  const updatePassword = useCallback(async (password) => {
    if (!supabase) return { success: false, message: "Accounts are not configured yet." };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { success: false, message: friendlyError(error) };
    setRecovery(false);
    return { success: true, message: "Password updated." };
  }, []);

  const value = useMemo(() => ({
    user: session?.user ?? null,
    session,
    loading,
    recovery,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,
    updatePassword,
    acceptTerms,
  }), [session, loading, recovery, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, resetPassword, updatePassword]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* Records acceptance of the current Terms and Privacy Policy on the profile.
   On a brand-new account it also sets student or faculty; the database ignores
   the role for existing accounts and never grants admin. */
export async function acceptTerms(role = "student") {
  if (!supabase) return { success: false, message: "Accounts are not configured yet." };
  const { error } = await supabase.rpc("complete_onboarding", {
    p_role: role === "faculty" ? "faculty" : "student",
    p_terms_version: TERMS_VERSION,
  });
  if (error) return { success: false, message: friendlyError(error) };
  return { success: true };
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth() must be used inside <AuthProvider>.");
  return value;
}

/* Wraps a page that needs a signed-in user. Signed-out visitors are sent to
   /login?next=<this path> and come straight back after signing in. */
export function RequireAuth({ children, fallback = null }) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || user || !isBackendConfigured) return;
    const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [loading, user]);

  if (!isBackendConfigured) return children;
  if (loading || !user) return fallback;
  return children;
}

/* ----------------------------------------------------------------------------
   2-step verification (authenticator app, TOTP) — required for the admin.
   The database refuses admin actions unless the session is "aal2", i.e. the
   6-digit code was checked in this login.
   ------------------------------------------------------------------------- */

/* { current: "aal1" | "aal2", next: "aal1" | "aal2" } — next is aal2 when an
   authenticator is already set up but this login has not been confirmed. */
export async function getAssuranceLevel() {
  if (!supabase) return { current: "aal1", next: "aal1" };
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return { current: "aal1", next: "aal1" };
  return { current: data.currentLevel, next: data.nextLevel };
}

/* The verified authenticator, if any. */
export async function getVerifiedFactor() {
  const { data } = await supabase.auth.mfa.listFactors();
  return data?.totp?.find((f) => f.status === "verified") || null;
}

/* Starts setting up an authenticator: returns the QR code (an SVG data URL)
   and the text secret for manual entry. Unfinished set-ups are cleared first
   so a reload does not pile them up. */
export async function startAuthenticatorSetup() {
  const { data: listed } = await supabase.auth.mfa.listFactors();
  for (const f of listed?.all || []) {
    if (f.factor_type === "totp" && f.status !== "verified") {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  }
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `DnyanSetu admin ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error) throw new Error(friendlyError(error, "Could not start 2-step verification set-up."));
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/* Checks a 6-digit code; on success the session becomes aal2. */
export async function verifyAuthenticatorCode(factorId, code) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: String(code).trim() });
  if (error) {
    throw new Error(/invalid|expired|code/i.test(error.message || "")
      ? "That code is not right or has expired. Enter the current 6-digit code from your authenticator app."
      : friendlyError(error, "Could not verify the code."));
  }
}
