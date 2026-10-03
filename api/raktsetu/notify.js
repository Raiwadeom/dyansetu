/* ============================================================================
   POST /api/raktsetu/notify — push for something that just happened

   { type: "response", requestId } — the caller tapped "I can help"; the
                                      requester gets a push.
   { type: "closed",   requestId } — the caller (the requester) closed the
                                      request; everyone who offered to help
                                      gets a push.

   The browser only says *what* happened. Every fact is re-checked here from
   the database, and a one-time marker column is claimed before sending, so a
   repeated or forged call can never push anything twice or to anyone else.
   ========================================================================== */

import {
  authenticate, bearerToken, missingEnv, readBody, supabaseAdmin,
} from "../_lib/supabaseAdmin.js";
import { sendClosedPush, sendResponsePush } from "../_lib/raktsetuAlerts.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  if (missingEnv(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]).length) {
    res.status(503).json({ error: "Alerts are not available right now." });
    return;
  }

  const caller = await authenticate(bearerToken(req));
  if (!caller) {
    res.status(401).json({ error: "Your session is not valid. Please sign in again." });
    return;
  }

  const body = readBody(req);
  const requestId = typeof body.requestId === "string" ? body.requestId : "";
  if (!UUID.test(requestId) || !["response", "closed"].includes(body.type)) {
    res.status(400).json({ error: "Bad request." });
    return;
  }

  const admin = supabaseAdmin();
  const me = caller.user.id;

  try {
    if (body.type === "response") {
      /* Claim this response's one notification. No row back = not the
         caller's response, or already notified. */
      const { data: claimed } = await admin
        .from("request_responses")
        .update({ requester_notified_at: new Date().toISOString() })
        .eq("request_id", requestId)
        .eq("responder_id", me)
        .is("requester_notified_at", null)
        .select("id");
      if (!claimed?.length) { res.status(200).json({ ok: true, sent: 0 }); return; }

      const [{ data: request }, { data: donor }] = await Promise.all([
        admin.from("blood_requests").select("id, requester_id, blood_group, hospital, city, status").eq("id", requestId).maybeSingle(),
        admin.from("raktsetu_profiles").select("blood_group, city").eq("user_id", me).maybeSingle(),
      ]);
      if (!request || request.status !== "open") { res.status(200).json({ ok: true, sent: 0 }); return; }

      const result = await sendResponsePush(request, donor || {});
      res.status(200).json({ ok: true, sent: result.sent || 0 });
      return;
    }

    /* closed: only the requester, only once, only after it really closed. */
    const { data: closed } = await admin
      .from("blood_requests")
      .update({ close_notified_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("requester_id", me)
      .in("status", ["fulfilled", "cancelled"])
      .is("close_notified_at", null)
      .select("id, blood_group, hospital, city, status");
    const request = closed?.[0];
    if (!request) { res.status(200).json({ ok: true, sent: 0 }); return; }

    const { data: responses } = await admin
      .from("request_responses")
      .select("responder_id")
      .eq("request_id", requestId);
    const ids = [...new Set((responses || []).map((r) => r.responder_id))].filter((id) => id !== me);

    const result = await sendClosedPush(request, ids);
    res.status(200).json({ ok: true, sent: result.sent || 0 });
  } catch (error) {
    console.error("[raktsetu] notify failed:", error.message);
    res.status(500).json({ error: "Could not send the alert." });
  }
}
