import React from "react";
import { Code2 } from "lucide-react";

/* The picture shown when a project has no screenshot: a colourful gradient
   (chosen from the title, so a project always keeps the same colours), a soft
   dot pattern, the project's initials and a code icon. */
const PALETTE = [
  ["#0F766E", "#2DD4BF"], ["#1D4ED8", "#60A5FA"], ["#6D28D9", "#A78BFA"], ["#C2410C", "#FDBA74"],
  ["#BE185D", "#F9A8D4"], ["#15803D", "#86EFAC"], ["#0E7490", "#67E8F9"], ["#B45309", "#FCD34D"],
];

function hash(text = "") {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

const initialsOf = (title = "") =>
  title.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase() || "P";

export default function ProjectCover({ title, size = "card" }) {
  const [a, b] = PALETTE[hash(title) % PALETTE.length];
  return (
    <span className={`sp-cover sp-cover--${size}`} style={{ background: `linear-gradient(135deg, ${a}, ${b})` }} aria-hidden="true">
      <i className="sp-cover-dots" />
      <b>{initialsOf(title)}</b>
      {size === "card" && <Code2 className="sp-cover-icon" size={22} />}
    </span>
  );
}
