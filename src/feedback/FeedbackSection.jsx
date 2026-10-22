import React, { useState } from "react";
import { CheckCircle2, HelpCircle, Lightbulb, Bug, MessageSquare, Loader2, Send } from "lucide-react";

import { FEEDBACK_KINDS, MAX_MESSAGE, MIN_MESSAGE, sendFeedback } from "../lib/feedback.js";
import "./feedback.css";

const KIND_ICON = { query: HelpCircle, feature: Lightbulb, bug: Bug, feedback: MessageSquare };

/* Landing page, just above the footer: a short note on the left and a small
   form on the right. Whatever is sent goes straight to the administrator. */
export default function FeedbackSection({ tr, user }) {
  const [kind, setKind] = useState("query");
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [message, setMessage] = useState("");
  const [trap, setTrap] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const length = message.trim().length;
  const ready = length >= MIN_MESSAGE && !busy;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setError("");
    /* A hidden field only automated senders fill in. */
    if (trap) { setSent(true); return; }
    setBusy(true);
    try {
      await sendFeedback({ name: name.trim(), email: email.trim(), kind, message: message.trim() });
      setSent(true);
      setMessage("");
    } catch (err) {
      setError(err.message || tr("Could not send your message. Please try again.", "संदेश पाठवता आला नाही. कृपया पुन्हा प्रयत्न करा."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="fbk" id="feedback" aria-labelledby="fbk-title">
      <div className="fbk-in">
        <div className="fbk-copy">
          <p className="fbk-kicker"><MessageSquare size={14} /> {tr("Feedback", "अभिप्राय")}</p>
          <h2 id="fbk-title">{tr("Have a question or an idea for DnyanSetu?", "ज्ञानसेतूबद्दल प्रश्न किंवा कल्पना आहे का?")}</h2>
          <p className="fbk-sub">
            {tr(
              "Ask a question, suggest a feature or tell us what is not working. Your message goes straight to the administrator.",
              "प्रश्न विचारा, नवीन सुविधा सुचवा किंवा काय चालत नाही ते सांगा. तुमचा संदेश थेट प्रशासकाकडे जातो.",
            )}
          </p>
        </div>

        <div className="fbk-card">
          {sent ? (
            <div className="fbk-done" role="status">
              <CheckCircle2 size={38} />
              <h3>{tr("Thank you!", "धन्यवाद!")}</h3>
              <p>{tr("Your message has reached the administrator.", "तुमचा संदेश प्रशासकापर्यंत पोहोचला आहे.")}</p>
              <button type="button" className="fbk-again" onClick={() => setSent(false)}>
                {tr("Send another message", "आणखी एक संदेश पाठवा")}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <fieldset className="fbk-kinds">
                <legend>{tr("What is this about?", "हे कशाबद्दल आहे?")}</legend>
                {FEEDBACK_KINDS.map((k) => {
                  const Icon = KIND_ICON[k.id];
                  return (
                    <button key={k.id} type="button" className={kind === k.id ? "is-on" : ""} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
                      <Icon size={15} /> {tr(k.label, k.labelMr)}
                    </button>
                  );
                })}
              </fieldset>

              <div className="fbk-two">
                <label className="fbk-field">
                  <span>{tr("Your name", "तुमचे नाव")} <em>({tr("optional", "ऐच्छिक")})</em></span>
                  <input value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
                </label>
                <label className="fbk-field">
                  <span>{tr("Email for a reply", "उत्तरासाठी ईमेल")} <em>({tr("optional", "ऐच्छिक")})</em></span>
                  <input type="email" value={email} maxLength={120} autoComplete="email" inputMode="email" onChange={(e) => setEmail(e.target.value)} />
                </label>
              </div>

              <label className="fbk-field">
                <span>{tr("Your message", "तुमचा संदेश")}</span>
                <textarea
                  rows={5}
                  value={message}
                  maxLength={MAX_MESSAGE}
                  required
                  placeholder={tr("Write here in English, Hindi or Marathi…", "येथे इंग्रजी, हिंदी किंवा मराठीत लिहा…")}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <small className={length > 0 && length < MIN_MESSAGE ? "is-short" : ""}>
                  {length > 0 && length < MIN_MESSAGE
                    ? tr(`Please write at least ${MIN_MESSAGE} characters.`, `किमान ${MIN_MESSAGE} अक्षरे लिहा.`)
                    : `${length} / ${MAX_MESSAGE}`}
                </small>
              </label>

              {/* Real people never see or fill this. */}
              <input className="fbk-trap" tabIndex={-1} autoComplete="off" aria-hidden="true" value={trap} onChange={(e) => setTrap(e.target.value)} name="website" />

              {error && <p className="fbk-err" role="alert">{error}</p>}

              <button type="submit" className="fbk-send" disabled={!ready}>
                {busy ? <Loader2 size={17} className="spin" /> : <Send size={17} />}
                {busy ? tr("Sending…", "पाठवत आहे…") : tr("Send to administrator", "प्रशासकाला पाठवा")}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
