/* ============================================================================
   RaktSetu — student blood-donation network (/raktsetu)

   Its own full page with its own look, inside the DnyanSetu site: same domain,
   same sign-in session (useAuth), a "Back to DnyanSetu" link in the header.

   /raktsetu itself is public — it is the eligibility guide, so anyone can read
   who may donate before signing in. Every other /raktsetu/* page needs a
   signed-in user (RequireAuth sends them to /login?next=… and back) and a
   RaktSetu profile, which the database only accepts for ages 18 and over.
   ========================================================================== */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, ClipboardList, HeartHandshake, Home,
  PlusCircle, Settings, Shield, UserRound, XCircle,
} from "lucide-react";

import { RequireAuth, useAuth } from "../lib/auth.jsx";
import { isBackendConfigured } from "../lib/supabase.js";
import { LANG_KEY, makeTr } from "../lib/i18n.js";
import { ErrorBoundary, NotFoundPage } from "../lib/errorPages.jsx";
import {
  DISCLAIMER, DONATION_GAP_DAYS, MAX_DONOR_AGE, MIN_AGE, MIN_WEIGHT_KG,
  PAYMENT_WARNING, fetchBaseProfile, fetchMyRaktProfile,
} from "./api.js";
import { ensureServiceWorker } from "./push.js";
import {
  ActivityPage, AdminPage, NewRequestPage, ProfileForm, ProfilePage, RequestDetailPage, RequestsPage, SettingsPage,
} from "./screens.jsx";
import {
  EmergencyHelp, HeartPulse, HeartbeatLine, Link, RaktSetuLockup, RaktSetuLogo, SectionTitle, Spinner,
} from "./ui.jsx";
import "./raktsetu.css";

/* ------------------------------------------------------------------ router */

function currentPath() {
  return window.location.pathname.replace(/\/+$/, "") || "/raktsetu";
}

export function useRouter() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((to, { replace = false } = {}) => {
    if (replace) window.history.replaceState({}, "", to);
    else window.history.pushState({}, "", to);
    setPath(currentPath());
    window.scrollTo(0, 0);
  }, []);

  return { path, navigate };
}

/* ------------------------------------------------------------------ chrome */

/* The public RaktSetu pages follow the language chosen on DnyanSetu (same
   localStorage key) and have their own EN / मराठी switch. The signed-in
   screens stay English, like the DnyanSetu portals. */
function useRaktLang() {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) === "mr" ? "mr" : "en"; } catch { return "en"; }
  });
  const setLang = useCallback((value) => {
    setLangState(value);
    try { localStorage.setItem(LANG_KEY, value); } catch { /* storage blocked */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang === "mr" ? "mr" : "en"; }, [lang]);
  return { lang, setLang };
}

const T = {
  disclaimer: [
    DISCLAIMER,
    "रक्तसेतू हे रक्तदात्यांच्या शोधात असलेल्या लोकांना DnyanSetu वर नोंदणीकृत स्वयंसेवकांशी जोडणारे सामुदायिक नेटवर्क आहे. हे कोणताही वैद्यकीय सल्ला, निदान किंवा उपचार देत नाही आणि ही रक्तपेढी नाही. कोणतेही रक्तदान परवानाधारक रक्तपेढी किंवा रुग्णालयातच होते, आणि अंतिम पात्रता तेच ठरवतात.",
  ],
  pay: [PAYMENT_WARNING, "कोणालाही पैसे देऊ नका. भारतात रक्त विकत घेणे किंवा विकणे बेकायदेशीर आहे."],
};

/* Only signed-in members get a nav bar — it is how they reach their own
   pages. Visitors see just the logo, the language switch and the way back. */
const NAV = [
  { to: "/raktsetu", label: ["Home", "मुख्यपृष्ठ"], icon: Home, exact: true },
  { to: "/raktsetu/requests", label: ["Requests", "विनंत्या"], icon: HeartHandshake },
  { to: "/raktsetu/new", label: ["Request blood", "रक्त मागा"], icon: PlusCircle },
  { to: "/raktsetu/activity", label: ["My activity", "माझी कामगिरी"], icon: ClipboardList },
  { to: "/raktsetu/profile", label: ["My profile", "माझे प्रोफाइल"], icon: UserRound },
  { to: "/raktsetu/settings", label: ["Alerts", "सूचना"], icon: Settings },
];

