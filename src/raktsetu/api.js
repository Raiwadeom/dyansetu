/* ============================================================================
   RaktSetu — data access

   Reads go straight to Supabase and are limited by Row Level Security. Every
   action with a rule attached ("I can help", closing a request, moderation,
   deleting your data) is a database function, so the rule lives in one place.
   Posting a request goes through /api/raktsetu/requests, because that is also
   what sends the alerts.
   ========================================================================== */

import { friendlyError, getAccessToken, isBackendConfigured, supabase } from "../lib/supabase.js";

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not", label: "Prefer not to say" },
];

/* Must match the database (raktsetu_donation_gap_days, raktsetu_is_eligible_donor). */
export const DONATION_GAP_DAYS = 120;
export const MIN_AGE = 18;
export const MAX_DONOR_AGE = 65;
export const MIN_WEIGHT_KG = 45;

/* Shown in the profile form as the health self-declaration. */
export const HEALTH_CONDITIONS = [
  "I am in good health today — no fever, cold, cough or other infection",
  "I am not taking antibiotics or other medicine for an illness right now",
  "I have not had a tattoo, piercing or acupuncture in the last 12 months",
  "I have not had major surgery or a blood transfusion in the last 12 months",
  "I do not have HIV, hepatitis B or C, syphilis or malaria (now or in the past, as applicable)",
  "I do not have heart disease, epilepsy, cancer, a bleeding disorder, or diabetes treated with insulin",
  "I am not pregnant or breastfeeding, and have not delivered or miscarried in the last 6 months (if applicable)",
];

export const DISCLAIMER =
  "RaktSetu is a community network that connects people looking for blood donors with volunteers registered " +
  "on DnyanSetu. It does not give medical advice, diagnosis or treatment, and it is not a blood bank. Any " +
  "donation happens at a licensed blood bank or hospital, which decides final eligibility.";

export const PAYMENT_WARNING = "Never pay anyone. Buying or selling blood is illegal in India.";

export const displayGroup = (g) => (g === "unknown" ? "Don't know" : (g || "").replace("-", "−"));

function check(result, fallback) {
  if (result.error) throw new Error(friendlyError(result.error, fallback));
  return result.data;
}

/* ------------------------------------------------------------ eligibility */

export function nextEligibleDate(profile) {
  if (!profile?.last_donation_date) return null;
  const d = new Date(`${profile.last_donation_date}T00:00:00`);
  d.setDate(d.getDate() + DONATION_GAP_DAYS);
  return d;
}

/* Reasons this profile cannot donate right now; empty when eligible. Mirrors
   raktsetu_is_eligible_donor() in the database, which is what actually decides. */
export function donorBlockers(profile) {
  if (!profile) return ["Complete your RaktSetu profile."];
  const out = [];
  if (profile.age < MIN_AGE || profile.age > MAX_DONOR_AGE) out.push(`Donors must be ${MIN_AGE}–${MAX_DONOR_AGE} years old.`);
  if (Number(profile.weight_kg) < MIN_WEIGHT_KG) out.push(`Donors must weigh at least ${MIN_WEIGHT_KG} kg.`);
  if (!profile.health_declared) out.push("The health declaration on your profile is not confirmed.");
  const next = nextEligibleDate(profile);
  if (next && next > new Date()) {
    out.push(`You donated recently. You can donate again from ${next.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`);
  }
  return out;
}

/* ---------------------------------------------------------------- profile */

export async function fetchMyRaktProfile(userId) {
  if (!isBackendConfigured || !userId) return null;
  return check(
    await supabase.from("raktsetu_profiles").select("*").eq("user_id", userId).maybeSingle(),
    "Could not load your RaktSetu profile.",
  );
}

export async function saveMyRaktProfile(userId, form) {
  const row = {
    user_id: userId,
    display_name: form.display_name.trim(),
    age: Number(form.age),
    gender: form.gender,
    weight_kg: Number(form.weight_kg),
    blood_group: form.blood_group,
    city: form.city.trim(),
    phone: form.phone.trim(),
    health_declared: Boolean(form.health_declared),
    last_donation_date: form.last_donation_date || null,
    notify_push: Boolean(form.notify_push),
    notify_email: Boolean(form.notify_email),
    consent_at: new Date().toISOString(),
  };
  return check(
    await supabase.from("raktsetu_profiles").upsert(row).select("*").single(),
    "Could not save your profile.",
  );
}

export async function updateMyRaktSettings(userId, patch) {
  return check(
    await supabase.from("raktsetu_profiles").update(patch).eq("user_id", userId).select("*").single(),
    "Could not save your settings.",
  );
}

export async function deleteMyRaktData() {
  check(await supabase.rpc("raktsetu_delete_my_data"), "Could not delete your RaktSetu data.");
}

/* --------------------------------------------------------------- requests */

const REQUEST_COLUMNS =
  "id, requester_id, patient_name, blood_group, units, hospital, address, city, needed_by, note, status, removed_reason, created_at";

