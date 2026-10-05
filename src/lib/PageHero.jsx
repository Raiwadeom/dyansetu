/* The banner at the top of the study pages (Subject Notes, Scholarships,
   Question Papers, Practice Tests): campus photos behind, the page's purpose
   on the left, optional stat tiles on the right, optional content below
   (a search box, for example). Styles: .notes-hero* in App.jsx. */

import React from "react";
import { CampusCover } from "./ProfileArt.jsx";

export default function PageHero({ icon: Icon, eyebrow, title, highlight = "", sub, stats = [], actions = null, children = null }) {
  return (
    <CampusCover className="notes-hero">
      <div className={`notes-hero-grid ${stats.length ? "" : "is-single"}`}>
        <div className="notes-hero-copy">
          {eyebrow && <p className="notes-hero-eyebrow">{Icon && <Icon size={14} />} {eyebrow}</p>}
          <h1 className="notes-hero-title">{title}{highlight && <> <span>{highlight}</span></>}</h1>
          {sub && <p className="notes-hero-sub">{sub}</p>}
          {actions}
        </div>
        {stats.length > 0 && (
          <div className="notes-hero-stats" style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}>
            {stats.map(({ icon: StatIcon, value, label }) => (
              <div className="notes-stat" key={label}>
                {StatIcon && <span className="notes-stat-icon"><StatIcon size={18} /></span>}
                <strong>{value}</strong>
                <small>{label}</small>
              </div>
            ))}
          </div>
        )}
      </div>
      {children}
    </CampusCover>
  );
}
