import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Check, CheckCircle2, Clock, Code2, ExternalLink, FolderGit2, Github, ImagePlus, Loader2,
  Eye, Pencil, Plus, Search, ShieldCheck, Trash2, X, XCircle,
} from "lucide-react";
import collegeLogo from "../img/college-logo.jpg";
import ProjectCover from "./ProjectCover.jsx";

import {
  PROJECT_KINDS, PROJECT_CLASSES, PROJECT_STREAMS, projectDraft, addProject, deleteProject, fetchProjects, isHttpsUrl, kindLabel, liveLinkProblem, platformOf,
  setProjectStatus, streamLabel, updateProject,
} from "../lib/projects.js";

import { useLiveRefresh } from "../lib/liveRefresh.js";
import "./projects.css";

/* ============================================================================
   DnyanSetu — Student Projects

   Final-year, OJT and mini projects with a link to where they are deployed.
   Everyone can browse. Students add theirs (reviewed first); faculty and the
   administrator add projects that go live straight away and can approve,
   edit or remove any project.
   ========================================================================== */

const sameOr = (next) => (prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next);

/* "2025-26" style: the academic year starts in June. */
function currentAcademicYear() {
  const d = new Date();
  const start = d.getMonth() >= 5 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const blank = () => ({
  kind: "final-year", title: "", description: "", students: "", stream: "", className: "Final year",
  year: currentAcademicYear(), guide: "", tech: "", live: "", repo: "",
});

export function ProjectForm({ initial, user, onClose, onSaved }) {
  const editing = Boolean(initial?.id);
  const [f, setF] = useState(() => (initial ? {
    kind: initial.kind, title: initial.title, description: initial.description, students: initial.students,
    stream: initial.stream, className: initial.className, year: initial.year, guide: initial.guide,
    tech: initial.tech.join(", "), live: initial.live, repo: initial.repo,
  } : { ...blank(), students: user.role === "student" ? user.name || "" : "", ...(projectDraft.read() || {}) }));
  /* Keep what has been typed (new projects only; a chosen screenshot cannot be kept). */
  useEffect(() => { if (!editing) projectDraft.write(f); }, [f, editing]);
  const [file, setFile] = useState(null);
  const [confirm, setConfirm] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const staff = user.role === "faculty" || user.role === "admin";

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (f.title.trim().length < 3) return setErr("Give the project a title (at least 3 letters).");
    if (f.description.trim().length < 20) return setErr("Write a short description — at least 20 characters.");
    if (f.students.trim().length < 2) return setErr("Add the name of the student(s) who made it.");
    if (!f.stream) return setErr("Choose the stream.");
    if (!isHttpsUrl(f.live)) return setErr("The project link must start with https:// — copy it from your hosting site.");
    if (liveLinkProblem(f.live)) return setErr(liveLinkProblem(f.live));
    if (f.repo.trim() && !isHttpsUrl(f.repo)) return setErr("The code link must start with https://.");
    if (!confirm) return setErr("Please tick the confirmation box.");
    setBusy(true);
    try {
      if (editing) await updateProject(initial.id, f, file);
      else await addProject(user, f, file);
      onSaved(editing ? "Changes saved." : staff ? "Project added — it is live now." : "Your project is live now.");
    } catch (error) {
      setErr(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="sp-modal" role="dialog" aria-modal="true" aria-label={editing ? "Edit project" : "Add a project"}>
      <form className="sp-form" onSubmit={submit}>
        <div className="sp-form-head">
          <h2>{editing ? "Edit project" : "Add your project"}</h2>
          <button type="button" className="sp-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className="sp-form-body">
        <div className="sp-pane">
        <div className="sp-kinds" role="group" aria-label="Type of project">
          {PROJECT_KINDS.map((k) => (
            <button key={k.id} type="button" className={f.kind === k.id ? "is-on" : ""} aria-pressed={f.kind === k.id} onClick={() => setF((x) => ({ ...x, kind: k.id }))}>
              <span className="sp-k-full">{k.label}</span><span className="sp-k-short">{k.short}</span>
            </button>
          ))}
        </div>

        <label className="sp-field"><span>Project title *</span>
          <input value={f.title} maxLength={100} onChange={set("title")} placeholder="e.g. College Library Management System" />
        </label>
        <label className="sp-field"><span>Short description * <em>{f.description.length}/400</em></span>
          <textarea rows={6} maxLength={400} value={f.description} onChange={set("description")} placeholder="What does it do, who is it for, what problem does it solve?" />
        </label>
        <label className="sp-field"><span>Student name(s) * <em>{staff ? "who made it" : "you and your team"}</em></span>
          <input value={f.students} maxLength={200} onChange={set("students")} placeholder="e.g. Aarti Patil, Rohan Shinde" />
        </label>

        </div>
        <div className="sp-pane">
        <div className="sp-two">
          <label className="sp-field"><span>Stream *</span>
            <select value={f.stream} onChange={set("stream")}>
              <option value="">Select stream</option>
              {PROJECT_STREAMS.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.full}</option>)}
            </select>
          </label>
          <label className="sp-field"><span>Class</span>
            <select value={f.className} onChange={set("className")}>
              {PROJECT_CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <div className="sp-two">
          <label className="sp-field"><span>Academic year</span>
            <input value={f.year} maxLength={12} onChange={set("year")} placeholder="2025-26" />
          </label>
          <label className="sp-field"><span>Guide / teacher <em>optional</em></span>
            <input value={f.guide} maxLength={80} onChange={set("guide")} placeholder="e.g. Prof. S. K. Kulkarni" />
          </label>
        </div>
        <label className="sp-field"><span>Technologies <em>comma separated, optional</em></span>
          <input value={f.tech} maxLength={120} onChange={set("tech")} placeholder="React, Firebase, Tailwind" />
        </label>
        <label className="sp-field"><span>Live project link * <em>Vercel, Netlify, GitHub Pages, Render, Firebase…</em></span>
          <input type="url" inputMode="url" value={f.live} onChange={set("live")} placeholder="https://my-project.vercel.app" />
        </label>
        <label className="sp-field"><span>Source code link <em>GitHub, optional</em></span>
          <input type="url" inputMode="url" value={f.repo} onChange={set("repo")} placeholder="https://github.com/you/project" />
        </label>

        <label className="sp-file">
          <ImagePlus size={18} />
          <span>{file ? file.name : editing && initial.image ? "Change screenshot (optional)" : "Add a screenshot (optional, photo only)"}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        </div>
        </div>

        <div className="sp-form-bottom">
        {!editing && (
          <label className="sp-check">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            <span>This is real work done by the students named above. The link is safe to open and shows no one’s private details.</span>
          </label>
        )}
        {err && <p className="sp-err" role="alert">{err}</p>}
        <div className="sp-form-foot">
          <button type="button" className="sp-btn sp-btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="sp-btn sp-btn-primary" disabled={busy}>
            {busy ? <><Loader2 size={15} className="spin" /> Saving…</> : editing ? "Save changes" : "Submit project"}
          </button>
        </div>
        </div>
      </form>
    </div>
  );
}

function StatusTag({ status }) {
  if (status === "approved") return null;
  return (
    <span className={`sp-status sp-status--${status}`}>
      {status === "pending" ? <><Clock size={12} /> Waiting for review</> : <><XCircle size={12} /> Not approved</>}
    </span>
  );
}

const STATUS_DOT = {
  approved: { cls: "is-live", label: "Live" },
  pending: { cls: "is-wait", label: "Awaiting review" },
  rejected: { cls: "is-no", label: "Not approved" },
};

const fmtDate = (ms) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

/* "View more": the whole story of one project — title, the full description,
   who made it, class, guide, technologies and the links. The people who may
   manage it (owner, faculty, admin) also get their buttons here. */
export function ProjectDetail({ p, onClose, canManage, staff, busy, onEdit, onDecide, onDelete }) {
  const st = STATUS_DOT[p.status] || STATUS_DOT.pending;
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="sp-modal" role="dialog" aria-modal="true" aria-label={p.title} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sp-detail">
        <div className="sp-detail-head">
          <div className="sp-detail-badges">
            <span className="sp-chip-kind">{kindLabel(p.kind)} project</span>
            <span className={`sp-dotstat ${st.cls}`}>{st.label}</span>
          </div>
          <button type="button" className="sp-icon" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="sp-detail-body">
          <div className="sp-detail-media">
            {p.image ? <img src={p.image} alt={`Screenshot of ${p.title}`} /> : <ProjectCover title={p.title} />}
          </div>
          <h2>{p.title}</h2>
          <h3 className="sp-detail-label">About this project</h3>
          <p className="sp-detail-desc">{p.description}</p>
          <dl className="sp-detail-grid">
            <div><dt>Made by</dt><dd>{p.students}</dd></div>
            <div><dt>Stream &amp; class</dt><dd>{streamLabel(p.stream)}{p.className ? ` · ${p.className}` : ""}</dd></div>
            {p.year && <div><dt>Academic year</dt><dd>{p.year}</dd></div>}
            {p.guide && <div><dt>Guide</dt><dd>{p.guide}</dd></div>}
            <div><dt>Hosted on</dt><dd>{platformOf(p.live)}</dd></div>
            <div><dt>Added on</dt><dd>{fmtDate(p.createdAt)}</dd></div>
          </dl>
          {p.tech.length > 0 && (
            <>
              <h3 className="sp-detail-label">Technologies</h3>
              <ul className="sp-tech">{p.tech.map((t) => <li key={t}>{t}</li>)}</ul>
            </>
          )}
        </div>
        <div className="sp-detail-foot">
          {p.live && (
            <a className="sp-btn sp-btn-primary" href={p.live} target="_blank" rel="noopener noreferrer nofollow ugc"><ExternalLink size={15} /> Open project</a>
          )}
          {p.repo && (
            <a className="sp-btn sp-btn-ghost" href={p.repo} target="_blank" rel="noopener noreferrer nofollow ugc"><Github size={15} /> Source code</a>
          )}
          {canManage && (
            <span className="sp-detail-manage">
              {staff && p.status !== "approved" && <button type="button" className="sp-chipbtn is-ok" disabled={busy} onClick={() => { onDecide(p, "approved"); onClose(); }}><Check size={13} /> Approve</button>}
              {staff && p.status === "pending" && <button type="button" className="sp-chipbtn" disabled={busy} onClick={() => { onDecide(p, "rejected"); onClose(); }}><X size={13} /> Reject</button>}
              {staff && p.status === "approved" && <button type="button" className="sp-chipbtn" disabled={busy} onClick={() => { onDecide(p, "rejected"); onClose(); }}>Hide</button>}
              <button type="button" className="sp-chipbtn" onClick={() => { onEdit(p); onClose(); }}><Pencil size={13} /> Edit</button>
              <button type="button" className="sp-chipbtn is-bad" disabled={busy} onClick={() => { onClose(); onDelete(p); }}><Trash2 size={13} /> Delete</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* The list: one row per project on every screen size — thumbnail, title and
   students, a short description, class, type, hosting platform, status and a
   View button. The project picture is only shown in the View dialog. Rows that are waiting or not approved are tinted. On a phone
   the less important columns fold away but it stays a table. */
export function ProjectTable({ rows, user, staff, busyId, onEdit, onDecide, onDelete }) {
  const [detail, setDetail] = useState(null);
  const open = detail ? rows.find((r) => r.id === detail) || null : null;
  return (
    <div className="sp-table-wrap">
      <table className="sp-table">
        <thead>
          <tr>
            <th scope="col" className="sp-col-no">No.</th>
            <th scope="col">Project</th>
            <th scope="col" className="sp-col-about">About</th>
            <th scope="col">Class</th>
            <th scope="col" className="sp-col-type">Type</th>
            <th scope="col" className="sp-col-host">Hosted on</th>
            <th scope="col" className="sp-col-status">Status</th>
            <th scope="col"><span className="sp-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => {
            const mine = Boolean(user) && p.ownerId === user.id;
            const st = STATUS_DOT[p.status] || STATUS_DOT.pending;
            return (
              <tr key={p.id} className={p.status !== "approved" ? `is-${p.status}` : ""}>
                <td className="sp-cell-no" data-label="No.">{i + 1}</td>
                <td className="sp-cell-project" data-label="Project">
                  <span className="sp-cell-text">
                    <button type="button" className="sp-titlebtn" onClick={() => setDetail(p.id)}>{p.title}</button>
                    <small>{p.students}</small>
                  </span>
                </td>
                <td className="sp-col-about" data-label="About"><span className="sp-clamp">{p.description}</span></td>
                <td data-label="Class">
                  <strong className="sp-sub1">{streamLabel(p.stream)}{p.className ? ` · ${p.className}` : ""}</strong>
                  <small>{p.year}{p.guide ? ` · ${p.guide}` : ""}</small>
                </td>
                <td className="sp-col-type" data-label="Type">
                  <strong className="sp-sub1">{kindLabel(p.kind)}</strong>
                  {p.tech.length > 0 && <small>{p.tech.slice(0, 3).join(", ")}</small>}
                </td>
                <td className="sp-col-host" data-label="Hosted on"><span className="sp-host">{platformOf(p.live)}</span></td>
                <td className="sp-col-status" data-label="Status"><span className={`sp-dotstat ${st.cls}`}>{st.label}</span></td>
                <td className="sp-cell-actions">
                  <span className="sp-rowbtns">
                    <button type="button" className="sp-viewbtn" onClick={() => setDetail(p.id)} aria-label={`View more about ${p.title}`}><Eye size={15} /> <span>View</span></button>
                    {p.live && (
                      <a className="sp-pill sp-pill--open" href={p.live} target="_blank" rel="noopener noreferrer nofollow ugc" aria-label={`Open ${p.title}`} title="Open project"><ExternalLink size={15} /></a>
                    )}
                    {(staff || mine) && (
                      <button type="button" className="sp-trash sp-hide-sm" disabled={busyId === p.id} onClick={() => onDelete(p)} aria-label={`Delete ${p.title}`} title="Delete"><Trash2 size={16} /></button>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {open && (
        <ProjectDetail
          p={open}
          onClose={() => setDetail(null)}
          canManage={staff || (Boolean(user) && open.ownerId === user.id)}
          staff={staff}
          busy={busyId === open.id}
          onEdit={onEdit}
          onDecide={onDecide}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

export default function ProjectsPage({ user, onBack, onSignIn, onOpenProfile, embedded = false }) {
  const role = user?.role;
  const staff = role === "admin" || (role === "faculty" && (!user.approvalStatus || user.approvalStatus === "approved"));
  /* Faculty and the administrator add here. Students add from their own
     profile page, so a project is always tied to the signed-in student. */
  const canAdd = staff;

  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setFormState] = useState(() => (projectDraft.isOpen() ? "new" : null)); /* null | "new" | project */
  const setForm = (v) => {
    if (v === "new") projectDraft.open();
    else projectDraft.clear();
    setFormState(v);
  };
  const [busyId, setBusyId] = useState("");
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [stream, setStream] = useState("all");
  const [tab, setTab] = useState("live"); /* live | review | mine */

  const signedIn = Boolean(user);
  const load = useCallback(async () => {
    try {
      const rows = await fetchProjects({ all: signedIn });
      setProjects(sameOr(rows));
      setError("");
    } catch (e) { setError(e.message); setProjects((p) => p || []); }
  }, [signedIn]);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  const mine = useMemo(() => (projects || []).filter((p) => user && p.ownerId === user.id), [projects, user]);
  const pending = useMemo(() => (projects || []).filter((p) => p.status === "pending"), [projects]);
  const live = useMemo(() => (projects || []).filter((p) => p.status === "approved"), [projects]);

  const source = tab === "review" ? pending : tab === "mine" ? mine : live;
  const term = q.trim().toLowerCase();
  const shown = source.filter((p) =>
    (kind === "all" || p.kind === kind)
    && (stream === "all" || p.stream === stream)
    && (!term || `${p.title} ${p.description} ${p.students} ${p.guide} ${p.tech.join(" ")} ${p.year}`.toLowerCase().includes(term)));

  const decide = async (p, status) => {
    setBusyId(p.id);
    try { await setProjectStatus(p.id, status); await load(); setNotice(status === "approved" ? "Project approved." : "Project hidden from the public list."); }
    catch (e) { setError(e.message); }
    finally { setBusyId(""); }
  };
  const remove = async (p) => {
    if (!window.confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
    setBusyId(p.id);
    try { await deleteProject(p.id); await load(); setNotice("Project deleted."); }
    catch (e) { setError(e.message); }
    finally { setBusyId(""); }
  };

  const count = (k) => live.filter((p) => p.kind === k).length;

  return (
    <div className={embedded ? "sp-embed" : "sp-shell"}>
    {!embedded && (
      <div className="sp-ident">
        <div className="sp-ident-in">
          <img className="sp-crest" src={collegeLogo} alt="College emblem" width="60" height="60" />
          <div className="sp-ident-copy">
            <small>Kisan Shikshan Prasarak Mandal&apos;s</small>
            <strong>Chhatrapati Shivajiraje Mahavidyalaya, Udgir</strong>
            <small>Affiliated to SRTM University, Nanded · NAAC A+</small>
          </div>
          {onBack && <button type="button" className="sp-back" onClick={onBack}><ArrowLeft size={16} /> Back</button>}
        </div>
      </div>
    )}
    {!embedded && (
      <header className="sph">
        <div className="sph-in">
          <div className="sph-copy">
            <p className="sph-kicker"><Code2 size={14} /> Student Projects</p>
            <h1>Projects built by our students</h1>
            <p className="sph-sub">Final-year, OJT and mini projects, each one live on the internet.</p>
          </div>
          <ul className="sp-counts sph-counts" aria-label="Project counts">
              <li><strong>{live.length}</strong><span>Live</span></li>
              <li><strong>{count("final-year")}</strong><span>Final year</span></li>
              <li><strong>{count("ojt")}</strong><span>OJT</span></li>
              <li><strong>{count("mini")}</strong><span>Mini</span></li>
            </ul>
        </div>
      </header>
    )}
    <main className={`sp-page${embedded ? " is-embedded" : ""}`}>

      <div className="sp-bar">
        <label className="sp-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, student, technology…" aria-label="Search projects" />
        </label>
        {canAdd ? (
          <button type="button" className="sp-btn sp-btn-primary" onClick={() => setForm("new")}><Plus size={15} /> Add project</button>
        ) : role === "student" ? (
          <button type="button" className="sp-btn sp-btn-primary" onClick={onOpenProfile}><Plus size={15} /> Add yours from your profile</button>
        ) : !user ? (
          <button type="button" className="sp-btn sp-btn-primary" onClick={onSignIn}>Sign in to add yours</button>
        ) : null}
      </div>

      {(staff || mine.length > 0) && (
        <div className="sp-tabs" role="tablist">
          <button role="tab" aria-selected={tab === "live"} className={tab === "live" ? "is-on" : ""} onClick={() => setTab("live")}>Live ({live.length})</button>
          {staff && <button role="tab" aria-selected={tab === "review"} className={tab === "review" ? "is-on" : ""} onClick={() => setTab("review")}>Needs review ({pending.length})</button>}
          {mine.length > 0 && <button role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "is-on" : ""} onClick={() => setTab("mine")}>My projects ({mine.length})</button>}
        </div>
      )}

      <div className="sp-filters">
        <label className="sp-select">
          <span className="sp-sr">Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Filter by type">
            <option value="all">All types</option>
            {PROJECT_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </label>
        <label className="sp-select">
          <span className="sp-sr">Stream</span>
          <select value={stream} onChange={(e) => setStream(e.target.value)} aria-label="Filter by stream">
            <option value="all">All streams</option>
            {PROJECT_STREAMS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      </div>

      {notice && <p className="sp-note" role="status"><CheckCircle2 size={15} /> {notice} <button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={13} /></button></p>}
      {error && <p className="sp-err" role="alert">{error}</p>}

      {!projects ? (
        <p className="sp-loading"><Loader2 size={18} className="spin" /> Loading projects…</p>
      ) : shown.length === 0 ? (
        <div className="sp-empty">
          <FolderGit2 size={30} />
          <strong>{source.length === 0 ? (tab === "review" ? "Nothing is waiting for review." : "No projects here yet.") : "No project matches this search."}</strong>
          {source.length === 0 && tab === "live" && <span>{canAdd ? "Add the first project." : "Students will add their projects here soon."}</span>}
        </div>
      ) : (
        <>
          <h2 className="sp-list-title">{tab === "review" ? "Waiting for review" : tab === "mine" ? "My projects" : "Projects"} ({shown.length})</h2>
          <ProjectTable rows={shown} user={user} staff={staff} busyId={busyId} onEdit={(x) => setForm(x)} onDecide={decide} onDelete={remove} />
        </>
      )}

      <p className="sp-foot"><ShieldCheck size={14} /> Project links open websites made by students. The college checks each one before it is listed, but is not responsible for outside websites.</p>

      {form && (
        <ProjectForm
          initial={form === "new" ? null : form}
          user={user}
          onClose={() => setForm(null)}
          onSaved={async (msg) => { setForm(null); setNotice(msg); await load(); if (!staff && form === "new") setTab("mine"); }}
        />
      )}
    </main>
    </div>
  );
}
