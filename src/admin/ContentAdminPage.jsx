/* ============================================================================
   Admin: Scholarships & Notices

   Lets the administrator (e.g. the scholarship in-charge, signed in with the
   admin account) change what every visitor sees without touching the code:
   - home-page announcements: add, edit, delete, optional auto-remove date
   - scholarships: edit any detail, documents list, application dates (which
     also post a home-page announcement), hide/show, add or delete a scheme
   Every save is live for everyone on their next page load.
   ========================================================================== */

import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowDown, ArrowUp, CalendarDays, CheckCircle2, Coins, Eye, EyeOff, Loader2, Megaphone,
  Pencil, Plus, Save, Trash2, X,
} from "lucide-react";
import { SCHOLARSHIP_CATEGORIES } from "../data/resources";
import {
  addAnnouncement, deleteAnnouncement, deleteSchemeRow, fetchAllAnnouncements, fetchAllSchemeRows, fetchMyAnnouncements,
  formatNoticeDate, importBuiltInSchemes, saveSchemeRow, syncSchemeAnnouncement, todayIso, toScheme, schemeStatus,
  updateAnnouncement,
} from "../lib/siteContent";
import { notifySite } from "../lib/sitePush";

const slug = (text) => (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "scheme";

const blankScheme = () => ({
  id: "", name: "", name_mr: "", provider: "", provider_mr: "", categories: [],
  amount: "", amount_mr: "", time_window: "", time_window_mr: "", eligibility: "", eligibility_mr: "",
  documents: [], note: "", note_mr: "", portal: "", opens_on: null, closes_on: null, active: true, sort: 1000,
});

function Pair({ label, en, mr, onEn, onMr, area, required, placeholder }) {
  const Input = area ? "textarea" : "input";
  return (
    <div className="ca-pair">
      <label className="ca-field">
        <span>{label}{required && <b className="ca-req"> *</b>}</span>
        <Input className="field-input" rows={area ? 3 : undefined} value={en || ""} placeholder={placeholder} onChange={(e) => onEn(e.target.value)} />
      </label>
      <label className="ca-field">
        <span>{label} — मराठी <em>(optional)</em></span>
        <Input className="field-input" rows={area ? 3 : undefined} value={mr || ""} onChange={(e) => onMr(e.target.value)} />
      </label>
    </div>
  );
}

/* ------------------------------------------------------------ announcements */

export const ANNOUNCEMENT_CATEGORIES = [
  { id: "notice", name: "General notice" },
  { id: "event", name: "Event" },
  { id: "competition", name: "Competition (e.g. Aviskar)" },
  { id: "workshop", name: "Workshop / seminar" },
  { id: "exam", name: "Exam" },
  { id: "holiday", name: "Holiday" },
];
const categoryName = (id) => ANNOUNCEMENT_CATEGORIES.find((c) => c.id === id)?.name.replace(/ \(.*\)$/, "") || "Notice";

function AnnouncementForm({ initial, onSave, onCancel, busy }) {
  const [f, setF] = useState(() => ({
    category: initial?.category || "notice",
    title: initial?.title || "", title_mr: initial?.title_mr || "",
    notice_date: initial?.notice_date || todayIso(), href: initial?.href || "", expires_on: initial?.expires_on || "",
  }));
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = (e) => {
    e.preventDefault();
    if (f.title.trim().length < 3) return setErr("Write the announcement text.");
    const href = f.href.trim();
    if (href && !/^(https?:\/\/|\/)/i.test(href)) return setErr("A link must start with https:// (or leave it empty).");
    if (f.expires_on && f.expires_on < f.notice_date) return setErr("The remove-on date must be after the announcement date.");
    setErr("");
    onSave({ category: f.category, title: f.title.trim(), title_mr: f.title_mr.trim(), notice_date: f.notice_date, href, expires_on: f.expires_on || null });
  };
  return (
    <form className="ca-form" onSubmit={submit}>
      <label className="ca-field"><span>Type</span>
        <select className="field-input" value={f.category} onChange={set("category")}>
          {ANNOUNCEMENT_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <Pair label="Announcement" en={f.title} mr={f.title_mr} onEn={(v) => setF((x) => ({ ...x, title: v }))} onMr={(v) => setF((x) => ({ ...x, title_mr: v }))} area required
        placeholder="e.g. Post-matric scholarship forms are open till 31 Dec. Submit documents in the office." />
      <div className="ca-grid3">
        <label className="ca-field"><span>Date shown</span><input type="date" className="field-input" value={f.notice_date} onChange={set("notice_date")} required /></label>
        <label className="ca-field"><span>Link <em>(optional)</em></span><input type="url" className="field-input" placeholder="https://…" value={f.href} onChange={set("href")} /></label>
        <label className="ca-field"><span>Remove from home page after <em>(optional)</em></span><input type="date" className="field-input" value={f.expires_on || ""} onChange={set("expires_on")} /></label>
      </div>
      {err && <p className="upload-error">{err}</p>}
      <div className="ca-actions">
        {onCancel && <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : <Save size={14} />} {initial ? "Save changes" : "Publish announcement"}
        </button>
      </div>
    </form>
  );
}

function AnnouncementsCard() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState("");
  const [confirmDel, setConfirmDel] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await fetchAllAnnouncements()); setError(""); } catch (e) { setError(e.message); setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (key, fn) => {
    setBusy(key); setError("");
    try { await fn(); await load(); return true; } catch (e) { setError(e.message); return false; } finally { setBusy(""); }
  };

  const today = todayIso();
  return (
    <div className="card ca-card">
      <div className="admin-section-head">
        <h3><Megaphone size={18} /> Home page announcements ({rows ? rows.length : "…"})</h3>
        {!adding && <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}><Plus size={14} /> New announcement</button>}
      </div>
      <p className="ca-help">These appear in the <b>Announcements</b> box on the home page for every visitor, newest first, and a new one is sent as a phone notification to everyone who turned notifications on. Scholarship dates you save below are announced here automatically. Faculty can post their own too (marked “By …”).</p>

      {adding && (
        <AnnouncementForm busy={busy === "add"} onCancel={() => setAdding(false)}
          onSave={async (row) => { if (await run("add", () => addAnnouncement(row))) setAdding(false); }} />
      )}
      {error && <p className="upload-error">{error}</p>}
      {rows === null ? <p className="ca-help"><Loader2 size={14} className="spin" /> Loading…</p> : rows.length === 0 ? (
        <p className="resource-empty" style={{ margin: 0 }}>No announcements yet. The home page shows “No announcements right now.”</p>
      ) : (
        <ul className="ca-list">
          {rows.map((r) => {
            const expired = r.expires_on && r.expires_on < today;
            return (
              <li key={r.id} className={expired ? "is-dim" : ""}>
                {editing === r.id ? (
                  <AnnouncementForm initial={r} busy={busy === r.id} onCancel={() => setEditing("")}
                    onSave={async (row) => {
                      const ok = await run(r.id, () => updateAnnouncement(r.id, row));
                      if (ok) setEditing("");
                    }} />
                ) : (
                  <div className="ca-row">
                    <button type="button" className="ca-row-main" onClick={() => setEditing(r.id)} title="Click to edit">
                      <span className="ca-date"><CalendarDays size={13} /> {formatNoticeDate(r.notice_date)}</span>
                      <span className="ca-title">{r.title}</span>
                      <span className="ca-tags">
                        {r.category && r.category !== "notice" && <span className="ca-tag ca-tag--cat">{categoryName(r.category)}</span>}
                        {r.author_name && <span className="ca-tag">By {r.author_name}</span>}
                        {r.scholarship_id && <span className="ca-tag">From scholarship dates</span>}
                        {r.href && <span className="ca-tag">Has link</span>}
                        {r.expires_on && <span className={`ca-tag ${expired ? "ca-tag--off" : ""}`}>{expired ? "Removed from home page" : `Until ${formatNoticeDate(r.expires_on)}`}</span>}
                      </span>
                    </button>
                    <div className="ca-row-tools">
                      <button type="button" className="btn btn-xs btn-outline" onClick={() => setEditing(r.id)}><Pencil size={13} /> Edit</button>
                      {confirmDel === r.id ? (
                        <>
                          <button type="button" className="btn btn-xs btn-outline" onClick={() => setConfirmDel("")}>Keep</button>
                          <button type="button" className="btn btn-xs btn-danger" disabled={busy === r.id} onClick={() => run(r.id, () => deleteAnnouncement(r.id)).then(() => setConfirmDel(""))}>
                            {busy === r.id ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />} Delete
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-xs btn-outline ca-del" onClick={() => setConfirmDel(r.id)}><Trash2 size={13} /> Delete</button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------- faculty: own announcements */

/* In the Faculty Studio: a teacher posts an event, competition or notice to
   the home page and everyone with notifications on hears about it. They see
   and manage only their own; the database enforces that. */
export function FacultyAnnouncementsCard({ profile }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState("");
  const [confirmDel, setConfirmDel] = useState("");
  const [adding, setAdding] = useState(false);
  const [posted, setPosted] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await fetchMyAnnouncements(profile.id)); setError(""); } catch (e) { setError(e.message); setRows([]); }
  }, [profile.id]);
  useEffect(() => { load(); }, [load]);

  const run = async (key, fn) => {
    setBusy(key); setError("");
    try { await fn(); load(); return true; } catch (e) { setError(e.message); return false; } finally { setBusy(""); }
  };

  const approved = !profile.approvalStatus || profile.approvalStatus === "approved";
  const today = todayIso();
  return (
    <div className="card ca-card">
      <style>{CSS}</style>
      <div className="admin-section-head">
        <h3><Megaphone size={18} /> My announcements ({rows ? rows.length : "…"})</h3>
        {!adding && approved && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setAdding(true); setPosted(false); }}><Plus size={14} /> Post announcement</button>
        )}
      </div>
      <p className="ca-help">
        Tell the whole college about an event, a competition (for example Aviskar), a workshop or an exam notice.
        It shows in the <b>Announcements</b> box on the home page with your name, and students who turned on
        notifications get it on their phone.
      </p>
      {!approved && <p className="upload-error">You can post announcements once the administrator approves your account.</p>}
      {posted && <p className="ca-saved"><CheckCircle2 size={15} /> Posted — it is on the home page now.</p>}

      {adding && (
        <AnnouncementForm busy={busy === "add"} onCancel={() => setAdding(false)}
          onSave={async (row) => {
            if (await run("add", () => addAnnouncement({ ...row, posted_by: profile.id }))) { setAdding(false); setPosted(true); }
          }} />
      )}
      {error && <p className="upload-error">{error}</p>}
      {rows === null ? <p className="ca-help"><Loader2 size={14} className="spin" /> Loading…</p> : rows.length === 0 ? (
        !adding && <p className="resource-empty" style={{ margin: 0 }}>You have not posted any announcements yet.</p>
      ) : (
        <ul className="ca-list">
          {rows.map((r) => {
            const expired = r.expires_on && r.expires_on < today;
            return (
              <li key={r.id} className={expired ? "is-dim" : ""}>
                {editing === r.id ? (
                  <AnnouncementForm initial={r} busy={busy === r.id} onCancel={() => setEditing("")}
                    onSave={async (row) => { if (await run(r.id, () => updateAnnouncement(r.id, row))) setEditing(""); }} />
                ) : (
                  <div className="ca-row">
                    <button type="button" className="ca-row-main" onClick={() => setEditing(r.id)} title="Click to edit">
                      <span className="ca-date"><CalendarDays size={13} /> {formatNoticeDate(r.notice_date)}</span>
                      <span className="ca-title">{r.title}</span>
                      <span className="ca-tags">
                        <span className="ca-tag ca-tag--cat">{categoryName(r.category)}</span>
                        {r.expires_on && <span className={`ca-tag ${expired ? "ca-tag--off" : ""}`}>{expired ? "Removed from home page" : `Until ${formatNoticeDate(r.expires_on)}`}</span>}
                      </span>
                    </button>
                    <div className="ca-row-tools">
                      <button type="button" className="btn btn-xs btn-outline" onClick={() => setEditing(r.id)}><Pencil size={13} /> Edit</button>
                      {confirmDel === r.id ? (
                        <>
                          <button type="button" className="btn btn-xs btn-outline" onClick={() => setConfirmDel("")}>Keep</button>
                          <button type="button" className="btn btn-xs btn-danger" disabled={busy === r.id} onClick={() => run(r.id, () => deleteAnnouncement(r.id)).then(() => setConfirmDel(""))}>
                            {busy === r.id ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />} Delete
                          </button>
                        </>
                      ) : (
                        <button type="button" className="btn btn-xs btn-outline ca-del" onClick={() => setConfirmDel(r.id)}><Trash2 size={13} /> Delete</button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- scholarships */

/* scope: the category picked in the list's dropdown ("all" = every category).
   Editing a scheme shared by several categories with one category picked
   saves the changes as that category's own copy, so the other categories
   keep the old details untouched. */
function SchemeEditor({ initial, isNew, existingIds, onSaved, onCancel, onDeleted, scope = "all" }) {
  const splitting = !isNew && scope !== "all" && (initial?.categories || []).length > 1 && initial.categories.includes(scope);
  const scopeName = SCHOLARSHIP_CATEGORIES.find((c) => c.id === scope)?.name || scope;
  const [f, setF] = useState(() => ({ ...blankScheme(), ...initial, documents: (initial?.documents || []).map((d) => ({ en: d.en || "", mr: d.mr || "" })) }));
  const [announce, setAnnounce] = useState(true);
  const [newDoc, setNewDoc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const setDoc = (i, k, v) => setF((x) => ({ ...x, documents: x.documents.map((d, j) => (j === i ? { ...d, [k]: v } : d)) }));
  const moveDoc = (i, dir) => setF((x) => {
    const docs = [...x.documents]; const j = i + dir;
    if (j < 0 || j >= docs.length) return x;
    [docs[i], docs[j]] = [docs[j], docs[i]];
    return { ...x, documents: docs };
  });
  const removeDoc = (i) => setF((x) => ({ ...x, documents: x.documents.filter((_, j) => j !== i) }));
  const addDoc = () => {
    const t = newDoc.trim();
    if (!t) return;
    setF((x) => ({ ...x, documents: [...x.documents, { en: t, mr: "" }] }));
    setNewDoc("");
  };
  const toggleCat = (id) => setF((x) => ({ ...x, categories: x.categories.includes(id) ? x.categories.filter((c) => c !== id) : [...x.categories, id] }));

  const save = async () => {
    setErr("");
    if (f.name.trim().length < 2) return setErr("Write the scholarship name.");
    if (!splitting && f.categories.length === 0) return setErr("Tick at least one category, so students can find it.");
    if (f.portal.trim() && !/^https?:\/\//i.test(f.portal.trim())) return setErr("The apply link must start with https://");
    if (f.opens_on && f.closes_on && f.closes_on < f.opens_on) return setErr("The last date must be on or after the opening date.");
    let id = f.id;
    const uniqueId = (base) => {
      let candidate = base;
      let n = 2;
      while (existingIds.includes(candidate)) candidate = `${base}-${n++}`;
      return candidate;
    };
    if (isNew) id = uniqueId(slug(f.name));
    if (splitting) id = uniqueId(`${f.id}-${scope}`.slice(0, 76));
    const row = {
      ...f, id,
      ...(splitting ? { categories: [scope] } : {}),
      name: f.name.trim(), portal: f.portal.trim(),
      documents: f.documents.map((d) => ({ en: d.en.trim(), mr: d.mr.trim() })).filter((d) => d.en),
      opens_on: f.opens_on || null, closes_on: f.closes_on || null,
    };
    delete row.updated_at;
    delete row.push_sent_at;
    setBusy(true);
    try {
      const saved = await saveSchemeRow(row);
      if (splitting) {
        /* The original keeps every other category, with its old details. */
        const original = { ...initial, categories: initial.categories.filter((c) => c !== scope) };
        delete original.updated_at;
        delete original.push_sent_at;
        await saveSchemeRow(original);
      }
      if (announce && saved.active) await syncSchemeAnnouncement(saved);
      else await syncSchemeAnnouncement({ ...saved, opens_on: null, closes_on: null });
      if (saved.active) notifySite("scholarship", saved.id);
      onSaved(saved);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try { await deleteSchemeRow(f.id); onDeleted(f.id); } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="ca-editor">
      <Pair label="Scholarship name" required en={f.name} mr={f.name_mr} onEn={set("name")} onMr={set("name_mr")} />
      <Pair label="Given by (department)" en={f.provider} mr={f.provider_mr} onEn={set("provider")} onMr={set("provider_mr")} />
      <Pair label="Amount / benefit" en={f.amount} mr={f.amount_mr} onEn={set("amount")} onMr={set("amount_mr")} />
      <Pair label="Who can apply (eligibility)" area en={f.eligibility} mr={f.eligibility_mr} onEn={set("eligibility")} onMr={set("eligibility_mr")} />
      <Pair label="Usual application period (text)" en={f.time_window} mr={f.time_window_mr} onEn={set("time_window")} onMr={set("time_window_mr")} placeholder="e.g. Usually August – December" />

      <fieldset className="ca-box">
        <legend><CalendarDays size={15} /> This year's application dates</legend>
        <div className="ca-grid3">
          <label className="ca-field"><span>Applications open on</span><input type="date" className="field-input" value={f.opens_on || ""} onChange={(e) => set("opens_on")(e.target.value)} /></label>
          <label className="ca-field"><span>Last date to apply</span><input type="date" className="field-input" value={f.closes_on || ""} onChange={(e) => set("closes_on")(e.target.value)} /></label>
          <label className="ca-check">
            <input type="checkbox" checked={announce} onChange={(e) => setAnnounce(e.target.checked)} />
            <span>Announce these dates on the home page (removed automatically after the last date)</span>
          </label>
        </div>
      </fieldset>

      {splitting && (
        <p className="ca-scope-note">
          <b>Editing for {scopeName} only.</b> Your changes are saved as a separate {scopeName} copy of this
          scholarship. {initial.categories.filter((c) => c !== scope).map((c) => SCHOLARSHIP_CATEGORIES.find((x) => x.id === c)?.name || c).join(", ")} keep
          the current details. To change it for every category, pick <b>All categories</b> in the dropdown above.
        </p>
      )}

      {!splitting && <fieldset className="ca-box">
        <legend>Categories that can apply <b className="ca-req">*</b></legend>
        <div className="ca-chips">
          {SCHOLARSHIP_CATEGORIES.map((c) => (
            <button type="button" key={c.id} className={`category-chip ${f.categories.includes(c.id) ? "is-active" : ""}`} onClick={() => toggleCat(c.id)}>
              {f.categories.includes(c.id) && <CheckCircle2 size={13} />} {c.name}
            </button>
          ))}
        </div>
      </fieldset>}

      <fieldset className="ca-box">
        <legend>Documents required ({f.documents.length})</legend>
        <p className="ca-help">Click any document to change its wording. Use ✕ to remove one and “Add document” for a new one. The arrows change the order.</p>
        <ol className="ca-docs">
          {f.documents.map((d, i) => (
            <li key={i}>
              <span className="ca-doc-no">{i + 1}</span>
              <div className="ca-doc-inputs">
                <input className="field-input" value={d.en} onChange={(e) => setDoc(i, "en", e.target.value)} aria-label={`Document ${i + 1}`} />
                <input className="field-input ca-doc-mr" value={d.mr} placeholder="मराठी (optional)" onChange={(e) => setDoc(i, "mr", e.target.value)} aria-label={`Document ${i + 1} in Marathi`} />
              </div>
              <div className="ca-doc-tools">
                <button type="button" className="ca-icon" onClick={() => moveDoc(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp size={14} /></button>
                <button type="button" className="ca-icon" onClick={() => moveDoc(i, 1)} disabled={i === f.documents.length - 1} aria-label="Move down"><ArrowDown size={14} /></button>
                <button type="button" className="ca-icon ca-icon--del" onClick={() => removeDoc(i)} aria-label="Remove document"><X size={15} /></button>
              </div>
            </li>
          ))}
        </ol>
        <div className="ca-adddoc">
          <input className="field-input" placeholder="New document, e.g. Leaving certificate" value={newDoc} onChange={(e) => setNewDoc(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDoc(); } }} />
          <button type="button" className="btn btn-outline btn-sm" onClick={addDoc}><Plus size={14} /> Add document</button>
        </div>
      </fieldset>

      <Pair label="Important note (optional)" area en={f.note} mr={f.note_mr} onEn={set("note")} onMr={set("note_mr")} />
      <label className="ca-field"><span>Apply link (official portal)</span><input type="url" className="field-input" placeholder="https://mahadbt.maharashtra.gov.in/" value={f.portal} onChange={(e) => set("portal")(e.target.value)} /></label>

      <label className="ca-check ca-check--wide">
        <input type="checkbox" checked={f.active} onChange={(e) => set("active")(e.target.checked)} />
        <span>Show this scholarship on the website (untick to hide it without deleting)</span>
      </label>
      <p className="ca-help">Marathi boxes left empty show the English text on the Marathi page.</p>

      {err && <p className="upload-error">{err}</p>}
      <div className="ca-actions ca-actions--split">
        <div>
          {!isNew && (confirmDel ? (
            <>
              <span className="ca-help">Delete this scholarship for good?</span>{" "}
              <button type="button" className="btn btn-xs btn-outline" onClick={() => setConfirmDel(false)}>Keep</button>{" "}
              <button type="button" className="btn btn-xs btn-danger" onClick={remove} disabled={busy}><Trash2 size={13} /> Delete</button>
            </>
          ) : (
            <button type="button" className="btn btn-xs btn-outline ca-del" onClick={() => setConfirmDel(true)}><Trash2 size={13} /> Delete scholarship</button>
          ))}
        </div>
        <div className="ca-actions">
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
            {busy ? <Loader2 size={14} className="spin" /> : <Save size={14} />} {splitting ? `Save for ${scopeName} only` : "Save — show on website"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScholarshipsCard({ onAnnouncementsChanged }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState("");
  const [saved, setSaved] = useState("");
  const [importing, setImporting] = useState(false);
  /* The category dropdown: "all" lists every scheme and edits apply to all
     its categories; one category lists only its schemes and edits only it. */
  const [cat, setCat] = useState("all");

  const load = useCallback(async () => {
    try { setRows(await fetchAllSchemeRows()); setError(""); } catch (e) { setError(e.message); setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const doImport = async () => {
    setImporting(true);
    try { await importBuiltInSchemes(); await load(); } catch (e) { setError(e.message); } finally { setImporting(false); }
  };

  const ids = (rows || []).map((r) => r.id);
  const shown = (rows || []).filter((r) => cat === "all" || (r.categories || []).includes(cat));
  const countIn = (id) => (rows || []).filter((r) => (r.categories || []).includes(id)).length;
  const catName = (id) => SCHOLARSHIP_CATEGORIES.find((c) => c.id === id)?.name || id;

  return (
    <div className="card ca-card">
      <div className="admin-section-head">
        <h3><Coins size={18} /> Scholarships ({rows ? rows.length : "…"})</h3>
        {open !== "new" && <button type="button" className="btn btn-primary btn-sm" onClick={() => { setOpen("new"); setSaved(""); }}><Plus size={14} /> Add scholarship</button>}
      </div>
      <p className="ca-help">Click a scholarship to change anything in it — name, amount, eligibility, documents, dates or the apply link. <b>Save</b> puts it on the website for everyone at once and notifies students who turned notifications on.</p>
      <label className="ca-field ca-catpick">
        <span>Category</span>
        <select className="field-input" value={cat} onChange={(e) => { setCat(e.target.value); setOpen(""); setSaved(""); }}>
          <option value="all">All categories{rows ? ` (${rows.length})` : ""}</option>
          {SCHOLARSHIP_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}{rows ? ` (${countIn(c.id)})` : ""}</option>)}
        </select>
        <em>{cat === "all"
          ? "Showing every scholarship. Changes apply to all the categories ticked in it."
          : `Showing only ${SCHOLARSHIP_CATEGORIES.find((c) => c.id === cat)?.name} scholarships. Changes you save here apply to this category only — other categories stay as they are.`}</em>
      </label>
      {saved && <p className="ca-saved"><CheckCircle2 size={15} /> Saved — “{saved}” is updated on the website.</p>}
      {error && <p className="upload-error">{error}</p>}

      {open === "new" && (
        <div className="ca-scheme is-open">
          <h4 className="ca-new-title">New scholarship</h4>
          <SchemeEditor isNew initial={{ ...blankScheme(), categories: cat === "all" ? [] : [cat] }} existingIds={ids} onCancel={() => setOpen("")}
            onSaved={async (row) => { setOpen(""); setSaved(row.name); await load(); onAnnouncementsChanged(); }}
            onDeleted={() => {}} />
        </div>
      )}

      {rows === null ? <p className="ca-help"><Loader2 size={14} className="spin" /> Loading…</p> : rows.length === 0 ? (
        <div className="resource-empty" style={{ margin: 0 }}>
          <p>No scholarships in the database yet — the website is showing its built-in list.</p>
          <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={doImport} disabled={importing}>
            {importing ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Load the built-in list so it can be edited
          </button>
        </div>
      ) : (
        <div className="ca-schemes">
          {shown.length === 0 && <p className="resource-empty" style={{ margin: 0 }}>No scholarships in this category yet. Use <b>Add scholarship</b> to create one.</p>}
          {shown.map((r) => {
            const status = schemeStatus(toScheme(r));
            const isOpen = open === r.id;
            return (
              <div key={r.id} className={`ca-scheme ${isOpen ? "is-open" : ""} ${r.active ? "" : "is-hidden"}`}>
                {!isOpen ? (
                  <button type="button" className="ca-scheme-head" onClick={() => { setOpen(r.id); setSaved(""); }} title="Click to edit">
                    <span className="ca-scheme-name">{r.name}</span>
                    <span className="ca-tags">
                      {!r.active && <span className="ca-tag ca-tag--off"><EyeOff size={12} /> Hidden</span>}
                      {status && <span className={`ca-tag ca-tag--${status.tone}`}>{status.en}</span>}
                      <span className="ca-tag">{r.documents?.length || 0} documents</span>
                      {r.categories.map((c) => <span key={c} className="ca-tag ca-tag--cat">{catName(c)}</span>)}
                    </span>
                    <span className="ca-edit-hint"><Pencil size={13} /> Edit</span>
                  </button>
                ) : (
                  <>
                    <div className="ca-scheme-head ca-scheme-head--open">
                      <span className="ca-scheme-name">{r.name}</span>
                      <span className="ca-tags">{r.active ? <span className="ca-tag"><Eye size={12} /> On website</span> : <span className="ca-tag ca-tag--off"><EyeOff size={12} /> Hidden</span>}</span>
                    </div>
                    <SchemeEditor initial={r} scope={cat} existingIds={ids} onCancel={() => setOpen("")}
                      onSaved={async (row) => { setOpen(""); setSaved(row.name); await load(); onAnnouncementsChanged(); }}
                      onDeleted={async () => { setOpen(""); await load(); onAnnouncementsChanged(); }} />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ContentAdminPage() {
  /* Saving scholarship dates changes the announcements list too. */
  const [annKey, setAnnKey] = useState(0);
  return (
    <div className="dash-grid ca-page">
      <style>{CSS}</style>
      <div className="ca-intro" style={{ gridColumn: "1 / -1" }}>
        <h2>Scholarships &amp; Notices</h2>
        <p>Everything here is live: what you save shows on the website for every student straight away. No code needed.</p>
      </div>
      <div style={{ gridColumn: "1 / -1" }}><AnnouncementsCard key={annKey} /></div>
      <div style={{ gridColumn: "1 / -1" }}><ScholarshipsCard onAnnouncementsChanged={() => setAnnKey((k) => k + 1)} /></div>
    </div>
  );
}

const CSS = `
.ca-intro h2 { font-size: 22px; margin: 0; color: var(--abc-navy, #1E3A5F); }
.ca-intro p { margin: 4px 0 0; color: var(--text-muted); }
.ca-card { display: flex; flex-direction: column; gap: 12px; }
.ca-card .admin-section-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.ca-help { margin: 0; font-size: 13.5px; color: var(--text-muted); line-height: 1.5; }
.ca-saved { margin: 0; display: flex; align-items: center; gap: 6px; color: #0F7B5A; font-weight: 600; font-size: 14px; background: #E7F5EF; padding: 8px 12px; border-radius: 4px; }
.ca-form, .ca-editor { display: flex; flex-direction: column; gap: 12px; padding: 14px; border: 1px solid var(--border, #D9E0E8); border-radius: 6px; background: #FAFBFD; }
.ca-field { display: flex; flex-direction: column; gap: 5px; min-width: 0; font-size: 13px; font-weight: 600; color: #334155; }
.ca-field em, .ca-pair em { font-weight: 400; font-style: normal; color: var(--text-muted); }
.ca-field .field-input, .ca-docs .field-input, .ca-adddoc .field-input { width: 100%; padding: 9px 11px; font: inherit; font-weight: 400; font-size: 14.5px; }
.ca-field textarea.field-input { resize: vertical; min-height: 70px; }
.ca-req { color: #B42318; }
.ca-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ca-grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; align-items: end; }
.ca-box { border: 1px solid var(--border, #D9E0E8); border-radius: 6px; padding: 10px 12px 12px; margin: 0; min-width: 0; background: #fff; display: flex; flex-direction: column; gap: 8px; }
.ca-box legend { font-weight: 700; font-size: 14px; padding: 0 6px; color: var(--abc-navy, #1E3A5F); display: inline-flex; align-items: center; gap: 6px; }
.ca-check { display: flex; gap: 8px; align-items: flex-start; font-size: 13.5px; line-height: 1.4; }
.ca-check input { width: 18px; height: 18px; margin-top: 1px; flex-shrink: 0; }
.ca-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ca-docs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.ca-docs li { display: grid; grid-template-columns: 26px 1fr auto; gap: 8px; align-items: center; }
.ca-doc-no { width: 24px; height: 24px; border-radius: 50%; background: var(--abc-navy, #1E3A5F); color: #fff; font-size: 12px; font-weight: 700; display: grid; place-items: center; }
.ca-doc-inputs { display: grid; grid-template-columns: 1.3fr 1fr; gap: 6px; min-width: 0; }
.ca-doc-tools { display: flex; gap: 4px; }
.ca-icon { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid #CBD5E1; background: #fff; border-radius: 4px; cursor: pointer; color: #334155; }
.ca-icon:disabled { opacity: .35; cursor: default; }
.ca-icon--del { color: #B42318; border-color: #F1B5B0; }
.ca-icon--del:hover { background: #FEF1F0; }
.ca-adddoc { display: flex; gap: 8px; }
.ca-adddoc .field-input { flex: 1; }
.ca-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; align-items: center; }
.ca-actions--split { justify-content: space-between; }
.ca-del { color: #B42318 !important; }
.ca-list { list-style: none; margin: 0; padding: 0; border: 1px solid var(--border, #D9E0E8); border-radius: 6px; overflow: hidden; }
.ca-list > li { border-top: 1px solid var(--border, #D9E0E8); }
.ca-list > li:first-child { border-top: 0; }
.ca-list > li:nth-child(even) { background: #F8FAFC; }
.ca-list > li.is-dim { opacity: .6; }
.ca-list .ca-form { border: 0; border-radius: 0; }
.ca-row { display: flex; gap: 10px; align-items: center; padding: 10px 12px; }
.ca-row-main { flex: 1; min-width: 0; text-align: left; background: none; border: 0; padding: 0; cursor: pointer; font: inherit; color: inherit; display: flex; flex-direction: column; gap: 3px; }
.ca-row-main:hover .ca-title { text-decoration: underline; }
.ca-row-tools { display: flex; gap: 6px; flex-shrink: 0; }
.ca-date { font-size: 12.5px; color: var(--text-muted); display: inline-flex; gap: 5px; align-items: center; }
.ca-title { font-weight: 600; font-size: 14.5px; }
.ca-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.ca-tag { font-size: 11.5px; font-weight: 600; padding: 2px 7px; border-radius: 3px; background: #EEF2F7; color: #334155; display: inline-flex; gap: 4px; align-items: center; }
.ca-tag--off { background: #F1F3F6; color: #64748B; }
.ca-tag--open { background: #E7F5EF; color: #0F7B5A; }
.ca-tag--soon { background: #FFF4E0; color: #9A5B00; }
.ca-tag--closed { background: #F1F3F6; color: #5A6675; }
.ca-tag--cat { background: #EAF0F7; color: #1E3A5F; }
.ca-schemes { display: flex; flex-direction: column; gap: 8px; }
.ca-scheme { border: 1px solid var(--border, #D9E0E8); border-radius: 6px; background: #fff; }
.ca-scheme.is-hidden { background: #FAFAFA; }
.ca-scheme.is-open { border-color: var(--abc-navy, #1E3A5F); }
.ca-scheme .ca-editor { border: 0; border-top: 1px solid var(--border, #D9E0E8); border-radius: 0 0 6px 6px; }
.ca-scheme-head { width: 100%; display: flex; flex-direction: column; gap: 6px; text-align: left; background: none; border: 0; padding: 12px 14px; font: inherit; color: inherit; cursor: pointer; position: relative; }
.ca-scheme-head--open { cursor: default; }
button.ca-scheme-head:hover { background: #F5F8FC; }
.ca-scheme-name { font-weight: 700; font-size: 15px; color: var(--abc-navy, #1E3A5F); padding-right: 60px; }
.ca-edit-hint { position: absolute; top: 12px; right: 14px; font-size: 12.5px; font-weight: 600; color: var(--abc-saffron, #E65100); display: inline-flex; gap: 4px; align-items: center; }
.ca-catpick { max-width: 460px; }
.ca-catpick em { font-size: 12.5px; line-height: 1.45; }
.ca-scope-note { margin: 0; padding: 10px 12px; border-left: 4px solid var(--abc-saffron, #E65100); background: #FFF7ED; font-size: 13.5px; line-height: 1.5; border-radius: 4px; }
.ca-new-title { margin: 0; padding: 12px 14px 0; font-size: 15px; }
@media (max-width: 760px) {
  .ca-pair, .ca-grid3 { grid-template-columns: 1fr; }
  .ca-doc-inputs { grid-template-columns: 1fr; }
  .ca-docs li { grid-template-columns: 24px 1fr; }
  .ca-doc-tools { grid-column: 2; }
  .ca-row { flex-direction: column; align-items: stretch; }
  .ca-row-tools { justify-content: flex-end; }
  .ca-adddoc { flex-direction: column; }
  .ca-actions--split { flex-direction: column-reverse; align-items: stretch; }
}
`;
