import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Code2, Loader2, Plus, X } from "lucide-react";

import { deleteProject, fetchMyProjects, projectDraft } from "../lib/projects.js";
import { ProjectForm, ProjectTable } from "./ProjectsPage.jsx";
import "./projects.css";

/* A student's own projects, shown on their profile. This is where a student
   adds a project: it stays "waiting for review" until a teacher or the
   administrator approves it, then it appears on the public Projects page. */
export default function MyProjectsCard({ user, onOpenAll }) {
  const [list, setList] = useState(null);
  const [form, setFormState] = useState(() => (projectDraft.isOpen() ? "new" : null));
  const setForm = (v) => {
    if (v === "new") projectDraft.open();
    else projectDraft.clear();
    setFormState(v);
  };
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try { setList(await fetchMyProjects(user.id)); setError(""); }
    catch (e) { setError(e.message); setList((l) => l || []); }
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  const remove = async (p) => {
    if (!window.confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
    setBusyId(p.id);
    try { await deleteProject(p.id); await load(); setNotice("Project deleted."); }
    catch (e) { setError(e.message); }
    finally { setBusyId(""); }
  };

  return (
    <section className="card sp-mine" aria-labelledby="sp-mine-title">
      <div className="sp-mine-head">
        <div>
          <h3 id="sp-mine-title"><Code2 size={18} /> My projects</h3>
          <p className="dash-meta">Add your final-year, OJT or mini project with its live link. A teacher or the administrator checks it, then everyone can see it.</p>
        </div>
        <button type="button" className="sp-btn sp-btn-primary" onClick={() => setForm("new")}><Plus size={15} /> Add project</button>
      </div>

      {notice && <p className="sp-note" role="status"><CheckCircle2 size={15} /> {notice} <button type="button" onClick={() => setNotice("")} aria-label="Dismiss"><X size={13} /></button></p>}
      {error && <p className="sp-err" role="alert">{error}</p>}

      {!list ? (
        <p className="sp-loading"><Loader2 size={18} className="spin" /> Loading…</p>
      ) : list.length === 0 ? (
        <p className="sp-mine-empty">You have not added a project yet.</p>
      ) : (
        <ProjectTable rows={list} user={user} staff={false} busyId={busyId} onEdit={setForm} onDecide={() => {}} onDelete={remove} />
      )}
      {onOpenAll && <button type="button" className="sp-btn sp-btn-ghost sp-mine-all" onClick={onOpenAll}>See all student projects</button>}

      {form && (
        <ProjectForm
          initial={form === "new" ? null : form}
          user={user}
          onClose={() => setForm(null)}
          onSaved={async (msg) => { setForm(null); setNotice(msg); await load(); }}
        />
      )}
    </section>
  );
}
