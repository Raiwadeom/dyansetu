/* ============================================================================
   DnyanSetu — Feedback (queries, feature requests, bug reports)

   Anyone can send one through the submit_feedback() function (migration
   0030); only the administrator can read, mark or delete them.
   ========================================================================== */

import { friendlyError, isBackendConfigured, supabase } from "./supabase.js";

export const FEEDBACK_KINDS = [
  { id: "query", label: "Question", labelMr: "प्रश्न" },
  { id: "feature", label: "New feature idea", labelMr: "नवीन सुविधा सुचवा" },
  { id: "bug", label: "Something is broken", labelMr: "काहीतरी बिघडले आहे" },
  { id: "feedback", label: "General feedback", labelMr: "सर्वसाधारण अभिप्राय" },
];
export const kindName = (id) => FEEDBACK_KINDS.find((k) => k.id === id)?.label || "Feedback";
export const MAX_MESSAGE = 1000;
export const MIN_MESSAGE = 10;

export async function sendFeedback({ name, email, kind, message }) {
  if (!isBackendConfigured) throw new Error("Feedback needs a connection to the server. Please try again later.");
  const { error } = await supabase.rpc("submit_feedback", {
    p_name: name || "", p_email: email || "", p_kind: kind, p_message: message,
  });
  if (error) throw new Error(friendlyError(error, "Could not send your message. Please try again."));
}

export async function fetchFeedback() {
  if (!isBackendConfigured) return [];
  const { data, error } = await supabase
    .from("feedback")
    .select("id, name, email, kind, message, status, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(friendlyError(error, "Could not load feedback."));
  return data || [];
}

export async function setFeedbackStatus(id, status) {
  const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
  if (error) throw new Error(friendlyError(error, "Could not save that change."));
}

export async function deleteFeedback(id) {
  const { error } = await supabase.from("feedback").delete().eq("id", id);
  if (error) throw new Error(friendlyError(error, "Could not delete that message."));
}
