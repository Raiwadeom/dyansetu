/* ============================================================================
   Student Dev Hub (/devhub)

   Its own full page with its own dark, 3D look inside the DnyanSetu site —
   the same way /raktsetu is separate. Content lives in ./data.js.
   ========================================================================== */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowDownRight, ArrowUpRight, Asterisk, BookOpen, Check, Flower2, Hammer, Pause, Play, Presentation, Search, Sparkles, UserPlus, Zap, CalendarDays, ChevronLeft, ChevronRight, MapPin, Menu, Trophy, X } from "lucide-react";
import { ABOUT_TECHNOVA, LEAD, SOCIALS, STEPS, TEAM, TECHOVA, TRACKS, UPCOMING } from "./data.js";
import "@fontsource/anton/400.css";
import "@fontsource-variable/bricolage-grotesque";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/playfair-display/800-italic.css";
import "./devhub.css";

const NAV = [
  { id: "about", label: "About" },
  { id: "tracks", label: "Tracks" },
  { id: "team", label: "Team" },
  { label: "Technova", href: "/devhub/technova" },
];
const TECH_NAV = [
  { id: "tabout", label: "About" },
  { id: "techova", label: "Winners" },
  { id: "event", label: "2026" },
  { label: "Dev Hub", href: "/devhub" },
];

const initials = (name) =>
  name.replace(/^TODO\s*·\s*/i, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "?";

/* Club mark: "Slash Code" concept (purple < , yellow / , green >). */
function SlashLogo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="9">
      <path d="M22 16 8 32l14 16" stroke="#6c4bff" />
      <path d="M42 16l14 16-14 16" stroke="#1ec8a0" />
      <path d="M36 11 28 53" stroke="#ffb020" />
    </svg>
  );
}

function InstagramIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WhatsAppIcon({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.95L2 22l5.2-1.36A9.9 9.9 0 1 0 12.04 2Zm0 18.1a8.2 8.2 0 0 1-4.18-1.14l-.3-.18-3.08.8.82-3-.2-.31a8.2 8.2 0 1 1 6.94 3.83Zm4.5-6.14c-.25-.12-1.46-.72-1.69-.8-.23-.09-.39-.13-.56.12-.16.25-.64.8-.78.97-.14.16-.29.18-.54.06a6.7 6.7 0 0 1-3.3-2.88c-.25-.43.25-.4.72-1.33.08-.16.04-.3-.02-.42-.06-.12-.56-1.35-.77-1.85-.2-.48-.4-.42-.56-.43h-.47c-.16 0-.43.06-.65.3-.23.25-.86.84-.86 2.05s.88 2.38 1 2.55c.12.16 1.73 2.64 4.2 3.7.59.26 1.05.41 1.4.52.59.19 1.13.16 1.55.1.47-.07 1.46-.6 1.66-1.17.2-.58.2-1.07.14-1.17-.06-.1-.23-.16-.48-.28Z" />
    </svg>
  );
}

/* Pixel-art mouse pointer (retro OS style). */
function PixelCursor({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 14 21" aria-hidden="true" shapeRendering="crispEdges">
      <polygon points="0,0 0,17 4,13 7,20 10,19 7,12 13,12" fill="#fff" stroke="#0a0b14" strokeWidth="1.4" strokeLinejoin="miter" />
    </svg>
  );
}

/* Hero: graph-paper card with colourful 3D keycaps that press one after another. */
const KEYS = [
  { c: "orange", l: "D" }, { c: "violet", l: "E" }, { c: "green", l: "V" },
  { c: "blue", l: "H" }, { c: "yellow", l: "U" }, { c: "lilac", l: "B" },
];
function KeyCaps() {
  return (
    <div className="dh-keys" aria-hidden="true">
      <div className="dh-keys-paper" />
      <div className="dh-keys-code"><span>{"</>"}</span></div>
      <div className="dh-keys-mail" />
      <div className="dh-keys-bubble"><i /><i /><i /></div>
      <div className="dh-keys-pencil" />
      <Sparkles className="dh-keys-star s1" size={44} />
      <Sparkles className="dh-keys-star s2" size={26} />
      <div className="dh-keys-grid">
        {KEYS.map((k, i) => (
          <span key={k.l} className={`dh-key k-${k.c}`} style={{ "--i": i }}><b>{k.l}</b></span>
        ))}
      </div>
      <PixelCursor className="dh-keys-cursor" />
    </div>
  );
}

