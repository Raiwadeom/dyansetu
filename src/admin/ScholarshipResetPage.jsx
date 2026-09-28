/* The page the administrator's email link opens (/scholarship-reset?token=…):
   set a new email and password for the scholarship admin account. The server
   (api/scholarship-account.js) checks the one-time link before and on save. */

import React, { useEffect, useState } from "react";
import { CheckCircle2, Coins, Loader2, Lock, Mail } from "lucide-react";

async function call(body) {
  const response = await fetch("/api/scholarship-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await response.json(); } catch { /* handled below */ }
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}

/* Read once when the site loads, before the app rewrites the address bar, so
   the one-time token never stays in the URL or browser history. */
const LINK_TOKEN = window.location.pathname.startsWith("/scholarship-reset")
  ? new URLSearchParams(window.location.search).get("token") || ""
  : "";

export default function ScholarshipResetPage({ onDone }) {
  const token = LINK_TOKEN;
  const [state, setState] = useState("checking"); // checking | ready | bad | done
  const [currentEmail, setCurrentEmail] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState("bad"); setError("This link is incomplete. Open it straight from the email."); return; }
    call({ action: "check", token })
      .then((d) => { setCurrentEmail(d.email || ""); setState("ready"); })
      .catch((e) => { setError(e.message); setState("bad"); });
  }, [token]);

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password || !confirm) { setError("Fill in the new email, the new password and confirm it."); return; }
    if (password !== confirm) { setError("The two passwords do not match."); return; }
    setBusy(true);
    try {
      const d = await call({ action: "complete", token, email: email.trim(), password });
      setCurrentEmail(d.email);
      setState("done");
      /* The link is used up; keep it out of the address bar and history. */
      window.history.replaceState(window.history.state, "", "/scholarship-reset");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-brand-panel" />
      <div className="auth-form-panel">
        <div className="auth-heading">
          <span className="pending-status"><Coins size={14} /> Scholarship admin</span>
          <h2 className="auth-title">Change email and password</h2>
          {state === "ready" && (
            <p className="auth-sub">Current email: <strong>{currentEmail}</strong>. Enter the new email (or the same one) and a new password.</p>
          )}
        </div>

        {state === "checking" && <p className="auth-sub"><Loader2 size={16} className="spin" /> Checking the link…</p>}

        {state === "bad" && (
          <>
            <div className="form-error">{error}</div>
            <button type="button" className="btn btn-primary btn-block" onClick={onDone}>Go to Staff Login</button>
          </>
        )}

        {state === "done" && (
          <>
            <div className="form-success"><CheckCircle2 size={15} /> <span>Saved. The scholarship admin now logs in with <strong>{currentEmail}</strong> and the new password.</span></div>
            <button type="button" className="btn btn-primary btn-block" onClick={onDone}>Go to Staff Login</button>
          </>
        )}

        {state === "ready" && (
          <form onSubmit={save}>
            {error && <div className="form-error">{error}</div>}
            <label className="field">
              <span className="field-label">New email</span>
              <span className="field-input-wrap">
                <Mail size={16} className="field-icon" />
                <input className="field-input" type="email" autoComplete="off" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </span>
            </label>
            <label className="field">
              <span className="field-label">New password</span>
              <span className="field-input-wrap">
                <Lock size={16} className="field-icon" />
                <input className="field-input" type={show ? "text" : "password"} autoComplete="new-password" placeholder="8+ characters, a letter and a number" value={password} onChange={(e) => setPassword(e.target.value)} />
              </span>
            </label>
            <label className="field">
              <span className="field-label">Confirm new password</span>
              <span className="field-input-wrap">
                <Lock size={16} className="field-icon" />
                <input className="field-input" type={show ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter the password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 14px" }}>
              <input className="field-input" type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
            </label>
            <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
              {busy ? <><Loader2 size={16} className="spin" /> Saving…</> : "Save new email and password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
