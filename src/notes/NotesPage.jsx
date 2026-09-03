import React, { useState, useEffect, useMemo } from "react";
import {
  ArrowLeft, ArrowRight, ChevronRight, GraduationCap, Search, Download,
  NotebookPen, FileText, ImageIcon, Loader2, AlertTriangle, Calendar, User,
} from "lucide-react";

import { NOTE_STREAMS, SEMESTERS, noteStreamById, formatBytes } from "../data/notes.js";
import { fetchNotes } from "../lib/notes.js";
import { downloadUrl } from "../lib/cloudinary.js";
import { isBackendConfigured } from "../lib/firebase.js";

/* ============================================================================
   DyanSetu — Subject-wise notes library

   Students pick their stream, then browse what faculty have uploaded, grouped
   by subject. The search box works across every stream at once, so a student
   who only knows the topic name does not have to guess where it lives.
   ========================================================================== */

function fileIcon(type) {
  if (type?.startsWith("image/")) return ImageIcon;
  return FileText;
}

function timeAgo(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

export default function NotesPage({ onBack }) {
  const [streamId, setStreamId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [semester, setSemester] = useState("All");

  const stream = streamId ? noteStreamById(streamId) : null;

  /* Back returns to the branch list first, and only leaves the notes library
     once there is no selection left to undo. */
  const stepBack = () => {
    if (streamId) { setStreamId(null); setQuery(""); setSemester("All"); return; }
    onBack();
  };

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const all = await fetchNotes();
        if (active) setNotes(all);
      } catch (err) {
        if (active) setError("Could not load the notes library. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [streamId]);

  const term = query.trim().toLowerCase();

  /* A search runs across every stream; without one, results stay inside the
     stream the student picked. */
  const searching = term.length > 0;
  const visible = useMemo(() => {
    let list = notes;
    if (!searching && streamId) list = list.filter((n) => n.streamId === streamId);
    if (semester !== "All") list = list.filter((n) => n.semester === semester);
    if (searching) {
      list = list.filter((n) =>
        `${n.title} ${n.subject} ${n.description} ${n.semester} ${n.author}`.toLowerCase().includes(term));
    }
    return list;
  }, [notes, streamId, semester, term, searching]);

  /* Group into subjects so a long list reads as a syllabus, not a feed. */
  const grouped = useMemo(() => {
    const map = new Map();
    visible.forEach((note) => {
      const key = note.subject || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(note);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [visible]);

  const countFor = (id) => notes.filter((n) => n.streamId === id).length;

  return (
    <main className="resource-page">
      <div className="resource-head">
        <button type="button" className="btn btn-ghost btn-sm" onClick={stepBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="resource-head-copy">
          <p className="section-eyebrow"><NotebookPen size={14} /> Subject-wise Notes</p>
          <h1 className="resource-title">Notes uploaded by your faculty</h1>
          <p className="resource-sub">
            Choose your stream to see what your teachers have shared, or search across every
            stream if you already know the subject or topic.
          </p>
        </div>
      </div>

      {/* Search is always available, even before a stream is chosen. */}
      <div className="resource-toolbar">
        <div className="resource-search">
          <Search size={16} />
          <input
            type="text"
            value={query}
            placeholder="Search notes by subject, topic or teacher"
            aria-label="Search notes"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {(searching || stream) && (
          <div className="chip-row" role="group" aria-label="Filter by semester">
            <button
              type="button"
              className={`chip ${semester === "All" ? "is-active" : ""}`}
              onClick={() => setSemester("All")}
            >
              All semesters
            </button>
            {SEMESTERS.map((s) => (
              <button
                type="button"
                key={s}
                className={`chip ${semester === s ? "is-active" : ""}`}
                onClick={() => setSemester(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="crumbs" aria-label="Breadcrumb">
        <button
          type="button"
          className={`crumb ${!stream || searching ? "is-current" : ""}`}
          onClick={() => { setStreamId(null); setQuery(""); setSemester("All"); }}
        >
          All streams
        </button>
        {stream && !searching && (
          <>
            <ChevronRight size={14} className="crumb-sep" />
            <span className="crumb is-current">{stream.name}</span>
          </>
        )}
        {searching && (
          <>
            <ChevronRight size={14} className="crumb-sep" />
            <span className="crumb is-current">Search results</span>
          </>
        )}
      </nav>

      {!isBackendConfigured && (
        <p className="resource-note">
          <AlertTriangle size={14} />
          The notes library needs the backend configured. See SETUP.md — until then this
          page will stay empty.
        </p>
      )}

      {error && <p className="resource-note"><AlertTriangle size={14} />{error}</p>}

      {loading ? (
        <p className="notes-loading"><Loader2 size={18} className="spin" /> Loading notes…</p>
      ) : (
        <>
          {/* Stage 1 — stream picker */}
          {!stream && !searching && (
            <div className="resource-grid">
              {NOTE_STREAMS.map((item) => {
                const count = countFor(item.id);
                return (
                  <button
                    type="button"
                    className={`resource-card ${count === 0 ? "is-empty-card" : ""}`}
                    key={item.id}
                    onClick={() => setStreamId(item.id)}
                  >
                    <span className="resource-card-icon"><GraduationCap size={20} /></span>
                    <h3>{item.name}</h3>
                    <p className="resource-card-full">{item.full}</p>
                    <p>{item.blurb}</p>
                    <span className="resource-card-meta">
                      {count === 0 ? "No notes yet" : `${count} note${count === 1 ? "" : "s"}`}
                      <ArrowRight size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Stage 2 — the notes themselves */}
          {(stream || searching) && (
            grouped.length === 0 ? (
              <p className="resource-empty">
                {searching
                  ? `No notes match “${query.trim()}”.`
                  : "Your faculty have not uploaded notes for this stream yet."}
              </p>
            ) : (
              <div className="notes-groups">
                {grouped.map(([subject, items]) => (
                  <section className="notes-group" key={subject}>
                    <h2 className="notes-subject">
                      {subject}
                      <span>{items.length} note{items.length === 1 ? "" : "s"}</span>
                    </h2>

                    <div className="notes-list">
                      {items.map((note) => (
                        <article className="note-card" key={note.id}>
                          <div className="note-card-head">
                            <h3>{note.title}</h3>
                            <span className="note-sem">{note.semester}</span>
                          </div>

                          {note.description && <p className="note-desc">{note.description}</p>}

                          <div className="note-meta">
                            <span><User size={13} /> {note.author}</span>
                            <span><Calendar size={13} /> {timeAgo(note.createdAt)}</span>
                            {searching && <span className="note-stream-tag">{noteStreamById(note.streamId)?.name}</span>}
                          </div>

                          <div className="note-files">
                            {note.files.map((file) => {
                              const Icon = fileIcon(file.type);
                              return (
                                <a
                                  key={file.publicId || file.url}
                                  className="note-file"
                                  /* fl_attachment makes Cloudinary send the file
                                     as a download rather than opening a viewer. */
                                  href={downloadUrl(file)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Icon size={15} />
                                  <span className="note-file-name">{file.name}</span>
                                  <span className="note-file-size">{formatBytes(file.size)}</span>
                                  <Download size={14} />
                                </a>
                              );
                            })}
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )
          )}
        </>
      )}
    </main>
  );
}