export async function listOpenRequests({ bloodGroup = "", city = "" } = {}) {
  let query = supabase
    .from("blood_requests")
    .select(REQUEST_COLUMNS)
    .eq("status", "open")
    .gt("needed_by", new Date().toISOString())
    .order("needed_by", { ascending: true })
    .limit(200);
  if (bloodGroup) query = query.eq("blood_group", bloodGroup);
  if (city.trim()) query = query.ilike("city", `%${city.trim().replace(/[%_]/g, "")}%`);
  return check(await query, "Could not load requests.") || [];
}

export async function fetchRequest(id) {
  return check(
    await supabase.from("blood_requests").select(REQUEST_COLUMNS).eq("id", id).maybeSingle(),
    "Could not load this request.",
  );
}

/* Only succeeds for the requester, or a donor who already responded. */
export async function fetchContact(id) {
  const data = check(
    await supabase.from("blood_request_contacts").select("contact_phone").eq("request_id", id).maybeSingle(),
    "Could not load the contact.",
  );
  return data?.contact_phone || "";
}

export async function createRequest(form) {
  const token = await getAccessToken();
  const response = await fetch("/api/raktsetu/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(form),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Could not post the request.");
  return body;
}

export async function respondToRequest(id) {
  const rows = check(await supabase.rpc("raktsetu_respond", { p_request_id: id }), "Could not record your response.");
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function listResponders(id) {
  return check(await supabase.rpc("raktsetu_list_responders", { p_request_id: id }), "Could not load responses.") || [];
}

export async function setRequestStatus(id, status) {
  check(await supabase.rpc("raktsetu_set_request_status", { p_request_id: id, p_status: status }), "Could not update the request.");
}

export async function markDonated(id, date) {
  check(await supabase.rpc("raktsetu_mark_donated", { p_request_id: id, p_date: date }), "Could not record your donation.");
}

export async function reportRequest(id, userId, reason) {
  const result = await supabase.from("blood_request_reports").insert({ request_id: id, reporter_id: userId, reason: reason.trim() });
  if (result.error?.code === "23505") throw new Error("You have already reported this request.");
  check(result, "Could not send the report.");
}

/* ------------------------------------------------------------ my activity */

export async function listMyRequests(userId) {
  return check(
    await supabase.from("blood_requests").select(REQUEST_COLUMNS).eq("requester_id", userId).order("created_at", { ascending: false }),
    "Could not load your requests.",
  ) || [];
}

export async function listMyResponses(userId) {
  const responses = check(
    await supabase.from("request_responses").select("request_id, created_at, donated_at").eq("responder_id", userId).order("created_at", { ascending: false }),
    "Could not load your responses.",
  ) || [];
  if (!responses.length) return [];
  const requests = check(
    await supabase.from("blood_requests").select(REQUEST_COLUMNS).in("id", responses.map((r) => r.request_id)),
    "Could not load your responses.",
  ) || [];
  const byId = new Map(requests.map((r) => [r.id, r]));
  return responses.map((r) => ({ ...r, request: byId.get(r.request_id) })).filter((r) => r.request);
}

/* ------------------------------------------------------------- moderation */

export async function listReports() {
  const reports = check(
    await supabase.from("blood_request_reports").select("id, request_id, reason, created_at, resolved_at").is("resolved_at", null).order("created_at", { ascending: false }),
    "Could not load reports.",
  ) || [];
  const ids = [...new Set(reports.map((r) => r.request_id))];
  const requests = ids.length
    ? check(await supabase.from("blood_requests").select(REQUEST_COLUMNS).in("id", ids), "Could not load reports.") || []
    : [];
  const byId = new Map(requests.map((r) => [r.id, r]));
  const grouped = new Map();
  reports.forEach((r) => {
    if (!grouped.has(r.request_id)) grouped.set(r.request_id, { request: byId.get(r.request_id), reasons: [] });
    grouped.get(r.request_id).reasons.push(r);
  });
  return [...grouped.values()].filter((g) => g.request);
}

export async function listAllOpenForAdmin() {
  return check(
    await supabase.from("blood_requests").select(REQUEST_COLUMNS).eq("status", "open").order("created_at", { ascending: false }).limit(200),
    "Could not load requests.",
  ) || [];
}

export async function adminRemove(id, reason) {
  check(await supabase.rpc("raktsetu_admin_remove", { p_request_id: id, p_reason: reason }), "Could not remove the request.");
}

export async function adminDismiss(id) {
  check(await supabase.rpc("raktsetu_admin_dismiss_reports", { p_request_id: id }), "Could not dismiss the reports.");
}

/* The DnyanSetu profile row: name for display, role for the admin page. */
export async function fetchBaseProfile(userId) {
  if (!isBackendConfigured || !userId) return null;
  return check(
    await supabase.from("profiles").select("id, name, email, role, restricted, status, terms_accepted_at, pfp").eq("id", userId).maybeSingle(),
    "Could not load your account.",
  );
}
