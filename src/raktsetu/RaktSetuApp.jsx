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

/* Who can donate: four quick checks, shown as tiles. */
const DONOR_CHECKS = [
  { value: `${MIN_AGE}–${MAX_DONOR_AGE}`, label: ["Years old", "वर्षे वय"] },
  { value: `${MIN_WEIGHT_KG}+ kg`, label: ["Body weight", "वजन"] },
  { value: "✓", label: ["Healthy today", "आज तब्येत चांगली"] },
  { value: "4 mo", valueMr: "4 महिने", label: ["Since last donation", "मागील रक्तदानापासून"] },
];

/* Who should not donate, grouped so the list is easy to scan. */
const NOT_ELIGIBLE_GROUPS = [
  {
    title: ["Right now", "सध्या"],
    items: [
      ["Fever, cold, cough or any infection", "ताप, सर्दी, खोकला किंवा कोणताही संसर्ग"],
      ["Taking antibiotics or medicine for an illness", "आजारासाठी अँटिबायोटिक्स किंवा औषधे घेत आहात"],
      ["Donated blood in the last 4 months", "गेल्या 4 महिन्यांत रक्तदान केले आहे"],
    ],
  },
  {
    title: ["In the last 12 months", "गेल्या 12 महिन्यांत"],
    items: [
      ["Tattoo, piercing or acupuncture", "टॅटू, छिद्र (पिअर्सिंग) किंवा अ‍ॅक्युपंक्चर"],
      ["Major surgery or a blood transfusion", "मोठी शस्त्रक्रिया किंवा रक्त चढवले"],
    ],
  },
  {
    title: ["Health conditions", "आरोग्य स्थिती"],
    items: [
      ["HIV, hepatitis B or C, syphilis, or recent malaria", "HIV, हिपॅटायटिस B किंवा C, सिफिलिस, किंवा अलीकडील मलेरिया"],
      ["Heart disease, epilepsy, cancer or a bleeding disorder", "हृदयरोग, अपस्मार (फिट्स), कर्करोग किंवा रक्तस्रावाचा विकार"],
      ["Diabetes treated with insulin", "इन्सुलिनवरील मधुमेह"],
    ],
  },
  {
    title: ["Pregnancy", "गर्भावस्था"],
    items: [
      ["Pregnant or breastfeeding", "गर्भवती किंवा स्तनपान करत आहात"],
      ["Delivered or miscarried in the last 6 months", "गेल्या 6 महिन्यांत प्रसूती किंवा गर्भपात"],
    ],
  },
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
        sub={tr("Read this before you join. The blood bank still does its own checks.", "सामील होण्यापूर्वी हे वाचा. रक्तपेढी स्वतःची तपासणी करतेच.")}
      >
        {tr("Who can use RaktSetu, and who can donate", "रक्तसेतू कोण वापरू शकते आणि रक्तदान कोण करू शकते")}
      </SectionTitle>

      <div className="rs-age-banner" role="note">
        <span className="rs-age-badge">{MIN_AGE}+</span>
        <div>
          <strong>{tr(`Only for people aged ${MIN_AGE} and over`, `फक्त ${MIN_AGE} वर्षे व त्यावरील वयासाठी`)}</strong>
          <p>{tr(
            `Under ${MIN_AGE}? You can keep using the rest of DnyanSetu.`,
            `${MIN_AGE} पेक्षा कमी वय? बाकी DnyanSetu तुम्ही वापरू शकता.`,
          )}</p>
        </div>
      </div>

      <article className="rs-card rs-elig-block rs-tone-2">
        <h3><span className="rs-icon-chip"><CheckCircle2 size={18} /></span> {tr("You can donate if you are", "तुम्ही रक्तदान करू शकता, जर")}</h3>
        <ul className="rs-check-tiles">
          {DONOR_CHECKS.map((c) => (
            <li key={c.label[0]}>
              <strong>{c.valueMr ? tr(c.value, c.valueMr) : c.value}</strong>
              <span>{pick(tr, c.label)}</span>
            </li>
          ))}
        </ul>
        <p className="rs-muted">{tr(
          "Students, faculty and staff can all join, and you confirm your health in the profile form.",
          "विद्यार्थी, प्राध्यापक आणि कर्मचारी सर्वजण सामील होऊ शकतात; आरोग्याची खात्री प्रोफाइल फॉर्ममध्ये द्या.",
        )}</p>
      </article>

      <article className="rs-card rs-elig-block rs-tone-4">
        <h3><span className="rs-icon-chip"><XCircle size={18} /></span> {tr("Please do not donate if you have", "यापैकी काही असल्यास रक्तदान करू नका")}</h3>
        <div className="rs-reason-groups">
          {NOT_ELIGIBLE_GROUPS.map((g) => (
            <div key={g.title[0]} className="rs-reason-group">
              <h4>{pick(tr, g.title)}</h4>
              <ul className="rs-crosses">
                {g.items.map((line) => <li key={line[0]}>{pick(tr, line)}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </article>

      <article className="rs-card rs-elig-block rs-tone-5">
        <h3><span className="rs-icon-chip"><HeartPulse size={18} /></span> {tr("After you donate", "रक्तदानानंतर")}</h3>
        <p>{tr(
          "Rest for 4 months. Once you record a donation, RaktSetu pauses your requests and email matches for that time automatically.",
          "4 महिने विश्रांती घ्या. रक्तदानाची नोंद केल्यावर रक्तसेतू त्या काळात विनंत्या आणि ईमेल जुळवणी आपोआप थांबवते.",
        )}</p>
      </article>

      <p className="rs-note">{tr(
        "The blood bank or hospital always makes the final decision after checking haemoglobin and blood pressure. RaktSetu does not give medical advice.",
        "हिमोग्लोबिन व रक्तदाब तपासून अंतिम निर्णय नेहमी रक्तपेढी किंवा रुग्णालयच घेते. रक्तसेतू वैद्यकीय सल्ला देत नाही.",
      )}</p>
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

  /* The administrator can open the admin page without being a donor. */
  const isAdmin = state.base.role === "admin";
  if (!state.profile && isAdmin && /^\/raktsetu\/admin/.test(window.location.pathname)) {
    return children({
      base: state.base,
      profile: null,
      setProfile: (profile) => setState((s) => ({ ...s, profile })),
      clearProfile: () => setState((s) => ({ ...s, profile: null })),
      isAdmin,
    });
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
