/* ============================================================================
   RaktSetu — signed-in screens

   Every rule the database enforces is also explained here in plain words, but
   the database is what decides: an under-18 profile, a fourth request in a day
   or "I can help" during the four-month rest are refused there too.
   ========================================================================== */

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Bell, BellOff, CheckCircle2, Flag, Loader2, Mail, MapPin, Phone, PlusCircle, Trash2,
} from "lucide-react";

import {
  BLOOD_GROUPS, DONATION_GAP_DAYS, GENDERS, HEALTH_CONDITIONS, MAX_DONOR_AGE, MIN_AGE, MIN_WEIGHT_KG,
  adminDismiss, adminRemove, createRequest, deleteMyRaktData, displayGroup, donorBlockers, fetchContact,
  fetchMyRaktProfile,
  fetchRequest, listAllOpenForAdmin, listMyRequests, listMyResponses, listOpenRequests, listReports,
  listResponders, markDonated, nextEligibleDate, reportRequest, respondToRequest, saveMyRaktProfile,
  setRequestStatus, updateMyRaktSettings,
} from "./api.js";
import { currentSubscription, disablePush, enablePush, isPushConfigured, pushSupport } from "./push.js";
import {
  GroupBadge, Link, PaymentWarning, Spinner, StatusBadge, formatDate, formatDateTime, todayIso,
} from "./ui.jsx";

/* ------------------------------------------------------------ form pieces */

function Field({ label, hint, children, required }) {
  return (
    <label className="rs-field">
      <span className="rs-label">{label}{required && <span className="rs-req" aria-hidden="true"> *</span>}</span>
      {children}
      {hint && <span className="rs-hint">{hint}</span>}
    </label>
  );
}

function Check({ checked, onChange, children, required }) {
  return (
    <label className="rs-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} required={required} />
      <span>{children}</span>
    </label>
  );
}

function ErrorBox({ message }) {
  if (!message) return null;
  return <div className="rs-alert rs-alert--error" role="alert"><AlertTriangle size={16} /> {message}</div>;
}

/* ------------------------------------------------------- profile (onboarding) */

