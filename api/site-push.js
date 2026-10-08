/* ============================================================================
   /api/site-push — DnyanSetu phone / browser notifications

   POST   { subscription }              save this browser (sign-in optional)
   DELETE { endpoint }                  forget it (notifications turned off)
   PUT    { oldEndpoint, subscription } the service worker swapping in a
                                        renewed subscription
   POST   { notify: kind, id }          something new was published; signed in.
          kind = "announcement" | "note" | "scholarship"

   For notify the browser only names *what* was published. The row is re-read
   here, the caller must be its author (or an administrator), and a one-time
   marker is claimed before sending, so a repeated or forged call can never
   push twice. Scholarships may be re-announced after 6 hours.
   ========================================================================== */

import {
  authenticate, bearerToken, missingEnv, readBody, supabaseAdmin,
} from "./_lib/supabaseAdmin.js";
import { broadcast } from "./_lib/sitePush.js";

function isPushEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && value.length <= 1000;
  } catch {
    return false;
  }
}

function validSub(sub) {
  return sub && isPushEndpoint(sub.endpoint)
    && typeof sub.keys?.p256dh === "string" && sub.keys.p256dh.length < 200
    && typeof sub.keys?.auth === "string" && sub.keys.auth.length < 100;
}

const clip = (text, n) => {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};

const CATEGORY_LABEL = {
  event: "Event", competition: "Competition", exam: "Exam", holiday: "Holiday", workshop: "Workshop", notice: "Notice",
};

async function notify(caller, kind, id) {
  const admin = supabaseAdmin();
  const me = caller.user.id;
  const isAdmin = ["admin", "scholarship"].includes(caller.profile.role);
  const now = new Date().toISOString();
  const recent = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  if (kind === "announcement") {
    const { data: row } = await admin.from("announcements").select("posted_by").eq("id", id).maybeSingle();
    if (!row || (!isAdmin && row.posted_by !== me)) return null;
    const { data } = await admin.from("announcements")
      .update({ push_sent_at: now })
      .eq("id", id).is("push_sent_at", null).gte("created_at", recent)
      .select("id, title, category, author_name, href");
    const a = data?.[0];
    if (!a) return null;
    const label = CATEGORY_LABEL[a.category] || "Notice";
    return {
      title: `DnyanSetu · New ${label.toLowerCase()}`,
      body: clip(a.author_name ? `${a.title} — ${a.author_name}` : a.title, 180),
      url: a.href && a.href.startsWith("/") ? a.href : "/#announcements",
      tag: `ann-${a.id}`,
    };
  }

  if (kind === "note") {
    const { data: row } = await admin.from("notes").select("uploaded_by").eq("id", id).maybeSingle();
    if (!row || (!isAdmin && row.uploaded_by !== me)) return null;
    const { data } = await admin.from("notes")
      .update({ push_sent_at: now })
      .eq("id", id).is("push_sent_at", null).gte("created_at", recent)
      .select("id, title, subject, semester, author_name, stream_id");
    const n = data?.[0];
    if (!n) return null;
    /* Students see only their own stream's notes, so students of every other
       stream are left out of this push. */
    const { data: others } = await admin.from("profiles").select("id")
      .eq("role", "student").not("details->>stream", "is", null).neq("details->>stream", n.stream_id);
    return {
      skipUsers: (others || []).map((o) => o.id),
      title: `New notes: ${clip(n.subject, 60)}`,
      body: clip(`${n.title}${n.semester ? ` (${n.semester})` : ""} — uploaded by ${n.author_name || "Faculty"}. Tap to download.`, 180),
      url: `/notes?note=${encodeURIComponent(n.id)}`,
      tag: `note-${n.id}`,
    };
  }

  if (kind === "scholarship") {
    if (!isAdmin) return null;
    const cutoff = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const { data } = await admin.from("scholarships")
      .update({ push_sent_at: now })
      .eq("id", id).eq("active", true)
      .or(`push_sent_at.is.null,push_sent_at.lt.${cutoff}`)
      .select("id, name, closes_on");
    const s = data?.[0];
    if (!s) return null;
    const last = s.closes_on
      ? ` Last date: ${new Date(`${s.closes_on}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.`
      : "";
    return {
      title: "Scholarship update",
      body: clip(`${s.name} — details updated on DnyanSetu.${last}`, 180),
      url: "/scholarships",
      tag: `sch-${s.id}`,
    };
  }
  return null;
}

export default async function handler(req, res) {
  if (!["POST", "DELETE", "PUT"].includes(req.method)) {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }
  if (missingEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]).length) {
    res.status(503).json({ error: "Notifications are not available right now." });
    return;
  }

  const body = readBody(req);
  const admin = supabaseAdmin();

  try {
    if (req.method === "PUT") {
      if (!isPushEndpoint(body.oldEndpoint) || !validSub(body.subscription)) {
        res.status(400).json({ error: "That is not a valid push subscription." });
        return;
      }
      const sub = body.subscription;
      await admin.from("site_push_subscriptions")
        .update({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } })
        .eq("endpoint", body.oldEndpoint);
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "DELETE") {
      if (!isPushEndpoint(body.endpoint)) {
        res.status(400).json({ error: "Missing endpoint." });
        return;
      }
      await admin.from("site_push_subscriptions").delete().eq("endpoint", body.endpoint);
      res.status(200).json({ ok: true });
      return;
    }

    if (body.notify) {
      const caller = await authenticate(bearerToken(req));
      if (!caller) {
        res.status(401).json({ error: "Your session is not valid. Please sign in again." });
        return;
      }
      const id = typeof body.id === "string" ? body.id.slice(0, 120) : "";
      if (!id || !["announcement", "note", "scholarship"].includes(body.notify)) {
        res.status(400).json({ error: "Bad request." });
        return;
      }
      const payload = await notify(caller, body.notify, id);
      if (!payload) { res.status(200).json({ ok: true, sent: 0 }); return; }
      const { skipUsers, ...message } = payload;
      const result = await broadcast(message, { skipUsers });
      res.status(200).json({ ok: true, sent: result.sent || 0 });
      return;
    }

    if (!validSub(body.subscription)) {
      res.status(400).json({ error: "That is not a valid push subscription." });
      return;
    }
    const token = bearerToken(req);
    const caller = token ? await authenticate(token) : null;
    const sub = body.subscription;
    const { error } = await admin.from("site_push_subscriptions").upsert({
      endpoint: sub.endpoint,
      keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      user_id: caller?.user.id || null,
      user_agent: String(req.headers["user-agent"] || "").slice(0, 300),
    }, { onConflict: "endpoint" });
    if (error) {
      console.error("[site-push] save failed:", error.message);
      res.status(500).json({ error: "Could not turn on notifications for this browser." });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[site-push] failed:", error.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