function Header({ path, navigate, user, isAdmin, lang, setLang, tr }) {
  const items = isAdmin ? [...NAV, { to: "/raktsetu/admin", label: ["Moderation", "नियंत्रण"], icon: Shield }] : NAV;
  return (
    <header className="rs-header">
      <div className="rs-header-top">
        <Link to="/raktsetu" navigate={navigate} className="rs-brand" aria-label="RaktSetu home">
          <RaktSetuLockup size={46} />
        </Link>
        <div className="rs-header-actions">
          <div className="rs-lang" role="group" aria-label="Language / भाषा">
            <button type="button" className={lang === "en" ? "is-active" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>EN</button>
            <button type="button" lang="mr" className={lang === "mr" ? "is-active" : ""} aria-pressed={lang === "mr"} onClick={() => setLang("mr")}>मराठी</button>
          </div>
          <a className="rs-back" href="/">
            <ArrowLeft size={16} /> <span className="rs-back-long">{tr("Back to ", "परत ")}</span><span>DnyanSetu</span>
          </a>
        </div>
      </div>
      {user && (
        <nav className="rs-nav" aria-label="RaktSetu">
          <div className="rs-nav-inner">
            {items.map(({ to, label, icon: Icon, exact }, i) => {
              const active = exact ? path === to : path === to || path.startsWith(`${to}/`);
              return (
                <Link
                  key={to}
                  to={to}
                  navigate={navigate}
                  className={`rs-nav-link rs-tone-${(i % 5) + 1} ${active ? "is-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={16} /> {tr(label[0], label[1])}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}

function Footer({ tr }) {
  return (
    <footer className="rs-footer">
      <div className="rs-footer-inner">
        <div className="rs-footer-brand">
          <RaktSetuLockup size={40} reversed />
        </div>
        <p className="rs-footer-warning"><AlertTriangle size={16} /> <strong>{tr(...T.pay)}</strong></p>
        <p>{tr(...T.disclaimer)}</p>
        <p className="rs-footer-links">
          <a href="/terms#raktsetu" target="_blank" rel="noreferrer">{tr("RaktSetu terms", "रक्तसेतू अटी")}</a>
          <a href="/privacy" target="_blank" rel="noreferrer">{tr("Privacy", "गोपनीयता")}</a>
          <a href="mailto:smuiqac@gmail.com">{tr("Report a problem", "समस्या कळवा")}</a>
          <a href="/">{tr("DnyanSetu home", "DnyanSetu मुख्यपृष्ठ")}</a>
        </p>
      </div>
      <div className="rs-tricolour" aria-hidden="true" />
    </footer>
  );
}

/* --------------------------------------------------------------- home page */

const NOT_ELIGIBLE = [
  [`You are under ${MIN_AGE}, over ${MAX_DONOR_AGE}, or weigh less than ${MIN_WEIGHT_KG} kg`,
    `तुमचे वय ${MIN_AGE} पेक्षा कमी किंवा ${MAX_DONOR_AGE} पेक्षा जास्त आहे, किंवा वजन ${MIN_WEIGHT_KG} किलोपेक्षा कमी आहे`],
  ["You have a fever, cold, cough or any infection today, or are taking antibiotics",
    "आज तुम्हाला ताप, सर्दी, खोकला किंवा कोणताही संसर्ग आहे, किंवा तुम्ही अँटिबायोटिक्स घेत आहात"],
  ["You donated blood in the last 4 months", "गेल्या 4 महिन्यांत तुम्ही रक्तदान केले आहे"],
  ["You had a tattoo, piercing, acupuncture, major surgery or a transfusion in the last 12 months",
    "गेल्या 12 महिन्यांत टॅटू, छिद्र (पिअर्सिंग), अ‍ॅक्युपंक्चर, मोठी शस्त्रक्रिया किंवा रक्त चढवले आहे"],
  ["You have or have had HIV, hepatitis B or C, syphilis, or recent malaria",
    "तुम्हाला HIV, हिपॅटायटिस B किंवा C, सिफिलिस आहे/होता, किंवा अलीकडे मलेरिया झाला आहे"],
  ["You have heart disease, epilepsy, cancer, a bleeding disorder, or insulin-treated diabetes",
    "तुम्हाला हृदयरोग, अपस्मार (फिट्स), कर्करोग, रक्तस्रावाचा विकार किंवा इन्सुलिनवरील मधुमेह आहे"],
  ["You are pregnant or breastfeeding, or delivered or miscarried in the last 6 months",
    "तुम्ही गर्भवती आहात किंवा स्तनपान करत आहात, किंवा गेल्या 6 महिन्यांत प्रसूती/गर्भपात झाला आहे"],
];

const ELIGIBLE = [
  [<>are <strong>{MIN_AGE}–{MAX_DONOR_AGE} years</strong> old</>, <>वय <strong>{MIN_AGE}–{MAX_DONOR_AGE} वर्षे</strong> आहे</>],
  [<>weigh <strong>at least {MIN_WEIGHT_KG} kg</strong></>, <>वजन <strong>किमान {MIN_WEIGHT_KG} किलो</strong> आहे</>],
  ["are in good health today, with no fever, cold or infection", "आज तब्येत चांगली आहे — ताप, सर्दी किंवा संसर्ग नाही"],
  [<>have <strong>not donated blood in the last 4 months</strong> ({DONATION_GAP_DAYS} days)</>,
    <><strong>गेल्या 4 महिन्यांत रक्तदान केलेले नाही</strong> ({DONATION_GAP_DAYS} दिवस)</>],
  ["can confirm the health declaration in your profile", "प्रोफाइलमधील आरोग्य घोषणापत्राची खात्री देऊ शकता"],
];

const HERO_FACTS = [
  [`${MIN_AGE}+`, ["Only adults can join", "फक्त प्रौढांसाठी"], ["Under 18? The rest of DnyanSetu stays open to you.", "18 पेक्षा कमी वय? बाकी DnyanSetu तुमच्यासाठी खुले आहे."]],
  [`${MIN_WEIGHT_KG} kg`, ["Minimum donor weight", "रक्तदात्याचे किमान वजन"], [`Donors are ${MIN_AGE}–${MAX_DONOR_AGE} years old.`, `रक्तदाते ${MIN_AGE}–${MAX_DONOR_AGE} वर्षे वयाचे असावेत.`]],
  [["4 mo", "4 महिने"], ["Rest after donating", "रक्तदानानंतर विश्रांती"], ["Applied automatically once you record a donation.", "रक्तदानाची नोंद केल्यावर आपोआप लागू होते."]],
  ["₹0", ["Always free", "नेहमी मोफत"], ["Never pay anyone for blood.", "रक्तासाठी कोणालाही पैसे देऊ नका."]],
];

const STEPS = [
  [["Complete your profile", "प्रोफाइल पूर्ण करा"],
    ["Age, gender, weight, blood group and city. Phone is optional and only shared when you choose to help.",
      "वय, लिंग, वजन, रक्तगट आणि शहर. फोन ऐच्छिक आहे आणि तुम्ही मदत करायचे ठरवल्यावरच दाखवला जातो."]],
  [["Turn on alerts", "सूचना सुरू करा"],
    ["Browser notifications for requests in your city; email only when your blood group matches exactly.",
      "तुमच्या शहरातील विनंत्यांसाठी ब्राउझर सूचना; तुमचा रक्तगट अचूक जुळल्यावरच ईमेल."]],
  [["Help or ask", "मदत करा किंवा मागा"],
    ["Tap “I can help” to see the family’s contact, or post a request (at most 3 in 24 hours).",
      "कुटुंबाचा संपर्क पाहण्यासाठी “मी मदत करू शकतो/शकते” दाबा, किंवा विनंती टाका (24 तासांत जास्तीत जास्त 3)."]],
  [["Donate at the hospital", "रुग्णालयात रक्तदान करा"],
    ["Record your donation afterwards so RaktSetu gives you your 4-month rest.",
      "नंतर रक्तदानाची नोंद करा, म्हणजे रक्तसेतू तुम्हाला 4 महिन्यांची विश्रांती देईल."]],
];

const pick = (tr, v) => (Array.isArray(v) ? tr(v[0], v[1]) : v);

function EligibilityGuide({ tr }) {
  return (
    <section className="rs-section rs-tone-1" id="eligibility" aria-labelledby="rs-elig-title">
      <SectionTitle
        id="rs-elig-title"
        sub={tr("Read this before you join. The blood bank still does its own checks before any donation.",
          "सामील होण्यापूर्वी हे वाचा. कोणत्याही रक्तदानापूर्वी रक्तपेढी स्वतःची तपासणी करतेच.")}
      >
        {tr("Who can use RaktSetu, and who can donate", "रक्तसेतू कोण वापरू शकते आणि रक्तदान कोण करू शकते")}
      </SectionTitle>

      <div className="rs-age-banner" role="note">
        <span className="rs-age-badge">{MIN_AGE}+</span>
        <div>
          <strong>{tr(`RaktSetu is only for people aged ${MIN_AGE} and over.`, `रक्तसेतू फक्त ${MIN_AGE} वर्षे व त्यावरील वयाच्या व्यक्तींसाठी आहे.`)}</strong>
          <p>
            {tr(
              `Students and staff under ${MIN_AGE} can keep using everything else on DnyanSetu, but cannot join RaktSetu, post requests or receive alerts. The profile form will not accept an age under ${MIN_AGE}.`,
              `${MIN_AGE} पेक्षा कमी वयाचे विद्यार्थी आणि कर्मचारी DnyanSetu वरील बाकी सर्व वापरू शकतात, पण रक्तसेतूमध्ये सामील होऊ शकत नाहीत, विनंती टाकू शकत नाहीत किंवा सूचना मिळवू शकत नाहीत. प्रोफाइल फॉर्म ${MIN_AGE} पेक्षा कमी वय स्वीकारत नाही.`,
            )}
          </p>
        </div>
      </div>

      <div className="rs-guide-grid">
        <article className="rs-card rs-guide rs-tone-2">
          <h3><span className="rs-icon-chip"><CheckCircle2 size={18} /></span> {tr("You may volunteer as a donor if you", "तुम्ही रक्तदाता म्हणून स्वयंसेवा करू शकता, जर तुम्ही")}</h3>
          <ul className="rs-ticks">
            {ELIGIBLE.map((line, i) => <li key={i}>{pick(tr, line)}</li>)}
          </ul>
          <p className="rs-muted">
            {tr("Students, faculty and staff can all join. Only age and health decide who can donate.",
              "विद्यार्थी, प्राध्यापक आणि कर्मचारी सर्वजण सामील होऊ शकतात. रक्तदान कोण करू शकते हे फक्त वय आणि आरोग्य ठरवते.")}
          </p>
        </article>

        <article className="rs-card rs-guide rs-tone-4">
          <h3><span className="rs-icon-chip"><XCircle size={18} /></span> {tr("Please do not volunteer if any of these apply", "यापैकी काहीही लागू असल्यास कृपया स्वयंसेवा करू नका")}</h3>
          <ul className="rs-crosses">
            {NOT_ELIGIBLE.map((line) => <li key={line[0]}>{pick(tr, line)}</li>)}
          </ul>
        </article>
      </div>

      <article className="rs-card rs-guide rs-guide--wide rs-tone-5">
        <h3><span className="rs-icon-chip"><HeartPulse size={18} /></span> {tr("After you donate", "रक्तदानानंतर")}</h3>
        <p>
          {tr(
            "Your body needs time to rebuild the blood you gave. Once you record a donation, RaktSetu automatically stops showing you requests to help with and stops matching you by email for 4 months. You can still post requests for someone else during that time.",
            "दिलेले रक्त पुन्हा तयार होण्यासाठी शरीराला वेळ लागतो. रक्तदानाची नोंद केल्यावर रक्तसेतू 4 महिने तुम्हाला मदतीसाठी विनंत्या दाखवणे आणि ईमेलद्वारे जुळवणे आपोआप थांबवते. या काळात तुम्ही इतरांसाठी विनंती टाकू शकता.",
          )}
        </p>
      </article>

      <p className="rs-note">
        {tr(
          "The blood bank or hospital always makes the final decision. They will check your haemoglobin, blood pressure and health history before any donation. RaktSetu does not give medical advice.",
          "अंतिम निर्णय नेहमी रक्तपेढी किंवा रुग्णालयच घेते. रक्तदानापूर्वी ते तुमचे हिमोग्लोबिन, रक्तदाब आणि आरोग्य इतिहास तपासतील. रक्तसेतू वैद्यकीय सल्ला देत नाही.",
        )}
      </p>
    </section>
  );
}

function HomePage({ navigate, user, tr }) {
  return (
    <>
      <section className="rs-hero">
        <div className="rs-hero-copy">
          <p className="rs-eyebrow"><HeartPulse size={14} /> {tr("DnyanSetu · Social Services", "DnyanSetu · सामाजिक सेवा")}</p>
          <h1>{tr("Connect patients who need blood with student and staff volunteers nearby",
            "रक्ताची गरज असलेल्या रुग्णांना जवळच्या विद्यार्थी आणि कर्मचारी स्वयंसेवकांशी जोडा")}</h1>
          <p className="rs-hero-sub">
            {tr(
              "Post a request when someone needs blood. Registered volunteers in the same city get an alert, and anyone who can help reaches the family directly. Donations always happen at a licensed blood bank or hospital.",
              "एखाद्याला रक्ताची गरज असल्यास विनंती टाका. त्याच शहरातील नोंदणीकृत स्वयंसेवकांना सूचना जाते, आणि मदत करू शकणारे थेट कुटुंबाशी संपर्क साधतात. रक्तदान नेहमी परवानाधारक रक्तपेढी किंवा रुग्णालयातच होते.",
            )}
          </p>
          <div className="rs-hero-actions">
            {user ? (
              <>
                <Link to="/raktsetu/requests" navigate={navigate} className="rs-btn rs-btn-primary">{tr("See open requests", "खुल्या विनंत्या पहा")}</Link>
                <Link to="/raktsetu/new" navigate={navigate} className="rs-btn rs-btn-ghost">{tr("Request blood", "रक्ताची विनंती करा")}</Link>
              </>
            ) : (
              <>
                <a href={`/login?next=${encodeURIComponent("/raktsetu/requests")}`} className="rs-btn rs-btn-primary">{tr("Sign in to join", "सामील होण्यासाठी लॉग इन करा")}</a>
                <a href={`/signup?next=${encodeURIComponent("/raktsetu/requests")}`} className="rs-btn rs-btn-ghost">{tr("Create a DnyanSetu account", "DnyanSetu खाते तयार करा")}</a>
              </>
            )}
          </div>
          <p className="rs-hero-warning"><AlertTriangle size={16} /> <span>{tr(...T.pay)}</span></p>
          <EmergencyHelp tr={tr} />
        </div>

        <aside className="rs-hero-panel" aria-label={tr("RaktSetu at a glance", "रक्तसेतू एका नजरेत")}>
          <div className="rs-hero-panel-head">
            <RaktSetuLogo size={52} />
            <HeartbeatLine />
          </div>
          <ul className="rs-hero-facts">
            {HERO_FACTS.map(([value, label, note], i) => (
              <li key={label[0]} className={`rs-tone-${i + 1}`}>
                <span className="rs-fact-num">{pick(tr, value)}</span>
                <span>
                  <strong>{pick(tr, label)}</strong>
                  <span className="rs-muted">{pick(tr, note)}</span>
                </span>
              </li>
            ))}
          </ul>
        </aside>
      </section>

      <EligibilityGuide tr={tr} />

      <section className="rs-section rs-tone-3" id="how-it-works" aria-labelledby="rs-how-title">
        <SectionTitle id="rs-how-title" sub={tr("Four steps, from joining to giving blood.", "सामील होण्यापासून रक्तदानापर्यंत चार पायऱ्या.")}>
          {tr("How it works", "हे कसे काम करते")}
        </SectionTitle>
        <ol className="rs-steps">
          {STEPS.map(([title, body], i) => (
            <li key={title[0]} className={`rs-tone-${((i + 1) % 5) + 1}`}>
              <strong>{pick(tr, title)}</strong>
              <span>{pick(tr, body)}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}

/* ---------------------------------------------------------- signed-in gate */

/* Loads the DnyanSetu account and RaktSetu profile, and shows the onboarding
   form until a RaktSetu profile exists. */
function MemberArea({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, base: null, profile: null, error: "" });

  const load = useCallback(async () => {
    try {
      const [base, profile] = await Promise.all([fetchBaseProfile(user.id), fetchMyRaktProfile(user.id)]);
      setState({ loading: false, base, profile, error: "" });
    } catch (error) {
      setState({ loading: false, base: null, profile: null, error: error.message });
    }
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  if (state.loading) return <Spinner />;
  if (state.error) return <div className="rs-alert rs-alert--error">{state.error}</div>;

  if (!state.base || state.base.restricted || state.base.status !== "active") {
    return (
      <div className="rs-alert rs-alert--error">
        This account is restricted. Please contact the administrator at smuiqac@gmail.com.
      </div>
    );
  }
  /* Terms first — the main site's sign-in handles that screen. */
  if (!state.base.terms_accepted_at) {
    window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    return <Spinner />;
  }

  if (!state.profile) {
    return (
      <ProfileForm
        userId={user.id}
        defaultName={state.base.name}
        onboarding
        onSaved={(profile) => setState((s) => ({ ...s, profile }))}
      />
    );
  }

  return children({
    base: state.base,
    profile: state.profile,
    setProfile: (profile) => setState((s) => ({ ...s, profile })),
    clearProfile: () => setState((s) => ({ ...s, profile: null })),
    isAdmin: state.base.role === "admin",
  });
}

/* ------------------------------------------------------------------- app */

export default function RaktSetuApp() {
  const { path, navigate } = useRouter();
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const { lang, setLang } = useRaktLang();
  const tr = useMemo(() => makeTr(lang), [lang]);

  useEffect(() => {
    document.title = "RaktSetu · DnyanSetu";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#16202e");
    /* RaktSetu's own tab icon (the split drop). */
    document.querySelectorAll('link[rel="icon"]').forEach((l) => l.remove());
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.href = "/raktsetu-icon.svg";
    document.head.appendChild(icon);
    ensureServiceWorker();
  }, []);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    fetchBaseProfile(user.id).then((p) => setIsAdmin(p?.role === "admin")).catch(() => setIsAdmin(false));
  }, [user]);

  const page = useMemo(() => {
    const rest = path.replace(/^\/raktsetu/i, "") || "/";
    const detail = /^\/requests\/([0-9a-f-]{36})$/i.exec(rest);
    return { rest, requestId: detail ? detail[1] : null };
  }, [path]);

  let body;
  if (!isBackendConfigured) {
    body = (
      <>
        <div className="rs-alert">RaktSetu needs the Supabase keys in <code>.env.local</code> — see SUPABASE-SETUP.md. Showing the public guide only.</div>
        <HomePage navigate={navigate} user={null} tr={tr} />
      </>
    );
  } else if (page.rest === "/") {
    body = <HomePage navigate={navigate} user={user} tr={tr} />;
  } else {
    body = (
      <RequireAuth fallback={<Spinner label="Checking your sign-in…" />}>
        <MemberArea>
          {(ctx) => {
            const props = { ...ctx, navigate, userId: user?.id };
            if (page.requestId) return <RequestDetailPage {...props} id={page.requestId} />;
            switch (page.rest) {
              case "/requests": return <RequestsPage {...props} />;
              case "/new": return <NewRequestPage {...props} />;
              case "/activity": return <ActivityPage {...props} />;
              case "/profile": return <ProfilePage {...props} />;
              case "/settings": return <SettingsPage {...props} />;
              case "/admin": return ctx.isAdmin
                ? <AdminPage {...props} />
                : <div className="rs-alert rs-alert--error">Moderation is for the DnyanSetu administrator only.</div>;
              default:
                return <NotFoundPage homeHref="/raktsetu" inline />;
            }
          }}
        </MemberArea>
      </RequireAuth>
    );
  }

  return (
    <div className="rs-root">
      <Header path={path} navigate={navigate} user={user} isAdmin={isAdmin} lang={lang} setLang={setLang} tr={tr} />
      <main className="rs-main" lang={lang === "mr" && page.rest === "/" ? "mr" : undefined}>
        {/* A crash in one screen shows a "try again" card; header and footer stay. */}
        <ErrorBoundary resetKey={path} inline>{body}</ErrorBoundary>
      </main>
      <Footer tr={tr} />
    </div>
  );
}
