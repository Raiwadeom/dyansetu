/* ============================================================================
   DnyanSetu — Student Projects (final-year, OJT and mini projects)

   Rows live in Supabase table student_projects (migration 0027). Everyone can
   read approved projects. Students add one and it waits for the administrator
   or faculty; faculty and the administrator add projects that go live at once.
   The optional screenshot goes to Cloudinary folder dnyansetu/projects.
   ========================================================================== */

import { friendlyError, isBackendConfigured, supabase } from "./supabase.js";
import { shrinkPhoto, uploadFile } from "./cloudinary.js";
import { NOTE_STREAMS } from "../data/notes.js";

export const PROJECT_KINDS = [
  { id: "final-year", label: "Final-year project", short: "Final year" },
  { id: "ojt", label: "OJT / internship project", short: "OJT" },
  { id: "mini", label: "Mini project", short: "Mini" },
];
export const PROJECT_CLASSES = ["FY (First year)", "SY (Second year)", "TY (Third year)", "Final year", "Post-graduate"];
export const kindLabel = (id) => PROJECT_KINDS.find((k) => k.id === id)?.short || "Project";
/* Streams that can add and filter projects (BCA and B.Com. are not offered here). */
export const PROJECT_STREAMS = NOTE_STREAMS.filter((s) => s.id !== "bca" && s.id !== "bcom");
export const streamLabel = (id) => NOTE_STREAMS.find((s) => s.id === id)?.name || id;

/* Hosting sites students commonly use, recognised from the link. */
const PLATFORMS = [
  [/vercel\.app$/, "Vercel"], [/netlify\.app$/, "Netlify"], [/github\.io$/, "GitHub Pages"],
  [/onrender\.com$/, "Render"], [/(web\.app|firebaseapp\.com)$/, "Firebase"], [/herokuapp\.com$/, "Heroku"],
  [/(railway\.app|up\.railway\.app)$/, "Railway"], [/streamlit\.app$/, "Streamlit"], [/hf\.space$/, "Hugging Face"],
  [/pages\.dev$/, "Cloudflare"], [/surge\.sh$/, "Surge"], [/(replit\.app|repl\.co)$/, "Replit"],
  [/glitch\.me$/, "Glitch"], [/infinityfree|epizy|000webhost|rf\.gd$/, "Free hosting"], [/fly\.dev$/, "Fly.io"],
  [/azurewebsites\.net$/, "Azure"], [/(amazonaws\.com|awsapps\.com)$/, "AWS"], [/github\.com$/, "GitHub"],
];
export function platformOf(url = "") {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    const hit = PLATFORMS.find(([re]) => re.test(host));
    return hit ? hit[1] : host;
  } catch { return "Link"; }
}

/* A half-filled "Add project" form survives switching tabs, a page rebuild or
   a refresh: the text is kept in this tab's session storage and the form
   reopens by itself. Cleared on save or cancel. */
const DRAFT_KEY = "dnyansetu:project-draft";
const OPEN_KEY = "dnyansetu:project-form-open";
export const projectDraft = {
  isOpen() { try { return sessionStorage.getItem(OPEN_KEY) === "1"; } catch { return false; } },
  open() { try { sessionStorage.setItem(OPEN_KEY, "1"); } catch { /* storage blocked */ } },
  read() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; } },
  write(f) { try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(f)); } catch { /* storage blocked */ } },
  clear() { try { sessionStorage.removeItem(DRAFT_KEY); sessionStorage.removeItem(OPEN_KEY); } catch { /* storage blocked */ } },
};

export const isHttpsUrl = (v = "") => /^https:\/\/[^\s]{4,500}$/i.test(v.trim());

/* Defence in depth: the database only stores https links, but a link is also
   re-checked right before it is put on a page, so a javascript: or data: link
   can never become clickable. Returns "" when the link is not safe. */
export function safeUrl(u = "") {
  try {
    const x = new URL(u);
    return x.protocol === "https:" ? x.href : "";
  } catch { return ""; }
}

function toProject(r) {
  return {
    id: r.id, ownerId: r.owner_id, addedBy: r.added_by, kind: r.kind, title: r.title, description: r.description,
    students: r.students, stream: r.stream, className: r.class_name || "", year: r.academic_year || "",
    guide: r.guide || "", tech: (r.tech || "").split(",").map((t) => t.trim()).filter(Boolean),
    live: safeUrl(r.live_url), repo: safeUrl(r.repo_url || ""), image: r.image_url || "", status: r.status,
    createdAt: r.created_at ? Date.parse(r.created_at) : Date.now(),
  };
}

/* approved projects for everyone; `all: true` is for staff (every status). */
export async function fetchProjects({ all = false, limit = 200 } = {}) {
  if (!isBackendConfigured) return [];
  let q = supabase.from("student_projects").select("*").order("created_at", { ascending: false }).limit(limit);
  if (!all) q = q.eq("status", "approved");
  const { data, error } = await q;
  if (error) throw new Error(friendlyError(error, "Could not load the projects."));
  return (data || []).map(toProject);
}

/* Projects this account added (any status), so a student can see "pending". */
export async function fetchMyProjects(userId) {
  if (!isBackendConfigured || !userId) return [];
  const { data, error } = await supabase.from("student_projects").select("*").eq("owner_id", userId).order("created_at", { ascending: false });
  if (error) throw new Error(friendlyError(error, "Could not load your projects."));
  return (data || []).map(toProject);
}

function toRow(f) {
  return {
    kind: f.kind, title: f.title.trim(), description: f.description.trim(), students: f.students.trim(),
    stream: f.stream, class_name: (f.className || "").trim(), academic_year: (f.year || "").trim(),
    guide: (f.guide || "").trim(), tech: (f.tech || "").trim(), live_url: f.live.trim(), repo_url: (f.repo || "").trim(),
  };
}

export async function addProject(user, f, file) {
  if (!isBackendConfigured) throw new Error("Adding a project needs the backend configured.");
  let image_url = "";
  if (file) image_url = (await uploadFile(await shrinkPhoto(file), { folder: "dnyansetu/projects" })).url;
  const { data, error } = await supabase.from("student_projects").insert({ ...toRow(f), owner_id: user.id, image_url }).select("*").single();
  if (error) throw new Error(friendlyError(error, "Could not save your project."));
  return toProject(data);
}

export async function updateProject(id, f, file) {
  const patch = toRow(f);
  if (file) patch.image_url = (await uploadFile(await shrinkPhoto(file), { folder: "dnyansetu/projects" })).url;
  const { error } = await supabase.from("student_projects").update(patch).eq("id", id);
  if (error) throw new Error(friendlyError(error, "Could not save the changes."));
}

export async function setProjectStatus(id, status) {
  const { error } = await supabase.from("student_projects").update({ status }).eq("id", id);
  if (error) throw new Error(friendlyError(error, "Could not save the decision."));
}

export async function deleteProject(id) {
  const { error } = await supabase.from("student_projects").delete().eq("id", id);
  if (error) throw new Error(friendlyError(error, "Could not remove the project."));
}
