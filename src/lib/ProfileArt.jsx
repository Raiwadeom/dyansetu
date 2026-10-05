/* ============================================================================
   Header artwork

   CampusCover   — page banners (Subject Notes, Scholarships, Question Papers,
                   Practice Tests): the abstract art below with content on top.
   ProfileCover  — the profile banner: an abstract navy and saffron design
                   with flowing lines and a faint college crest. (Photos crop
                   badly in a strip this wide, so none are used here.)
   AvatarCycle   — the round profile picture. DnyanSetu does not take personal
                   photos, so it shows an illustrated person (Avataaars via
                   DiceBear, free for commercial use, saved in public/avatars)
                   matched to the gender in the profile, fixed per account.
   ========================================================================== */

import React from "react";
import collegeLogo from "../img/college-logo.jpg";

/* Page banner: the same abstract navy + saffron art as the profile banner,
   with the page's own content laid over it. (Photos were tried and dropped:
   they crop badly and fight with the text.) */
export function CampusCover({ className = "", children }) {
  return (
    <div className={`campus-cover ${className}`}>
      <ProfileCover className="campus-cover-art" />
      {children}
    </div>
  );
}

export function ProfileCover({ className = "" }) {
  return (
    <div className={`profile-art-cover ${className}`} aria-hidden="true">
      <svg className="profile-art-lines" viewBox="0 0 1200 200" preserveAspectRatio="none">
        <path d="M0 150 C 200 90, 380 190, 600 120 S 980 40, 1200 90" />
        <path d="M0 170 C 220 110, 400 205, 620 140 S 1000 60, 1200 110" />
        <path d="M0 130 C 180 70, 360 170, 580 100 S 960 20, 1200 70" />
        <path d="M0 190 C 240 130, 420 215, 640 160 S 1020 80, 1200 130" />
      </svg>
      <span className="profile-art-dots" />
      <img className="profile-art-crest" src={collegeLogo} alt="" draggable={false} />
    </div>
  );
}

/* The same number every time for the same text (the account id). */
function hashOf(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

const AVATARS = {
  male: Array.from({ length: 8 }, (_, i) => `/avatars/male-${i + 1}.svg`),
  female: Array.from({ length: 8 }, (_, i) => `/avatars/female-${i + 1}.svg`),
};
const AVATAR_BG = ["#DBEAFE", "#E0E7FF", "#DCFCE7", "#FFEDD5", "#FCE7F3", "#CFFAFE", "#FEF3C7", "#EDE9FE"];

/* One fixed avatar per account (picked by the account id, so it never
   changes on refresh): an illustrated person matching the gender in the
   profile. Other / not chosen yet: a plain silhouette. */
export function AvatarCycle({ gender = "", seed = "", className = "" }) {
  const h = hashOf(String(seed || "dnyansetu"));
  const list = AVATARS[gender];
  if (list) {
    const i = h % list.length;
    return (
      <span className={`avatar-cycle ${className}`} aria-hidden="true" style={{ background: AVATAR_BG[i] }}>
        <img className="avatar-illustration" src={list[i]} alt="" draggable={false} />
      </span>
    );
  }
  return (
    <span className={`avatar-cycle ${className}`} aria-hidden="true">
      <svg viewBox="0 0 100 100" className="avatar-figure">
        <defs>
          <linearGradient id="avg-neutral" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#334155" />
            <stop offset="1" stopColor="#94A3B8" />
          </linearGradient>
        </defs>
        <rect width="100" height="100" fill="url(#avg-neutral)" />
        <path d="M16 100c2-18 16-30 34-30s32 12 34 30z" fill="#fff" opacity="0.95" />
        <circle cx="50" cy="45" r="16.5" fill="#fff" />
      </svg>
    </span>
  );
}
