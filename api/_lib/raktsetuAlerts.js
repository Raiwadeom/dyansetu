/* ============================================================================
   RaktSetu — alert fan-out (web push + email)

   Push is free and unlimited, so it is the main channel: everyone opted in
   within the request's city, plus anyone who asked for all cities.

   Email is the bonus channel. Resend's free tier is 100 emails a day and 3,000
   a month, so it goes only to eligible donors with an exact blood-group match,
   same city first, and stops cleanly before the cap. Every send is counted in
   raktsetu_email_log.

   Neither channel ever carries a phone number.
   ========================================================================== */

import webpush from "web-push";

import { env, supabaseAdmin } from "./supabaseAdmin.js";
import { makeUnsubscribeToken } from "./unsubscribeToken.js";

export const DISCLAIMER =
  "RaktSetu is a community network that connects people looking for blood donors with volunteers " +
  "registered on DnyanSetu. It does not give medical advice, diagnosis or treatment, and it is not a " +
  "blood bank. Any donation happens at a licensed blood bank or hospital, which decides final eligibility.";

export const PAYMENT_WARNING = "Never pay anyone. Buying or selling blood is illegal in India.";

/* Sent in parallel, a chunk at a time, so hundreds of subscriptions finish well
   inside the function's time limit instead of one after another. */
const PUSH_CHUNK = 100;
const EMAIL_BATCH = 100; /* Resend's batch endpoint accepts up to 100 per call. */

function formatNeededBy(iso) {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* ---------------------------------------------------------------- push ---- */

export async function sendPushAlerts(request) {
  const publicKey = env("VAPID_PUBLIC_KEY");
  const privateKey = env("VAPID_PRIVATE_KEY");
  const subject = env("VAPID_SUBJECT", "mailto:smuiqac@gmail.com");
  if (!publicKey || !privateKey) {
    return { sent: 0, failed: 0, removed: 0, skipped: "VAPID keys are not configured." };
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const admin = supabaseAdmin();
  const { data: targets, error } = await admin.rpc("raktsetu_push_targets", { p_request_id: request.id });
  if (error) throw new Error(`Could not load push targets: ${error.message}`);

  const payload = JSON.stringify({
    title: `Blood needed: ${request.blood_group} — ${request.units} unit${request.units === 1 ? "" : "s"}`,
    body: `${request.hospital}, ${request.city}`,
    url: `/raktsetu/requests/${request.id}`,
    tag: `raktsetu-${request.id}`,
  });

  let sent = 0;
  let failed = 0;
  const gone = [];
  const delivered = [];

  for (let i = 0; i < (targets || []).length; i += PUSH_CHUNK) {
    const chunk = targets.slice(i, i + PUSH_CHUNK);
    const results = await Promise.allSettled(chunk.map((t) => webpush.sendNotification(
      { endpoint: t.endpoint, keys: t.keys },
      payload,
      { TTL: 12 * 60 * 60, urgency: "high", timeout: 8000 },
    )));
    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        sent += 1;
        delivered.push(chunk[index].id);
        return;
      }
      failed += 1;
      const status = result.reason?.statusCode;
      /* 404/410: the browser dropped this subscription (data cleared, app
         uninstalled). It will never work again, so forget it. */
      if (status === 404 || status === 410) gone.push(chunk[index].id);
      else console.error("[raktsetu] push failed:", status, result.reason?.body || result.reason?.message);
    });
  }

  if (gone.length) await admin.from("push_subscriptions").delete().in("id", gone);
  if (delivered.length) {
    await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).in("id", delivered);
  }

  return { sent, failed, removed: gone.length, targets: (targets || []).length };
}

