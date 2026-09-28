/* ============================================================================
   POST /api/scholarship-account — change the scholarship admin's email and
   password through a link sent to the main administrator

   { action: "request" }                      emails a one-time link to the
                                              administrator (smuiqac@gmail.com)
   { action: "check", token }                 is the link still valid? returns
                                              the current email
   { action: "complete", token, email, password }
                                              sets the new email + password

   The link is never sent to the scholarship account itself, so only the
   administrator's inbox can change it. A link carries the user id, an expiry
   and a random nonce, signed with HMAC; the nonce is stored on the auth user
   (app_metadata) and cleared once used, so each link works once, for 1 hour,
   and a newer link cancels the older one.
   ========================================================================== */

import crypto from "node:crypto";

import { env, missingEnv, readBody, supabaseAdmin } from "./_lib/supabaseAdmin.js";

const ADMIN_EMAIL = "smuiqac@gmail.com";
const LINK_MINUTES = 60;
const RESEND_GAP_MS = 2 * 60 * 1000;

function secret() {
  const value = env("RAKTSETU_UNSUBSCRIBE_SECRET");
  if (!value) throw new Error("RAKTSETU_UNSUBSCRIBE_SECRET is not set.");
  return value;
}

const sign = (payload) => crypto.createHmac("sha256", secret()).update(`scholarship-reset:${payload}`).digest("base64url");

function makeToken(userId, nonce, exp) {
  const payload = Buffer.from(JSON.stringify({ u: userId, n: nonce, e: exp }), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature || "");
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!/^[0-9a-f-]{36}$/i.test(data.u) || typeof data.n !== "string" || typeof data.e !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

/* The one scholarship admin account (the approved one if there are several). */
async function scholarshipAccount(admin) {
  const { data } = await admin
    .from("profiles")
    .select("id, email, approval_status, status")
    .eq("role", "scholarship")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  const rows = data || [];
  return rows.find((r) => r.approval_status === "approved") || rows[0] || null;
}

/* A valid, unused, unexpired link -> { user, profile }; otherwise null. */
async function verify(admin, token) {
  const data = readToken(token);
  if (!data || data.e < Date.now()) return null;
  const { data: found } = await admin.auth.admin.getUserById(data.u);
  const user = found?.user;
  const saved = user?.app_metadata?.scholarship_reset;
  if (!user || !saved || saved.nonce !== data.n) return null;
  const { data: profile } = await admin.from("profiles").select("id, email, role").eq("id", user.id).maybeSingle();
  if (!profile || profile.role !== "scholarship") return null;
  return { user, profile };
}

const passwordProblem = (pw) => {
  if (typeof pw !== "string" || pw.length < 8) return "The password must be at least 8 characters.";
  if (pw.length > 72) return "The password must be at most 72 characters.";
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return "The password needs at least one letter and one number.";
  return "";
};

async function sendLink(link, currentEmail) {
  const apiKey = env("RESEND_API_KEY");
  const from = env("RESEND_FROM");
  if (!apiKey || !from) throw new Error("Email sending is not configured.");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1B2430">
      <h2 style="color:#1E3A5F;margin:0 0 12px">DnyanSetu — change the scholarship admin login</h2>
      <p>Someone asked to change the email or password of the scholarship admin account
        (currently <b>${currentEmail}</b>).</p>
      <p>If that was you, open this link within ${LINK_MINUTES} minutes. It works once.</p>
      <p style="margin:22px 0"><a href="${link}" style="background:#E65100;color:#fff;padding:11px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Change email or password</a></p>
      <p style="font-size:13px;color:#5A6675">If you did not ask for this, ignore this email — nothing changes.</p>
    </div>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [ADMIN_EMAIL],
      subject: "DnyanSetu: change the scholarship admin email or password",
      html,
      text: `Change the scholarship admin email or password (currently ${currentEmail}). Open within ${LINK_MINUTES} minutes; works once:\n${link}\n\nIf you did not ask for this, ignore this email.`,
    }),
  });
  if (!response.ok) {
    console.error(`[scholarship-account] Resend failed (HTTP ${response.status}): ${await response.text().catch(() => "")}`);
    throw new Error("Could not send the email.");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }
  if (missingEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "RAKTSETU_UNSUBSCRIBE_SECRET"]).length) {
    res.status(503).json({ error: "This is not available right now. Please try again later." });
    return;
  }
  const admin = supabaseAdmin();
  const body = readBody(req);

  try {
    if (body.action === "request") {
      const account = await scholarshipAccount(admin);
      /* Same answer whether or not an account exists or a link was just sent. */
      const reply = { ok: true, sentTo: ADMIN_EMAIL };
      if (!account) { res.status(200).json(reply); return; }
      const { data: found } = await admin.auth.admin.getUserById(account.id);
      const meta = found?.user?.app_metadata || {};
      const last = Number(meta.scholarship_reset?.sentAt || 0);
      if (Date.now() - last < RESEND_GAP_MS) { res.status(200).json(reply); return; }

      const nonce = crypto.randomBytes(16).toString("base64url");
      const exp = Date.now() + LINK_MINUTES * 60 * 1000;
      await admin.auth.admin.updateUserById(account.id, {
        app_metadata: { ...meta, scholarship_reset: { nonce, sentAt: Date.now() } },
      });
      /* A fixed site address: never build the link from request headers. */
      const site = (env("PUBLIC_SITE_URL") || "https://www.dnyansetu.online").replace(/\/+$/, "");
      await sendLink(`${site}/scholarship-reset?token=${encodeURIComponent(makeToken(account.id, nonce, exp))}`, account.email);
      res.status(200).json(reply);
      return;
    }

    if (body.action === "check") {
      const ok = await verify(admin, body.token);
      if (!ok) { res.status(400).json({ error: "This link has expired or was already used. Ask for a new one from the Scholarship admin log-in." }); return; }
      res.status(200).json({ ok: true, email: ok.profile.email });
      return;
    }

    if (body.action === "complete") {
      const ok = await verify(admin, body.token);
      if (!ok) { res.status(400).json({ error: "This link has expired or was already used. Ask for a new one from the Scholarship admin log-in." }); return; }
      const email = String(body.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) { res.status(400).json({ error: "Please enter a valid email address." }); return; }
      if (email === ADMIN_EMAIL) { res.status(400).json({ error: "The main administrator's email cannot be the scholarship admin." }); return; }
      const weak = passwordProblem(body.password);
      if (weak) { res.status(400).json({ error: weak }); return; }
      if (email !== ok.profile.email) {
        const { data: taken } = await admin.from("profiles").select("id").eq("email", email).neq("id", ok.user.id).maybeSingle();
        if (taken) { res.status(400).json({ error: "Another DnyanSetu account already uses that email." }); return; }
      }
      const meta = { ...(ok.user.app_metadata || {}) };
      delete meta.scholarship_reset;
      const { error } = await admin.auth.admin.updateUserById(ok.user.id, {
        email, password: body.password, email_confirm: true, app_metadata: meta,
      });
      if (error) {
        console.error("[scholarship-account] update failed:", error.message);
        res.status(400).json({ error: /already/i.test(error.message) ? "Another account already uses that email." : "Could not save the change. Please try again." });
        return;
      }
      await admin.from("profiles").update({ email }).eq("id", ok.user.id);
      res.status(200).json({ ok: true, email });
      return;
    }

    res.status(400).json({ error: "Unknown action." });
  } catch (error) {
    console.error("[scholarship-account]", error?.message || error);
    res.status(500).json({ error: "Something went wrong. Please try again in a while." });
  }
}
