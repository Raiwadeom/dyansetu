/* ============================================================================
   POST /api/raktsetu/requests — post a blood request and send the alerts

   In order:
     1. Verify the caller's Supabase session token with the Auth server.
     2. Require a RaktSetu profile (which the database only allows for 18+).
     3. Validate every field.
     4. Enforce the rate limit: 3 requests per user per 24 hours (the database
        trigger enforces it again, so a race cannot slip past).
     5. Save the request and its contact phone (phone in its own table).
     6. Fan out: web push to the city, email to exact-group donors (capped).

   The browser has no insert access to blood_requests, so this endpoint is the
   only way a request — and therefore an alert to other users — can be created.
   ========================================================================== */

import {
  authenticate, bearerToken, missingEnv, readBody, siteUrl, supabaseAdmin,
} from "../_lib/supabaseAdmin.js";
import { sendEmailAlerts, sendPushAlerts } from "../_lib/raktsetuAlerts.js";

const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/* Mirrors raktsetu_has_payment_words() in the database, which is what
   actually refuses them; checked here too for a clear message. */
const PAYMENT_WORDS = /(\bupi\b|\bg ?pay\b|google ?pay|\bphone ?pe\b|paytm|₹|\brupees?\b|\brs\.? ?\d|\binr\b|\bifsc\b|\baccount ?(no|number|num)\b|bank ?details|\bpayments?\b|send ?money|transfer ?money|processing ?fee|service ?charge|donation ?fee|\bprice\b|cost of blood)/i;
const MAX_PER_DAY = 3;

function text(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validate(body) {
  const request = {
    patient_name: text(body.patientName, 80),
    blood_group: text(body.bloodGroup, 3),
    units: Number.parseInt(body.units, 10),
    hospital: text(body.hospital, 120),
    address: text(body.address, 300),
    city: text(body.city, 60),
    needed_by: body.neededBy ? new Date(body.neededBy) : null,
    note: text(body.note, 500),
  };
  const phone = text(body.contactPhone, 20).replace(/[^\d+\s-]/g, "");

  if (request.patient_name.length < 2) return { error: "Enter the patient or requester name." };
  if (!GROUPS.includes(request.blood_group)) return { error: "Choose the blood group needed." };
  if (!Number.isInteger(request.units) || request.units < 1 || request.units > 10) {
    return { error: "Units needed must be between 1 and 10." };
  }
  if (request.hospital.length < 2) return { error: "Enter the hospital or blood bank name." };
  if (request.address.length < 5) return { error: "Enter the full address." };
  if (request.city.length < 2) return { error: "Enter the city." };
  if (phone.replace(/\D/g, "").length < 10) return { error: "Enter a contact phone number with at least 10 digits." };
  if (!request.needed_by || Number.isNaN(request.needed_by.getTime())) return { error: "Enter when the blood is needed by." };
  if (request.needed_by.getTime() <= Date.now()) return { error: "The needed-by time must be in the future." };
  if (request.needed_by.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
    return { error: "The needed-by time must be within the next 30 days." };
  }
  if (body.genuine !== true) return { error: "Please confirm this request is genuine." };
  if (PAYMENT_WORDS.test(`${request.patient_name} ${request.hospital} ${request.address} ${request.note}`)) {
    return { error: "Requests cannot mention money, payment or bank details. Blood is never paid for through RaktSetu." };
  }

  request.needed_by = request.needed_by.toISOString();
  return { request, phone };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
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

  const admin = supabaseAdmin();
  const { data: rsProfile } = await admin
    .from("raktsetu_profiles")
    .select("user_id")
    .eq("user_id", caller.user.id)
    .maybeSingle();
  if (!rsProfile) {
    res.status(403).json({ error: "Complete your RaktSetu profile before posting a request." });
    return;
  }

  const { request, phone, error: invalid } = validate(readBody(req));
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("blood_requests")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", caller.user.id)
    .gt("created_at", since);
  if ((count || 0) >= MAX_PER_DAY) {
    res.status(429).json({ error: `You can post at most ${MAX_PER_DAY} blood requests in 24 hours.` });
    return;
  }

  const { data: saved, error: saveError } = await admin
    .from("blood_requests")
    .insert({
      ...request,
      requester_id: caller.user.id,
      /* Shown as a "New member" badge so donors can judge for themselves. Uses
         the DnyanSetu join date, so accounts moved over from Firebase keep
         their original age. */
      new_member: Date.now() - new Date(caller.profile.created_at || caller.user.created_at).getTime() < 24 * 60 * 60 * 1000,
    })
    .select("*")
    .single();
  if (saveError) {
    const limited = /at most 3/i.test(saveError.message || "");
    const payment = /money, payment/i.test(saveError.message || "");
    if (!limited && !payment) console.error("[raktsetu] save failed:", saveError.message);
    res.status(limited ? 429 : payment ? 400 : 500).json({
      error: limited || payment ? saveError.message : "Could not save the request.",
    });
    return;
  }

  const { error: contactError } = await admin
    .from("blood_request_contacts")
    .insert({ request_id: saved.id, contact_phone: phone });
  if (contactError) {
    console.error("[raktsetu] contact save failed:", contactError.message);
    await admin.from("blood_requests").delete().eq("id", saved.id);
    res.status(500).json({ error: "Could not save the request." });
    return;
  }

  /* The request is saved either way; an alert failure is reported, not fatal. */
  const site = siteUrl(req);
  const [push, email] = await Promise.all([
    sendPushAlerts(saved).catch((e) => ({ sent: 0, error: e.message })),
    sendEmailAlerts(saved, site).catch((e) => ({ sent: 0, error: e.message })),
  ]);
  console.info(`[raktsetu] request ${saved.id}: push ${JSON.stringify(push)} email ${JSON.stringify(email)}`);

  res.status(201).json({
    id: saved.id,
    push: { sent: push.sent || 0 },
    email: { sent: email.sent || 0, limitHit: Boolean(email.limitHit) },
  });
}
