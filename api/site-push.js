/* ============================================================================
   /api/site-push — DnyanSetu phone / browser notifications (rebuilt 2026-10-11;
   devices in push_devices, every send logged in push_log — migration 0026)

   POST   { subscription }              save this browser (sign-in optional)
   DELETE { endpoint }                  forget it (notifications turned off)
   PUT    { oldEndpoint, subscription } the service worker swapping in a
                                        renewed subscription
   POST   { notify: kind, id }          something new was published; signed in.
          kind = "announcement" | "note" | "scholarship" | "talent"
   POST   { test: true }                admin: test notification to own devices

   For notify the browser only names *what* was published. The row is re-read
   here, the caller must be its author (or an administrator), and a one-time
   marker is claimed before sending, so a repeated or forged call can never
   push twice. Scholarships may be re-announced after 6 hours.
   ========================================================================== */

import {
  authenticate, bearerToken, missingEnv, readBody, supabaseAdmin,
} from "./_lib/supabaseAdmin.js";
import { broadcast, sendToUser } from "./_lib/sitePush.js";

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

/* Like clip, but keeps line breaks (poem / shayari lines). */
const clipLines = (text, n) => {
  const s = String(text || "").split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
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
      image: "/push/announcement.jpg",
      action: "Read notice",
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
      image: "/push/note.jpg",
      action: "Open notes",
    };
  }

  if (kind === "talent") {
    const { data: row } = await admin.from("talent_posts").select("author_id").eq("id", id).maybeSingle();
    if (!row || row.author_id !== me) return null;
    /* One notification per student per hour, so a burst of posts does not
       flood every phone; each post is still announced at most once. */
    const { count } = await admin.from("talent_posts").select("id", { count: "exact", head: true })
      .eq("author_id", me).gte("push_sent_at", recent);
    if (count) return null;
    const { data } = await admin.from("talent_posts")
      .update({ push_sent_at: now })
      .eq("id", id).is("push_sent_at", null).gte("created_at", recent)
      .select("id, category, title, body, author_name, images");
    const t = data?.[0];
    if (!t) return null;
    const kindLabel = { poem: "poem", shayari: "shayari", content: "creation" }[t.category] || "post";
    const lines = (t.body || "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 2);
    const preview = [t.title ? `“${t.title}”` : "", ...lines].filter(Boolean).join("\n");
    /* A content post with a photo shows that photo (cropped 2:1); everything
       else shows the Talent Corner banner for its category. */
    const photo = t.category === "content" && Array.isArray(t.images) && t.images[0]?.url
      ? String(t.images[0].url).replace("/image/upload/", "/image/upload/c_fill,g_auto,w_1024,h_512,q_auto,f_jpg/")
      : "";
    return {
      skipUsers: [me],
      title: `✨ New ${kindLabel} by ${clip(t.author_name || "a student", 40)}`,
      body: clipLines(preview || "Tap to see it in the Talent Corner.", 180),
      url: `/talent?post=${encodeURIComponent(t.id)}`,
      tag: `talent-${t.id}`,
      image: photo || `/push/talent-${t.category}.jpg`,
      action: t.category === "content" ? "Watch now" : "Read now",
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
      image: "/push/scholarship.jpg",
      action: "View scheme",
    };
  }
  return null;
}

function deviceRow(sub, userId, userAgent) {
  return {
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_id: userId,
    user_agent: String(userAgent || "").slice(0, 300),
    last_seen_at: new Date().toISOString(),
    dead_at: null,
  };
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
    /* The service worker swapping in a renewed subscription. */
    if (req.method === "PUT") {
      if (!isPushEndpoint(body.oldEndpoint) || !validSub(body.subscription)) {
        res.status(400).json({ error: "That is not a valid push subscription." });
        return;
      }
      const { data: old } = await admin.from("push_devices").select("user_id").eq("endpoint", body.oldEndpoint).maybeSingle();
      await admin.from("push_devices").delete().eq("endpoint", body.oldEndpoint);
      await admin.from("push_devices").upsert(deviceRow(body.subscription, old?.user_id || null, req.headers["user-agent"]), { onConflict: "endpoint" });
      res.status(200).json({ ok: true });
      return;
    }

    if (req.method === "DELETE") {
      if (!isPushEndpoint(body.endpoint)) {
        res.status(400).json({ error: "Missing endpoint." });
        return;
      }
      await admin.from("push_devices").delete().eq("endpoint", body.endpoint);
      res.status(200).json({ ok: true });
      return;
    }

    /* Admin: send a test notification to this account's own devices. */
    if (body.test) {
      const caller = await authenticate(bearerToken(req));
      if (!caller || !["admin", "scholarship"].includes(caller.profile.role)) {
        res.status(403).json({ error: "Only the administrator can send a test notification." });
        return;
      }
      const time = new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
      const result = await sendToUser(caller.user.id, {
        title: "DnyanSetu · Test notification",
        body: `Sent at ${time}. If you can read this, notifications work on this device.`,
        url: "/",
        tag: `test-${Date.now()}`,
        image: "/push/announcement.jpg",
        action: "Open DnyanSetu",
      });
      res.status(200).json({ ok: true, ...result });
      return;
    }

    if (body.notify) {
      const caller = await authenticate(bearerToken(req));
      if (!caller) {
        res.status(401).json({ error: "Your session is not valid. Please sign in again." });
        return;
      }
      const id = typeof body.id === "string" ? body.id.slice(0, 120) : "";
      if (!id || !["announcement", "note", "scholarship", "talent"].includes(body.notify)) {
        res.status(400).json({ error: "Bad request." });
        return;
      }
      const payload = await notify(caller, body.notify, id);
      if (!payload) { res.status(200).json({ ok: true, sent: 0 }); return; }
      const { skipUsers, ...message } = payload;
      const result = await broadcast(message, { skipUsers, kind: body.notify, refId: id });
      res.status(200).json({ ok: true, sent: result.sent || 0 });
      return;
    }

    /* Register (or refresh) this browser. Sign-in is optional. */
    if (!validSub(body.subscription)) {
      res.status(400).json({ error: "That is not a valid push subscription." });
      return;
    }
    const sub = body.subscription;
    const { data: known } = await admin.from("push_devices").select("dead_at").eq("endpoint", sub.endpoint).maybeSingle();
    if (known?.dead_at) {
      /* Google already said this subscription is gone: the browser must make
         a new one instead of reviving it. */
      await admin.from("push_devices").delete().eq("endpoint", sub.endpoint);
      res.status(200).json({ ok: false, stale: true });
      return;
    }
    const token = bearerToken(req);
    const caller = token ? await authenticate(token) : null;
    const { error } = await admin.from("push_devices")
      .upsert(deviceRow(sub, caller?.user.id || null, req.headers["user-agent"]), { onConflict: "endpoint" });
    if (error) {
      console.error("[push] save failed:", error.message);
      res.status(500).json({ error: "Could not turn on notifications for this browser." });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("[push] failed:", error.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
