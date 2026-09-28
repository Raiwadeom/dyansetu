/* Scholarships and home-page announcements: read by everyone, edited by the
   administrator on the "Scholarships & Notices" page. The built-in copy in
   src/data/resources.js is shown whenever the database cannot be reached. */

import { supabase, isBackendConfigured } from "./supabase.js";
import { builtInScholarshipRows } from "../data/resources.js";

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function check({ data, error }, message) {
  if (error) throw new Error(`${message} (${error.message})`);
  return data;
}

/* DB row -> the shape the Scholarships page renders. */
export function toScheme(row) {
  return {
    id: row.id,
    name: row.name, nameMr: row.name_mr,
    provider: row.provider, providerMr: row.provider_mr,
    categories: row.categories || [],
    amount: row.amount, amountMr: row.amount_mr,
    window: row.time_window, windowMr: row.time_window_mr,
    eligibility: row.eligibility, eligibilityMr: row.eligibility_mr,
    documents: Array.isArray(row.documents) ? row.documents : [],
    note: row.note, noteMr: row.note_mr,
    portal: row.portal,
    opensOn: row.opens_on || "", closesOn: row.closes_on || "",
    active: row.active !== false,
  };
}

export const builtInSchemes = () => builtInScholarshipRows().map(toScheme);

/* Public list (active schemes only). Falls back to the built-in copy. */
export async function fetchSchemes() {
  if (!isBackendConfigured) return builtInSchemes();
  try {
    const rows = check(await supabase.from("scholarships").select("*").eq("active", true).order("sort").order("name"), "Could not load scholarships.");
    return (rows || []).map(toScheme);
  } catch {
    return builtInSchemes();
  }
}

/* Admin list: every scheme, hidden ones included. */
export async function fetchAllSchemeRows() {
  return check(await supabase.from("scholarships").select("*").order("sort").order("name"), "Could not load scholarships.") || [];
}

export async function saveSchemeRow(row) {
  return check(await supabase.from("scholarships").upsert(row).select("*").single(), "Could not save the scholarship.");
}

export async function deleteSchemeRow(id) {
  check(await supabase.from("scholarships").delete().eq("id", id), "Could not delete the scholarship.");
}

/* Copies the built-in schemes into an empty table (first-time setup). */
export async function importBuiltInSchemes() {
  check(await supabase.from("scholarships").upsert(builtInScholarshipRows(), { onConflict: "id", ignoreDuplicates: true }), "Could not import the scholarships.");
}

/* ------------------------------------------------------------ announcements */

/* Home page: current announcements, newest first. null = could not load
   (the page then shows its built-in notices). */
export async function fetchLiveAnnouncements() {
  if (!isBackendConfigured) return null;
  try {
    const rows = check(
      await supabase.from("announcements").select("*")
        .or(`expires_on.is.null,expires_on.gte.${todayIso()}`)
        .order("notice_date", { ascending: false }).order("created_at", { ascending: false }).limit(20),
      "Could not load announcements.",
    );
    return rows || [];
  } catch {
    return null;
  }
}

export async function fetchAllAnnouncements() {
  return check(
    await supabase.from("announcements").select("*").order("notice_date", { ascending: false }).order("created_at", { ascending: false }),
    "Could not load announcements.",
  ) || [];
}

export async function addAnnouncement(row) {
  return check(await supabase.from("announcements").insert(row).select("*").single(), "Could not add the announcement.");
}

export async function deleteAnnouncement(id) {
  check(await supabase.from("announcements").delete().eq("id", id), "Could not delete the announcement.");
}

const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/* The home-page notice made from a scheme's application dates: created or
   updated when the dates are saved, removed when they are cleared. */
export async function syncSchemeAnnouncement(scheme) {
  const { id, name, opens_on: opens, closes_on: closes } = scheme;
  if (!opens && !closes) {
    check(await supabase.from("announcements").delete().eq("scholarship_id", id), "Could not remove the scholarship notice.");
    return;
  }
  const when = opens && closes ? `from ${fmt(opens)} to ${fmt(closes)}` : closes ? `until ${fmt(closes)}` : `from ${fmt(opens)}`;
  const whenMr = opens && closes ? `${fmt(opens)} ते ${fmt(closes)}` : closes ? `${fmt(closes)} पर्यंत` : `${fmt(opens)} पासून`;
  const row = {
    scholarship_id: id,
    title: `Scholarship: ${name} — apply ${when}.`,
    title_mr: `शिष्यवृत्ती: ${scheme.name_mr || name} — अर्ज ${whenMr}.`,
    notice_date: todayIso(),
    href: "/scholarships",
    expires_on: closes || null,
  };
  const existing = check(await supabase.from("announcements").select("id").eq("scholarship_id", id).maybeSingle(), "Could not update the scholarship notice.");
  if (existing) check(await supabase.from("announcements").update(row).eq("id", existing.id), "Could not update the scholarship notice.");
  else check(await supabase.from("announcements").insert(row), "Could not add the scholarship notice.");
}

/* "Open now" / "Opens on …" / "Closed" for a scheme with dates. */
export function schemeStatus(scheme) {
  const today = todayIso();
  if (scheme.closesOn && scheme.closesOn < today) return { tone: "closed", en: "Applications closed", mr: "अर्ज बंद" };
  if (scheme.opensOn && scheme.opensOn > today) return { tone: "soon", en: `Opens ${fmt(scheme.opensOn)}`, mr: `${fmt(scheme.opensOn)} पासून सुरू` };
  if (scheme.opensOn || scheme.closesOn) {
    if (scheme.closesOn) {
      const days = Math.round((new Date(`${scheme.closesOn}T00:00:00`) - new Date(`${today}T00:00:00`)) / 86400000);
      return { tone: "open", en: days === 0 ? "Open — last day today" : `Open — last date ${fmt(scheme.closesOn)} (${days} day${days === 1 ? "" : "s"} left)`, mr: days === 0 ? "सुरू — आज शेवटचा दिवस" : `सुरू — शेवटची तारीख ${fmt(scheme.closesOn)} (${days} दिवस बाकी)` };
    }
    return { tone: "open", en: "Open now", mr: "आता सुरू" };
  }
  return null;
}

export { fmt as formatNoticeDate, todayIso };
