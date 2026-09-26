/* ============================================================================
   DnyanSetu — server-side Supabase helpers (shared by the /api functions)

   Files under api/_lib are not deployed as endpoints — Vercel skips paths that
   start with an underscore — so this is plain shared code.

   The service-role key bypasses Row Level Security entirely. It is read from
   SUPABASE_SERVICE_ROLE_KEY, deliberately without the VITE_ prefix, so Vite
   can never inline it into the browser bundle.
   ========================================================================== */

import { createClient } from "@supabase/supabase-js";

/* Every value here is typed into a dashboard by hand; trim it once so a stray
   newline from a copy-paste cannot break a URL or a signature downstream. */
export function env(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

/* Names the missing variables. The names are not secrets; the values never
   leave the function. */
export function missingEnv(names) {
  return names.filter((name) => !env(name));
}

let adminClient = null;

export function supabaseAdmin() {
  if (adminClient) return adminClient;
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.");
  adminClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return adminClient;
}

export function bearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
}

/* Verifies the caller's Supabase access token with the Auth server itself —
   an expired, forged or signed-out token fails here — and loads their
   DnyanSetu profile. Returns null for anything short of a valid, active,
   unrestricted account. */
export async function authenticate(token) {
  if (!token) return null;
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, name, email, status, restricted, created_at")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile || profile.restricted || profile.status !== "active") return null;
  return { user: data.user, profile };
}

/* Vercel passes a parsed body for JSON requests, but a raw string arrives when
   the content type is missing. Accept both. */
export function readBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  return body && typeof body === "object" ? body : {};
}

export function siteUrl(req) {
  const configured = env("PUBLIC_SITE_URL");
  if (configured) return configured.replace(/\/+$/, "");
  const host = req?.headers?.["x-forwarded-host"] || req?.headers?.host || "www.dnyansetu.online";
  const proto = req?.headers?.["x-forwarded-proto"] || (String(host).startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