/* Smooth-scroll to a section, or jump if the visitor prefers less motion. */
function goTo(id) {
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const el = id === "top" ? null : document.getElementById(id);
  if (id === "top") window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  else el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

/* Fades a block in once it scrolls into view. */
function Reveal({ children, className = "", delay = 0 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) { setShown(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`dh-reveal ${shown ? "is-in" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Header({ items = NAV, brandHref = null }) {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const pick = (id) => { setOpen(false); goTo(id); };
  return (
    <header className={`dh-header ${solid ? "is-solid" : ""}`}>
      <div className="dh-header-in">
        {brandHref ? (
          <a className="dh-brand" href={brandHref} aria-label="Dev Hub home">
            <span className="dh-brand-mark" aria-hidden="true"><SlashLogo size={20} /></span>
            <span>Dev Hub</span>
          </a>
        ) : (
          <button type="button" className="dh-brand" onClick={() => pick("top")} aria-label="Dev Hub home">
            <span className="dh-brand-mark" aria-hidden="true"><SlashLogo size={20} /></span>
            <span>Dev Hub</span>
          </button>
        )}
        <nav className={`dh-nav ${open ? "is-open" : ""}`} aria-label="Dev Hub sections">
          {items.map((n) => (n.href
            ? <a key={n.label} href={n.href} className="dh-nav-link">{n.label}</a>
            : <button key={n.id} type="button" onClick={() => pick(n.id)}>{n.label}</button>))}
          <a href="/" className="dh-nav-back"><ArrowLeft size={14} /> DnyanSetu</a>
          <button type="button" className="dh-cloud dh-cloud-menu" onClick={() => pick("join")}>Join the hub</button>
        </nav>
        <a href="/" className="dh-back"><ArrowLeft size={14} /> DnyanSetu</a>
        <button type="button" className="dh-cloud" onClick={() => pick("join")}>
          <svg viewBox="0 0 150 64" preserveAspectRatio="none" aria-hidden="true"><path d="M26 54C8 54 4 36 18 30 12 14 34 6 46 16 52 2 78 0 86 14 98 4 120 8 122 24 142 26 148 46 130 54Z" /></svg>
          <span>JOIN THE HUB</span>
          <PixelCursor className="dh-cloud-cursor" />
        </button>
        <button type="button" className="dh-burger" aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)}>
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="dh-hero" id="top">
      <div className="dh-hero-bg" aria-hidden="true">
        <span className="dh-sun" />
        <span className="dh-bigword">build</span>
      </div>
      <ul className="dh-hero-social" aria-label="Social links">
        <li><a href={SOCIALS.instagram} target="_blank" rel="noreferrer">Instagram</a></li>
        <li><a href={SOCIALS.youtube} target="_blank" rel="noreferrer">YouTube</a></li>
        <li><a href={SOCIALS.whatsapp} target="_blank" rel="noreferrer">WhatsApp</a></li>
      </ul>
      <div className="dh-wrap dh-hero-center">
        <p className="dh-hero-chip"><span className="dh-dot" /> Chhatrapati Shivajiraje Mahavidyalaya · Udgir</p>
        <div className="dh-hero-head">
          <span className="dh-sticker" aria-hidden="true">100% free<br />for students</span>
          <h1>
            <span>Where our college</span>
            <em>builds</em>
            <span>things.</span>
          </h1>
        </div>
        <p className="dh-lede">
          The student developer hub. Learn to code, ship real projects and show them at Techova. Made by students, for students.
        </p>
        <div className="dh-pillform">
          <span>Come to the next session, no experience needed</span>
          <button type="button" className="dh-yellowbtn" onClick={() => goTo("join")}>Join now <ArrowRight size={15} /></button>
        </div>
        <a className="dh-hero-link" href="/devhub/technova"><Trophy size={15} /> See Technova and the winners</a>
      </div>
    </section>
  );
}

const STEP_ICONS = [UserPlus, BookOpen, Hammer, Presentation];

/* About, shown as a soft learning-plan dashboard (Nixtio style). */
function About() {
  return (
    <section className="dh-about-band" id="about">
      <div>
        <Reveal>
          <div className="dh-app">
            <div className="dh-app-bar">
              <span className="dh-app-logo"><SlashLogo size={20} /> Dev Hub</span>
              <span className="dh-app-title">Learning plan</span>
              <span className="dh-app-user"><i>DH</i> Student · Dev Hub</span>
            </div>
            <div className="dh-app-body">
              <div className="dh-app-main">
                <div className="dh-app-head">
                  <div>
                    <p className="dh-app-kicker">01 — About</p>
                    <h2>About the hub 👋</h2>
                  </div>
                  <span className="dh-app-search"><Search size={15} /> Search sessions</span>
                </div>
                <p className="dh-app-lede">
                  Dev Hub is the student-run tech community of our college. We meet, learn the basics together, pair up on small projects and
                  help each other finish them. No fees, no prior experience needed. If you are curious, you belong here.
                </p>
                <div className="dh-app-stats">
                  <div className="is-sky"><strong>{TRACKS.length}</strong><span>Tracks</span></div>
                  <div className="is-mint"><strong>Free</strong><span>for every student</span></div>
                  <div className="is-dash"><strong>1</strong><span>Upcoming event</span></div>
                </div>
                <ol className="dh-plan">
                  {STEPS.map((s, i) => {
                    const Icon = STEP_ICONS[i % STEP_ICONS.length];
                    return (
                      <li key={s.n} className={`dh-plan-card is-p${i % 4}`}>
                        <span className="dh-plan-icon"><Icon size={16} /></span>
                        <h3>{s.title}</h3>
                        <p>{s.text}</p>
                        <span className="dh-plan-pill"><Check size={12} /> Step {s.n}</span>
                      </li>
                    );
                  })}
                </ol>
              </div>
              <aside className="dh-app-side">
                <h3>Coming up 🗓</h3>
                <div className="dh-ev is-sky">
                  <span className="dh-ev-top"><b>Event</b><i>{UPCOMING.dateText}</i></span>
                  <p>{UPCOMING.name}: show what you built in front of the college.</p>
                </div>
                <div className="dh-ev is-lilac">
                  <span className="dh-ev-top"><b>Session</b><i>Weekly</i></span>
                  <p>Short build night. Learn a skill, then make something small.</p>
                </div>
                <div className="dh-ev is-butter">
                  <span className="dh-ev-top"><b>Task</b><i>Any time</i></span>
                  <p>Pick a track and start a tiny project with a friend.</p>
                </div>
                <div className="dh-ev is-mint dh-ev-pop">
                  <span className="dh-ev-top"><b>Task</b><i>Technova</i></span>
                  <p>Present it, win it, get on the winners wall.</p>
                </div>
              </aside>
            </div>
          </div>
        </Reveal>
        <div className="dh-wrap"><ul className="dh-tags dh-tags-about">
          {["#Web", "#Apps", "#Data_&_AI", "#Games_&_3D", "#Open_Source", "#Hackathons"].map((t) => <li key={t}>{t}</li>)}
        </ul></div>
      </div>
    </section>
  );
}

function Bento() {
  const ring = "LEARN • BUILD • SHIP • SHOW • ";
  return (
    <section className="dh-bento-band">
    <div className="dh-wrap dh-bento">
      <Reveal className="dh-b-welcome-w">
        <div className="dh-b dh-b-welcome">
          <span className="dh-pill-outline">Welcome</span>
          <Asterisk className="dh-spin" size={44} aria-hidden="true" />
          <p>A new way to learn on campus. Pick a project, find your team and ship it with people who help.</p>
        </div>
      </Reveal>
      <Reveal delay={80} className="dh-b-lime-w">
        <div className="dh-b dh-b-lime">
          <div className="dh-b-pills"><span>Learn together</span><span>Free</span><span>Beginner</span></div>
          <h3>Flexible</h3>
          <p>Short sessions, shared notes and small projects that fit around classes. Start at your own pace, go as deep as you like.</p>
          <ArrowUpRight className="dh-b-arrow" size={46} strokeWidth={2.2} aria-hidden="true" />
        </div>
      </Reveal>
      <Reveal delay={120} className="dh-b-stat-w">
        <div className="dh-b dh-b-stat"><strong>{TRACKS.length}</strong><span>Tracks</span></div>
      </Reveal>
      <Reveal delay={160} className="dh-b-stat-w">
        <div className="dh-b dh-b-stat dh-b-dark"><strong>{TEAM.length}</strong><span>Team leads</span></div>
      </Reveal>
      <Reveal delay={200} className="dh-b-badge-w">
        <div className="dh-badge" aria-hidden="true">
          <svg viewBox="0 0 120 120" className="dh-badge-ring">
            <defs><path id="dh-circ" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
            <text fontSize="11" letterSpacing="2.4" fill="currentColor"><textPath href="#dh-circ">{ring}{ring}</textPath></text>
          </svg>
          <Sparkles size={22} />
        </div>
      </Reveal>
    </div>
    </section>
  );
}

const TRACK_ICONS = [Flower2, Zap, Sparkles, Asterisk];

const SKILLS = [
  ["HTML", "</>"], ["CSS", "{ }"], ["JavaScript", "JS"], ["React", "Re"],
  ["Python", "Py"], ["Node.js", "No"], ["Android", "An"], ["Git", "Gt"],
];

/* Square cards orbiting a centre ring, each staying upright (Pinterest showcase style). */
function SkillOrbit() {
  const n = SKILLS.length;
  return (
    <div className="dh-orbit-wrap">
      <p className="dh-label">Tools we use</p>
      <div className="dh-orbit" style={{ "--n": n }}>
        <div className="dh-orbit-ring" aria-hidden="true" />
        <div className="dh-orbit-centre"><Sparkles size={26} /><strong>Build<br />with us</strong></div>
        <ul className="dh-orbit-spin">
          {SKILLS.map(([name, glyph], i) => (
            <li key={name} className={`dh-orbit-item is-o${i % 5}`} style={{ "--i": i }}>
              <span className="dh-orbit-card"><b>{glyph}</b><em>{name}</em></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Tracks() {
  return (
    <section className="dh-section" id="tracks">
      <div className="dh-wrap">
        <Reveal>
          <p className="dh-label">02 — Tracks</p>
          <h2 className="dh-h2-icons">
            Pick a <span className="dh-ipill is-blue"><Flower2 size={34} fill="currentColor" /><Sparkles size={30} fill="currentColor" /></span> lane.
            <br />Switch <span className="dh-ipill is-yellow"><span className="dh-ring" /></span> any time.
          </h2>
        </Reveal>
        <div className="dh-tracks">
          {TRACKS.map((t, i) => {
            const Icon = TRACK_ICONS[i % TRACK_ICONS.length];
            return (
              <Reveal key={t.id} delay={i * 80} className="dh-track-wrap">
                <article className={`dh-track is-t${i % 4}`}>
                  <div className="dh-track-top"><span className="dh-track-code">{t.code}</span><span className="dh-track-kind">Track</span></div>
                  <Icon className="dh-track-mark" size={190} strokeWidth={1} fill="currentColor" aria-hidden="true" />
                  <h3>{t.title}</h3>
                  <p>{t.text}</p>
                </article>
              </Reveal>
            );
          })}
        </div>
        <Reveal delay={100}><SkillOrbit /></Reveal>
      </div>
    </section>
  );
}

/* One team card: greyscale portrait, ribbons along the bottom (never over the face). */
function TeamCard({ m }) {
  const word = m.role.toUpperCase();
  const strip = (tone) => (
    <div className={`dh-ribbon dh-ribbon-${tone}`} aria-hidden="true">
      <div className="dh-ribbon-track">
        {Array.from({ length: 12 }).map((_, k) => (
          <span key={k}><b>{tone === "lime" ? "100%" : "★"}</b>{word}<i>↘</i></span>
        ))}
      </div>
    </div>
  );
  return (
    <>
      <div className="dh-member-stage">
        {m.photo ? (
          <img className="dh-member-img" src={m.photo} alt="" draggable="false" />
        ) : (
          <svg className="dh-member-sil" viewBox="0 0 200 240" aria-hidden="true">
            <circle cx="100" cy="82" r="46" />
            <path d="M12 240c4-70 40-104 88-104s84 34 88 104Z" />
          </svg>
        )}
        {strip("blue")}
        {strip("lime")}
      </div>
      <div className="dh-member-info">
        <p className="dh-member-by">↗ {m.role}</p>
        <h3>{m.name.replace(/^TODO\s*·\s*/i, "")}</h3>
        <p className="dh-member-klass">{m.klass}</p>
        <p className="dh-member-bio">{m.bio}</p>
      </div>
    </>
  );
}

/* Draggable, fanned deck: drag or swipe the front card away and it goes to the back. */
function Team() {
  const [order, setOrder] = useState(() => TEAM.map((_, i) => i));
  const [drag, setDrag] = useState({ x: 0, y: 0, on: false });
  const start = useRef(null);

  const bring = (idx) => setOrder((o) => [idx, ...o.filter((v) => v !== idx)]);
  const send = (dir) => {
    setDrag({ x: dir * 520, y: 0, on: false });
    setTimeout(() => {
      setOrder((o) => [...o.slice(1), o[0]]);
      setDrag({ x: 0, y: 0, on: false });
    }, 300);
  };
  const down = (e) => {
    start.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!start.current) return;
    setDrag({ x: e.clientX - start.current.x, y: (e.clientY - start.current.y) * 0.4, on: true });
  };
  const up = () => {
    if (!start.current) return;
    start.current = null;
    if (Math.abs(drag.x) > 80) send(drag.x > 0 ? 1 : -1);
    else setDrag({ x: 0, y: 0, on: false });
  };

  return (
    <section className="dh-section dh-teamsec" id="team">
      <div className="dh-wrap">
        <div className="dh-teamstage">
          <Reveal>
            <p className="dh-label dh-team-label">03 — Team</p>
            <h2 className="dh-team-title">Meet <span>+</span> the students <span>+</span><br /><u>running the hub.</u></h2>
          </Reveal>
          <div className="dh-deck-wrap">
            <ul className="dh-deck-list">
              {TEAM.map((m, i) => (
                <li key={m.role}>
                  <button type="button" className={order[0] === i ? "is-on" : ""} onClick={() => bring(i)}>
                    <span>0{i + 1}</span>
                    <strong>{m.role}</strong>
                    <em>{m.name.replace(/^TODO\s*·\s*/i, "")}</em>
                  </button>
                </li>
              ))}
              <li className="dh-deck-hint">Drag the card away, or tap a name.</li>
              <li><button type="button" className="dh-deck-next" onClick={() => send(1)}>Next card <ArrowRight size={14} /></button></li>
            </ul>
            <div className="dh-deck" role="group" aria-label="Team cards">
              {order.map((idx, pos) => {
                const front = pos === 0;
                const x = pos * 46 + (front ? drag.x : 0);
                const y = pos * 14 + (front ? drag.y : 0);
                const rot = (front ? -2 : pos * 5) + (front ? drag.x / 14 : 0);
                const style = {
                  transform: `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${1 - pos * 0.04})`,
                  zIndex: 10 - pos,
                };
                return (
                  <article
                    key={idx}
                    className={`dh-deck-card ${front ? "is-front" : ""} ${front && drag.on ? "is-dragging" : ""}`}
                    style={style}
                    onPointerDown={front ? down : undefined}
                    onPointerMove={front ? move : undefined}
                    onPointerUp={front ? up : undefined}
                    onPointerCancel={front ? up : undefined}
                    onClick={!front ? () => bring(idx) : undefined}
                    aria-hidden={!front}
                  >
                    <TeamCard m={TEAM[idx]} />
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Poster-style spotlight for the Technical Lead. */
function LeadSpotlight() {
  const m = TEAM.find((t) => /lead/i.test(t.role)) || TEAM[0];
  const clean = m.name.replace(/^TODO\s*·\s*/i, "");
  const [first, ...rest] = clean.split(/\s+/);
  const ring = LEAD.ring.repeat(2);
  return (
    <section className="dh-section dh-leadsec" id="lead">
      <div className="dh-wrap">
        <Reveal>
          <p className="dh-label dh-lead-label">Meet our Technical Lead</p>
          <article className="dh-lead">
            <svg className="dh-lead-ring" viewBox="0 0 600 600" aria-hidden="true">
              <defs><path id="dh-lead-path" d="M300 300 m-235 0 a235 235 0 1 1 470 0 a235 235 0 1 1 -470 0" /></defs>
              <circle cx="300" cy="300" r="235" fill="none" stroke="#2f4bff" strokeWidth="78" />
              <text fontSize="40" letterSpacing="6" fill="#dfe6ff" fontFamily="Bricolage Grotesque, sans-serif"><textPath href="#dh-lead-path" textLength="1450" lengthAdjust="spacing">{ring}</textPath></text>
            </svg>
            <h2 className="dh-lead-name">{first}</h2>
            {rest.length > 0 && <p className="dh-lead-name2">{rest.join(" ")}</p>}
            <div className="dh-lead-person">
              {m.photo ? (
                <img src={m.photo} alt="" draggable="false" />
              ) : (
                <svg viewBox="0 0 200 240" aria-hidden="true"><circle cx="100" cy="82" r="46" /><path d="M12 240c4-70 40-104 88-104s84 34 88 104Z" /></svg>
              )}
            </div>
            <p className="dh-lead-role">{m.role}<br /><span>Student Dev Hub</span></p>
            <div className="dh-lead-box">
              <strong>{LEAD.headline}</strong>
              <p>{m.bio}</p>
              {LEAD.lines.map((l) => <p key={l}>{l}</p>)}
            </div>
            <div className="dh-lead-bar">
              <span className="dh-lead-logo"><SlashLogo size={26} /> Dev Hub</span>
              <span className="dh-lead-college">Chhatrapati Shivajiraje Mahavidyalaya, Udgir</span>
            </div>
          </article>
        </Reveal>
      </div>
    </section>
  );
}

/* Days / hours / minutes / seconds until the event. */
function Countdown({ date }) {
  const target = new Date(date).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, target - now);
  const parts = [
    ["Days", Math.floor(left / 86400000)],
    ["Hours", Math.floor(left / 3600000) % 24],
    ["Mins", Math.floor(left / 60000) % 60],
    ["Secs", Math.floor(left / 1000) % 60],
  ];
  return (
    <div className="dh-count" role="timer" aria-label="Time until the event">
      {parts.map(([label, v]) => (
        <div key={label}><strong>{String(v).padStart(2, "0")}</strong><span>{label}</span></div>
      ))}
    </div>
  );
}

function UpcomingEvent() {
  const hasDate = UPCOMING.date && !Number.isNaN(new Date(UPCOMING.date).getTime());
  return (
    <section className="dh-section dh-event" id="event">
      <div className="dh-wrap">
        <Reveal>
          <div className="dh-bigblue">
            <div className="dh-bigblue-left">
              <p className="dh-label"><span className="dh-dot" /> Coming soon · 2026</p>
              <div className="dh-retro">
                <span className="dh-burst" aria-hidden="true" />
                <div className="dh-retro-win">
                  <div className="dh-retro-bar"><b>technova<i>.exe</i></b><span>X</span></div>
                  <div className="dh-retro-body">
                    <div className="dh-cube" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
                    <div>
                      <strong>TECHNOVA</strong>
                      <p>Show what you built.</p>
                      <span className="dh-retro-btn">Register ↗</span>
                    </div>
                  </div>
                </div>
                <PixelCursor className="dh-retro-cursor" />
              </div>
              <ul className="dh-tags">
                {["#Projects", "#Coding", "#Prizes", "#Teams", "#Demo", "#Udgir"].map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
            <div className="dh-bigtype" role="img" aria-label={UPCOMING.name}>
              <span>TECH</span><span>NOVA</span><span className="dh-bigyear">2026</span>
            </div>
          </div>
        </Reveal>
        <Reveal delay={80}>
          <h2 className="dh-event-title">{UPCOMING.name}</h2>
          <p className="dh-body dh-narrow">{UPCOMING.text}</p>
          <ul className="dh-event-meta">
            <li><CalendarDays size={15} /> {UPCOMING.dateText}</li>
            <li><MapPin size={15} /> {UPCOMING.venue}</li>
          </ul>
        </Reveal>
        {hasDate && <Reveal delay={100}><Countdown date={UPCOMING.date} /></Reveal>}
        <div className="dh-event-grid">
          {UPCOMING.highlights.map((h, i) => (
            <Reveal key={h.title} delay={i * 100} className="dh-member-wrap">
              <article className="dh-event-card">
                <span className="dh-event-no">0{i + 1}</span>
                <h3>{h.title}</h3>
                <p>{h.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
        <Reveal delay={150}>
          <div className="dh-cta">
            <a className="dh-btn dh-btn-solid" href={UPCOMING.register || SOCIALS.whatsapp} target="_blank" rel="noreferrer">Register your interest <ArrowUpRight size={16} /></a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* Winners as a fanned row of glass cards: click a side card, drag, swipe, use arrows or keys. */
function Winners() {
  const list = TECHOVA.winners;
  const n = list.length;
  const [current, setCurrent] = useState(0);
  const start = useRef(null);
  const go = useCallback((delta) => setCurrent((c) => (c + delta + n) % n), [n]);
  const tones = ["white", "black", "lime"];

  /* Auto-advance every 3.2s. Pauses while hovered / touched / focused, when off-screen,
     or when the visitor presses the Pause button (that button is the accessibility control). */
  const fanRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = fanRef.current;
    if (!el || !("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (paused || userPaused || !visible) return undefined;
    const t = setInterval(() => setCurrent((c) => (c + 1) % n), 3200);
    return () => clearInterval(t);
  }, [paused, userPaused, visible, n]);

  const down = (e) => { start.current = e.clientX; setPaused(true); };
  const up = (e) => {
    if (start.current == null) return;
    const dx = e.clientX - start.current;
    start.current = null;
    if (e.pointerType === "touch") setPaused(false);
    if (dx > 50) go(-1);
    else if (dx < -50) go(1);
  };
  const onKey = (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
  };

  return (
    <div className="dh-fan-wrap">
      <div
        ref={fanRef}
        className="dh-fan"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={`Techova ${TECHOVA.year} winners`}
        onKeyDown={onKey}
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={() => { start.current = null; }}
      >
        {list.map((w, i) => {
          let d = i - current;
          if (d > n / 2) d -= n;
          if (d < -n / 2) d += n;
          const abs = Math.abs(d);
          const style = {
            "--d": d,
            transform: `translateX(calc(${d} * var(--step))) translateZ(${-abs * 90}px) rotateY(${-d * 24}deg) scale(${1 - abs * 0.08})`,
            zIndex: 10 - abs,
            opacity: abs > 2 ? 0 : 1 - abs * 0.18,
            pointerEvents: abs > 2 ? "none" : "auto",
          };
          return (
            <article
              key={i}
              className={`dh-fcard is-${tones[i % 3]} ${d === 0 ? "is-front" : ""}`}
              style={style}
              onClick={() => d !== 0 && setCurrent(i)}
              aria-hidden={d !== 0}
            >
              <header>
                <span className="dh-place">{w.place}</span>
                <span className="dh-prize">{w.prize}</span>
              </header>
              <div className="dh-avatar">
                {w.photo ? <img src={w.photo} alt="" draggable="false" /> : <span>{initials(w.name)}</span>}
              </div>
              <h3>{w.name}</h3>
              <p className="dh-klass">{w.klass}</p>
              <p className="dh-project">{w.project}</p>
              <p className="dh-note">{w.note}</p>
            </article>
          );
        })}
      </div>
      <div className="dh-ring-ctrl">
        <button type="button" onClick={() => go(-1)} aria-label="Previous winner"><ChevronLeft size={18} /></button>
        <span className="dh-ring-count" aria-live="polite">{String(current + 1).padStart(2, "0")} / {String(n).padStart(2, "0")}</span>
        <button type="button" onClick={() => setUserPaused((v) => !v)} aria-pressed={userPaused} aria-label={userPaused ? "Play auto-advance" : "Pause auto-advance"}>{userPaused ? <Play size={16} /> : <Pause size={16} />}</button>
        <button type="button" onClick={() => go(1)} aria-label="Next winner"><ChevronRight size={18} /></button>
      </div>
    </div>
  );
}

/* Hand-drawn lime squiggle arrow (SocialFi style). */
function Squiggle({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 18c40-6 62 10 40 34-18 20-34 6-20-10 14-16 52-8 62 34" />
      <path d="M92 70l2 34-32-6" />
    </svg>
  );
}

function Techova() {
  return (
    <section className="dh-section dh-techova" id="techova">
      <div className="dh-wrap">
        <div className="dh-stage">
          <div className="dh-stage-grid" aria-hidden="true" />
          <p className="dh-label dh-stage-label">Winners · Techova {TECHOVA.year}</p>
          <div className="dh-stage-type" aria-hidden="true">
            <span><b className="dh-hash">#</b>LAST</span>
            <span>YEAR&apos;S</span>
            <span>WINNERS</span>
          </div>
          <Squiggle className="dh-squig dh-squig-a" />
          <Squiggle className="dh-squig dh-squig-b" />
          <h2 className="dh-sr">Last year&apos;s winners</h2>
          <Winners />
          <div className="dh-roundbadge" aria-hidden="true">
            <svg viewBox="0 0 120 120">
              <defs><path id="dh-circ2" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" /></defs>
              <text fontSize="10.5" letterSpacing="2.2" fill="currentColor"><textPath href="#dh-circ2">TECHOVA • {TECHOVA.year} • WINNERS • </textPath></text>
            </svg>
            <Trophy size={22} />
          </div>
        </div>
        <p className="dh-body dh-narrow dh-stage-tag">{TECHOVA.tagline}</p>
      </div>
    </section>
  );
}

function Join() {
  return (
    <section className="dh-section dh-join" id="join">
      <div className="dh-wrap dh-join-grid">
        <Reveal>
          <p className="dh-label">06 — Join</p>
          <h2>Ready to build something?</h2>
          <p className="dh-body dh-narrow">Message us on WhatsApp, follow the channel on Instagram, and come to the next session.</p>
          <div className="dh-cta">
            <a className="dh-btn dh-btn-wa" href={SOCIALS.whatsapp} target="_blank" rel="noreferrer"><WhatsAppIcon size={18} /> Chat on WhatsApp</a>
            <a className="dh-btn" href={SOCIALS.instagram} target="_blank" rel="noreferrer"><InstagramIcon size={18} /> {SOCIALS.instagramHandle}</a>
            <a className="dh-btn" href={SOCIALS.youtube} target="_blank" rel="noreferrer">YouTube <ArrowUpRight size={16} /></a>
          </div>
        </Reveal>
        <KeyCaps />
      </div>
    </section>
  );
}

/* Home page teaser: the full Technova story lives on its own page. */
function TechnovaTeaser() {
  return (
    <section className="dh-section" id="event">
      <div className="dh-wrap">
        <a className="dh-bigblue dh-teaser" href="/devhub/technova">
          <div className="dh-bigblue-left">
            <p className="dh-label"><span className="dh-dot" /> Coming soon · 2026</p>
            <p className="dh-teaser-text">Our annual tech festival. About Technova, last year&apos;s winners and the 2026 countdown live on their own page.</p>
            <span className="dh-yellowbtn dh-teaser-btn">Open Technova <ArrowUpRight size={15} /></span>
          </div>
          <div className="dh-bigtype" role="img" aria-label={UPCOMING.name}>
            <span>TECH</span><span>NOVA</span><span className="dh-bigyear">2026</span>
          </div>
        </a>
      </div>
    </section>
  );
}

function TechnovaAbout() {
  return (
    <section className="dh-section" id="tabout">
      <div className="dh-wrap dh-abtech">
        <Reveal>
          <p className="dh-label">About Technova</p>
          <h2>{ABOUT_TECHNOVA.title}</h2>
          <p className="dh-body dh-narrow">{ABOUT_TECHNOVA.text}</p>
        </Reveal>
        <div className="dh-abtech-grid">
          {ABOUT_TECHNOVA.points.map((p, i) => (
            <Reveal key={p.title} delay={i * 80} className="dh-track-wrap">
              <article className={`dh-track dh-abtech-card is-t${i % 4}`}>
                <span className="dh-track-code">0{i + 1}</span>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* /devhub/technova: coming soon 2026, about, last year's winners. */
function TechnovaPage() {
  return (
    <>
      <UpcomingEvent />
      <TechnovaAbout />
      <Techova />
      <Join />
    </>
  );
}

function HomePage() {
  return (
    <>
      <Hero />
      <About />
      <Bento />
      <Tracks />
      <Team />
      <LeadSpotlight />
      <TechnovaTeaser />
      <Join />
    </>
  );
}

export default function DevHubApp() {
  const tech = /^\/devhub\/technova/i.test(window.location.pathname);
  useEffect(() => {
    document.title = tech ? "Technova 2026 — Student Dev Hub" : "Student Dev Hub — DnyanSetu";
    document.documentElement.classList.add("dh-root");
    /* The site is light-only; this page is dark on purpose. */
    const meta = document.querySelector('meta[name="theme-color"]');
    const prev = meta?.getAttribute("content");
    meta?.setAttribute("content", "#050608");
    return () => {
      document.documentElement.classList.remove("dh-root");
      if (prev) meta?.setAttribute("content", prev);
    };
  }, []);

  return (
    <div className={`dh-page ${tech ? "dh-tpage" : ""}`}>
      <div className="dh-aurora" aria-hidden="true"><i /><i /><i /><i /></div>
      <Header items={tech ? TECH_NAV : NAV} brandHref={tech ? "/devhub" : null} />
      <main>{tech ? <TechnovaPage /> : <HomePage />}</main>
      <footer className="dh-footer">
        <div className="dh-wrap dh-footer-in">
          <span className="dh-foot-brand"><SlashLogo size={18} /> © Dev Hub · Chhatrapati Shivajiraje Mahavidyalaya, Udgir</span>
          <a href="/">Back to DnyanSetu <ArrowUpRight size={13} /></a>
        </div>
      </footer>

      <aside className="dh-float" aria-label="Contact">
        <a className="dh-float-btn dh-float-wa" href={SOCIALS.whatsapp} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"><WhatsAppIcon /></a>
        <a className="dh-float-btn dh-float-ig" href={SOCIALS.instagram} target="_blank" rel="noreferrer" aria-label={`Instagram ${SOCIALS.instagramHandle}`}><InstagramIcon /></a>
      </aside>
    </div>
  );
}
