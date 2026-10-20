/* ============================================================================
   Admin kit — the shared layout for every admin area (DnyanSetu admin,
   RaktSetu admin, Scholarship admin). Modelled on a clean banking-style dashboard:
   white sidebar, cool-grey canvas, one green stat tile, green rounded bars,
   week strip + ring card, and clean tables.
   Styles are in adminKit.css (all scoped under .ak).
   ========================================================================== */

import React, { useMemo, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, LogOut, Menu, Search, X, ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import "./adminKit.css";

const initialsOf = (name = "") =>
  name.split(" ").filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "A";

/* ------------------------------------------------------------------- shell */

export function AdminShell({
  brand = "DnyanSetu", logo = "/dnyansetu-logo.png", tag = "Admin", nav = [], active, title, user, onLogout,
  promo, footer = [], search, onSearch, searchPlaceholder = "Search…", bell, children,
}) {
  const [open, setOpen] = useState(false);
  const pick = (item) => {
    setOpen(false);
    if (item.href) { window.location.href = item.href; return; }
    item.onClick?.();
  };
  const renderItem = (item) => {
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        type="button"
        className={`ak-nav-item${active === item.id ? " is-active" : ""}`}
        aria-current={active === item.id ? "page" : undefined}
        onClick={() => pick(item)}
      >
        {Icon && <Icon size={17} />}
        <span>{item.label}</span>
        {item.badge ? <em className="ak-badge">{item.badge}</em> : null}
      </button>
    );
  };

  return (
    <div className="ak">
      <div className={`ak-scrim${open ? " is-open" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`ak-side${open ? " is-open" : ""}`} aria-label="Admin navigation">
        <div className="ak-brand">
          <img className="ak-mark" src={logo} alt="" width="34" height="34" />
          <span className="ak-logo">{brand}</span>
          <span className="ak-tag">{tag}</span>
          <button type="button" className="ak-close" aria-label="Close menu" onClick={() => setOpen(false)}><X size={18} /></button>
        </div>
        <nav className="ak-nav">{nav.map(renderItem)}</nav>
        {promo && (
          <div className="ak-promo">
            <strong>{promo.title}</strong>
            <p>{promo.text}</p>
            <button type="button" onClick={() => pick(promo)}>{promo.button}</button>
          </div>
        )}
        <div className="ak-side-foot">
          {footer.map(renderItem)}
          {onLogout && (
            <button type="button" className="ak-nav-item" onClick={onLogout}>
              <LogOut size={17} /><span>Log out</span>
            </button>
          )}
        </div>
      </aside>

      <div className="ak-body">
        <header className="ak-top">
          <button type="button" className="ak-menu" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={20} /></button>
          <h1 className="ak-title">{title}</h1>
          <div className="ak-top-tools">
            {onSearch && (
              <label className="ak-search">
                <Search size={15} />
                <input value={search || ""} onChange={(e) => onSearch(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
              </label>
            )}
            {bell && (
              <button type="button" className="ak-round" aria-label={bell.label} onClick={bell.onClick}>
                <Bell size={15} />
                {bell.count ? <i className="ak-dot" /> : null}
              </button>
            )}
            <span className="ak-avatar" title={user?.name || "Administrator"}>{initialsOf(user?.name)}</span>
          </div>
        </header>
        <main className="ak-main">{children}</main>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ small pieces */

/* Day / Week / Month / Year style switch. */
export function PillTabs({ options, value, onChange, label = "Range" }) {
  return (
    <div className="ak-pills" role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" className={value === id ? "is-on" : ""} aria-pressed={value === id} onClick={() => onChange(id)}>
          {text}
        </button>
      ))}
    </div>
  );
}

/* One figure. `dark` is the single black tile; `delta` is { pct, label }. */
export function StatTile({ label, value, delta, note, dark }) {
  const up = delta && delta.pct !== null ? delta.pct >= 0 : true;
  return (
    <div className={`ak-stat${dark ? " is-dark" : ""}`}>
      <span className="ak-stat-label">{label}</span>
      <strong className="ak-stat-value">{value}</strong>
      {delta && delta.pct === null ? (
        <span className="ak-delta"><small>{delta.label}</small></span>
      ) : delta ? (
        <span className={`ak-delta ${up ? "is-up" : "is-down"}`}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {delta.pct > 0 ? "+" : ""}{delta.pct}% <small>{delta.label || "from last month"}</small>
        </span>
      ) : note ? <span className="ak-delta"><small>{note}</small></span> : null}
    </div>
  );
}

export function StatRow({ children }) {
  return <div className="ak-stats">{children}</div>;
}

/* Rounded bars. data: [{ label, value }]. The tallest bar is drawn grey. */
export function BarCard({ title, data, onOpen, unit = "", empty = "Nothing to show yet." }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = niceStep(max);
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let v = top; v >= 0; v -= step) ticks.push(v);
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const any = data.some((d) => d.value > 0);

  return (
    <section className="ak-card ak-bars">
      <div className="ak-card-head">
        <h2>{title}</h2>
        {onOpen && (
          <button type="button" className="ak-round" aria-label={`Open ${title}`} onClick={onOpen}><ArrowUpRight size={15} /></button>
        )}
      </div>
      <div className="ak-chart">
        <ol className="ak-yaxis" aria-hidden="true">{ticks.map((t) => <li key={t}>{shortNum(t)}</li>)}</ol>
        <div className="ak-plot">
          <div className="ak-grids" aria-hidden="true">
            {ticks.map((t) => <i key={t} className="ak-grid" style={{ bottom: `${(t / top) * 100}%` }} />)}
          </div>
          <div className="ak-cols">
            {data.map((d, i) => (
              <div className="ak-col" key={d.label + i}>
                <div className="ak-bar-wrap" title={`${d.label}: ${d.value}${unit}`}>
                  <span className={`ak-bar${i === peak && any ? " is-peak" : ""}`} style={{ height: `${Math.max(d.value ? 4 : 0, (d.value / top) * 100)}%` }} />
                </div>
                <b className={i === peak && any ? "is-peak" : ""}>{d.label}</b>
              </div>
            ))}
          </div>
          {!any && <p className="ak-chart-empty">{empty}</p>}
        </div>
      </div>
    </section>
  );
}

function niceStep(max) {
  const raw = max / 5;
  const pow = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  const f = raw / pow;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return Math.max(1, n * pow);
}
const shortNum = (n) => (n >= 1000 ? `${n / 1000}K` : String(n));

/* A week strip around today with a ring card beneath it. */
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function CalendarCard({ ring }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const today = new Date();
  const days = useMemo(() => [-2, -1, 0, 1, 2].map((o) => {
    const d = new Date(anchor); d.setDate(anchor.getDate() + o); return d;
  }), [anchor]);
  const shift = (n) => setAnchor((a) => { const d = new Date(a); d.setDate(a.getDate() + n); return d; });
  const same = (a, b) => a.toDateString() === b.toDateString();

  return (
    <section className="ak-card ak-cal">
      <div className="ak-cal-head">
        <button type="button" aria-label="Earlier days" onClick={() => shift(-5)}><ChevronLeft size={16} /></button>
        <strong>{anchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</strong>
        <button type="button" aria-label="Later days" onClick={() => shift(5)}><ChevronRight size={16} /></button>
      </div>
      <div className="ak-week">
        {days.map((d) => (
          <button key={d.toISOString()} type="button" className={same(d, anchor) ? "is-sel" : ""} onClick={() => setAnchor(d)} aria-label={d.toDateString()}>
            <small>{DAY[d.getDay()]}</small>
            <b className={same(d, today) ? "is-today" : ""}>{d.getDate()}</b>
          </button>
        ))}
      </div>
      {ring && <RingCard {...ring} />}
    </section>
  );
}

export function RingCard({ title, pct, note }) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const r = 20, c = 2 * Math.PI * r;
  return (
    <div className="ak-ring">
      <div>
        <strong>{title}</strong>
        {note && <span className="ak-delta is-up"><small>{note}</small></span>}
      </div>
      <svg viewBox="0 0 50 50" width="52" height="52" role="img" aria-label={`${title} ${p}%`}>
        <circle cx="25" cy="25" r={r} className="ak-ring-track" />
        <circle cx="25" cy="25" r={r} className="ak-ring-arc" strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 25 25)" />
        <text x="25" y="29" textAnchor="middle">{p}%</text>
      </svg>
    </div>
  );
}

/* A titled white card for tables and forms. */
export function Panel({ title, icon: Icon, right, children, className = "" }) {
  return (
    <section className={`ak-card ak-panel ${className}`}>
      {(title || right) && (
        <div className="ak-card-head">
          <h2>{Icon && <Icon size={16} />}{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/* ---------------------------------------------------------- time bucketing */

/* Counts items per period for the chart. mode: day | week | month | year. */
export function bucketCounts(dates, mode = "month") {
  const now = new Date();
  const buckets = [];
  const add = (label, from, to) => buckets.push({ label, from: from.getTime(), to: to.getTime(), value: 0 });
  if (mode === "day") {
    for (let i = 6; i >= 0; i--) {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      add(DAY[s.getDay()], s, new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1));
    }
  } else if (mode === "week") {
    for (let i = 5; i >= 0; i--) {
      const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7 - 6);
      add(`${s.getDate()} ${s.toLocaleString("en-IN", { month: "short" })}`, s, new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7));
    }
  } else if (mode === "year") {
    for (let i = 5; i >= 0; i--) {
      const y = now.getFullYear() - i;
      add(String(y), new Date(y, 0, 1), new Date(y + 1, 0, 1));
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
      add(s.toLocaleString("en-IN", { month: "short" }), s, new Date(s.getFullYear(), s.getMonth() + 1, 1));
    }
  }
  dates.forEach((d) => {
    const t = typeof d === "number" ? d : Date.parse(d);
    if (Number.isNaN(t)) return;
    const b = buckets.find((x) => t >= x.from && t < x.to);
    if (b) b.value += 1;
  });
  return buckets;
}

/* This month so far against the SAME days of last month (a month that is only
   half over must not be compared with a whole one). With nothing to compare
   against there is no percentage, only a plain note. */
export function monthDelta(dates) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const prevEnd = Math.min(new Date(now.getFullYear(), now.getMonth() - 1, now.getDate() + 1).getTime(), monthStart);
  let cur = 0;
  let prev = 0;
  dates.forEach((d) => {
    const t = typeof d === "number" ? d : Date.parse(d);
    if (Number.isNaN(t)) return;
    if (t >= monthStart && t <= now.getTime()) cur += 1;
    else if (t >= prevStart && t < prevEnd) prev += 1;
  });
  if (prev === 0) return { pct: null, label: cur > 0 ? "none in the same days last month" : "none yet" };
  return { pct: Math.round(((cur - prev) / prev) * 100), label: "vs same days last month" };
}