/* --------------------------------------------------------------- email ---- */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function emailHtml(request, { name, openUrl, unsubscribeUrl }) {
  const rows = [
    ["Blood group", request.blood_group],
    ["Units needed", String(request.units)],
    ["Hospital / blood bank", request.hospital],
    ["Address", request.address],
    ["City", request.city],
    ["Needed by", formatNeededBy(request.needed_by)],
  ].map(([label, value]) => (
    `<tr><td style="padding:6px 12px 6px 0;color:#6b7280;font-size:14px;vertical-align:top">${escapeHtml(label)}</td>` +
    `<td style="padding:6px 0;font-size:14px;color:#111827;font-weight:600">${escapeHtml(value)}</td></tr>`
  )).join("");

  return `<!doctype html><html><body style="margin:0;background:#f6f6f6;font-family:Segoe UI,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f6;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px">
<tr><td style="background:#b91c1c;color:#ffffff;padding:16px 22px;border-radius:10px 10px 0 0;font-size:18px;font-weight:700">RaktSetu · Blood needed: ${escapeHtml(request.blood_group)}</td></tr>
<tr><td style="padding:20px 22px">
<p style="margin:0 0 14px;font-size:15px;color:#111827">Hello${name ? ` ${escapeHtml(name)}` : ""},</p>
<p style="margin:0 0 14px;font-size:15px;color:#111827">Someone near you has asked for ${escapeHtml(request.blood_group)} blood. Your profile matches this group.</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px">${rows}</table>
<p style="margin:0 0 20px"><a href="${escapeHtml(openUrl)}" style="display:inline-block;background:#b91c1c;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;font-size:15px">Open the request</a></p>
<p style="margin:0 0 14px;padding:10px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:13px;color:#991b1b"><strong>${escapeHtml(PAYMENT_WARNING)}</strong></p>
<p style="margin:0 0 10px;font-size:12px;color:#6b7280;line-height:1.5">${escapeHtml(DISCLAIMER)}</p>
<p style="margin:0;font-size:12px;color:#6b7280">You are receiving this because you turned on RaktSetu email alerts on DnyanSetu. <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280">Turn off email alerts</a>.</p>
</td></tr></table></td></tr></table></body></html>`;
}

function emailText(request, { openUrl, unsubscribeUrl }) {
  return [
    `Blood needed: ${request.blood_group} — ${request.units} unit(s)`,
    `Hospital / blood bank: ${request.hospital}`,
    `Address: ${request.address}`,
    `City: ${request.city}`,
    `Needed by: ${formatNeededBy(request.needed_by)}`,
    "",
    `Open the request: ${openUrl}`,
    "",
    PAYMENT_WARNING,
    "",
    DISCLAIMER,
    "",
    `Turn off email alerts: ${unsubscribeUrl}`,
  ].join("\n");
}

export async function sendEmailAlerts(request, site) {
  const apiKey = env("RESEND_API_KEY");
  const from = env("RESEND_FROM");
  if (!apiKey || !from) return { sent: 0, skipped: "Resend is not configured.", limitHit: false };

  const dailyLimit = Number(env("RESEND_DAILY_LIMIT", "90")) || 90;
  const monthlyLimit = Number(env("RESEND_MONTHLY_LIMIT", "2900")) || 2900;

  const admin = supabaseAdmin();
  const [{ data: targets, error: targetError }, { data: usageRows, error: usageError }] = await Promise.all([
    admin.rpc("raktsetu_email_targets", { p_request_id: request.id }),
    admin.rpc("raktsetu_email_usage"),
  ]);
  if (targetError) throw new Error(`Could not load email targets: ${targetError.message}`);
  if (usageError) throw new Error(`Could not read email usage: ${usageError.message}`);

  const usage = Array.isArray(usageRows) ? usageRows[0] : usageRows;
  const remaining = Math.max(0, Math.min(dailyLimit - (usage?.today || 0), monthlyLimit - (usage?.month || 0)));
  const all = targets || [];
  const chosen = all.slice(0, remaining);
  const limitHit = chosen.length < all.length;

  if (limitHit) {
    console.warn(
      `[raktsetu] email cap reached: ${all.length} matching donors, ${chosen.length} emailed ` +
      `(today ${usage?.today || 0}/${dailyLimit}, month ${usage?.month || 0}/${monthlyLimit}). ` +
      "Push alerts are unaffected.",
    );
  }

  const openUrl = `${site}/raktsetu/requests/${request.id}`;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < chosen.length; i += EMAIL_BATCH) {
    const batch = chosen.slice(i, i + EMAIL_BATCH).map((t) => {
      const unsubscribeUrl = `${site}/api/raktsetu/unsubscribe?token=${encodeURIComponent(makeUnsubscribeToken(t.user_id))}`;
      return {
        from,
        to: [t.email],
        subject: `Blood needed: ${request.blood_group} — ${request.units} unit(s) at ${request.hospital}, ${request.city}`,
        html: emailHtml(request, { name: t.name, openUrl, unsubscribeUrl }),
        text: emailText(request, { openUrl, unsubscribeUrl }),
        /* One-click unsubscribe (RFC 8058) — Gmail and Yahoo expect it, and it
           keeps alerts out of spam. */
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });

    if (response.ok) {
      sent += batch.length;
    } else {
      failed += batch.length;
      const detail = await response.text().catch(() => "");
      console.error(`[raktsetu] Resend batch failed (HTTP ${response.status}): ${detail}`);
      /* 429 means Resend's own limit was hit — stop rather than burn retries. */
      if (response.status === 429) break;
    }
  }

  if (sent) await admin.rpc("raktsetu_log_emails", { p_count: sent });

  return { sent, failed, matching: all.length, limitHit };
}
