/* ============================================================================
   DnyanSetu — the bell's list.

   Built from what is already public: current announcements, new notes (only
   the student's own stream) and open RaktSetu blood requests. Nothing is
   stored on the server; "unread" is simply "newer than the last time this
   browser opened the bell".
   ========================================================================== */

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchLiveAnnouncements } from "./siteContent.js";
import { fetchNotes } from "./notes.js";
import { listOpenRequests } from "../raktsetu/api.js";
import { noteStreamById } from "../data/notes.js";

const REFRESH_MS = 60 * 1000;
const FIRST_VISIT_WINDOW = 3 * 24 * 60 * 60 * 1000;

const seenKey = (userId) => `dnyansetu.bell.seen.${userId || "anon"}`;

function readSeen(userId) {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    if (raw) return Number(raw) || 0;
  } catch { /* storage blocked */ }
  return Date.now() - FIRST_VISIT_WINDOW;
}

const stamp = (value) => {
  const t = typeof value === "number" ? value : Date.parse(value || "");
  return Number.isFinite(t) ? t : 0;
};

export function useNotifications(user, enabled = true) {
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState(() => readSeen(user?.id));

  useEffect(() => { setSeen(readSeen(user?.id)); }, [user?.id]);

  useEffect(() => {
    if (!enabled || !user) return undefined;
    let cancelled = false;

    const load = async () => {
      const lockedStream = user.role === "student" && noteStreamById(user.stream) ? user.stream : "";
      const [announcements, notes, requests] = await Promise.all([
        fetchLiveAnnouncements().catch(() => null),
        fetchNotes(lockedStream ? { streamId: lockedStream } : {}).catch(() => []),
        listOpenRequests().catch(() => []),
      ]);
      if (cancelled) return;

      const list = [];
      (announcements || []).slice(0, 8).forEach((a) => list.push({
        id: `a-${a.id}`, kind: "announcement", title: a.title, meta: "Announcement",
        time: stamp(a.created_at) || stamp(`${a.notice_date}T00:00:00`),
      }));
      (notes || []).filter((n) => n.uploadedBy !== user.id).slice(0, 8).forEach((n) => list.push({
        id: `n-${n.id}`, kind: "note", title: n.title, meta: `New notes · ${n.subject}`, time: n.createdAt,
      }));
      (requests || []).filter((r) => r.requester_id !== user.id).slice(0, 5).forEach((r) => list.push({
        id: `r-${r.id}`, kind: "blood", title: `${r.blood_group} blood needed${r.hospital ? ` at ${r.hospital}` : ""}`,
        meta: `RaktSetu${r.city ? ` · ${r.city}` : ""}`, time: stamp(r.created_at),
      }));
      list.sort((x, y) => y.time - x.time);
      setItems(list.slice(0, 20));
    };

    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [enabled, user?.id, user?.role, user?.stream]);

  const unread = useMemo(() => items.filter((it) => it.time > seen).length, [items, seen]);

  const markAllRead = useCallback(() => {
    const now = Date.now();
    setSeen(now);
    try { localStorage.setItem(seenKey(user?.id), String(now)); } catch { /* storage blocked */ }
  }, [user?.id]);

  return { items, unread, seen, markAllRead };
}