export function ProfileForm({ userId, defaultName = "", existing = null, onboarding = false, embedded = false, onSaved }) {
  const [form, setForm] = useState(() => ({
    display_name: existing?.display_name || defaultName || "",
    age: existing?.age ?? "",
    gender: existing?.gender || "",
    weight_kg: existing?.weight_kg ?? "",
    blood_group: existing?.blood_group || "",
    city: existing?.city || "",
    phone: existing?.phone || "",
    last_donation_date: existing?.last_donation_date || "",
    /* Re-confirmed on every save — health changes. */
    health_declared: false,
    notify: existing ? existing.notify_push || existing.notify_email : true,
    consent: Boolean(existing),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const set = (key) => (value) => { setSaved(false); setForm((f) => ({ ...f, [key]: value })); };
  const age = Number(form.age);
  const tooYoung = form.age !== "" && age < MIN_AGE;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!Number.isInteger(age) || age < 1) return setError("Enter your age in years.");
    if (age < MIN_AGE) return setError(`RaktSetu is only for people aged ${MIN_AGE} and over.`);
    if (age > 100) return setError("Enter a valid age.");
    if (!form.gender) return setError("Choose your gender.");
    const weight = Number(form.weight_kg);
    if (!weight || weight < 30 || weight > 250) return setError("Enter your weight in kilograms.");
    if (!form.blood_group) return setError("Choose your blood group, or “Don't know”.");
    if (form.city.trim().length < 2) return setError("Enter your city — it is needed to show and match requests.");
    if (form.phone && form.phone.replace(/\D/g, "").length < 10) return setError("Enter a 10-digit phone number, or leave it blank.");
    if (form.last_donation_date && form.last_donation_date > todayIso()) return setError("The last donation date cannot be in the future.");
    if (!form.consent) return setError("Please give your consent to continue.");

    setSaving(true);
    try {
      const profile = await saveMyRaktProfile(userId, {
        ...form,
        notify_push: form.notify,
        notify_email: form.notify,
      });
      setSaved(true);
      onSaved?.(profile);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const blockers = existing ? donorBlockers(existing) : [];

  const formEl = (
      <form className={embedded ? "rs-form rs-form--embedded" : "rs-card rs-form"} onSubmit={submit} noValidate>
        <div className="rs-age-banner rs-age-banner--compact" role="note">
          <span className="rs-age-badge">{MIN_AGE}+</span>
          <p>RaktSetu is for ages {MIN_AGE} and over. Donors must be {MIN_AGE}–{MAX_DONOR_AGE} and weigh at least {MIN_WEIGHT_KG} kg.</p>
        </div>

        <Field label="Your name" hint="Shown to a requester only if you tap “I can help”.">
          <input type="text" value={form.display_name} maxLength={80} onChange={(e) => set("display_name")(e.target.value)} />
        </Field>

        <div className="rs-grid-2">
          <Field label="Age" required hint="Final eligibility is decided by the blood bank.">
            <input type="number" inputMode="numeric" min={MIN_AGE} max={100} value={form.age} onChange={(e) => set("age")(e.target.value)} required />
          </Field>
          <Field label="Weight (kg)" required hint={`Donors must weigh at least ${MIN_WEIGHT_KG} kg.`}>
            <input type="number" inputMode="decimal" min={30} max={250} step="0.5" value={form.weight_kg} onChange={(e) => set("weight_kg")(e.target.value)} required />
          </Field>
        </div>

        {tooYoung && (
          <div className="rs-alert rs-alert--error" role="alert">
            <strong>RaktSetu is only for people aged {MIN_AGE} and over.</strong> You can keep using the rest
            of DnyanSetu. <a href="/">Back to DnyanSetu</a>
          </div>
        )}

        <div className="rs-grid-2">
          <Field label="Gender" required>
            <select value={form.gender} onChange={(e) => set("gender")(e.target.value)} required>
              <option value="">Choose…</option>
              {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </Field>
          <Field label="Blood group" required>
            <select value={form.blood_group} onChange={(e) => set("blood_group")(e.target.value)} required>
              <option value="">Choose…</option>
              {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{displayGroup(g)}</option>)}
              <option value="unknown">Don&apos;t know</option>
            </select>
          </Field>
        </div>
        {form.blood_group === "unknown" && (
          <p className="rs-hint rs-hint--box">
            You can find out your blood group free of charge when you donate, or with a simple test at any
            blood bank or pathology lab. Update it here afterwards to receive matching email alerts.
          </p>
        )}

        <div className="rs-grid-2">
          <Field label="City" required hint="Used to show and match requests near you.">
            <input type="text" value={form.city} maxLength={60} autoComplete="address-level2" onChange={(e) => set("city")(e.target.value)} required />
          </Field>
          <Field label="Phone (optional)" hint="Only shared with a requester when you choose to respond.">
            <input type="tel" inputMode="tel" value={form.phone} maxLength={20} autoComplete="tel" onChange={(e) => set("phone")(e.target.value)} />
          </Field>
        </div>

        <Field label="Last blood donation (optional)" hint={`After a donation you cannot donate again for 4 months (${DONATION_GAP_DAYS} days). Leave blank if you have never donated.`}>
          <input type="date" value={form.last_donation_date || ""} max={todayIso()} onChange={(e) => set("last_donation_date")(e.target.value)} />
        </Field>

        <fieldset className="rs-fieldset">
          <legend>Health declaration (for donors)</legend>
          <ul className="rs-health-list">
            {HEALTH_CONDITIONS.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <Check checked={form.health_declared} onChange={set("health_declared")}>
            All of the statements above are true for me today. <span className="rs-muted">(Leave unticked if not — you can still post requests, but you will not be asked to donate.)</span>
          </Check>
        </fieldset>

        <Check checked={form.notify} onChange={set("notify")}>
          Notify me about blood requests (browser notifications for my city, and email when my blood group matches).
        </Check>

        <Check checked={form.consent} onChange={set("consent")} required>
          I am {MIN_AGE} or older, and I consent to DnyanSetu storing my age, gender, weight, blood group, city,
          health declaration and optional phone number to run RaktSetu, as described in the{" "}
          <a href="/terms#raktsetu" target="_blank" rel="noreferrer">RaktSetu terms</a> and{" "}
          <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>. I can delete this data at any time.
        </Check>

        <ErrorBox message={error} />
        {saved && !onboarding && <div className="rs-alert rs-alert--ok"><CheckCircle2 size={16} /> Profile saved.</div>}

        <button type="submit" className="rs-btn rs-btn-primary rs-btn-block" disabled={saving || tooYoung}>
          {saving ? <><Loader2 size={16} className="rs-spin" /> Saving…</> : onboarding ? "Save and continue" : "Save changes"}
        </button>
      </form>
  );

  if (embedded) return formEl;

  return (
    <section className="rs-section rs-narrow">
      <h1 className="rs-page-title">{onboarding ? "Set up your RaktSetu profile" : "My RaktSetu profile"}</h1>
      <p className="rs-lead">
        {onboarding
          ? "A few details so requests can be shown and matched near you. This is needed once, before anything else."
          : "Keep this up to date — it decides which requests you are alerted to."}
      </p>

      {!onboarding && blockers.length > 0 && (
        <div className="rs-alert">
          <strong>You cannot volunteer to donate right now:</strong>
          <ul>{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
          You can still post requests for someone else.
        </div>
      )}

      {formEl}
    </section>
  );
}

/* ------------------------------------------------------------ push prompt */

function PushPrompt({ navigate }) {
  const [state, setState] = useState("checking");

  useEffect(() => {
    let active = true;
    const support = pushSupport();
    if (!support.supported || !isPushConfigured) { setState("hidden"); return undefined; }
    currentSubscription().then((sub) => { if (active) setState(sub ? "hidden" : "show"); }).catch(() => setState("hidden"));
    return () => { active = false; };
  }, []);

  if (state !== "show") return null;
  return (
    <div className="rs-card rs-push-prompt">
      <Bell size={20} />
      <div>
        <strong>Get alerts for requests in your city</strong>
        <p className="rs-muted">Turn on notifications for this browser so you hear about urgent requests even when this tab is closed.</p>
      </div>
      <Link to="/raktsetu/settings" navigate={navigate} className="rs-btn rs-btn-primary rs-btn-sm">Turn on alerts</Link>
    </div>
  );
}

/* --------------------------------------------------------- requests list */

function RequestCard({ request, navigate }) {
  return (
    <Link to={`/raktsetu/requests/${request.id}`} navigate={navigate} className="rs-card rs-request-card">
      <GroupBadge group={request.blood_group} large />
      <div className="rs-request-body">
        <div className="rs-request-top">
          <strong>{request.units} unit{request.units === 1 ? "" : "s"} needed</strong>
          <StatusBadge status={request.status} />
        </div>
        <p className="rs-request-where"><MapPin size={14} /> {request.hospital}, {request.city}</p>
        <p className="rs-muted">Needed by {formatDateTime(request.needed_by)}</p>
      </div>
    </Link>
  );
}

export function RequestsPage({ navigate, profile }) {
  const [group, setGroup] = useState("");
  const [city, setCity] = useState(profile.city || "");
  const [state, setState] = useState({ loading: true, rows: [], error: "" });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      setState({ loading: false, rows: await listOpenRequests({ bloodGroup: group, city }), error: "" });
    } catch (error) {
      setState({ loading: false, rows: [], error: error.message });
    }
  }, [group, city]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <section className="rs-section">
      <div className="rs-page-head">
        <h1 className="rs-page-title">Open blood requests</h1>
        <Link to="/raktsetu/new" navigate={navigate} className="rs-btn rs-btn-primary rs-btn-sm"><PlusCircle size={15} /> Request blood</Link>
      </div>
      <PaymentWarning />
      <PushPrompt navigate={navigate} />

      <div className="rs-filters">
        <Field label="Blood group">
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">All groups</option>
            {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{displayGroup(g)}</option>)}
          </select>
        </Field>
        <Field label="City">
          <input type="search" value={city} placeholder="Any city" onChange={(e) => setCity(e.target.value)} />
        </Field>
      </div>

      <ErrorBox message={state.error} />
      {state.loading ? <Spinner /> : state.rows.length === 0 ? (
        <div className="rs-empty">
          No open requests{group ? ` for ${displayGroup(group)}` : ""}{city ? ` in “${city}”` : ""} right now.
          {city && <> <button type="button" className="rs-linkbtn" onClick={() => setCity("")}>Show all cities</button></>}
        </div>
      ) : (
        <div className="rs-request-list">
          {state.rows.map((r) => <RequestCard key={r.id} request={r} navigate={navigate} />)}
        </div>
      )}
    </section>
  );
}

/* ---------------------------------------------------------- request detail */

function ReportForm({ requestId, userId }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState({ busy: false, done: false, error: "" });

  if (state.done) return <p className="rs-alert rs-alert--ok"><CheckCircle2 size={16} /> Thank you — the moderator will review this request.</p>;
  if (!open) {
    return (
      <button type="button" className="rs-linkbtn rs-report-link" onClick={() => setOpen(true)}>
        <Flag size={14} /> Report this request
      </button>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    if (reason.trim().length < 3) return setState({ busy: false, done: false, error: "Tell us briefly what is wrong." });
    setState({ busy: true, done: false, error: "" });
    try {
      await reportRequest(requestId, userId, reason);
      setState({ busy: false, done: true, error: "" });
    } catch (error) {
      setState({ busy: false, done: false, error: error.message });
    }
  };

  return (
    <form className="rs-card rs-form" onSubmit={submit}>
      <Field label="What is wrong with this request?" hint="For example: asks for money, fake details, spam, duplicate.">
        <textarea rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <ErrorBox message={state.error} />
      <div className="rs-actions">
        <button type="submit" className="rs-btn rs-btn-danger rs-btn-sm" disabled={state.busy}>Send report</button>
        <button type="button" className="rs-btn rs-btn-ghost rs-btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

function Responders({ requestId }) {
  const [state, setState] = useState({ loading: true, rows: [], error: "" });
  useEffect(() => {
    listResponders(requestId)
      .then((rows) => setState({ loading: false, rows, error: "" }))
      .catch((error) => setState({ loading: false, rows: [], error: error.message }));
  }, [requestId]);

  if (state.loading) return <Spinner label="Loading responses…" />;
  return (
    <div className="rs-card">
      <h2 className="rs-card-title">People who offered to help ({state.rows.length})</h2>
      <ErrorBox message={state.error} />
      {state.rows.length === 0 ? (
        <p className="rs-muted">No one has responded yet. Alerts have gone to volunteers in this city; check back soon.</p>
      ) : (
        <ul className="rs-responders">
          {state.rows.map((r, i) => (
            <li key={i}>
              <div>
                <strong>{r.responder_name}</strong> <GroupBadge group={r.blood_group} /> <span className="rs-muted">{r.city}</span>
                <div className="rs-muted">Responded {formatDateTime(r.responded_at)}{r.donated_at ? ` · donated ${formatDate(r.donated_at)}` : ""}</div>
              </div>
              {r.phone ? <a className="rs-btn rs-btn-ghost rs-btn-sm" href={`tel:${r.phone}`}><Phone size={14} /> {r.phone}</a> : <span className="rs-muted">No phone shared</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RequestDetailPage({ id, navigate, userId, profile }) {
  const [state, setState] = useState({ loading: true, request: null, contact: "", error: "" });
  const [action, setAction] = useState({ busy: false, error: "" });

  const load = useCallback(async () => {
    try {
      const request = await fetchRequest(id);
      /* Only the requester or someone who already responded gets a phone back. */
      const contact = request ? await fetchContact(id).catch(() => "") : "";
      setState({ loading: false, request, contact, error: "" });
    } catch (error) {
      setState({ loading: false, request: null, contact: "", error: error.message });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorBox message={state.error} />;
  const r = state.request;
  if (!r) {
    return (
      <div className="rs-empty">
        This request is closed or no longer available. <Link to="/raktsetu/requests" navigate={navigate}>See open requests</Link>
      </div>
    );
  }

  const mine = r.requester_id === userId;
  const isOpen = r.status === "open" && new Date(r.needed_by) > new Date();
  const blockers = donorBlockers(profile);

  const help = async () => {
    setAction({ busy: true, error: "" });
    try {
      const result = await respondToRequest(id);
      setState((s) => ({ ...s, contact: result?.contact_phone || "" }));
      setAction({ busy: false, error: "" });
    } catch (error) {
      setAction({ busy: false, error: error.message });
    }
  };

  const close = async (status) => {
    setAction({ busy: true, error: "" });
    try {
      await setRequestStatus(id, status);
      await load();
      setAction({ busy: false, error: "" });
    } catch (error) {
      setAction({ busy: false, error: error.message });
    }
  };

  return (
    <section className="rs-section rs-narrow">
      <Link to="/raktsetu/requests" navigate={navigate} className="rs-crumb">← All requests</Link>

      <article className="rs-card rs-detail">
        <div className="rs-detail-head">
          <GroupBadge group={r.blood_group} large />
          <div>
            <h1 className="rs-page-title">Blood needed: {displayGroup(r.blood_group)} — {r.units} unit{r.units === 1 ? "" : "s"}</h1>
            <StatusBadge status={r.status} />
          </div>
        </div>

        <dl className="rs-dl">
          <dt>Patient / requester</dt><dd>{r.patient_name}</dd>
          <dt>Hospital / blood bank</dt><dd>{r.hospital}</dd>
          <dt>Address</dt><dd>{r.address}</dd>
          <dt>City</dt><dd>{r.city}</dd>
          <dt>Needed by</dt><dd>{formatDateTime(r.needed_by)}</dd>
          {r.note && (<><dt>Note</dt><dd>{r.note}</dd></>)}
          <dt>Posted</dt><dd>{formatDateTime(r.created_at)}</dd>
        </dl>

        <PaymentWarning />

        {state.contact && !mine && (
          <div className="rs-contact">
            <p>Thank you for offering to help. Contact the family directly and go to the hospital or blood bank named above:</p>
            <a className="rs-btn rs-btn-primary" href={`tel:${state.contact}`}><Phone size={16} /> Call {state.contact}</a>
            <p className="rs-muted">After you donate, record it under <Link to="/raktsetu/activity" navigate={navigate}>My activity</Link> to start your 4-month rest.</p>
          </div>
        )}

        {!mine && isOpen && !state.contact && (
          blockers.length ? (
            <div className="rs-alert">
              <strong>You cannot volunteer for this right now:</strong>
              <ul>{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
              You can still share this request with someone who can help.
            </div>
          ) : (
            <div className="rs-help">
              <button type="button" className="rs-btn rs-btn-primary rs-btn-block" onClick={help} disabled={action.busy}>
                {action.busy ? <Loader2 size={16} className="rs-spin" /> : "I can help"}
              </button>
              <p className="rs-muted">
                This records that you offered and shows you the requester’s phone. If you added a phone to
                your profile, they can see it too.
              </p>
            </div>
          )
        )}

        {mine && (
          <div className="rs-owner">
            <p className="rs-muted">Your contact number: <strong>{state.contact}</strong> (shown only to people who tap “I can help”).</p>
            {r.status === "open" && (
              <div className="rs-actions">
                <button type="button" className="rs-btn rs-btn-primary rs-btn-sm" onClick={() => close("fulfilled")} disabled={action.busy}>Mark fulfilled</button>
                <button type="button" className="rs-btn rs-btn-ghost rs-btn-sm" onClick={() => close("cancelled")} disabled={action.busy}>Cancel request</button>
              </div>
            )}
          </div>
        )}

        <ErrorBox message={action.error} />
        {!mine && <ReportForm requestId={id} userId={userId} />}
      </article>

      {mine && <Responders requestId={id} />}
    </section>
  );
}

/* -------------------------------------------------------------- new request */

function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function NewRequestPage({ navigate, profile }) {
  const [form, setForm] = useState({
    patientName: "", bloodGroup: "", units: 1, hospital: "", address: "",
    city: profile.city || "", contactPhone: profile.phone || "", neededBy: "", note: "", genuine: false,
  });
  const [state, setState] = useState({ busy: false, error: "", result: null });
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.genuine) return setState({ busy: false, error: "Please confirm this request is genuine.", result: null });
    setState({ busy: true, error: "", result: null });
    try {
      const result = await createRequest({
        ...form,
        units: Number(form.units),
        neededBy: form.neededBy ? new Date(form.neededBy).toISOString() : "",
      });
      setState({ busy: false, error: "", result });
    } catch (error) {
      setState({ busy: false, error: error.message, result: null });
    }
  };

  if (state.result) {
    const { push, email } = state.result;
    return (
      <section className="rs-section rs-narrow">
        <div className="rs-card rs-success">
          <CheckCircle2 size={28} />
          <h1 className="rs-page-title">Request posted</h1>
          <p>
            Alerts sent: {push.sent} browser notification{push.sent === 1 ? "" : "s"} and {email.sent} email{email.sent === 1 ? "" : "s"} to
            matching donors.
            {email.limitHit && " Today’s email limit was reached, so some matching donors were notified by browser alert only."}
          </p>
          <p className="rs-muted">
            Volunteers who tap “I can help” will see your phone number and can call you. Alerts are fast but not
            guaranteed — please also contact the hospital’s blood bank directly.
          </p>
          <div className="rs-actions">
            <Link to={`/raktsetu/requests/${state.result.id}`} navigate={navigate} className="rs-btn rs-btn-primary">View your request</Link>
            <Link to="/raktsetu/activity" navigate={navigate} className="rs-btn rs-btn-ghost">My activity</Link>
          </div>
        </div>
      </section>
    );
  }

  const minNeededBy = toLocalInput(new Date(Date.now() + 5 * 60 * 1000));

  return (
    <section className="rs-section rs-narrow">
      <h1 className="rs-page-title">Request blood</h1>
      <p className="rs-lead">Volunteers in this city get a browser alert; donors whose blood group matches exactly also get an email. Your phone number is never included in alerts.</p>
      <PaymentWarning />

      <form className="rs-card rs-form" onSubmit={submit}>
        <Field label="Patient / requester name" required>
          <input type="text" maxLength={80} value={form.patientName} onChange={(e) => set("patientName")(e.target.value)} required />
        </Field>
        <div className="rs-grid-2">
          <Field label="Blood group needed" required>
            <select value={form.bloodGroup} onChange={(e) => set("bloodGroup")(e.target.value)} required>
              <option value="">Choose…</option>
              {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{displayGroup(g)}</option>)}
            </select>
          </Field>
          <Field label="Units needed" required>
            <input type="number" inputMode="numeric" min={1} max={10} value={form.units} onChange={(e) => set("units")(e.target.value)} required />
          </Field>
        </div>
        <Field label="Hospital / blood bank name" required>
          <input type="text" maxLength={120} value={form.hospital} onChange={(e) => set("hospital")(e.target.value)} required />
        </Field>
        <Field label="Full address" required>
          <textarea rows={2} maxLength={300} value={form.address} onChange={(e) => set("address")(e.target.value)} required />
        </Field>
        <div className="rs-grid-2">
          <Field label="City" required>
            <input type="text" maxLength={60} value={form.city} onChange={(e) => set("city")(e.target.value)} required />
          </Field>
          <Field label="Contact phone" required hint="Shown only to volunteers who tap “I can help”.">
            <input type="tel" inputMode="tel" maxLength={20} value={form.contactPhone} onChange={(e) => set("contactPhone")(e.target.value)} required />
          </Field>
        </div>
        <Field label="Needed by" required hint="The request closes automatically after this time.">
          <input type="datetime-local" min={minNeededBy} value={form.neededBy} onChange={(e) => set("neededBy")(e.target.value)} required />
        </Field>
        <Field label="Note (optional)" hint="Anything a donor should know. Do not include bank details or payment requests.">
          <textarea rows={3} maxLength={500} value={form.note} onChange={(e) => set("note")(e.target.value)} />
        </Field>
        <Check checked={form.genuine} onChange={set("genuine")} required>
          I confirm this request is genuine. I understand that fake, spam or paid requests will be removed and may
          get my account restricted. You can post at most 3 requests in 24 hours.
        </Check>

        <ErrorBox message={state.error} />
        <button type="submit" className="rs-btn rs-btn-primary rs-btn-block" disabled={state.busy || !form.genuine}>
          {state.busy ? <><Loader2 size={16} className="rs-spin" /> Posting and sending alerts…</> : "Post request"}
        </button>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------ my activity */

function DonatedForm({ requestId, onDone }) {
  const [date, setDate] = useState(todayIso());
  const [state, setState] = useState({ busy: false, error: "" });
  const submit = async (e) => {
    e.preventDefault();
    setState({ busy: true, error: "" });
    try {
      await markDonated(requestId, date);
      onDone();
    } catch (error) {
      setState({ busy: false, error: error.message });
    }
  };
  return (
    <form className="rs-inline-form" onSubmit={submit}>
      <label className="rs-muted" htmlFor={`don-${requestId}`}>I donated on</label>
      <input id={`don-${requestId}`} type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
      <button type="submit" className="rs-btn rs-btn-ghost rs-btn-sm" disabled={state.busy}>Record</button>
      {state.error && <span className="rs-error-text">{state.error}</span>}
    </form>
  );
}

export function ActivityPage({ navigate, userId, profile, setProfile }) {
  const [state, setState] = useState({ loading: true, posted: [], responded: [], error: "" });

  const load = useCallback(async () => {
    try {
      const [posted, responded] = await Promise.all([listMyRequests(userId), listMyResponses(userId)]);
      setState({ loading: false, posted, responded, error: "" });
    } catch (error) {
      setState({ loading: false, posted: [], responded: [], error: error.message });
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const next = nextEligibleDate(profile);

  return (
    <section className="rs-section">
      <h1 className="rs-page-title">My activity</h1>
      {next && next > new Date() && (
        <div className="rs-alert">
          You last donated on {formatDate(profile.last_donation_date)}. Thank you! You can donate again from{" "}
          <strong>{formatDate(next.toISOString())}</strong>. Until then you will not be matched for donations.
        </div>
      )}
      <ErrorBox message={state.error} />
      {state.loading ? <Spinner /> : (
        <div className="rs-grid-2 rs-grid-2--wide">
          <div>
            <h2 className="rs-card-title">Requests I posted</h2>
            {state.posted.length === 0 ? <p className="rs-empty">You have not posted any requests.</p> : (
              <div className="rs-request-list">
                {state.posted.map((r) => <RequestCard key={r.id} request={r} navigate={navigate} />)}
              </div>
            )}
          </div>
          <div>
            <h2 className="rs-card-title">Requests I responded to</h2>
            {state.responded.length === 0 ? <p className="rs-empty">You have not responded to any requests yet.</p> : (
              <div className="rs-request-list">
                {state.responded.map((x) => (
                  <div key={x.request_id} className="rs-stack">
                    <RequestCard request={x.request} navigate={navigate} />
                    {x.donated_at ? (
                      <p className="rs-muted rs-donated"><CheckCircle2 size={14} /> You donated on {formatDate(x.donated_at)}</p>
                    ) : (
                      <DonatedForm
                        requestId={x.request_id}
                        onDone={async () => {
                          await load();
                          setProfile(await fetchMyRaktProfile(userId));
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

/* --------------------------------------------------------------- settings */

export function SettingsPage({ profile, setProfile, clearProfile, userId, navigate }) {
  const support = pushSupport();
  const [browserOn, setBrowserOn] = useState(null);
  const [state, setState] = useState({ busy: false, error: "", ok: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    currentSubscription().then((sub) => setBrowserOn(Boolean(sub))).catch(() => setBrowserOn(false));
  }, []);

  const run = async (fn, ok) => {
    setState({ busy: true, error: "", ok: "" });
    try {
      await fn();
      setState({ busy: false, error: "", ok });
    } catch (error) {
      setState({ busy: false, error: error.message, ok: "" });
    }
  };

  const toggleBrowser = () => run(async () => {
    if (browserOn) {
      await disablePush();
      setBrowserOn(false);
    } else {
      await enablePush();
      setBrowserOn(true);
      setProfile({ ...profile, notify_push: true });
    }
  }, browserOn ? "Notifications turned off for this browser." : "Notifications are on for this browser.");

  const toggle = (key) => run(async () => {
    setProfile(await updateMyRaktSettings(userId, { [key]: !profile[key] }));
  }, "Saved.");

  const remove = () => run(async () => {
    await disablePush().catch(() => {});
    await deleteMyRaktData();
    clearProfile();
    navigate("/raktsetu", { replace: true });
  }, "");

  return (
    <section className="rs-section rs-narrow">
      <h1 className="rs-page-title">Alerts and data</h1>

      <div className="rs-card rs-setting">
        <div>
          <h2 className="rs-card-title">{browserOn ? <Bell size={17} /> : <BellOff size={17} />} Notifications in this browser</h2>
          <p className="rs-muted">
            Alerts for new requests in <strong>{profile.city}</strong>{profile.notify_all_cities ? " and every other city" : ""}.
            Alerts keep arriving after you close the tab or sign out, until you turn them off here.
          </p>
          {!support.supported && <p className="rs-hint rs-hint--box">This browser does not support notifications. Try Chrome, Edge or Firefox.</p>}
          {support.needsHomeScreen && (
            <p className="rs-hint rs-hint--box">
              <strong>On iPhone or iPad:</strong> alerts only work after you add this site to your Home Screen
              (iOS 16.4 or later). Tap the Share button, choose <em>Add to Home Screen</em>, open DnyanSetu from
              the new icon, go to RaktSetu → Alerts, and turn notifications on there.
            </p>
          )}
          {support.permission === "denied" && (
            <p className="rs-hint rs-hint--box">Notifications are blocked for this site. Allow them from the lock icon next to the address bar, then try again.</p>
          )}
          <p className="rs-hint">
            Some phones (for example Xiaomi, Oppo, Vivo) delay browser notifications to save battery, and clearing
            browser data removes them. Treat alerts as fast but not guaranteed.
          </p>
        </div>
        <button
          type="button"
          className={`rs-btn ${browserOn ? "rs-btn-ghost" : "rs-btn-primary"}`}
          onClick={toggleBrowser}
          disabled={state.busy || browserOn === null || !support.supported || (!browserOn && support.needsHomeScreen)}
        >
          {browserOn ? "Turn off" : "Turn on"}
        </button>
      </div>

      <div className="rs-card rs-setting">
        <div>
          <h2 className="rs-card-title"><MapPin size={17} /> Alerts from all cities</h2>
          <p className="rs-muted">Off: only requests in your city. On: requests anywhere.</p>
        </div>
        <button type="button" className="rs-btn rs-btn-ghost" onClick={() => toggle("notify_all_cities")} disabled={state.busy} aria-pressed={profile.notify_all_cities}>
          {profile.notify_all_cities ? "On — turn off" : "Off — turn on"}
        </button>
      </div>

      <div className="rs-card rs-setting">
        <div>
          <h2 className="rs-card-title"><Mail size={17} /> Email alerts</h2>
          <p className="rs-muted">
            Sent only when a request needs exactly your blood group ({displayGroup(profile.blood_group)}) and you are
            eligible to donate. {profile.blood_group === "unknown" && "Set your blood group on your profile to receive these."}
          </p>
        </div>
        <button type="button" className="rs-btn rs-btn-ghost" onClick={() => toggle("notify_email")} disabled={state.busy} aria-pressed={profile.notify_email}>
          {profile.notify_email ? "On — turn off" : "Off — turn on"}
        </button>
      </div>

      <div className="rs-card rs-setting">
        <div>
          <h2 className="rs-card-title"><Bell size={17} /> Push alerts on all my devices</h2>
          <p className="rs-muted">Pauses browser alerts everywhere without removing each browser.</p>
        </div>
        <button type="button" className="rs-btn rs-btn-ghost" onClick={() => toggle("notify_push")} disabled={state.busy} aria-pressed={profile.notify_push}>
          {profile.notify_push ? "On — pause" : "Paused — resume"}
        </button>
      </div>

      <ErrorBox message={state.error} />
      {state.ok && <div className="rs-alert rs-alert--ok"><CheckCircle2 size={16} /> {state.ok}</div>}

      <div className="rs-card rs-danger-zone">
        <h2 className="rs-card-title"><Trash2 size={17} /> Delete my RaktSetu data</h2>
        <p className="rs-muted">
          Permanently deletes your RaktSetu profile (age, gender, weight, blood group, city, phone, health
          declaration), your alert subscriptions, your responses and reports, and the requests you posted.
          Your DnyanSetu account is not affected.
        </p>
        {confirmDelete ? (
          <div className="rs-actions">
            <button type="button" className="rs-btn rs-btn-danger" onClick={remove} disabled={state.busy}>Yes, delete everything</button>
            <button type="button" className="rs-btn rs-btn-ghost" onClick={() => setConfirmDelete(false)}>Keep my data</button>
          </div>
        ) : (
          <button type="button" className="rs-btn rs-btn-danger-ghost" onClick={() => setConfirmDelete(true)}>Delete my RaktSetu data</button>
        )}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------- admin moderation */

export function AdminPage({ navigate }) {
  const [state, setState] = useState({ loading: true, reports: [], open: [], error: "" });
  const [reasons, setReasons] = useState({});

  const load = useCallback(async () => {
    try {
      const [reports, open] = await Promise.all([listReports(), listAllOpenForAdmin()]);
      setState({ loading: false, reports, open, error: "" });
    } catch (error) {
      setState({ loading: false, reports: [], open: [], error: error.message });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    try {
      await fn();
      await load();
    } catch (error) {
      setState((s) => ({ ...s, error: error.message }));
    }
  };

  const removeRow = (r) => (
    <div className="rs-inline-form">
      <input
        type="text"
        placeholder="Reason (e.g. asks for money)"
        value={reasons[r.id] || ""}
        onChange={(e) => setReasons((x) => ({ ...x, [r.id]: e.target.value }))}
        aria-label="Reason for removal"
      />
      <button type="button" className="rs-btn rs-btn-danger rs-btn-sm" onClick={() => act(() => adminRemove(r.id, reasons[r.id] || "Removed by moderator"))}>
        Remove
      </button>
    </div>
  );

  return (
    <section className="rs-section">
      <h1 className="rs-page-title">Moderation</h1>
      <p className="rs-lead">Remove fake, spam or paid requests. To stop someone posting again, restrict their account from the DnyanSetu admin desk.</p>
      <ErrorBox message={state.error} />
      {state.loading ? <Spinner /> : (
        <>
          <h2 className="rs-card-title">Reported requests ({state.reports.length})</h2>
          {state.reports.length === 0 ? <p className="rs-empty">No open reports.</p> : state.reports.map(({ request, reasons: rs }) => (
            <div key={request.id} className="rs-card rs-mod-row">
              <RequestCard request={request} navigate={navigate} />
              <ul className="rs-report-reasons">{rs.map((x) => <li key={x.id}>“{x.reason}” <span className="rs-muted">— {formatDateTime(x.created_at)}</span></li>)}</ul>
              <div className="rs-actions">
                {request.status === "open" && removeRow(request)}
                <button type="button" className="rs-btn rs-btn-ghost rs-btn-sm" onClick={() => act(() => adminDismiss(request.id))}>Dismiss reports</button>
              </div>
            </div>
          ))}

          <h2 className="rs-card-title">All open requests ({state.open.length})</h2>
          {state.open.map((r) => (
            <div key={r.id} className="rs-card rs-mod-row">
              <RequestCard request={r} navigate={navigate} />
              {removeRow(r)}
            </div>
          ))}
        </>
      )}
    </section>
  );
}

/* ------------------------------------------------------------ profile page */

const GENDER_LABEL = Object.fromEntries(GENDERS.map((g) => [g.value, g.label]));

function InfoGrid({ rows }) {
  return (
    <dl className="rs-info-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProfileCard({ kicker, title, tone, action, children }) {
  return (
    <section className={`rs-profile-card rs-tone-${tone}`}>
      <div className="rs-profile-card-head">
        <div>
          <span className="rs-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/* The RaktSetu profile, laid out like the DnyanSetu user profile: a header
   card with cover, photo and badges, then one card per topic. "Edit profile"
   swaps in the same form used for onboarding. */
export function ProfilePage({ userId, base, profile, setProfile, navigate }) {
  const [editing, setEditing] = useState(false);
  const name = profile.display_name || base?.name || "RaktSetu member";
  const initials = name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const blockers = donorBlockers(profile);
  const eligible = blockers.length === 0;
  const next = nextEligibleDate(profile);
  const role = base?.role === "faculty" ? "Faculty" : base?.role === "admin" ? "Administrator" : "Student";

  if (editing) {
    return (
      <div className="rs-profile-page">
        <ProfileCard
          kicker="EDIT"
          title="Update RaktSetu profile"
          tone={3}
          action={<button type="button" className="rs-btn rs-btn-ghost rs-btn-sm" onClick={() => setEditing(false)}>Cancel</button>}
        >
          <ProfileForm
            userId={userId}
            defaultName={base?.name}
            existing={profile}
            embedded
            onSaved={(saved) => { setProfile(saved); setEditing(false); window.scrollTo(0, 0); }}
          />
        </ProfileCard>
      </div>
    );
  }

  return (
    <div className="rs-profile-page">
      <section className="rs-profile-header">
        <div className="rs-profile-cover" aria-hidden="true">
          <div className="rs-profile-cover-pattern" />
        </div>
        <div className="rs-profile-header-content">
          <div className="rs-profile-avatar-wrap">
            {base?.pfp
              ? <img className="rs-profile-avatar" src={base.pfp} alt="" />
              : <div className="rs-profile-avatar rs-profile-avatar-initials">{initials || "RS"}</div>}
            <span className="rs-profile-group-dot" title={`Blood group ${displayGroup(profile.blood_group)}`}>
              {displayGroup(profile.blood_group) === "Don't know" ? "?" : displayGroup(profile.blood_group)}
            </span>
          </div>

          <div className="rs-profile-main">
            <div className="rs-profile-name-line">
              <h1>{name}</h1>
              <span className={`rs-profile-status ${eligible ? "is-eligible" : "is-paused"}`}>
                {eligible ? <><CheckCircle2 size={14} /> Eligible donor</> : <><AlertTriangle size={14} /> Not donating right now</>}
              </span>
            </div>
            <p className="rs-profile-headline">RaktSetu volunteer · {role}</p>
            <p className="rs-profile-location"><MapPin size={14} /> {profile.city}</p>

            <div className="rs-profile-metrics">
              <span><strong>{displayGroup(profile.blood_group)}</strong> blood group</span>
              <span><strong>{profile.age}</strong> years</span>
              <span><strong>{Number(profile.weight_kg)}</strong> kg</span>
              <span>{GENDER_LABEL[profile.gender] || "—"}</span>
            </div>

            <div className="rs-profile-actions">
              <button type="button" className="rs-btn rs-btn-primary" onClick={() => setEditing(true)}>Edit profile</button>
              <Link to="/raktsetu/settings" navigate={navigate} className="rs-btn rs-btn-ghost">Alert settings</Link>
            </div>
          </div>
        </div>
      </section>

      {!eligible && (
        <div className="rs-alert">
          <strong>You cannot volunteer to donate right now:</strong>
          <ul>{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
          You can still post requests for someone else.
        </div>
      )}

      <div className="rs-profile-grid">
        <ProfileCard kicker="DONOR" title="Donor details" tone={1}>
          <InfoGrid rows={[
            ["Blood group", displayGroup(profile.blood_group)],
            ["Age", `${profile.age} years`],
            ["Weight", `${Number(profile.weight_kg)} kg`],
            ["Gender", GENDER_LABEL[profile.gender] || "—"],
          ]} />
          {profile.blood_group === "unknown" && (
            <p className="rs-hint rs-hint--box">Find out your blood group at any blood bank or lab, then update it here to receive matching email alerts.</p>
          )}
        </ProfileCard>

        <ProfileCard kicker="CONTACT" title="Location & contact" tone={3}>
          <InfoGrid rows={[
            ["City", profile.city],
            ["Phone", profile.phone || "Not added"],
          ]} />
          <p className="rs-muted">Your phone is shared with a requester only when you tap “I can help”.</p>
        </ProfileCard>

        <ProfileCard kicker="DONATION" title="Donation history" tone={2}>
          <InfoGrid rows={[
            ["Last donation", profile.last_donation_date ? formatDate(profile.last_donation_date) : "Never recorded"],
            ["Can donate again", next && next > new Date() ? formatDate(next.toISOString()) : "Now"],
          ]} />
          <p className="rs-muted">After every donation there is a 4-month ({DONATION_GAP_DAYS}-day) rest before you are matched again.</p>
        </ProfileCard>

        <ProfileCard kicker="HEALTH" title="Health declaration" tone={4}>
          <p className={`rs-health-state ${profile.health_declared ? "is-ok" : "is-missing"}`}>
            {profile.health_declared
              ? <><CheckCircle2 size={16} /> Confirmed — none of the listed conditions apply</>
              : <><AlertTriangle size={16} /> Not confirmed — you will not be asked to donate</>}
          </p>
          <details className="rs-health-details">
            <summary>What you confirmed</summary>
            <ul className="rs-health-list">{HEALTH_CONDITIONS.map((c) => <li key={c}>{c}</li>)}</ul>
          </details>
        </ProfileCard>

        <ProfileCard
          kicker="ALERTS"
          title="Notifications"
          tone={5}
          action={<Link to="/raktsetu/settings" navigate={navigate} className="rs-btn rs-btn-ghost rs-btn-sm">Change</Link>}
        >
          <InfoGrid rows={[
            ["Browser alerts", profile.notify_push ? "On" : "Paused"],
            ["Email alerts", profile.notify_email ? `On (${displayGroup(profile.blood_group)} only)` : "Off"],
            ["Cities", profile.notify_all_cities ? "All cities" : `${profile.city} only`],
          ]} />
        </ProfileCard>
      </div>
    </div>
  );
}
