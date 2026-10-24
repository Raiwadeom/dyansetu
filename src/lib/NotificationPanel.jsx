import React, { useEffect, useRef } from "react";
import { BellOff, Droplet, Megaphone, NotebookPen } from "lucide-react";

const ICONS = { announcement: Megaphone, note: NotebookPen, blood: Droplet };

function ago(time) {
  const mins = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(time).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/* The dropdown under the bell. onPick receives the tapped item. */
export default function NotificationPanel({ items, seen, onPick, onMarkAll, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const away = (e) => { if (ref.current && !ref.current.contains(e.target) && !e.target.closest(".ak-bellwrap")) onClose(); };
    const esc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [onClose]);

  return (
    <div className="np-panel" ref={ref} role="dialog" aria-label="Notifications">
      <div className="np-panel-head">
        <strong>Notifications</strong>
        <button type="button" onClick={onMarkAll}>Mark all read</button>
      </div>
      {items.length === 0 ? (
        <p className="np-panel-empty"><BellOff size={18} /> Nothing new right now.</p>
      ) : (
        <ul className="np-panel-list">
          {items.map((it) => {
            const Icon = ICONS[it.kind] || Megaphone;
            return (
              <li key={it.id}>
                <button type="button" className={`np-row np-row--${it.kind}${it.time > seen ? " is-new" : ""}`} onClick={() => onPick(it)}>
                  <span className="np-row-icon"><Icon size={16} /></span>
                  <span className="np-row-copy">
                    <strong>{it.title}</strong>
                    <small>{it.meta} · {ago(it.time)}</small>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
