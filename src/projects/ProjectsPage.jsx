import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Check, CheckCircle2, Clock, Code2, ExternalLink, FolderGit2, Github, GraduationCap, ImagePlus, Loader2,
  LayoutGrid, List, Pencil, Plus, Search, ShieldCheck, Trash2, UserCheck, Users, X, XCircle,
} from "lucide-react";
import collegeLogo from "../img/college-logo.jpg";
import ProjectCover from "./ProjectCover.jsx";

import {
  PROJECT_KINDS, PROJECT_CLASSES, PROJECT_STREAMS, projectDraft, addProject, deleteProject, fetchProjects, isHttpsUrl, kindLabel, platformOf,
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
    if (f.repo.trim() && !isHttpsUrl(f.repo)) return setErr("The code link must start with https://.");
    if (!confirm) return setErr("Please tick the confirmation box.");
    setBusy(true);
    try {
      if (editing) await updateProject(initial.id, f, file);
      else await addProject(user, f, file);
      onSaved(editing ? "Changes saved." : staff ? "Project added — it is live now." : "Thanks! Your project was sent. It appears once a teacher or the administrator approves it.");
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

export function ProjectCard({ p, user, staff, onEdit, onDecide, onDelete, busy }) {
  const mine = user && p.ownerId === user.id;
  const platform = platformOf(p.live);
  return (
    <article className={`sp-card${p.status !== "approved" ? " is-dim" : ""}`}>
      <div className="sp-shot">
        {p.image ? <img src={p.image} alt={`Screenshot of ${p.title}`} loading="lazy" /> : <ProjectCover title={p.title} />}
        <span className="sp-kind">{kindLabel(p.kind)}</span>
        <span className="sp-platform">{platform}</span>
      </div>
      <div className="sp-body">
        <StatusTag status={p.status} />
        <h3>{p.title}</h3>
        <p className="sp-desc">{p.description}</p>
        {p.tech.length > 0 && (
          <ul className="sp-tech">{p.tech.slice(0, 6).map((t) => <li key={t}>{t}</li>)}</ul>
        )}
        <ul className="sp-meta">
          <li><Users size={14} /><span>{p.students}</span></li>
          <li><GraduationCap size={14} /><span>{streamLabel(p.stream)}{p.className ? ` · ${p.className}` : ""}{p.year ? ` · ${p.year}` : ""}</span></li>
          {p.guide && <li><UserCheck size={14} /><span>Guide: {p.guide}</span></li>}
        </ul>
        <div className="sp-actions">
          {p.live && (
            <a className="sp-btn sp-btn-primary" href={p.live} target="_blank" rel="noopener noreferrer nofollow ugc">
            <ExternalLink size={14} /> Open project
          </a>
          )}
          {p.repo && (
            <a className="sp-btn sp-btn-ghost" href={p.repo} target="_blank" rel="noopener noreferrer nofollow ugc">
              <Github size={14} /> Code
            </a>
          )}
        </div>
        {(staff || mine) && (
          <div className="sp-manage">
            {staff && p.status !== "approved" && (
              <button type="button" className="sp-chipbtn is-ok" disabled={busy} onClick={() => onDecide(p, "approved")}><Check size={13} /> Approve</button>
            )}
            {staff && p.status === "pending" && (
              <button type="button" className="sp-chipbtn" disabled={busy} onClick={() => onDecide(p, "rejected")}><X size={13} /> Reject</button>
            )}
            {staff && p.status === "approved" && (
              <button type="button" className="sp-chipbtn" disabled={busy} onClick={() => onDecide(p, "rejected")}>Hide</button>
            )}
            <button type="button" className="sp-chipbtn" onClick={() => onEdit(p)}><Pencil size={13} /> Edit</button>
            <button type="button" className="sp-chipbtn is-bad" disabled={busy} onClick={() => onDelete(p)}><Trash2 size={13} /> Delete</button>
          </div>
        )}
      </div>
    </article>
  );
}

const STATUS_DOT = {
  approved: { cls: "is-live", label: "Live" },
  pending: { cls: "is-wait", label: "Awaiting review" },
  rejected: { cls: "is-no", label: "Not approved" },
};

/* The list view: one row per project — thumbnail, title and students, a short
   description, class, type, hosting platform, status and the actions. Rows that
   are waiting or not approved are tinted so they stand out. On a phone each
   row becomes a card. */
export function ProjectTable({ rows, user, staff, busyId, onEdit, onDecide, onDelete }) {
  return (
    <div className="sp-table-wrap">
      <table className="sp-table">
        <thead>
          <tr>
            <th scope="col">Project</th>
            <th scope="col" className="sp-col-about">About</th>
            <th scope="col">Class</th>
            <th scope="col">Type</th>
            <th scope="col">Hosted on</th>
            <th scope="col">Status</th>
            <th scope="col"><span className="sp-sr">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => {
            const mine = user && p.ownerId === user.id;
            const st = STATUS_DOT[p.status] || STATUS_DOT.pending;
            return (
              <tr key={p.id} className={p.status !== "approved" ? `is-${p.status}` : ""}>
                <td className="sp-cell-project" data-label="Project">
                  <span className="sp-thumb">
                    {p.image ? <img src={p.image} alt="" loading="lazy" /> : <ProjectCover title={p.title} size="thumb" />}
                  </span>
                  <span className="sp-cell-text">
                    <strong>{p.title}</strong>
                    <small>{p.students}</small>
                  </span>
                </td>
                <td className="sp-col-about" data-label="About"><span className="sp-clamp">{p.description}</span></td>
                <td data-label="Class">
                  <strong className="sp-sub1">{streamLabel(p.stream)}{p.className ? ` · ${p.className}` : ""}</strong>
                  <small>{p.year}{p.guide ? ` · ${p.guide}` : ""}</small>
                </td>
                <td data-label="Type">
                  <strong className="sp-sub1">{kindLabel(p.kind)}</strong>
                  {p.tech.length > 0 && <small>{p.tech.slice(0, 3).join(", ")}</small>}
                </td>
                <td data-label="Hosted on"><span className="sp-host">{platformOf(p.live)}</span></td>
                <td data-label="Status"><span className={`sp-dotstat ${st.cls}`}>{st.label}</span></td>
                <td className="sp-cell-actions">
                  <span className="sp-rowbtns">
                    {p.live && <a className="sp-pill" href={p.live} target="_blank" rel="noopener noreferrer nofollow ugc" aria-label={`Open ${p.title}`} title="Open project"><ExternalLink size={15} /></a>}
                    {p.repo && (
                      <a className="sp-pill sp-pill--plain" href={p.repo} target="_blank" rel="noopener noreferrer nofollow ugc" aria-label={`Source code of ${p.title}`} title="Source code"><Github size={15} /></a>
                    )}
                    {staff && p.status !== "approved" && (
                      <button type="button" className="sp-pill sp-pill--ok" disabled={busyId === p.id} onClick={() => onDecide(p, "approved")} aria-label={`Approve ${p.title}`} title="Approve"><Check size={15} /></button>
                    )}
                    {staff && p.status === "pending" && (
                      <button type="button" className="sp-pill sp-pill--plain" disabled={busyId === p.id} onClick={() => onDecide(p, "rejected")} aria-label={`Reject ${p.title}`} title="Reject"><X size={15} /></button>
                    )}
                    {staff && p.status === "approved" && (
                      <button type="button" className="sp-pill sp-pill--plain" disabled={busyId === p.id} onClick={() => onDecide(p, "rejected")} aria-label={`Hide ${p.title}`} title="Hide from public list"><XCircle size={15} /></button>
                    )}
                    {(staff || mine) && (
                      <>
                        <button type="button" className="sp-pill" onClick={() => onEdit(p)} aria-label={`Edit ${p.title}`} title="Edit"><Pencil size={15} /></button>
                        <button type="button" className="sp-trash" disabled={busyId === p.id} onClick={() => onDelete(p)} aria-label={`Delete ${p.title}`} title="Delete"><Trash2 size={16} /></button>
                      </>
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  /* A table is for laptops; on a phone the cards read better, so they start as the view. */
  const [layout, setLayout] = useState(() => (window.matchMedia?.("(max-width: 760px)").matches ? "cards" : "list")); /* list | cards */

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
    <main className={`sp-page${embedded ? " is-embedded" : ""}`}>
      {!embedded && (
        <header className="sp-hero">
          <p className="sp-eyebrow"><Code2 size={14} /> Student Projects</p>
          <h1>Projects built by our students</h1>
          <p className="sp-sub">
            Final-year, OJT and mini projects, each one live on the internet. Browse freely, open a project and
            see what our students can build.
          </p>
          <ul className="sp-counts" aria-label="Project counts">
            <li><strong>{live.length}</strong><span>Live projects</span></li>
            <li><strong>{count("final-year")}</strong><span>Final year</span></li>
            <li><strong>{count("ojt")}</strong><span>OJT</span></li>
            <li><strong>{count("mini")}</strong><span>Mini</span></li>
          </ul>
        </header>
      )}

      <div className="sp-bar">
        <label className="sp-search">
          <Search size={15} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, student, technology…" aria-label="Search projects" />
        </label>
        <div className="sp-toggle" role="group" aria-label="View">
          <button type="button" className={layout === "list" ? "is-on" : ""} aria-pressed={layout === "list"} onClick={() => setLayout("list")}><List size={15} /> List</button>
          <button type="button" className={layout === "cards" ? "is-on" : ""} aria-pressed={layout === "cards"} onClick={() => setLayout("cards")}><LayoutGrid size={15} /> Cards</button>
        </div>
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
        <div className="sp-chips" role="group" aria-label="Type">
          {[{ id: "all", short: "All types" }, ...PROJECT_KINDS].map((k) => (
            <button key={k.id} type="button" className={kind === k.id ? "is-on" : ""} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.short}</button>
          ))}
        </div>
        <div className="sp-chips" role="group" aria-label="Stream">
          {[{ id: "all", name: "All streams" }, ...PROJECT_STREAMS].map((s) => (
            <button key={s.id} type="button" className={stream === s.id ? "is-on" : ""} aria-pressed={stream === s.id} onClick={() => setStream(s.id)}>{s.name}</button>
          ))}
        </div>
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
      ) : layout === "list" ? (
        <>
          <h2 className="sp-list-title">{tab === "review" ? "Waiting for review" : tab === "mine" ? "My projects" : "Projects"} ({shown.length})</h2>
          <ProjectTable rows={shown} user={user} staff={staff} busyId={busyId} onEdit={(x) => setForm(x)} onDecide={decide} onDelete={remove} />
        </>
      ) : (
        <div className="sp-grid">
          {shown.map((p) => (
            <ProjectCard key={p.id} p={p} user={user} staff={staff} busy={busyId === p.id}
              onEdit={(x) => setForm(x)} onDecide={decide} onDelete={remove} />
          ))}
        </div>
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
