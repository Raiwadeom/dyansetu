/* ============================================================================
   Admin: Feedback

   Everything visitors send from the "Feedback" section on the landing page:
   questions, feature ideas, bug reports. The administrator can mark each one
   as read or resolved, reply by email when the sender left an address, and
   delete it.
   ========================================================================== */

import React, { useCallback, useEffect, useState } from "react";
import { CheckCheck, Eye, Loader2, Mail, Trash2 } from "lucide-react";

import { deleteFeedback, fetchFeedback, kindName, setFeedbackStatus } from "../lib/feedback.js";
import { useLiveRefresh } from "../lib/liveRefresh.js";
import { PillTabs, StatRow, StatTile } from "./adminKit.jsx";
import "../feedback/feedback.css";

const STATE_LABEL = { new: "New", read: "Read", resolved: "Resolved" };
/* The address is encoded so odd characters can never add mail fields (cc, body…). */
const mailTo = (email) => `mailto:${encodeURIComponent(email).replace(/%40/g, "@")}?subject=${encodeURIComponent("Your message to DnyanSetu")}`;
const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function FeedbackAdminPage() {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState("new");
  const [busyId, setBusyId] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await fetchFeedback();
      setRows((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    } catch (err) {
      setError(err.message);
      setRows((prev) => prev || []);
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useLiveRefresh(load);

  const act = async (id, run) => {
    setBusyId(id);
    setError("");
    try { await run(); setConfirmId(""); await load(); } catch (err) { setError(err.message); } finally { setBusyId(""); }
  };

  const all = rows || [];
  const count = (s) => all.filter((f) => f.status === s).length;
  const shown = filter === "all" ? all : all.filter((f) => f.status === filter);

  return (
    <div className="fba">
      <StatRow>
        <StatTile dark label="New messages" value={count("new")} note="not opened yet" />
        <StatTile label="Read" value={count("read")} note="waiting for action" />
        <StatTile label="Resolved" value={count("resolved")} note="done" />
        <StatTile label="All time" value={all.length} note="since the form went live" />
      </StatRow>

      <div className="fba-tools">
        <PillTabs
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[["new", "New"], ["read", "Read"], ["resolved", "Resolved"], ["all", "All"]]}
        />
      </div>

      {error && <p className="fba-err" role="alert">{error}</p>}

      {rows === null ? (
        <div className="fba-empty"><Loader2 size={18} className="spin" /> Loading…</div>
      ) : shown.length === 0 ? (
        <div className="fba-empty">{filter === "new" ? "No new messages. You are all caught up." : "Nothing here yet."}</div>
      ) : (
        <div className="fba-list">
          {shown.map((f) => {
            const busy = busyId === f.id;
            return (
              <article key={f.id} className={`fba-item${f.status === "new" ? " is-new" : ""}`}>
                <div className="fba-top">
                  <span className={`fba-kind fba-kind--${f.kind}`}>{kindName(f.kind)}</span>
                  <span className={`fba-state fba-state--${f.status}`}>{STATE_LABEL[f.status]}</span>
                  <time className="fba-when" dateTime={f.created_at}>{when(f.created_at)}</time>
                </div>
                <p className="fba-msg">{f.message}</p>
                <div className="fba-from">
                  <strong>{f.name || "Anonymous"}</strong>
                  {f.email ? <a href={mailTo(f.email)}>{f.email}</a> : <span>No email left</span>}
                  {f.user_id && <span>Signed-in user</span>}
                </div>
                <div className="fba-actions">
                  {f.status === "new" && (
                    <button type="button" className="fba-btn" disabled={busy} onClick={() => act(f.id, () => setFeedbackStatus(f.id, "read"))}>
                      <Eye size={15} /> Mark read
                    </button>
                  )}
                  {f.status !== "resolved" && (
                    <button type="button" className="fba-btn" disabled={busy} onClick={() => act(f.id, () => setFeedbackStatus(f.id, "resolved"))}>
                      <CheckCheck size={15} /> Resolved
                    </button>
                  )}
                  {f.status === "resolved" && (
                    <button type="button" className="fba-btn" disabled={busy} onClick={() => act(f.id, () => setFeedbackStatus(f.id, "read"))}>
                      Reopen
                    </button>
                  )}
                  {f.email && (
                    <a className="fba-btn" href={mailTo(f.email)}>
                      <Mail size={15} /> Reply
                    </a>
                  )}
                  {confirmId === f.id ? (
                    <>
                      <button type="button" className="fba-btn" onClick={() => setConfirmId("")} disabled={busy}>Cancel</button>
                      <button type="button" className="fba-btn is-solid" disabled={busy} onClick={() => act(f.id, () => deleteFeedback(f.id))}>
                        {busy ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />} Delete for good
                      </button>
                    </>
                  ) : (
                    <button type="button" className="fba-btn is-danger" disabled={busy} onClick={() => setConfirmId(f.id)}>
                      <Trash2 size={15} /> Delete
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
